from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


NotificationCategory = Literal["update", "announcement", "alert"]


class NotificationBroadcastRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=160)
    description: str = Field(..., min_length=1, max_length=800)
    category: NotificationCategory = "announcement"

    @field_validator("title", "description")
    @classmethod
    def strip_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field is required")
        return cleaned


class NotificationItem(BaseModel):
    id: str
    title: str
    description: str
    category: NotificationCategory
    created_at: datetime
    read: bool


class NotificationListResponse(BaseModel):
    items: list[NotificationItem]
    unread_count: int
