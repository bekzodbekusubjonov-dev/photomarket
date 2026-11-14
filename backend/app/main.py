import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from sqlalchemy.orm import Session
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import models  # noqa: F401  (jadvallarni ro'yxatdan o'tkazish)
from .config import BASE_DIR, settings
from .database import Base, engine, ensure_columns
from .i18n import current_lang, pick_lang, translate_text, tr
from .deps import read_only
from .routers import admin, auth, bookings, creators, dashboard, extras, features, messages, notifications, site
from .security import decode_token

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("photomarket")

FIELD_NAMES = {
    "name": "Ism", "email": "Email", "password": "Parol", "new_password": "Yangi parol", "phone": "Telefon",
    "code": "Kod", "title": "Nomi", "event_date": "Sana", "start_time": "Vaqt", "location": "Manzil",
    "price": "Narx", "price_from": "Narx", "display_name": "Ko'rinadigan ism", "city": "Shahar",
    "rating": "Baho", "body": "Xabar", "duration_hours": "Davomiylik", "day": "Sana", "bio": "Bio",
}


def _msg(err: dict) -> str:
    """Pydantic xatosini (uz) kalitga aylantiradi, so'ng so'rov tiliga tarjima qiladi."""
    lang = current_lang.get()
    t, ctx = err.get("type", ""), err.get("ctx") or {}
    if t == "missing":
        return tr(lang, "to'ldirilishi shart")
    if t == "string_too_short":
        return tr(lang, "kamida {n} ta belgi bo'lsin", n=ctx.get("min_length"))
    if t == "string_too_long":
        return tr(lang, "ko'pi bilan {n} ta belgi bo'lsin", n=ctx.get("max_length"))
    if t in ("greater_than_equal", "greater_than"):
        return tr(lang, "{n} dan katta bo'lsin", n=ctx.get("ge", ctx.get("gt")))
    if t in ("less_than_equal", "less_than"):
        return tr(lang, "{n} dan oshmasin", n=ctx.get("le", ctx.get("lt")))
    if t.startswith("date"):
        return tr(lang, "sana noto'g'ri")
    if t == "string_pattern_mismatch":
        return tr(lang, "formati noto'g'ri")
    if t == "value_error":
        m = str(err.get("msg", ""))
        if "email" in m.lower():
            return tr(lang, "email manzil noto'g'ri")
        return translate_text(lang, m.removeprefix("Value error, "))
    if t in ("int_parsing", "float_parsing", "int_type"):
        return tr(lang, "son bo'lishi kerak")
    if t == "literal_error":
        return tr(lang, "qiymati noto'g'ri")
    return tr(lang, "noto'g'ri qiymat")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_columns()
    with Session(engine) as _db:
        extras.seed_defaults(_db)
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    if not settings.email_enabled:
        log.warning("Email sozlanmagan: kodlar terminalga chiqariladi (DEV rejim). .env faylini to'ldiring.")
    if settings.admin_email and settings.admin_password and len(settings.admin_password) >= 8:
        from .cli import create_admin
        create_admin(settings.admin_email, settings.admin_password, "Administrator")
    if settings.seed_demo:
        from .cli import seed_demo
        seed_demo()
    if settings.jwt_secret.startswith("dev-only") or settings.jwt_secret.startswith("replace-this"):
        log.warning("JWT_SECRET standart qiymatda! Ishlab chiqarishda albatta o'zgartiring.")
    yield


app = FastAPI(title=f"{settings.app_name} API", version="2.0.0", lifespan=lifespan,
              description="Fotograf/videograf xizmatlarini onlayn buyurtma qilish platformasi")

app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(RequestValidationError)
async def validation_handler(_req: Request, exc: RequestValidationError):
    errs = exc.errors()
    parts = []
    for e in errs[:3]:
        field = next((str(x) for x in reversed(e.get("loc", [])) if isinstance(x, str) and x != "body"), "")
        label = tr(current_lang.get(), FIELD_NAMES.get(field, field))
        parts.append(f"{label}: {_msg(e)}" if label else _msg(e))
    return JSONResponse(status_code=422, content={"detail": "; ".join(parts) or tr(current_lang.get(), "Ma'lumotlar noto'g'ri")})


@app.exception_handler(StarletteHTTPException)
async def http_handler(_req: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, str):
        detail = translate_text(current_lang.get(), detail)
    return JSONResponse(status_code=exc.status_code, content={"detail": detail}, headers=getattr(exc, "headers", None))


@app.middleware("http")
async def security_headers(request: Request, call_next):
    current_lang.set(pick_lang(request.headers.get("accept-language"), settings.default_lang))
    ro = False
    auth = request.headers.get("authorization", "")
    if auth[:7].lower() == "bearer ":
        payload = decode_token(auth[7:])
        ro = bool(payload and payload.get("ro"))
    read_only.set(ro)
    if ro and request.method not in ("GET", "HEAD", "OPTIONS"):  # admin kuzatuv rejimi: faqat ko'rish
        return JSONResponse(status_code=403, content={
            "detail": translate_text(current_lang.get(), "Kuzatuv rejimida faqat ko'rish mumkin")})
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    return resp


for r in (auth.router, creators.router, creators.me, bookings.router, bookings.reviews, messages.router,
          notifications.router, dashboard.router, admin.router, extras.router, extras.admin, features.router,
          features.admin, site.router):
    app.include_router(r)


@app.get("/api/health")
def health():
    return {"status": "ok", "email": ("script" if settings.script_enabled else "smtp") if settings.email_enabled else "console"}


settings.upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_path), name="uploads")

# ---- Production: tayyor frontend (frontend/dist) ni shu server orqali berish ----
DIST = (BASE_DIR.parent / "frontend" / "dist").resolve()
if DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Topilmadi"}, status_code=404)
        f = (DIST / full_path).resolve()
        if full_path and DIST in f.parents and f.is_file():
            return FileResponse(f)
        return FileResponse(DIST / "index.html")
else:
    @app.get("/", include_in_schema=False)
    def root():
        return {"name": f"{settings.app_name} API", "docs": "/docs", "status": "ok"}
