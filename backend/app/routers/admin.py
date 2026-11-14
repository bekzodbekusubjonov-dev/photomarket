from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

import secrets
import string

from ..database import get_db
from ..deps import require_admin
from ..models import (
    Booking, CreatorProfile, Message, Review, User, ROLE_ADMIN, ROLE_CREATOR, ST_COMPLETED, utcnow,
)
from ..security import hash_password
from ..schemas import AdminCreatorPatch, AdminUserPatch
from ..services import STATUS_LABELS, creator_card, notify, recalc_creator_rating, review_out, user_private
from .dashboard import monthly_series

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/stats")
def admin_stats(db: Session = Depends(get_db)):
    roles = dict(db.execute(select(User.role, func.count()).group_by(User.role)).all())
    since = utcnow() - timedelta(days=30)
    new_users = db.scalar(select(func.count(User.id)).where(User.created_at >= since)) or 0
    unverified = db.scalar(select(func.count(User.id)).where(User.is_verified.is_(False))) or 0
    blocked = db.scalar(select(func.count(User.id)).where(User.is_active.is_(False))) or 0
    statuses = dict(db.execute(select(Booking.status, func.count()).group_by(Booking.status)).all())
    revenue = db.scalar(select(func.coalesce(func.sum(Booking.price), 0)).where(Booking.status == ST_COMPLETED)) or 0
    start = date.today().replace(day=1) - timedelta(days=200)
    recent = db.scalars(select(Booking).where(Booking.event_date >= start)).all()
    top = db.scalars(select(CreatorProfile).options(selectinload(CreatorProfile.user),
                                                    selectinload(CreatorProfile.portfolio))
                     .order_by(CreatorProfile.completed_count.desc(), CreatorProfile.rating.desc()).limit(5)).all()
    return {
        "users": {"total": sum(roles.values()), "by_role": roles, "new_30d": new_users,
                  "unverified": unverified, "blocked": blocked},
        "bookings": {"total": sum(statuses.values()), "by_status": statuses},
        "revenue": revenue,
        "reviews": db.scalar(select(func.count(Review.id))) or 0,
        "messages": db.scalar(select(func.count(Message.id))) or 0,
        "pending_verification": db.scalar(select(func.count(CreatorProfile.id)).where(
            CreatorProfile.verified.is_(False))) or 0,
        "series": monthly_series(recent),
        "top_creators": [creator_card(c) for c in top],
        "activity": _activity(db),
    }


def _activity(db: Session) -> list[dict]:
    """So'nggi hodisalar: ro'yxatdan o'tishlar, buyurtmalar, sharhlar."""
    ev = []
    for u in db.scalars(select(User).order_by(User.id.desc()).limit(6)):
        ev.append({"at": u.created_at, "kind": "user",
                   "text": f"Yangi {'ijodkor' if u.role == ROLE_CREATOR else 'foydalanuvchi'}: {u.name}"})
    for b in db.scalars(select(Booking).options(selectinload(Booking.client), selectinload(Booking.creator))
                        .order_by(Booking.updated_at.desc()).limit(6)):
        ev.append({"at": b.updated_at, "kind": f"booking_{b.status}",
                   "text": f"#{b.id} «{b.title}»: {b.client.name} → {b.creator.display_name} ({STATUS_LABELS.get(b.status, b.status).lower()})",
                   "link": f"/dashboard/bookings/{b.id}"})
    for r in db.scalars(select(Review).options(selectinload(Review.client), selectinload(Review.creator))
                        .order_by(Review.id.desc()).limit(4)):
        ev.append({"at": r.created_at, "kind": "review",
                   "text": f"{r.client.name} {r.creator.display_name} ga {r.rating}★ baho qo'ydi"})
    ev.sort(key=lambda e: e["at"], reverse=True)
    return ev[:10]


@router.get("/users")
def admin_users(q: str | None = None, role: str | None = None, page: int = Query(1, ge=1),
                size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    stmt = select(User)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(User.name.ilike(like), User.email.ilike(like), User.phone.ilike(like)))
    if role:
        stmt = stmt.where(User.role == role)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.options(selectinload(User.creator_profile)).order_by(User.id.desc())
                      .offset((page - 1) * size).limit(size))
    return {"items": [user_private(u) for u in rows], "total": total, "page": page, "pages": max(1, -(-total // size))}


@router.patch("/users/{user_id}")
def admin_patch_user(user_id: int, data: AdminUserPatch, admin: User = Depends(require_admin),
                     db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Foydalanuvchi topilmadi")
    if u.id == admin.id and (data.role not in (None, ROLE_ADMIN) or data.is_active is False):
        raise HTTPException(400, "O'zingizning admin huquqingizni olib tashlay olmaysiz")
    if data.role is not None and data.role != u.role:
        u.role = data.role
        u.token_version += 1
        if data.role == ROLE_CREATOR and not u.creator_profile:
            db.add(CreatorProfile(user_id=u.id, display_name=u.name))
    if data.is_active is not None and data.is_active != u.is_active:
        u.is_active = data.is_active
        u.token_version += 1
    if data.is_verified is not None:
        u.is_verified = data.is_verified
    db.commit()
    db.refresh(u)
    return user_private(u)


@router.post("/users/{user_id}/reset-password")
def admin_reset_password(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Parollar xeshlangan saqlanadi (ko'rib bo'lmaydi). Admin yangi vaqtinchalik parol yaratadi va uni bir marta ko'radi."""
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Foydalanuvchi topilmadi")
    if u.id == admin.id:
        raise HTTPException(400, "O'z parolingizni Sozlamalar bo'limida o'zgartiring")
    alphabet = string.ascii_letters + string.digits
    pw = "".join(secrets.choice(alphabet) for _ in range(10))
    if not any(c.isdigit() for c in pw):
        pw = pw[:-1] + secrets.choice(string.digits)
    u.password_hash = hash_password(pw)
    u.token_version += 1
    db.commit()
    return {"password": pw, "email": u.email}


@router.get("/creators")
def admin_creators(q: str | None = None, verified: bool | None = None, page: int = Query(1, ge=1),
                   size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    stmt = select(CreatorProfile).join(User, User.id == CreatorProfile.user_id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(CreatorProfile.display_name.ilike(like), User.email.ilike(like),
                              CreatorProfile.city.ilike(like)))
    if verified is not None:
        stmt = stmt.where(CreatorProfile.verified.is_(verified))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(stmt.options(selectinload(CreatorProfile.user), selectinload(CreatorProfile.portfolio))
                      .order_by(CreatorProfile.id.desc()).offset((page - 1) * size).limit(size))
    items = []
    for c in rows:
        d = creator_card(c)
        d["email"] = c.user.email
        d["user_active"] = c.user.is_active
        d["portfolio_count"] = len(c.portfolio)
        items.append(d)
    return {"items": items, "total": total, "page": page, "pages": max(1, -(-total // size))}


@router.patch("/creators/{creator_id}")
def admin_patch_creator(creator_id: int, data: AdminCreatorPatch, db: Session = Depends(get_db)):
    c = db.get(CreatorProfile, creator_id)
    if not c:
        raise HTTPException(404, "Ijodkor topilmadi")
    if data.verified is not None and data.verified != c.verified:
        c.verified = data.verified
        if data.verified:
            notify(db, c.user, "verified", "Profilingiz tasdiqlandi ✓",
                   "Administrator profilingizni tekshirdi. Endi katalogda «Tasdiqlangan» belgisi bilan chiqasiz.",
                   f"/creators/{c.id}")
    if data.featured is not None:
        c.featured = data.featured
    if data.active is not None:
        c.active = data.active
    db.commit()
    return creator_card(c)


@router.get("/reviews")
def admin_reviews(page: int = Query(1, ge=1), size: int = Query(30, ge=1, le=100), db: Session = Depends(get_db)):
    total = db.scalar(select(func.count(Review.id))) or 0
    rows = db.scalars(select(Review).options(selectinload(Review.client), selectinload(Review.creator))
                      .order_by(Review.id.desc()).offset((page - 1) * size).limit(size))
    return {"items": [review_out(r) for r in rows], "total": total, "page": page, "pages": max(1, -(-total // size))}


@router.delete("/reviews/{review_id}")
def admin_delete_review(review_id: int, db: Session = Depends(get_db)):
    r = db.get(Review, review_id)
    if not r:
        raise HTTPException(404, "Sharh topilmadi")
    creator = r.creator
    db.delete(r)
    db.flush()
    recalc_creator_rating(db, creator)
    db.commit()
    return {"ok": True}
