"""Umumiy biznes-mantiq: email kodlar, bildirishnomalar, band sanalarni tekshirish, serializatsiya."""
from datetime import date, timedelta

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import settings
from .i18n import current_lang, status_label, translate_text
from .emailer import send_code_email, send_notice_email
from .models import (
    BlockedDate, Booking, CreatorProfile, EmailCode, Notification, Review, User,
    ST_ACCEPTED, ST_COMPLETED, utcnow,
)
from .security import code_matches, generate_code, hash_code

STATUS_LABELS = {
    "pending": "Kutilmoqda",
    "accepted": "Qabul qilindi",
    "rejected": "Rad etildi",
    "cancelled": "Bekor qilindi",
    "completed": "Bajarildi",
}


# ---------------- Email kodlar ----------------
def issue_code(db: Session, user: User, purpose: str, background: BackgroundTasks | None = None,
               enforce_cooldown: bool = True):
    last = db.scalar(
        select(EmailCode).where(EmailCode.user_id == user.id, EmailCode.purpose == purpose)
        .order_by(EmailCode.id.desc()).limit(1)
    )
    now = utcnow()
    if enforce_cooldown and last:
        passed = (now - last.created_at).total_seconds()
        if passed < settings.email_code_cooldown_seconds:
            wait = int(settings.email_code_cooldown_seconds - passed) + 1
            raise HTTPException(429, f"Yangi kodni {wait} soniyadan keyin so'rashingiz mumkin")
    # eski kodlarni bekor qilish
    for old in db.scalars(select(EmailCode).where(
        EmailCode.user_id == user.id, EmailCode.purpose == purpose, EmailCode.used.is_(False)
    )):
        old.used = True
    code = generate_code()
    db.add(EmailCode(
        user_id=user.id, purpose=purpose, code_hash=hash_code(code),
        expires_at=now + timedelta(minutes=settings.email_code_ttl_minutes),
    ))
    db.commit()
    # Kod sinxron yuboriladi: yuborilmasa foydalanuvchi darhol xabar oladi
    if not send_code_email(user.email, user.name, code, purpose, user.lang or "uz"):
        raise HTTPException(502, "Emailga kod yuborib bo'lmadi. Birozdan so'ng «Qayta yuborish» ni bosing "
                                 "yoki administratorga murojaat qiling")


def consume_code(db: Session, user: User, purpose: str, code: str):
    rec = db.scalar(
        select(EmailCode).where(
            EmailCode.user_id == user.id, EmailCode.purpose == purpose, EmailCode.used.is_(False)
        ).order_by(EmailCode.id.desc()).limit(1)
    )
    if not rec or rec.expires_at < utcnow():
        raise HTTPException(400, "Kod muddati tugagan yoki topilmadi. Yangi kod so'rang")
    if rec.attempts >= settings.email_code_max_attempts:
        raise HTTPException(400, "Urinishlar soni tugadi. Yangi kod so'rang")
    if not code_matches(code, rec.code_hash):
        rec.attempts += 1
        db.commit()
        left = settings.email_code_max_attempts - rec.attempts
        raise HTTPException(400, f"Kod noto'g'ri. Qolgan urinishlar: {left}")
    rec.used = True


# ---------------- Bildirishnomalar ----------------
def notify(db: Session, user: User, kind: str, title: str, body: str = "", link: str = "",
           background: BackgroundTasks | None = None, email: bool = False):
    lang = user.lang or "uz"
    title, body = translate_text(lang, title), translate_text(lang, body)
    db.add(Notification(user_id=user.id, kind=kind, title=title, body=body[:1000], link=link))
    if email and background is not None and user.is_active:
        background.add_task(send_notice_email, user.email, title, body, link, lang)


# ---------------- Bandlik ----------------
def _minutes(t: str) -> int | None:
    if not t:
        return None
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def check_slot_free(db: Session, creator_id: int, day: date, start_time: str, duration: float,
                    exclude_booking_id: int | None = None):
    blocked = db.scalar(select(BlockedDate).where(BlockedDate.creator_id == creator_id, BlockedDate.day == day))
    if blocked:
        raise HTTPException(409, "Ijodkor bu sanada band (dam olish yoki boshqa ish)")
    q = select(Booking).where(
        Booking.creator_id == creator_id, Booking.event_date == day, Booking.status == ST_ACCEPTED
    )
    if exclude_booking_id:
        q = q.where(Booking.id != exclude_booking_id)
    start = _minutes(start_time)
    for b in db.scalars(q):
        other = _minutes(b.start_time)
        if start is None or other is None:
            raise HTTPException(409, "Bu sanada ijodkorda tasdiqlangan buyurtma bor")
        end, other_end = start + int(duration * 60), other + int(b.duration_hours * 60)
        if start < other_end and other < end:
            raise HTTPException(409, f"Bu vaqt band: {b.start_time} dan {b.duration_hours:g} soatlik buyurtma bor")


def recalc_creator_rating(db: Session, creator: CreatorProfile):
    avg, cnt = db.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(Review.creator_id == creator.id)
    ).one()
    creator.rating = round(float(avg or 0), 2)
    creator.reviews_count = int(cnt or 0)
    creator.completed_count = db.scalar(
        select(func.count(Booking.id)).where(Booking.creator_id == creator.id, Booking.status == ST_COMPLETED)
    ) or 0


# ---------------- Serializatsiya ----------------
def user_public(u: User | None) -> dict | None:
    if not u:
        return None
    return {"id": u.id, "name": u.name, "avatar_url": u.avatar_url, "role": u.role}


def user_private(u: User) -> dict:
    return {
        "id": u.id, "name": u.name, "email": u.email, "phone": u.phone, "role": u.role,
        "avatar_url": u.avatar_url, "lang": u.lang or "uz", "is_verified": u.is_verified, "is_active": u.is_active,
        "created_at": u.created_at, "last_login_at": u.last_login_at,
        "creator_id": u.creator_profile.id if u.creator_profile else None,
    }


def creator_card(c: CreatorProfile) -> dict:
    cover = c.cover_url or (c.portfolio[0].image_url if c.portfolio else "")
    return {
        "id": c.id, "user_id": c.user_id, "display_name": c.display_name, "category": c.category,
        "city": c.city, "price_from": c.price_from, "rating": c.rating, "reviews_count": c.reviews_count,
        "completed_count": c.completed_count, "specialties": c.specialties_list,
        "experience_years": c.experience_years, "avatar_url": c.user.avatar_url if c.user else "",
        "cover_url": cover, "verified": c.verified, "featured": c.featured, "active": c.active,
        "preview": [p.image_url for p in c.portfolio[:3]],
    }


def creator_full(c: CreatorProfile) -> dict:
    d = creator_card(c)
    d.update({
        "bio": c.bio, "instagram": c.instagram, "telegram": c.telegram,
        "own_cover_url": c.cover_url, "created_at": c.created_at,
        "portfolio": [portfolio_out(p) for p in c.portfolio],
        "services": [service_out(s) for s in c.services if s.active],
    })
    return d


def portfolio_out(p) -> dict:
    return {"id": p.id, "image_url": p.image_url, "title": p.title, "category": p.category,
            "position": p.position, "created_at": p.created_at}


def service_out(s) -> dict:
    return {"id": s.id, "title": s.title, "description": s.description, "price": s.price,
            "duration_hours": s.duration_hours, "active": s.active}


def review_out(r: Review) -> dict:
    return {"id": r.id, "booking_id": r.booking_id, "creator_id": r.creator_id, "rating": r.rating,
            "comment": r.comment, "reply": r.reply, "created_at": r.created_at,
            "client": user_public(r.client),
            "creator_name": r.creator.display_name if r.creator else ""}


def booking_out(b: Booking, detail: bool = False) -> dict:
    d = {
        "id": b.id, "title": b.title, "event_date": b.event_date, "start_time": b.start_time,
        "duration_hours": b.duration_hours, "location": b.location, "price": b.price,
        "status": b.status, "status_label": status_label(current_lang.get(), b.status),
        "status_note": b.status_note, "created_at": b.created_at, "updated_at": b.updated_at,
        "client": user_public(b.client),
        "creator": {"id": b.creator.id, "display_name": b.creator.display_name, "user_id": b.creator.user_id,
                    "avatar_url": b.creator.user.avatar_url if b.creator.user else "", "city": b.creator.city},
        "service": {"id": b.service.id, "title": b.service.title} if b.service else None,
        "has_review": b.review is not None,
    }
    if detail:
        d["details"] = b.details
        d["review"] = review_out(b.review) if b.review else None
        d["client_contact"] = {"email": b.client.email, "phone": b.client.phone} if b.client else None
    return d
