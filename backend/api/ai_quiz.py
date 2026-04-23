import asyncio
import logging
import uuid
import urllib.request
from html.parser import HTMLParser
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.api.deps import get_current_user
from backend.api.quizzes import generate_ai_quiz
from backend.core.database import get_db
from backend.core.redis import cache_get_json, cache_set_json
from backend.models.document import Document
from backend.models.quiz import Quiz
from backend.models.user import User
from backend.utils.file_utils import save_upload_file
from backend.services.task_dispatcher import dispatch_document_task
from backend.integrations.youtube import (
    is_youtube_url,
    extract_video_id,
    fetch_video_metadata,
    fetch_transcript,
    classify_transcript,
    filter_by_time_range,
    summarize_chunks_full_video,
    YouTubeTranscriptError,
    TranscriptTooLargeError,
)


router = APIRouter(prefix="/ai/quiz", tags=["AI Quiz"])
logger = logging.getLogger(__name__)


class _HTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self._chunks: list[str] = []

    def handle_data(self, data: str) -> None:
        if data and data.strip():
            self._chunks.append(data.strip())

    def get_text(self) -> str:
        return " ".join(self._chunks)


def _cache_key(quiz_id: str) -> str:
    return f"ai:quiz:source:{quiz_id}"


async def _get_quiz_or_404(quiz_id: uuid.UUID, db: AsyncSession, current_user: User) -> Quiz:
    quiz = await db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    if quiz.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this quiz")
    return quiz


async def _load_sources(quiz_id: str) -> dict:
    cached = await cache_get_json(_cache_key(quiz_id))
    if isinstance(cached, dict):
        return cached
    return {"text_sources": [], "url_sources": [], "file_sources": []}


async def _save_sources(quiz_id: str, sources: dict) -> None:
    await cache_set_json(_cache_key(quiz_id), sources, ttl_seconds=6 * 60 * 60)


def _fetch_url_content(url: str) -> str:
    with urllib.request.urlopen(url, timeout=10) as response:
        raw = response.read().decode("utf-8", errors="ignore")
    parser = _HTMLTextExtractor()
    parser.feed(raw)
    return parser.get_text()


def _normalize_question_type_strict(value: str | None) -> str | None:
    token = str(value or "").strip().upper().replace("-", "_").replace(" ", "_").replace("/", "_")
    aliases = {
        "MCQ": "MCQ",
        "TRUEFALSE": "TRUE_FALSE",
        "TRUE_FALSE": "TRUE_FALSE",
        "BOOLEAN": "TRUE_FALSE",
        "TF": "TRUE_FALSE",
        "SHORTANSWER": "SHORT_ANSWER",
        "SHORT_ANSWER": "SHORT_ANSWER",
        "SHORTANS": "SHORT_ANSWER",
        "SA": "SHORT_ANSWER",
        "LONGANSWER": "LONG_ANSWER",
        "LONG_ANSWER": "LONG_ANSWER",
        "LA": "LONG_ANSWER",
    }
    return aliases.get(token)


def _normalize_blueprint_sections(blueprint: dict) -> list[dict]:
    sections = blueprint.get("sections", [])
    if not isinstance(sections, list) or len(sections) == 0:
        raise HTTPException(status_code=422, detail="blueprint.sections must be a non-empty list")

    normalized_sections: list[dict] = []
    for idx, section in enumerate(sections):
        if not isinstance(section, dict):
            raise HTTPException(status_code=422, detail=f"Section {idx + 1}: must be an object")

        raw_count = section.get("number_of_questions") or section.get("numberOfQuestions") or 1
        try:
            number_of_questions = int(raw_count)
        except (TypeError, ValueError) as exc:
            raise HTTPException(status_code=422, detail=f"Section {idx + 1}: number_of_questions must be an integer") from exc
        if number_of_questions <= 0:
            raise HTTPException(status_code=422, detail=f"Section {idx + 1}: number_of_questions must be greater than 0")

        raw_types = section.get("question_types")
        legacy_type = section.get("questionType") or section.get("question_type")
        if raw_types is None:
            raw_types = [legacy_type] if legacy_type is not None else ["MCQ"]

        if not isinstance(raw_types, list):
            raise HTTPException(status_code=422, detail=f"Section {idx + 1}: question_types must be a list")
        if len(raw_types) == 0:
            raise HTTPException(status_code=422, detail=f"Section {idx + 1}: question_types must not be empty")

        normalized_types: list[str] = []
        for raw_type in raw_types:
            normalized = _normalize_question_type_strict(str(raw_type))
            if not normalized:
                raise HTTPException(status_code=422, detail=f"Section {idx + 1}: invalid question type '{raw_type}'")
            if normalized not in normalized_types:
                normalized_types.append(normalized)

        if len(normalized_types) == 0:
            raise HTTPException(status_code=422, detail=f"Section {idx + 1}: question_types must not be empty")

        normalized_sections.append(
            {
                **section,
                "number_of_questions": number_of_questions,
                "question_types": normalized_types,
            }
        )

    return normalized_sections


@router.post("/source/text")
async def add_text_source(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz_id = payload.get("quiz_id")
    text = payload.get("text")
    if not quiz_id or not text:
        raise HTTPException(status_code=400, detail="quiz_id and text required")
    try:
        quiz_uuid = uuid.UUID(str(quiz_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid quiz_id") from exc
    await _get_quiz_or_404(quiz_uuid, db, current_user)

    sources = await _load_sources(str(quiz_uuid))
    source_id = str(uuid.uuid4())
    sources["text_sources"].append(
        {
            "id": source_id,
            "text": text,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    await _save_sources(str(quiz_uuid), sources)
    return {"source_id": source_id, "status": "stored"}


@router.post("/source/url")
async def add_url_source(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz_id = payload.get("quiz_id")
    urls = payload.get("urls") or []
    if payload.get("url"):
        urls = [payload.get("url")]
    if not quiz_id or not isinstance(urls, list) or len(urls) == 0:
        raise HTTPException(status_code=400, detail="quiz_id and urls required")
    try:
        quiz_uuid = uuid.UUID(str(quiz_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid quiz_id") from exc
    await _get_quiz_or_404(quiz_uuid, db, current_user)

    sources = await _load_sources(str(quiz_uuid))
    added = []

    for url in urls:
        url = str(url)

        # ------------------------------------------------------------------ #
        # YouTube path                                                         #
        # ------------------------------------------------------------------ #
        if is_youtube_url(url):
            video_id = extract_video_id(url)
            if not video_id:
                raise HTTPException(status_code=400, detail=f"Could not extract YouTube video ID from: {url}")

            # Fetch metadata (non-blocking via thread pool)
            loop = asyncio.get_event_loop()
            try:
                metadata = await loop.run_in_executor(None, fetch_video_metadata, video_id)
            except Exception as exc:
                logger.warning("youtube_metadata_error", url=url, error=str(exc))
                metadata = {"title": f"YouTube video ({video_id})", "duration_seconds": 0}

            # Fetch transcript
            try:
                segments = await loop.run_in_executor(None, fetch_transcript, video_id)
            except YouTubeTranscriptError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail="No captions found. Please paste the transcript manually.",
                ) from exc

            full_text, size_class = classify_transcript(segments)

            if size_class == "DIRECT":
                # Store directly as a normal source
                source_id = str(uuid.uuid4())
                sources["url_sources"].append(
                    {
                        "id": source_id,
                        "url": url,
                        "text": full_text,
                        "title": metadata["title"],
                        "duration_seconds": metadata["duration_seconds"],
                        "video_id": video_id,
                        "source_type": "youtube_direct",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                )
                await _save_sources(str(quiz_uuid), sources)
                added.append(source_id)
            else:
                # Long/huge video — ask the user to choose
                return {
                    "status": "CHOICE_REQUIRED",
                    "video_id": video_id,
                    "title": metadata["title"],
                    "duration": metadata["duration_seconds"],
                    "transcript_size": size_class,
                }

        # ------------------------------------------------------------------ #
        # Regular URL path (unchanged)                                         #
        # ------------------------------------------------------------------ #
        else:
            try:
                content = _fetch_url_content(url)
            except Exception as exc:
                raise HTTPException(status_code=400, detail=f"Failed to fetch {url}: {exc}") from exc
            source_id = str(uuid.uuid4())
            sources["url_sources"].append(
                {
                    "id": source_id,
                    "url": url,
                    "text": content[:60000],
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            added.append(source_id)

    await _save_sources(str(quiz_uuid), sources)
    return {"source_id": added[0] if added else "", "status": "stored"}


# --------------------------------------------------------------------------- #
# YouTube long-video resolution endpoint                                       #
# --------------------------------------------------------------------------- #

@router.post("/source/youtube/confirm")
async def confirm_youtube_source(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Resolve a CHOICE_REQUIRED YouTube video.

    Payload:
        quiz_id       – existing quiz ID
        video_id      – YouTube video ID (11 chars)
        mode          – "time_range" | "full_video"
        start_seconds – (time_range only) start of range in seconds
        end_seconds   – (time_range only) end of range in seconds
    """
    quiz_id = payload.get("quiz_id")
    video_id = payload.get("video_id")
    mode = payload.get("mode")

    if not quiz_id or not video_id or mode not in ("time_range", "full_video"):
        raise HTTPException(
            status_code=400,
            detail="quiz_id, video_id, and mode (time_range|full_video) are required",
        )

    try:
        quiz_uuid = uuid.UUID(str(quiz_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid quiz_id") from exc
    await _get_quiz_or_404(quiz_uuid, db, current_user)

    loop = asyncio.get_event_loop()

    # Fetch transcript once
    try:
        segments = await loop.run_in_executor(None, fetch_transcript, video_id)
    except YouTubeTranscriptError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="No captions found. Please paste the transcript manually.",
        ) from exc

    # Metadata for storing
    try:
        metadata = await loop.run_in_executor(None, fetch_video_metadata, video_id)
    except Exception:
        metadata = {"title": f"YouTube video ({video_id})", "duration_seconds": 0}

    youtube_url = f"https://www.youtube.com/watch?v={video_id}"

    if mode == "time_range":
        start_sec = float(payload.get("start_seconds") or 0)
        end_sec = float(payload.get("end_seconds") or 0)
        if end_sec <= start_sec:
            raise HTTPException(status_code=400, detail="end_seconds must be greater than start_seconds")

        try:
            text = await loop.run_in_executor(
                None, lambda: filter_by_time_range(segments, start_sec, end_sec)
            )
        except TranscriptTooLargeError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        source_type = "youtube_time_range"
        note = f"Time range {int(start_sec // 60)}:{int(start_sec % 60):02d} – {int(end_sec // 60)}:{int(end_sec % 60):02d}"

    else:  # full_video
        text = await summarize_chunks_full_video(segments)
        source_type = "youtube_chunked_summary"
        note = "Full-video study guide (chunked summarisation)"

    sources = await _load_sources(str(quiz_uuid))
    source_id = str(uuid.uuid4())
    sources["url_sources"].append(
        {
            "id": source_id,
            "url": youtube_url,
            "text": text,
            "title": metadata["title"],
            "duration_seconds": metadata["duration_seconds"],
            "video_id": video_id,
            "source_type": source_type,
            "note": note,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    await _save_sources(str(quiz_uuid), sources)
    return {"source_id": source_id, "status": "stored"}



@router.post("/source/files")
async def add_file_sources(
    quiz_id: str = Form(...),
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        quiz_uuid = uuid.UUID(str(quiz_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid quiz_id") from exc
    await _get_quiz_or_404(quiz_uuid, db, current_user)

    documents: list[dict] = []
    for upload in files:
        extension = upload.filename.split(".")[-1].lower()
        if extension not in ["pdf", "docx", "pptx", "txt", "png", "jpg", "jpeg"]:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        saved_path = save_upload_file(upload, str(quiz_uuid))
        document = Document(
            quiz_id=quiz_uuid,
            file_name=upload.filename,
            file_type=extension,
            storage_path=saved_path,
            extraction_status="PENDING",
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)

        # Dispatch document processing task
        await dispatch_document_task(str(document.id))

        documents.append({"id": str(document.id), "file_name": document.file_name})

    sources = await _load_sources(str(quiz_uuid))
    sources["file_sources"].extend([doc["id"] for doc in documents])
    await _save_sources(str(quiz_uuid), sources)
    return {"documents": documents}


@router.get("/source/files/{quiz_id}")
async def list_file_sources(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_quiz_or_404(quiz_id, db, current_user)
    result = await db.execute(select(Document).where(Document.quiz_id == quiz_id))
    documents = result.scalars().all()
    return {"documents": documents}


@router.post("/generate")
async def generate_quiz_from_sources(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    quiz_id = payload.get("quiz_id")
    blueprint = payload.get("blueprint")
    professor_note = payload.get("professor_note")
    source_mode = payload.get("source_mode")
    if not quiz_id or not blueprint:
        raise HTTPException(status_code=400, detail="quiz_id and blueprint required")

    quiz_uuid = uuid.UUID(str(quiz_id))
    await _get_quiz_or_404(quiz_uuid, db, current_user)

    sources = await _load_sources(str(quiz_uuid))
    texts: list[str] = []
    texts.extend([entry.get("text", "") for entry in sources.get("text_sources", [])])
    texts.extend([entry.get("text", "") for entry in sources.get("url_sources", [])])

    documents = (
        await db.execute(select(Document).where(Document.quiz_id == quiz_uuid))
    ).scalars().all()
    pending = [doc for doc in documents if doc.extraction_status != "COMPLETED"]
    if pending and source_mode == "files":
        raise HTTPException(status_code=409, detail="Documents still processing")
    for doc in documents:
        extracted = (doc.extracted_metadata or {}).get("extracted_text")
        if extracted:
            texts.append(str(extracted))

    extracted_text = "\n\n".join([text for text in texts if text]).strip()
    if not extracted_text:
        raise HTTPException(status_code=400, detail="No source content available")

    blueprint = dict(blueprint)
    blueprint["sections"] = _normalize_blueprint_sections(blueprint)
    if source_mode:
        blueprint["source_mode"] = source_mode
    source_refs = [entry.get("url") for entry in sources.get("url_sources", []) if entry.get("url")]
    if source_refs:
        blueprint["source_references"] = source_refs

    return await generate_ai_quiz(
        quiz_id=quiz_uuid,
        payload={
            "extracted_text": extracted_text,
            "blueprint": blueprint,
            "professor_note": professor_note,
        },
        db=db,
        current_user=current_user,
    )
