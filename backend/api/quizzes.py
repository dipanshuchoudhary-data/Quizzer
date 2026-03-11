import uuid
import secrets
import json
import time
import asyncio
import logging
from collections.abc import AsyncIterator
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.database import get_db
from backend.api.deps import get_current_user
from backend.models.quiz import Quiz
from backend.models.quiz_section import QuizSection
from backend.models.question import Question
from backend.models.ai_job import AIJob
from backend.models.user import User
from backend.workers.quiz_creation_task import create_quiz_ai
from backend.workers.quiz_creation_task import (
    parse_questions_from_source,
    infer_blueprint_sections_from_source,
    pick_from_source,
    extract_questions_verbatim_with_llm,
    extract_all_questions_with_llm,
    enrich_missing_answers,
)
from backend.ai.agents.summarization_agent import summarize_document
from backend.ai.agents.prompt_enchancer_agent import enhance_prompt
from backend.ai.agents.quiz_generator_agent import generate_single_question
from backend.core.config import settings
from backend.services.question_quality import sanitize_question_candidate


router = APIRouter(
    prefix="/quizzes",
    tags=["Quizzes"],
)
logger = logging.getLogger(__name__)


def _normalize_question_type(value: str | None) -> str:
    token = str(value or "").strip().upper().replace("-", "_").replace(" ", "_").replace("/", "_")
    if token in {"TRUEFALSE", "TRUE_FALSE", "BOOLEAN", "TF"}:
        return "TRUE_FALSE"
    if token in {"SHORTANSWER", "SHORT_ANSWER", "SHORTANS", "SA"}:
        return "SHORT_ANSWER"
    if token in {"LONGANSWER", "LONG_ANSWER", "LA"}:
        return "LONG_ANSWER"
    return "MCQ"


def _parse_blueprint_sections(blueprint: dict) -> list[dict]:
    raw = blueprint.get("sections", [])
    if not isinstance(raw, list):
        return []
    parsed: list[dict] = []
    for idx, section in enumerate(raw):
        if not isinstance(section, dict):
            continue
        parsed.append(
            {
                "index": idx,
                "title": str(section.get("title") or f"Section {idx + 1}").strip(),
                "number_of_questions": max(1, int(section.get("numberOfQuestions") or section.get("number_of_questions") or 1)),
                "question_type": _normalize_question_type(section.get("questionType") or section.get("question_type")),
                "marks_per_question": max(1, int(section.get("marksPerQuestion") or section.get("marks_per_question") or 1)),
            }
        )
    return parsed


def _sse_event(event: str, payload: dict) -> str:
    data = json.dumps(payload, ensure_ascii=True, default=str)
    return f"event: {event}\ndata: {data}\n\n"


# --------------------------------------------------
# Create Quiz
# --------------------------------------------------

@router.post("", status_code=201)
@router.post("/", status_code=201)
async def create_quiz(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    academic_type = payload.get("academic_type") or "college"

    if academic_type not in ["college", "school"]:
        raise HTTPException(
            status_code=400,
            detail="academic_type must be 'college' or 'school'",
        )

    quiz = Quiz(
        title=payload.get("title"),
        description=payload.get("description"),
        academic_type=academic_type,
        created_by=current_user.id,
    )

    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)

    return quiz


# --------------------------------------------------
# List Quizzes
# --------------------------------------------------

@router.get("")
@router.get("/")
async def list_quizzes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    result = await db.execute(
        select(Quiz).where(Quiz.created_by == current_user.id)
    )

    quizzes = result.scalars().all()

    return quizzes


# --------------------------------------------------
# Get Quiz Detail
# --------------------------------------------------

@router.get("/{quiz_id}")
async def get_quiz(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    quiz = await db.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this quiz",
        )

    return quiz


# --------------------------------------------------
# Delete Quiz
# --------------------------------------------------

@router.delete("/{quiz_id}")
async def delete_quiz(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    quiz = await db.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this quiz",
        )

    await db.delete(quiz)
    await db.commit()

    return {"message": "Quiz deleted successfully"}


# --------------------------------------------------
# Create Section
# --------------------------------------------------

@router.post("/{quiz_id}/sections", status_code=201)
async def create_section(
    quiz_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    quiz = await db.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.created_by != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to modify this quiz",
        )

    section = QuizSection(
        quiz_id=quiz_id,
        title=payload.get("title"),
        total_marks=payload.get("total_marks"),
    )

    db.add(section)
    await db.commit()
    await db.refresh(section)

    return section


# --------------------------------------------------
# List Sections
# --------------------------------------------------

@router.get("/{quiz_id}/sections")
async def list_sections(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    quiz = await db.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.created_by != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access this quiz",
        )

    result = await db.execute(
        select(QuizSection).where(QuizSection.quiz_id == quiz_id).order_by(QuizSection.created_at.asc())
    )

    return result.scalars().all()


# --------------------------------------------------
# Reorder Sections
# --------------------------------------------------

@router.post("/{quiz_id}/sections/reorder")
async def reorder_sections(
    quiz_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    quiz = await db.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.created_by != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to modify this quiz",
        )

    section_ids = payload.get("section_ids")
    if not isinstance(section_ids, list):
        raise HTTPException(status_code=400, detail="section_ids must be a list")

    result = await db.execute(
        select(QuizSection.id).where(QuizSection.quiz_id == quiz_id)
    )
    existing_ids = {str(section_id) for section_id in result.scalars().all()}

    if set(section_ids) != existing_ids:
        raise HTTPException(
            status_code=400,
            detail="section_ids must contain all quiz section IDs exactly once",
        )

    return {"message": "Sections reordered"}


# --------------------------------------------------
# Trigger AI Quiz Generation
# --------------------------------------------------

@router.post("/{quiz_id}/generate-ai")
@router.post("/{quiz_id}/generate")
async def generate_ai_quiz(
    quiz_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    quiz = await db.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.created_by != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to modify this quiz",
        )

    if quiz.ai_generation_status == "PROCESSING":
        raise HTTPException(
            status_code=400,
            detail="AI generation already in progress",
        )

    extracted_text = payload.get("extracted_text")
    blueprint = payload.get("blueprint")
    professor_note = payload.get("professor_note")

    if not extracted_text or not blueprint:
        raise HTTPException(
            status_code=400,
            detail="extracted_text and blueprint required",
        )

    # Move status immediately so frontend polling is deterministic even
    # when worker startup is delayed.
    quiz.ai_generation_status = "PROCESSING"
    await db.commit()

    create_quiz_ai.delay(
        str(quiz_id),
        extracted_text,
        blueprint,
        professor_note,
    )

    return {"message": "AI generation started"}


@router.post("/{quiz_id}/generate-stream/init")
async def init_ai_quiz_stream(
    quiz_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = await db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if quiz.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this quiz")
    if quiz.ai_generation_status == "PROCESSING":
        raise HTTPException(status_code=400, detail="AI generation already in progress")

    extracted_text = payload.get("extracted_text")
    blueprint = payload.get("blueprint")
    professor_note = payload.get("professor_note")
    if not extracted_text or not blueprint:
        raise HTTPException(status_code=400, detail="extracted_text and blueprint required")

    quiz.ai_generation_status = "PROCESSING"
    job = AIJob(
        quiz_id=quiz_id,
        job_type="QUIZ_CREATION_STREAM",
        status="PENDING",
        meta={
            "extracted_text": extracted_text,
            "blueprint": blueprint,
            "professor_note": professor_note,
        },
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"message": "AI streaming generation initialized", "job_id": str(job.id)}


@router.get("/{quiz_id}/generate-stream")
async def stream_ai_quiz_generation(
    quiz_id: uuid.UUID,
    request: Request,
    job_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = await db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if quiz.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this quiz")

    job = await db.get(AIJob, job_id)
    if not job or job.quiz_id != quiz_id or job.job_type != "QUIZ_CREATION_STREAM":
        raise HTTPException(status_code=404, detail="Stream job not found")
    if not isinstance(job.meta, dict):
        raise HTTPException(status_code=400, detail="Invalid stream metadata")
    if job.status not in {"PENDING", "PROCESSING"}:
        raise HTTPException(status_code=409, detail=f"Stream job is not active (status={job.status})")
    if job.meta.get("stream_started_at"):
        raise HTTPException(status_code=409, detail="Stream already consumed")

    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    job.status = "PROCESSING"
    job.meta = {**job.meta, "request_id": request_id, "stream_started_at": int(time.time())}
    await db.commit()

    extracted_text = str(job.meta.get("extracted_text") or "")
    blueprint = job.meta.get("blueprint") if isinstance(job.meta.get("blueprint"), dict) else {}
    professor_note = job.meta.get("professor_note")
    blueprint_sections = _parse_blueprint_sections(blueprint)
    strict_source_alignment = bool(blueprint.get("strict_source_alignment"))
    auto_detect_structure = bool(blueprint.get("auto_detect_structure"))
    if not blueprint_sections:
        raise HTTPException(status_code=400, detail="Blueprint sections missing or invalid")

    timeout_seconds = int(getattr(settings, "QUIZ_STREAM_TIMEOUT_SECONDS", 300))

    async def event_stream() -> AsyncIterator[str]:
        start = time.perf_counter()
        generated_count = 0
        total_required = sum(section["number_of_questions"] for section in blueprint_sections)
        disconnected = False

        def safe_emit(event_name: str, payload: dict) -> str | None:
            try:
                return _sse_event(event_name, payload)
            except Exception:
                logger.exception(
                    "quiz_stream_emit_error request_id=%s quiz_id=%s job_id=%s event=%s",
                    request_id,
                    quiz_id,
                    job_id,
                    event_name,
                )
                return None

        logger.info("quiz_stream_start request_id=%s quiz_id=%s job_id=%s", request_id, quiz_id, job_id)

        try:
            source_questions = parse_questions_from_source(extracted_text)
            default_5_mcq = (
                len(blueprint_sections) == 1
                and blueprint_sections[0]["number_of_questions"] == 5
                and blueprint_sections[0]["question_type"] == "MCQ"
            )
            if auto_detect_structure and (len(source_questions) <= 5 or default_5_mcq):
                llm_all = await extract_all_questions_with_llm(extracted_text)
                if llm_all:
                    dedup_all_by_text: dict[str, object] = {}
                    for q in [*source_questions, *llm_all]:
                        key = " ".join(str(getattr(q, "question_text", "")).lower().strip().split())
                        if key and key not in dedup_all_by_text:
                            dedup_all_by_text[key] = q
                    source_questions = list(dedup_all_by_text.values())

            if auto_detect_structure and source_questions:
                inferred_sections = infer_blueprint_sections_from_source(source_questions)
                if inferred_sections:
                    requested_total = sum(section["number_of_questions"] for section in blueprint_sections)
                    inferred_total = sum(section["number_of_questions"] for section in inferred_sections)
                    requested_types = {section["question_type"] for section in blueprint_sections}
                    inferred_types = {section["question_type"] for section in inferred_sections}
                    if inferred_total > requested_total or len(inferred_types) > len(requested_types) or default_5_mcq:
                        blueprint_sections[:] = inferred_sections
                        total_required = sum(section["number_of_questions"] for section in blueprint_sections)

            first_chunk = safe_emit(
                "progress",
                {
                    "request_id": request_id,
                    "status": "parsing_source",
                    "generated_count": generated_count,
                    "target_count": total_required,
                    "percent": 5,
                },
            )
            if first_chunk:
                yield first_chunk

            async with asyncio.timeout(timeout_seconds):
                selected_pairs = pick_from_source(source_questions, blueprint_sections)
                counts_needed = sum(section["number_of_questions"] for section in blueprint_sections)

                if strict_source_alignment and len(selected_pairs) < counts_needed:
                    llm_extracted = await extract_questions_verbatim_with_llm(extracted_text, blueprint_sections)
                    dedup_by_text: dict[str, object] = {}
                    for q in [*source_questions, *llm_extracted]:
                        key = " ".join(str(getattr(q, "question_text", "")).lower().strip().split())
                        if key and key not in dedup_by_text:
                            dedup_by_text[key] = q
                    selected_pairs = pick_from_source(list(dedup_by_text.values()), blueprint_sections)

                if selected_pairs:
                    selected_pairs = await enrich_missing_answers(selected_pairs)

                if strict_source_alignment and len(selected_pairs) < counts_needed:
                    raise ValueError("Strict source alignment is ON and source did not satisfy required counts.")

                remaining_total = max(0, counts_needed - len(selected_pairs))
                enhanced = None
                if remaining_total > 0:
                    summary = await summarize_document(extracted_text)
                    if await request.is_disconnected():
                        disconnected = True
                        raise asyncio.CancelledError()

                    progress_chunk = safe_emit(
                        "progress",
                        {
                            "request_id": request_id,
                            "status": "building_prompt",
                            "generated_count": generated_count,
                            "target_count": total_required,
                            "percent": 15,
                        },
                    )
                    if progress_chunk:
                        yield progress_chunk

                    enhanced = await enhance_prompt(
                        summary=summary.summary,
                        source_excerpt=extracted_text[:12000],
                        blueprint=blueprint,
                        professor_note=professor_note,
                    )
                    if await request.is_disconnected():
                        disconnected = True
                        raise asyncio.CancelledError()

                section_result = await db.execute(
                    select(QuizSection).where(QuizSection.quiz_id == quiz_id).order_by(QuizSection.created_at.asc())
                )
                db_sections = section_result.scalars().all()
                if len(db_sections) < len(blueprint_sections):
                    for idx in range(len(db_sections), len(blueprint_sections)):
                        spec = blueprint_sections[idx]
                        missing = QuizSection(
                            quiz_id=quiz_id,
                            title=spec["title"],
                            total_marks=spec["number_of_questions"] * spec["marks_per_question"],
                        )
                        db.add(missing)
                    await db.commit()
                    section_result = await db.execute(
                        select(QuizSection).where(QuizSection.quiz_id == quiz_id).order_by(QuizSection.created_at.asc())
                    )
                    db_sections = section_result.scalars().all()

                generated_per_section: dict[int, int] = {section["index"]: 0 for section in blueprint_sections}
                slot_number = 0

                # Stream source-aligned questions first.
                for section_spec, source_q in selected_pairs:
                    section_index = section_spec["index"]
                    target_section = db_sections[section_index]
                    q_type = section_spec["question_type"]
                    marks = section_spec["marks_per_question"]
                    sanitized = sanitize_question_candidate(
                        question_text=getattr(source_q, "question_text", ""),
                        question_type=q_type,
                        options=getattr(source_q, "options", None),
                        correct_answer=getattr(source_q, "correct_answer", None),
                        marks=marks,
                    )
                    if not sanitized:
                        raise ValueError(f"Invalid source question detected for section '{section_spec['title']}'.")
                    options = sanitized.options
                    correct_answer = str(getattr(sanitized, "correct_answer", "")).strip()

                    if q_type == "TRUE_FALSE":
                        options = ["True", "False"]
                        lowered = correct_answer.lower()
                        if lowered in {"true", "t", "1"}:
                            correct_answer = "True"
                        elif lowered in {"false", "f", "0"}:
                            correct_answer = "False"
                        else:
                            correct_answer = "answer_unavailable"
                    elif q_type in {"SHORT_ANSWER", "LONG_ANSWER"}:
                        options = None
                        correct_answer = ""
                    elif q_type == "MCQ" and not correct_answer:
                        correct_answer = "answer_unavailable"

                    question = Question(
                        quiz_id=quiz_id,
                        section_id=target_section.id,
                        question_text=sanitized.question_text,
                        question_type=q_type,
                        options=options,
                        correct_answer=correct_answer or None,
                        marks=marks,
                        status="DRAFT",
                    )
                    db.add(question)
                    await db.commit()
                    await db.refresh(question)

                    generated_count += 1
                    generated_per_section[section_index] += 1
                    slot_number += 1
                    percent = min(99, 20 + int((generated_count / max(total_required, 1)) * 75))

                    question_chunk = safe_emit(
                        "question",
                        {
                            "request_id": request_id,
                            "generated_count": generated_count,
                            "target_count": total_required,
                            "question": {
                                "id": str(question.id),
                                "section_id": str(question.section_id),
                                "question_text": question.question_text,
                                "question_type": question.question_type,
                                "difficulty": question.difficulty,
                                "options": question.options,
                                "correct_answer": question.correct_answer,
                                "marks": question.marks,
                                "status": question.status,
                            },
                        },
                    )
                    if question_chunk:
                        yield question_chunk
                    per_question_progress = safe_emit(
                        "progress",
                        {
                            "request_id": request_id,
                            "status": "streaming_source_questions",
                            "generated_count": generated_count,
                            "target_count": total_required,
                            "percent": percent,
                        },
                    )
                    if per_question_progress:
                        yield per_question_progress

                # Fill remaining slots with AI generation only when needed.
                for section in blueprint_sections:
                    section_index = section["index"]
                    target_section = db_sections[section_index]
                    q_type = section["question_type"]
                    marks = section["marks_per_question"]
                    remaining = max(0, section["number_of_questions"] - generated_per_section.get(section_index, 0))
                    for _ in range(remaining):
                        if await request.is_disconnected():
                            disconnected = True
                            raise asyncio.CancelledError()

                        slot_number += 1
                        if enhanced is None:
                            raise ValueError("Prompt enhancer output missing for fallback generation.")
                        sanitized = None
                        for _attempt in range(3):
                            generated = await generate_single_question(
                                enhanced_prompt=enhanced.enhanced_prompt,
                                question_type=q_type,
                                marks=marks,
                                section_title=section["title"],
                                question_number=slot_number,
                                total_questions=total_required,
                            )
                            sanitized = sanitize_question_candidate(
                                question_text=generated.question_text,
                                question_type=q_type,
                                options=generated.options,
                                correct_answer=generated.correct_answer,
                                marks=marks,
                            )
                            if sanitized:
                                break
                        if not sanitized:
                            raise ValueError(f"Failed to generate a valid {q_type} question for section '{section['title']}'.")

                        options = sanitized.options
                        correct_answer = (sanitized.correct_answer or "").strip()
                        if q_type == "TRUE_FALSE":
                            options = ["True", "False"]
                            lowered = correct_answer.lower()
                            if lowered in {"true", "t", "1"}:
                                correct_answer = "True"
                            elif lowered in {"false", "f", "0"}:
                                correct_answer = "False"
                            else:
                                correct_answer = "answer_unavailable"
                        elif q_type in {"SHORT_ANSWER", "LONG_ANSWER"}:
                            options = None
                            correct_answer = ""
                        elif q_type == "MCQ" and not correct_answer:
                            correct_answer = "answer_unavailable"

                        question = Question(
                            quiz_id=quiz_id,
                            section_id=target_section.id,
                            question_text=sanitized.question_text,
                            question_type=q_type,
                            options=options,
                            correct_answer=correct_answer or None,
                            marks=marks,
                            status="DRAFT",
                        )
                        db.add(question)
                        await db.commit()
                        await db.refresh(question)

                        generated_count += 1
                        percent = min(99, 20 + int((generated_count / max(total_required, 1)) * 75))

                        question_chunk = safe_emit(
                            "question",
                            {
                                "request_id": request_id,
                                "generated_count": generated_count,
                                "target_count": total_required,
                                "question": {
                                    "id": str(question.id),
                                    "section_id": str(question.section_id),
                                    "question_text": question.question_text,
                                    "question_type": question.question_type,
                                    "difficulty": question.difficulty,
                                    "options": question.options,
                                    "correct_answer": question.correct_answer,
                                    "marks": question.marks,
                                    "status": question.status,
                                },
                            },
                        )
                        if question_chunk:
                            yield question_chunk
                        per_question_progress = safe_emit(
                            "progress",
                            {
                                "request_id": request_id,
                                "status": "generating_questions",
                                "generated_count": generated_count,
                                "target_count": total_required,
                                "percent": percent,
                            },
                        )
                        if per_question_progress:
                            yield per_question_progress

                quiz.ai_generation_status = "GENERATED"
                job.status = "COMPLETED"
                job.meta = {
                    **(job.meta or {}),
                    "generated_count": generated_count,
                    "completed_at": int(time.time()),
                }
                await db.commit()

                elapsed_ms = int((time.perf_counter() - start) * 1000)
                logger.info(
                    "quiz_stream_complete request_id=%s quiz_id=%s job_id=%s generated=%s elapsed_ms=%s",
                    request_id,
                    quiz_id,
                    job_id,
                    generated_count,
                    elapsed_ms,
                )
                complete_chunk = safe_emit(
                    "complete",
                    {
                        "request_id": request_id,
                        "generated_count": generated_count,
                        "target_count": total_required,
                        "elapsed_ms": elapsed_ms,
                    },
                )
                if complete_chunk:
                    yield complete_chunk
        except asyncio.TimeoutError:
            quiz.ai_generation_status = "FAILED"
            job.status = "FAILED"
            job.meta = {**(job.meta or {}), "error": "stream_timeout"}
            await db.commit()
            logger.error("quiz_stream_timeout request_id=%s quiz_id=%s job_id=%s", request_id, quiz_id, job_id)
            if not disconnected:
                timeout_chunk = safe_emit("error", {"request_id": request_id, "message": "Generation timed out. Please retry."})
                if timeout_chunk:
                    yield timeout_chunk
        except asyncio.CancelledError:
            job.status = "ABORTED"
            if generated_count == 0:
                quiz.ai_generation_status = "FAILED"
            else:
                quiz.ai_generation_status = "GENERATED"
            job.meta = {**(job.meta or {}), "aborted_at": int(time.time()), "generated_count": generated_count}
            await db.commit()
            logger.warning(
                "quiz_stream_aborted request_id=%s quiz_id=%s job_id=%s generated=%s",
                request_id,
                quiz_id,
                job_id,
                generated_count,
            )
        except Exception as exc:
            quiz.ai_generation_status = "FAILED"
            job.status = "FAILED"
            job.meta = {**(job.meta or {}), "error": str(exc)}
            await db.commit()
            logger.exception("quiz_stream_error request_id=%s quiz_id=%s job_id=%s", request_id, quiz_id, job_id)
            if not disconnected:
                err_chunk = safe_emit("error", {"request_id": request_id, "message": "Generation failed. Please retry."})
                if err_chunk:
                    yield err_chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{quiz_id}/source-references")
async def get_quiz_source_references(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz = await db.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.created_by != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to access this quiz",
        )

    result = await db.execute(
        select(AIJob)
        .where(AIJob.quiz_id == quiz_id, AIJob.job_type == "QUIZ_CREATION")
        .order_by(AIJob.created_at.desc())
    )
    latest = result.scalars().first()
    references = []
    if latest and isinstance(latest.meta, dict):
        payload_refs = latest.meta.get("source_references", [])
        if isinstance(payload_refs, list):
            references = payload_refs

    return {"items": references}


# --------------------------------------------------
# List Quiz Questions
# --------------------------------------------------

@router.get("/{quiz_id}/questions")
async def list_quiz_questions(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    quiz = await db.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this quiz",
        )

    result = await db.execute(
        select(Question).where(Question.quiz_id == quiz_id)
    )

    return result.scalars().all()


# --------------------------------------------------
# Publish Quiz
# --------------------------------------------------

@router.post("/{quiz_id}/publish")
async def publish_quiz(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    quiz = await db.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.created_by != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to publish this quiz",
        )

    result = await db.execute(
        select(Question).where(
            Question.quiz_id == quiz_id,
            Question.status != "APPROVED",
        )
    )

    unapproved = result.scalars().first()

    if unapproved:
        raise HTTPException(
            status_code=400,
            detail="All questions must be approved before publishing",
        )

    if not quiz.public_slug:
        quiz.public_slug = secrets.token_urlsafe(9).replace("-", "").replace("_", "")

    quiz.is_published = True
    quiz.ai_generation_status = "PUBLISHED"

    await db.commit()

    return {
        "message": "Quiz published successfully",
        "public_slug": quiz.public_slug,
        "public_url": f"/quiz/{quiz.public_slug}",
    }


@router.post("/{quiz_id}/unpublish")
async def unpublish_quiz(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    quiz = await db.get(Quiz, quiz_id)

    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if quiz.created_by != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to unpublish this quiz",
        )

    quiz.is_published = False
    quiz.public_slug = None

    if quiz.ai_generation_status == "PUBLISHED":
        quiz.ai_generation_status = "APPROVED"

    await db.commit()

    return {"message": "Quiz unpublished successfully"}
