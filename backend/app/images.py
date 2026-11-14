"""Sayt bezagi va demo ijodkorlar uchun real suratlar (Pexels — bepul, tijoriy foydalanishga ruxsat:
https://www.pexels.com/license/).

Ikki rejim:
  1) Hech narsa qilinmasa — rasmlar brauzerda to'g'ridan-to'g'ri Pexels CDN dan ochiladi.
  2) `python -m app.cli fetch-images` — rasmlar bir marta yuklab olinib, backend/uploads/ ga WEBP qilib
     saqlanadi. Shundan so'ng sayt tashqi saytga bog'liq bo'lmaydi (tavsiya etiladi).
"""
import hashlib
import io
import json
import time
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

from .config import settings

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PhotoMarket/2.0"


def px(pid: int, w: int = 1400) -> str:
    return f"https://images.pexels.com/photos/{pid}/pexels-photo-{pid}.jpeg?auto=compress&cs=tinysrgb&w={w}"


# Sayt bo'limlari: slot -> Pexels rasm ID
SITE_SLOTS: dict[str, int] = {
    "hero_main": 1721942,        # kelin
    "hero_side": 1838,           # fotograf kamera bilan
    "hero_small": 2333713,       # oilaviy
    "how": 3928550,              # videograf
    "cta": 14408918,             # fotograf
    "auth": 302035,              # sevishganlar gulzorda
    "auth_register": 16597255,   # fotograf
    "cover": 7417907,            # Registon (muqova yo'q bo'lsa)
    "cat_wedding": 13470038,
    "cat_love": 5055872,
    "cat_portrait": 3785844,
    "cat_family": 4879441,
    "cat_kids": 6148507,
    "cat_corporate": 8761674,
    "cat_product": 7317129,
    "cat_event": 1105666,
}

BIG = ("hero", "how", "cta", "auth", "cover")


def _site_dir() -> Path:
    return settings.upload_path / "site"


def _download(url: str, timeout: int = 30) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/*"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        ctype = r.headers.get("Content-Type", "")
        data = r.read()
    if not ctype.startswith("image/") or len(data) < 3000:
        raise ValueError(f"rasm emas ({ctype})")
    return data


def _save(data: bytes, dest: Path, max_side: int) -> None:
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    img.thumbnail((max_side, max_side))
    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "WEBP", quality=82, method=4)


def fetch_site_images(force: bool = False) -> dict:
    """Sayt rasmlarini yuklab oladi va manifest.json yozadi."""
    out = _site_dir()
    manifest = {} if force else site_manifest_local()
    for slot, pid in SITE_SLOTS.items():
        name = f"{slot}.webp"
        if not force and slot in manifest and (out / name).exists():
            continue
        try:
            big = slot.startswith(BIG)
            _save(_download(px(pid, 1800 if big else 900)), out / name, 1800 if big else 900)
            manifest[slot] = f"/uploads/site/{name}?v={int(time.time())}"
            print(f"  ✓ {slot}", flush=True)
        except Exception as exc:  # tarmoq xatosi — CDN manzili qoladi
            print(f"  × {slot}: {exc}", flush=True)
    out.mkdir(parents=True, exist_ok=True)
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1), "utf-8")
    return manifest


def localize_db_images() -> int:
    """Bazadagi tashqi (http) rasm manzillarini (demo avatar, muqova, portfolio) yuklab, lokal faylga almashtiradi."""
    from sqlalchemy import select

    from .database import SessionLocal
    from .models import CreatorProfile, PortfolioItem, User

    n = 0
    folder = settings.upload_path / "demo"
    with SessionLocal() as db:
        targets = [(u, "avatar_url", 400) for u in db.scalars(select(User).where(User.avatar_url.like("http%")))]
        targets += [(c, "cover_url", 1800) for c in db.scalars(select(CreatorProfile).where(CreatorProfile.cover_url.like("http%")))]
        targets += [(p, "image_url", 1400) for p in db.scalars(select(PortfolioItem).where(PortfolioItem.image_url.like("http%")))]
        cache: dict[str, str] = {}
        for obj, attr, size in targets:
            url = getattr(obj, attr)
            if url not in cache:
                name = f"{hashlib.md5(url.split('?')[0].encode()).hexdigest()[:14]}_{size}.webp"
                try:
                    if not (folder / name).exists():
                        _save(_download(url), folder / name, size)
                    cache[url] = f"/uploads/demo/{name}"
                except Exception as exc:
                    print(f"  × {url[:70]}: {exc}", flush=True)
                    continue
            setattr(obj, attr, cache[url])
            n += 1
        db.commit()
    return n


def site_manifest_local() -> dict:
    try:
        return json.loads((_site_dir() / "manifest.json").read_text("utf-8"))
    except (OSError, ValueError):
        return {}


def site_images() -> dict[str, str]:
    """Har bir slot uchun: yuklab olingan lokal fayl bo'lsa o'sha, bo'lmasa Pexels CDN manzili."""
    local = site_manifest_local()
    return {slot: local.get(slot) or px(pid, 1800 if slot.startswith(BIG) else 900) for slot, pid in SITE_SLOTS.items()}
