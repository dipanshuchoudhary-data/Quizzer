from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.auth import serialize_user
from backend.api.deps import get_current_user
from backend.core.database import get_db
from backend.models.user import User
from backend.schemas.user import UserProfileUpdateRequest


router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@router.put("/profile")
async def update_profile(
    payload: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    updates = payload.model_dump(exclude_unset=True)

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
    await db.commit()
    await db.refresh(current_user)
    return serialize_user(current_user)
