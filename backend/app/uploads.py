import io
import urllib.request
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import settings

ALLOWED = {"image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/webp"}
Image.MAX_IMAGE_PIXELS = 60_000_000


async def save_image(file: UploadFile, folder: str, max_side: int = 1920, quality: int = 84) -> str:
    """Rasmni tekshiradi, o'lchamini kichraytiradi, EXIF ni olib tashlaydi va WEBP qilib saqlaydi.
    Qaytaradi: '/uploads/<folder>/<nom>.webp'"""
    if file.content_type and file.content_type not in ALLOWED:
        raise HTTPException(400, "Faqat JPG, PNG yoki WEBP rasm yuklash mumkin")
    data = await file.read(settings.max_upload_mb * 1024 * 1024 + 1)
    if len(data) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(400, f"Rasm hajmi {settings.max_upload_mb} MB dan oshmasligi kerak")
    if not data:
        raise HTTPException(400, "Fayl bo'sh")
    try:
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        img.thumbnail((max_side, max_side))
    except (UnidentifiedImageError, OSError):
        raise HTTPException(400, "Rasm faylini o'qib bo'lmadi")
    name = f"{uuid.uuid4().hex}.webp"
    if settings.storage_enabled:
        buf = io.BytesIO()
        img.save(buf, "WEBP", quality=quality, method=4)
        return _storage_put(f"{folder}/{name}", buf.getvalue())
    target_dir = settings.upload_path / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    img.save(target_dir / name, "WEBP", quality=quality, method=4)
    return f"/uploads/{folder}/{name}"


def _storage_req(method: str, path: str, data: bytes | None = None):
    base = settings.supabase_url.rstrip("/")
    req = urllib.request.Request(f"{base}/storage/v1/object/{settings.supabase_bucket}/{path}", data=data, method=method,
                                 headers={"Authorization": f"Bearer {settings.supabase_service_key}",
                                          "apikey": settings.supabase_service_key,
                                          "Content-Type": "image/webp", "x-upsert": "true"})
    return urllib.request.urlopen(req, timeout=30)


def _storage_put(path: str, data: bytes) -> str:
    try:
        _storage_req("POST", path, data).close()
    except Exception:
        raise HTTPException(502, "Rasmni saqlab bo'lmadi. Birozdan so'ng urinib ko'ring")
    return f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public/{settings.supabase_bucket}/{path}"


def delete_upload(url: str) -> None:
    if url and settings.storage_enabled:
        marker = f"/storage/v1/object/public/{settings.supabase_bucket}/"
        if marker in url:
            try:
                _storage_req("DELETE", url.split(marker, 1)[1]).close()
            except Exception:
                pass
        return
    if not url or not url.startswith("/uploads/"):
        return
    rel = url[len("/uploads/"):]
    path = (settings.upload_path / rel).resolve()
    try:
        if settings.upload_path.resolve() in path.parents and path.exists():
            path.unlink()
    except OSError:
        pass
