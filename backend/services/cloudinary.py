from urllib.parse import urlsplit, urlunsplit

import cloudinary
import cloudinary.uploader
from fastapi import HTTPException, status

from backend.core.config import settings


_configured = False


def ensure_cloudinary_configured() -> None:
    global _configured
    if _configured:
        return
    if not settings.CLOUDINARY_CLOUD_NAME or not settings.CLOUDINARY_API_KEY or not settings.CLOUDINARY_API_SECRET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Cloudinary is not configured on the server",
        )
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
    _configured = True


def upload_avatar(image_bytes: bytes, *, user_id: str) -> str:
    ensure_cloudinary_configured()
    result = cloudinary.uploader.upload(
        image_bytes,
        folder=settings.CLOUDINARY_AVATAR_FOLDER,
        public_id=str(user_id),
        overwrite=True,
        invalidate=True,
        resource_type="image",
        type="upload",
        format="webp",
    )
    secure_url = result.get("secure_url")
    if not secure_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Cloudinary did not return an avatar URL",
        )
    return secure_url


def build_avatar_thumbnail_url(avatar_url: str | None, *, size: int = 128) -> str | None:
    if not avatar_url or "res.cloudinary.com" not in avatar_url:
        return avatar_url

    parts = urlsplit(avatar_url)
    marker = "/upload/"
    if marker not in parts.path:
        return avatar_url

    transformed_path = parts.path.replace(
        marker,
        f"{marker}f_auto,q_auto,c_fill,g_face,w_{size},h_{size}/",
        1,
    )
    return urlunsplit((parts.scheme, parts.netloc, transformed_path, parts.query, parts.fragment))
