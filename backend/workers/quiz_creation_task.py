import asyncio

from sqlalchemy import select

from backend.workers.celery_app import celery_app
from backend.ai.graphs.quiz_creation_graph import build_quiz_creation_graph
from backend.core.database import SessionLocal   # ✅ FIXED

from backend.models.quiz import Quiz
from backend.models.quiz_section import QuizSection
from backend.models.question import Question
from backend.models.ai_job import AIJob


@celery_app.task(name="create_quiz_ai")
def create_quiz_ai(
    quiz_id: str,
    extracted_text: str,
    blueprint: dict,
    professor_note: str | None,
):

    async def _run():

        graph = build_quiz_creation_graph()

        async with SessionLocal() as db:   # ✅ FIXED

            # -----------------------------
            # Create AI Job
            # -----------------------------
            job = AIJob(
                quiz_id=quiz_id,
                job_type="QUIZ_CREATION",
                status="PROCESSING",
            )
            db.add(job)
            await db.commit()
            await db.refresh(job)

            try:

                # -----------------------------
                # Load Quiz
                # -----------------------------
                quiz = await db.get(Quiz, quiz_id)

                if not quiz:
                    raise ValueError("Quiz not found")

                quiz.ai_generation_status = "PROCESSING"
                await db.commit()

                # -----------------------------
                # Run Graph
                # -----------------------------
                result = await graph.ainvoke(
                    {
                        "extracted_text": extracted_text,
                        "blueprint": blueprint,
                        "professor_note": professor_note,
                    }
                )

                # -----------------------------
                # Get Section
                # -----------------------------
                section_result = await db.execute(
                    select(QuizSection).where(
                        QuizSection.quiz_id == quiz_id
                    )
                )
                section = section_result.scalars().first()

                if not section:
                    raise ValueError("Quiz section not found")

                # -----------------------------
                # Persist Questions
                # -----------------------------
                for q in result["questions"]:

                    question = Question(
                        section_id=section.id,
                        question_text=q.question_text,
                        question_type=q.question_type,
                        options=q.options,
                        correct_answer=q.correct_answer,
                        marks=q.marks,
                        status="DRAFT",
                    )

                    db.add(question)

                # -----------------------------
                # Final Status Updates
                # -----------------------------
                quiz.ai_generation_status = "GENERATED"
                job.status = "COMPLETED"

                await db.commit()

            except Exception as e:

                job.status = "FAILED"
                job.metadata = {"error": str(e)}

                await db.commit()
                raise

    asyncio.run(_run())
