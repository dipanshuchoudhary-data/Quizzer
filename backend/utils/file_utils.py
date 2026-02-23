import os
import uuid
from pathlib import Path
from fastapi import UploadFile, HTTPException


# --------------------------------------------------
# Config
# --------------------------------------------------

BASE_UPLOAD_DIR = Path("uploads")
BASE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE_MB = 20
ALLOWED_EXTENSIONS = {"pdf", "docx", "pptx", "png", "jpg", "jpeg"}


# --------------------------------------------------
# Helpers
# --------------------------------------------------

def _validate_extension(filename: str) -> str:
    extension = filename.split(".")[-1].lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type",
        )

    return extension


def _validate_size(file: UploadFile):
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)

    if size > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds {MAX_FILE_SIZE_MB}MB limit",
        )


# --------------------------------------------------
# Main Save Function
# --------------------------------------------------

def save_upload_file(file: UploadFile, quiz_id: str) -> str:
    """
    Save uploaded file securely.
    Returns storage path.
    """

    extension = _validate_extension(file.filename)
    _validate_size(file)

    quiz_dir = BASE_UPLOAD_DIR / quiz_id
    quiz_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid.uuid4()}.{extension}"
    filepath = quiz_dir / filename

    with open(filepath, "wb") as buffer:
        while chunk := file.file.read(1024 * 1024):
            buffer.write(chunk)

    return str(filepath)
