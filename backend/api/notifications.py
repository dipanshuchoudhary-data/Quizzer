from fastapi import APIRouter, Depends, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, require_staff
from backend.core.database import get_db
from backend.models.notification_message import NotificationMessage
from backend.models.notification_read import NotificationRead
from backend.models.user import User
from backend.schemas.notification import NotificationBroadcastRequest


router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _serialize_notification(row) -> dict:
    return {
        "id": str(row.id),
        "title": row.title,
        "description": row.description,
        "category": row.category,
        "created_at": row.created_at,
        "read": bool(row.read_at),
    }


@router.get("")
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    unread_count = int(
        (
            await db.execute(
                select(func.count(NotificationMessage.id))
                .select_from(NotificationMessage)
                .outerjoin(
                    NotificationRead,
                    and_(
                        NotificationRead.notification_id == NotificationMessage.id,
                        NotificationRead.user_id == current_user.id,
                    ),
                )
                .where(
                    NotificationMessage.is_active.is_(True),
                    NotificationRead.id.is_(None),
                )
            )
        ).scalar()
        or 0
    )

    rows = (
        await db.execute(
            select(
                NotificationMessage.id,
                NotificationMessage.title,
                NotificationMessage.description,
                NotificationMessage.category,
                NotificationMessage.created_at,
                NotificationRead.read_at,
            )
            .select_from(NotificationMessage)
            .outerjoin(
                NotificationRead,
                and_(
                    NotificationRead.notification_id == NotificationMessage.id,
                    NotificationRead.user_id == current_user.id,
                ),
            )
            .where(NotificationMessage.is_active.is_(True))
            .order_by(NotificationMessage.created_at.desc())
            .limit(50)
        )
    ).all()

    return {
        "items": [_serialize_notification(row) for row in rows],
        "unread_count": unread_count,
    }


@router.get("/unread-count")
async def get_unread_notification_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    unread_count = int(
        (
            await db.execute(
                select(func.count(NotificationMessage.id))
                .select_from(NotificationMessage)
                .outerjoin(
                    NotificationRead,
                    and_(
                        NotificationRead.notification_id == NotificationMessage.id,
                        NotificationRead.user_id == current_user.id,
                    ),
                )
                .where(
                    NotificationMessage.is_active.is_(True),
                    NotificationRead.id.is_(None),
                )
            )
        ).scalar()
        or 0
    )
    return {"unread_count": unread_count}


@router.post("/read-all", status_code=status.HTTP_200_OK)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    unread_ids = list(
        (
            await db.execute(
                select(NotificationMessage.id)
                .select_from(NotificationMessage)
                .outerjoin(
                    NotificationRead,
                    and_(
                        NotificationRead.notification_id == NotificationMessage.id,
                        NotificationRead.user_id == current_user.id,
                    ),
                )
                .where(
                    NotificationMessage.is_active.is_(True),
                    NotificationRead.id.is_(None),
                )
            )
        ).scalars()
    )

    if unread_ids:
        db.add_all(
            [
                NotificationRead(user_id=current_user.id, notification_id=notification_id)
                for notification_id in unread_ids
            ]
        )
        await db.commit()

    return {"success": True}


@router.post("/broadcast", status_code=status.HTTP_201_CREATED)
async def create_broadcast_notification(
    payload: NotificationBroadcastRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    notification = NotificationMessage(
        title=payload.title,
        description=payload.description,
        category=payload.category,
        created_by=current_user.id,
    )
    db.add(notification)
    await db.commit()
    await db.refresh(notification)

    return {
        "id": str(notification.id),
        "title": notification.title,
        "description": notification.description,
        "category": notification.category,
        "created_at": notification.created_at,
        "read": False,
    }
