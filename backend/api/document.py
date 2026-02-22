import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.database import get_db
from backend.api.deps import require_staff
from backend.models.quiz import Quiz
from backend.models.document import Document
from backend.utils.file_utils import save_upload_file
from backend.workers.document_task import process_document


router = APIRouter(prefix="/documents", tags=["Documents"])


# --------------------------------------------------
# Upload Document
# --------------------------------------------------

@router.post("/{quiz_id}/upload")
async def upload_document(
    quiz_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_staff),
):

    quiz = await db.get(Quiz, quiz_id)
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    extension = file.filename.split(".")[-1].lower()

    if extension not in ["pdf", "docx", "pptx", "png", "jpg", "jpeg"]:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type",
        )

    saved_path = save_upload_file(file, str(quiz_id))

    document = Document(
        quiz_id=quiz_id,
        file_name=file.filename,
        file_type=extension,
        storage_path=saved_path,
        extraction_status="PENDING",
    )

    db.add(document)
    await db.commit()
    await db.refresh(document)

    process_document.delay(str(document.id))

    return {
        "message": "File uploaded. Processing started.",
        "document_id": document.id,
    }


# --------------------------------------------------
# List Documents for Quiz
# --------------------------------------------------

@router.get("/{quiz_id}")
async def list_documents(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_staff),
):

    result = await db.execute(
        select(Document).where(Document.quiz_id == quiz_id)
    )

    return result.scalars().all()


# --------------------------------------------------
# Get Document Detail
# --------------------------------------------------

@router.get("/detail/{document_id}")
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_staff),
):

    document = await db.get(Document, document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    return document


# --------------------------------------------------
# Delete Document
# --------------------------------------------------

@router.delete("/{document_id}")
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(require_staff),
):

    document = await db.get(Document, document_id)

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.delete(document)
    await db.commit()

    return {"message": "Document deleted"}
