import logging
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.auth import serialize_user
from backend.api.deps import get_current_user
from backend.core.database import get_db
from backend.models.user import User
from backend.schemas.user import UserProfileUpdateRequest
from backend.services.cloudinary import upload_avatar


router = APIRouter(prefix="/users", tags=["Users"])
logger = logging.getLogger(__name__)
MAX_AVATAR_SIZE_BYTES = 1024 * 1024
MAX_AVATAR_DIMENSION = 1024
ALLOWED_AVATAR_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}


@router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@router.put("/profile")
@router.patch("/profile")
async def update_profile(
    payload: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updates = payload.model_dump(exclude_unset=True)
    display_name = updates.pop("display_name", None)
    if display_name is not None:
        updates["full_name"] = display_name.strip()

    for field in ["full_name", "institution", "country", "timezone", "subject_area", "courses_taught", "teaching_experience"]:
        if field in updates and updates[field] is not None:
            updates[field] = updates[field].strip() or None
    if "avatar_url" in updates and updates["avatar_url"] is not None:
        updates["avatar_url"] = updates["avatar_url"].strip() or None
    if "email" in updates and updates["email"] is not None:
        updates["email"] = updates["email"].strip().lower()

    if "email" in updates and updates["email"] != current_user.email:
        existing_user = await db.execute(select(User).where(User.email == updates["email"]))
        if existing_user.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = updates["email"]
        current_user.is_verified = False

    if "phone_number" in updates and updates["phone_number"] != current_user.phone_number:
        existing_phone = await db.execute(select(User).where(User.phone_number == updates["phone_number"]))
        if existing_phone.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Phone number already in use")

    for field, value in updates.items():
        setattr(current_user, field, value)

    if any(key in updates for key in ["subject_area", "courses_taught", "teaching_experience", "institution", "country", "timezone"]):
        current_user.onboarding_completed = bool(
            current_user.subject_area and current_user.courses_taught and current_user.teaching_experience
        )

    db.add(current_user)
    try:
        await db.commit()
        await db.refresh(current_user)
    except Exception as exc:
        await db.rollback()
        logger.exception("profile_update_failed user_id=%s", current_user.id)
        raise HTTPException(status_code=500, detail="Unable to update profile right now") from exc

    logger.info("profile_updated user_id=%s full_name=%s", current_user.id, current_user.full_name)
    return serialize_user(current_user)


@router.post("/profile/avatar")
async def upload_profile_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ALLOWED_AVATAR_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported avatar type")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Avatar file is empty")
    if len(contents) > MAX_AVATAR_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Compressed avatar must be 1MB or smaller")

    try:
        image = Image.open(BytesIO(contents))
        width, height = image.size
        image.verify()
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Invalid image file") from exc

    if max(width, height) > MAX_AVATAR_DIMENSION:
        raise HTTPException(status_code=400, detail="Avatar dimensions exceed server limit")

    try:
        current_user.avatar_url = upload_avatar(contents, user_id=str(current_user.id))
        db.add(current_user)
        await db.commit()
        await db.refresh(current_user)
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        logger.exception("profile_avatar_upload_failed user_id=%s", current_user.id)
        raise HTTPException(status_code=502, detail="Avatar upload failed") from exc

    logger.info("profile_avatar_uploaded user_id=%s avatar_url=%s", current_user.id, current_user.avatar_url)
    return serialize_user(current_user)
