"""Qo'shimcha modullar: sevimlilar, to'lovlar, kategoriyalar, shikoyatlar, sozlamalar, admin boshqaruvi, tahlil."""
import re
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user, get_optional_user, require_admin, require_creator, require_roles
from ..i18n import current_lang
from ..models import (
    COMPLAINT_STATUSES, CONTRACT_SIGNED, Contract, PAY_METHODS, PAY_PAID, PAY_PENDING, PAY_REJECTED, ROLE_ADMIN, ROLE_CLIENT, ROLE_CREATOR,
    ST_ACCEPTED, ST_COMPLETED, Booking, Category, Complaint, CreatorProfile, Favorite, Payment, Review, SavedCard, Setting,
    User, utcnow,
)
from ..services import booking_out, creator_card, notify, review_out, user_public
from .dashboard import monthly_series

router = APIRouter(prefix="/api", tags=["extras"])

DEFAULT_CATEGORIES = [  # name_uz ijodkor mutaxassisliklari (SPECIALTIES) bilan bir xil
    ("wedding", "To'y", "Свадьба", "Wedding"),
    ("portrait", "Portret", "Портрет", "Portrait"),
    ("family", "Oilaviy", "Семейная", "Family"),
    ("kids", "Bolalar", "Детская", "Kids"),
    ("lovestory", "Love story", "Love story", "Love story"),
    ("corporate", "Korporativ", "Корпоратив", "Corporate"),
    ("product", "Mahsulot (predmet)", "Предметная", "Product"),
    ("event", "Tadbir / konsert", "Мероприятия", "Events"),
    ("drone", "Drone (aerosyomka)", "Дрон (аэросъёмка)", "Drone"),
    ("reels", "Reels / SMM", "Reels / SMM", "Reels / SMM"),
]
DEFAULT_SETTINGS = {
    "platform_name": "PhotoMarket", "contact_email": "", "contact_phone": "", "telegram": "",
    "commission_percent": "10", "allow_registration": "1", "terms_text": "",
    "cancel_free_days": "3", "cancel_fee_percent": "30", "cancel_platform_share": "40",
    "pay_card_number": "", "pay_card_holder": "", "logo_url": "",
}
PUBLIC_SETTINGS = ("platform_name", "contact_email", "contact_phone", "telegram", "terms_text", "logo_url",
                   "commission_percent", "cancel_free_days", "cancel_fee_percent", "cancel_platform_share")


def seed_defaults(db: Session):
    if not db.scalar(select(func.count(Category.id))):
        for i, (slug, uz, ru, en) in enumerate(DEFAULT_CATEGORIES):
            db.add(Category(slug=slug, name_uz=uz, name_ru=ru, name_en=en, position=i))
    for k, v in DEFAULT_SETTINGS.items():
        if not db.get(Setting, k):
            db.add(Setting(key=k, value=v))
    db.commit()


def get_settings(db: Session) -> dict:
    d = dict(DEFAULT_SETTINGS)
    d.update({s.key: s.value for s in db.scalars(select(Setting))})
    return d


def _page(q, db, page, size):
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    return total


# ---------------- Public ----------------
@router.get("/settings")
def public_settings(db: Session = Depends(get_db)):
    s = get_settings(db)
    return {k: s[k] for k in PUBLIC_SETTINGS}


def cat_out(c: Category) -> dict:
    lang = current_lang.get()
    name = {"ru": c.name_ru, "en": c.name_en}.get(lang) or c.name_uz
    return {"id": c.id, "slug": c.slug, "name": name, "name_uz": c.name_uz, "name_ru": c.name_ru,
            "name_en": c.name_en, "image_url": c.image_url, "position": c.position, "active": c.active}


@router.get("/categories")
def categories(db: Session = Depends(get_db)):
    rows = db.scalars(select(Category).where(Category.active.is_(True)).order_by(Category.position, Category.id))
    counts: dict[str, int] = {}
    for cp in db.scalars(select(CreatorProfile).where(CreatorProfile.active.is_(True))):
        for sp in cp.specialties_list:
            counts[sp] = counts.get(sp, 0) + 1
    out = []
    for c in rows:
        d = cat_out(c)
        d["creators"] = counts.get(c.name_uz, 0)
        out.append(d)
    return out


# ---------------- Sevimlilar (mijoz) ----------------
client_only = require_roles(ROLE_CLIENT)


@router.get("/favorites")
def my_favorites(user: User = Depends(client_only), db: Session = Depends(get_db)):
    favs = db.scalars(select(Favorite).where(Favorite.user_id == user.id).options(
        selectinload(Favorite.creator).selectinload(CreatorProfile.user),
        selectinload(Favorite.creator).selectinload(CreatorProfile.portfolio)).order_by(Favorite.id.desc())).all()
    return [creator_card(f.creator) for f in favs if f.creator and f.creator.active]


@router.get("/favorites/ids")
def favorite_ids(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return list(db.scalars(select(Favorite.creator_id).where(Favorite.user_id == user.id)))


@router.post("/favorites/{creator_id}")
def add_favorite(creator_id: int, user: User = Depends(client_only), db: Session = Depends(get_db)):
    if not db.get(CreatorProfile, creator_id):
        raise HTTPException(404, "Ijodkor topilmadi")
    if not db.scalar(select(Favorite.id).where(Favorite.user_id == user.id, Favorite.creator_id == creator_id)):
        db.add(Favorite(user_id=user.id, creator_id=creator_id))
        db.commit()
    return {"favorite": True}


@router.delete("/favorites/{creator_id}")
def remove_favorite(creator_id: int, user: User = Depends(client_only), db: Session = Depends(get_db)):
    f = db.scalar(select(Favorite).where(Favorite.user_id == user.id, Favorite.creator_id == creator_id))
    if f:
        db.delete(f)
        db.commit()
    return {"favorite": False}


# ---------------- To'lovlar ----------------
class PaymentIn(BaseModel):
    booking_id: int
    amount: int = Field(gt=0, le=2_000_000_000)
    method: Literal["cash", "card", "transfer"] = "cash"
    note: str = Field(default="", max_length=300)
    proof_url: str = Field(default="", max_length=500)
    card_id: int | None = None


def pay_out(p: Payment) -> dict:
    b = p.booking
    card = None
    if p.card_id:
        from sqlalchemy.orm import object_session
        from ..models import SavedCard
        s = object_session(p)
        c = s.get(SavedCard, p.card_id) if s else None
        card = f"{c.first4} **** **** {c.last4}" if c else None
    return {"id": p.id, "booking_id": p.booking_id, "booking_title": b.title if b else "", "amount": p.amount,
            "method": p.method, "status": p.status, "note": p.note, "created_at": p.created_at,
            "confirmed_at": p.confirmed_at, "proof_url": p.proof_url, "receipt_no": p.receipt_no, "fee": p.fee,
            "creator_amount": p.creator_amount, "payout_status": p.payout_status, "admin_note": p.admin_note,
            "card": card,
            "client": user_public(b.client) if b else None,
            "creator_name": b.creator.display_name if b and b.creator else ""}


def _pay_q(db, user):
    q = select(Payment).options(selectinload(Payment.booking).selectinload(Booking.client),
                                selectinload(Payment.booking).selectinload(Booking.creator))
    if user.role == ROLE_CLIENT:
        q = q.where(Payment.payer_id == user.id)
    elif user.role == ROLE_CREATOR:
        q = q.where(Payment.creator_id == (user.creator_profile.id if user.creator_profile else -1))
    return q.order_by(Payment.id.desc())


@router.get("/payments")
def list_payments(status: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    q = _pay_q(db, user)
    if status in (PAY_PENDING, PAY_PAID, PAY_REJECTED):
        q = q.where(Payment.status == status)
    rows = db.scalars(q.limit(300)).all()
    total_paid = sum(p.amount for p in rows if p.status == PAY_PAID)
    pending = sum(p.amount for p in rows if p.status == PAY_PENDING)
    return {"items": [pay_out(p) for p in rows], "total_paid": total_paid, "pending": pending}


@router.post("/payments")
def add_payment(data: PaymentIn, background: BackgroundTasks, user: User = Depends(get_current_user),
                db: Session = Depends(get_db)):
    if user.role == ROLE_ADMIN:
        raise HTTPException(403, "Bu rolda amal bajarib bo'lmaydi")
    b = db.get(Booking, data.booking_id)
    if not b:
        raise HTTPException(404, "Buyurtma topilmadi")
    is_client = user.role == ROLE_CLIENT and b.client_id == user.id
    is_creator = user.role == ROLE_CREATOR and user.creator_profile and b.creator_id == user.creator_profile.id
    if not (is_client or is_creator):
        raise HTTPException(404, "Buyurtma topilmadi")
    if b.status not in (ST_ACCEPTED, ST_COMPLETED):
        raise HTTPException(400, "To'lovni faqat qabul qilingan yoki bajarilgan buyurtmaga qo'shish mumkin")
    online = data.method in ("card", "transfer")
    if is_client and online:
        con = db.scalar(select(Contract).where(Contract.booking_id == b.id))
        if not con or con.status != CONTRACT_SIGNED:
            raise HTTPException(400, "Avval shartnomani imzolang: to'lov imzolangan shartnomadan keyin qabul qilinadi")
        if not data.proof_url:
            raise HTTPException(400, "To'lov chekini (skrinshot) yuklang")
    if data.card_id and not db.scalar(select(SavedCard.id).where(SavedCard.id == data.card_id,
                                                                SavedCard.user_id == user.id)):
        raise HTTPException(404, "Karta topilmadi")
    # naqd to'lovni ijodkor kiritsa darhol tasdiqlangan; karta/o'tkazma — administrator tasdiqlaydi
    auto_paid = is_creator and not online
    p = Payment(booking_id=b.id, payer_id=b.client_id, creator_id=b.creator_id, amount=data.amount,
                method=data.method, note=data.note.strip(), created_by=user.id, proof_url=data.proof_url,
                card_id=data.card_id if is_client else None,
                status=PAY_PAID if auto_paid else PAY_PENDING, confirmed_at=utcnow() if auto_paid else None)
    db.add(p)
    db.flush()
    amount_s = f"{data.amount:,}".replace(",", " ")
    if auto_paid:
        from .features import confirm_payment
        confirm_payment(db, p, PAY_PAID, "", user, background)
    elif online:
        for adm in db.scalars(select(User).where(User.role == ROLE_ADMIN, User.is_active.is_(True))):
            notify(db, adm, "payment_review", f"To'lovni tasdiqlang: {amount_s} so'm",
                   f"«{b.title}» buyurtmasi bo'yicha chek yuklandi", "/dashboard/payments", background)
    else:
        other = b.creator.user if is_client else b.client
        notify(db, other, "payment_new", f"Yangi to'lov: {amount_s} so'm", f"«{b.title}» buyurtmasi bo'yicha",
               "/dashboard/payments", background)
    db.commit()
    db.refresh(p)
    return pay_out(p)


class PaymentDecision(BaseModel):
    status: Literal["paid", "rejected"]


@router.patch("/payments/{pid}")
def decide_payment(pid: int, data: PaymentDecision, background: BackgroundTasks,
                   user: User = Depends(require_creator), db: Session = Depends(get_db)):
    p = db.get(Payment, pid)
    if not p or p.creator_id != user.creator_profile.id:
        raise HTTPException(404, "To'lov topilmadi")
    if p.status != PAY_PENDING:
        raise HTTPException(409, "Bu to'lov allaqachon ko'rib chiqilgan")
    if p.method in ("card", "transfer"):
        raise HTTPException(403, "Karta va o'tkazma to'lovlarini administrator tasdiqlaydi")
    from .features import confirm_payment
    confirm_payment(db, p, data.status, "", user, background)
    db.commit()
    return pay_out(p)


# ---------------- Shikoyatlar ----------------
class ComplaintIn(BaseModel):
    creator_id: int | None = None
    booking_id: int | None = None
    reason: Literal["quality", "no_show", "price", "rude", "fraud", "other"] = "other"
    text: str = Field(min_length=5, max_length=2000)


def complaint_out(c: Complaint) -> dict:
    return {"id": c.id, "reason": c.reason, "text": c.text, "status": c.status, "admin_note": c.admin_note,
            "created_at": c.created_at, "booking_id": c.booking_id, "creator_id": c.creator_id,
            "creator_name": c.creator.display_name if c.creator else "", "reporter": user_public(c.reporter)}


@router.post("/complaints")
def create_complaint(data: ComplaintIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    cid = data.creator_id
    if data.booking_id:
        b = db.get(Booking, data.booking_id)
        if not b or b.client_id != user.id:
            raise HTTPException(404, "Buyurtma topilmadi")
        cid = b.creator_id
    c = db.get(CreatorProfile, cid) if cid else None
    if not c or c.user_id == user.id:
        raise HTTPException(400, "Ijodkor topilmadi yoki o'zingizga shikoyat qilib bo'lmaydi")
    row = Complaint(reporter_id=user.id, creator_id=c.id, booking_id=data.booking_id, reason=data.reason,
                    text=data.text.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    return complaint_out(row)


@router.get("/complaints/mine")
def my_complaints(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Complaint).where(Complaint.reporter_id == user.id).options(
        selectinload(Complaint.creator), selectinload(Complaint.reporter)).order_by(Complaint.id.desc()))
    return [complaint_out(c) for c in rows]


# ---------------- Mijoz: yozgan sharhlari ----------------
@router.get("/reviews/given")
def reviews_given(user: User = Depends(client_only), db: Session = Depends(get_db)):
    rows = db.scalars(select(Review).where(Review.client_id == user.id).options(
        selectinload(Review.client), selectinload(Review.creator)).order_by(Review.id.desc()))
    return [review_out(r) for r in rows]


# ---------------- Ijodkor: daromad ----------------
@router.get("/creator/earnings")
def earnings(user: User = Depends(require_creator), db: Session = Depends(get_db)):
    cid = user.creator_profile.id
    done = db.scalars(select(Booking).where(Booking.creator_id == cid, Booking.status == ST_COMPLETED)).all()
    paid = db.scalar(select(func.coalesce(func.sum(Payment.amount), 0)).where(
        Payment.creator_id == cid, Payment.status == PAY_PAID)) or 0
    pending = db.scalar(select(func.coalesce(func.sum(Payment.amount), 0)).where(
        Payment.creator_id == cid, Payment.status == PAY_PENDING)) or 0
    booked = sum(b.price or 0 for b in done)
    return {"completed_total": booked, "paid": paid, "pending": pending, "outstanding": max(booked - paid, 0),
            "series": monthly_series(done)}


# ================= ADMIN =================
admin = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@admin.get("/bookings")
def admin_bookings(q: str | None = None, status: str | None = None, page: int = Query(1, ge=1),
                   size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db)):
    stmt = select(Booking).options(selectinload(Booking.client), selectinload(Booking.creator).selectinload(
        CreatorProfile.user), selectinload(Booking.service), selectinload(Booking.review))
    if status:
        stmt = stmt.where(Booking.status == status)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Booking.title.ilike(like), Booking.location.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.scalars(stmt.order_by(Booking.id.desc()).offset((page - 1) * size).limit(size)).all()
    return {"items": [booking_out(b) for b in rows], "total": total, "page": page, "size": size}


@admin.get("/payments")
def admin_payments(status: str | None = None, db: Session = Depends(get_db)):
    q = select(Payment).options(selectinload(Payment.booking).selectinload(Booking.client),
                                selectinload(Payment.booking).selectinload(Booking.creator)).order_by(Payment.id.desc())
    if status:
        q = q.where(Payment.status == status)
    rows = db.scalars(q.limit(300)).all()
    return {"items": [pay_out(p) for p in rows], "total_paid": sum(p.amount for p in rows if p.status == PAY_PAID),
            "pending": sum(p.amount for p in rows if p.status == PAY_PENDING)}


class CategoryIn(BaseModel):
    name_uz: str = Field(min_length=2, max_length=80)
    name_ru: str = Field(default="", max_length=80)
    name_en: str = Field(default="", max_length=80)
    image_url: str = Field(default="", max_length=500)
    position: int = Field(default=0, ge=0, le=999)
    active: bool = True


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("'", "").replace("ʻ", "")).strip("-") or "cat"


@admin.get("/categories")
def admin_categories(db: Session = Depends(get_db)):
    return [cat_out(c) for c in db.scalars(select(Category).order_by(Category.position, Category.id))]


@admin.post("/categories")
def admin_cat_create(data: CategoryIn, db: Session = Depends(get_db)):
    if db.scalar(select(Category.id).where(Category.name_uz == data.name_uz.strip())):
        raise HTTPException(409, "Bu nomli kategoriya mavjud")
    slug, n = _slug(data.name_en or data.name_uz), 1
    base = slug
    while db.scalar(select(Category.id).where(Category.slug == slug)):
        n += 1
        slug = f"{base}-{n}"
    c = Category(slug=slug, **{**data.model_dump(), "name_uz": data.name_uz.strip()})
    db.add(c)
    db.commit()
    return cat_out(c)


@admin.put("/categories/{cid}")
def admin_cat_update(cid: int, data: CategoryIn, db: Session = Depends(get_db)):
    c = db.get(Category, cid)
    if not c:
        raise HTTPException(404, "Kategoriya topilmadi")
    dup = db.scalar(select(Category.id).where(Category.name_uz == data.name_uz.strip(), Category.id != cid))
    if dup:
        raise HTTPException(409, "Bu nomli kategoriya mavjud")
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    db.commit()
    return cat_out(c)


@admin.delete("/categories/{cid}")
def admin_cat_delete(cid: int, db: Session = Depends(get_db)):
    c = db.get(Category, cid)
    if not c:
        raise HTTPException(404, "Kategoriya topilmadi")
    db.delete(c)
    db.commit()
    return {"ok": True}


class ComplaintPatch(BaseModel):
    status: Literal["open", "in_review", "resolved", "dismissed"]
    admin_note: str = Field(default="", max_length=1000)


@admin.get("/complaints")
def admin_complaints(status: str | None = None, db: Session = Depends(get_db)):
    q = select(Complaint).options(selectinload(Complaint.creator), selectinload(Complaint.reporter)).order_by(
        Complaint.id.desc())
    if status in COMPLAINT_STATUSES:
        q = q.where(Complaint.status == status)
    return [complaint_out(c) for c in db.scalars(q.limit(300))]


@admin.patch("/complaints/{cid}")
def admin_complaint_patch(cid: int, data: ComplaintPatch, background: BackgroundTasks, db: Session = Depends(get_db)):
    c = db.get(Complaint, cid)
    if not c:
        raise HTTPException(404, "Shikoyat topilmadi")
    changed = c.status != data.status
    c.status, c.admin_note = data.status, data.admin_note.strip()
    if changed and data.status in ("resolved", "dismissed"):
        notify(db, c.reporter, "complaint", "Shikoyatingiz ko'rib chiqildi",
               f"Holat: {data.status}" if not c.admin_note else c.admin_note, "/dashboard/complaints", background)
    db.commit()
    return complaint_out(c)


@admin.get("/settings")
def admin_settings(db: Session = Depends(get_db)):
    return get_settings(db)


class SettingsIn(BaseModel):
    platform_name: str = Field(default="PhotoMarket", min_length=2, max_length=60)
    contact_email: str = Field(default="", max_length=120)
    contact_phone: str = Field(default="", max_length=40)
    telegram: str = Field(default="", max_length=80)
    commission_percent: int = Field(default=10, ge=0, le=50)
    allow_registration: bool = True
    terms_text: str = Field(default="", max_length=5000)
    cancel_free_days: int = Field(default=3, ge=0, le=60)
    cancel_fee_percent: int = Field(default=30, ge=0, le=100)
    cancel_platform_share: int = Field(default=40, ge=0, le=100)
    pay_card_number: str = Field(default="", max_length=24, pattern=r"^[0-9 ]*$")
    pay_card_holder: str = Field(default="", max_length=80)
    logo_url: str = Field(default="", max_length=500)


@admin.put("/settings")
def admin_settings_save(data: SettingsIn, db: Session = Depends(get_db)):
    for k, v in data.model_dump().items():
        v = ("1" if v else "0") if isinstance(v, bool) else str(v)
        row = db.get(Setting, k)
        if row:
            row.value = v
        else:
            db.add(Setting(key=k, value=v))
    db.commit()
    return get_settings(db)


@admin.get("/analytics")
def admin_analytics(db: Session = Depends(get_db)):
    since = date.today() - timedelta(days=365)
    bookings = db.scalars(select(Booking).where(Booking.event_date >= since)).all()
    by_cat = db.execute(select(CreatorProfile.category, func.count(Booking.id)).join(
        Booking, Booking.creator_id == CreatorProfile.id).group_by(CreatorProfile.category)).all()
    by_city = db.execute(select(CreatorProfile.city, func.count(Booking.id)).join(
        Booking, Booking.creator_id == CreatorProfile.id).group_by(CreatorProfile.city).order_by(
        func.count(Booking.id).desc()).limit(8)).all()
    users_m = {}
    for u in db.scalars(select(User).where(User.created_at >= utcnow() - timedelta(days=200))):
        k = u.created_at.strftime("%Y-%m")
        users_m[k] = users_m.get(k, 0) + 1
    paid = db.scalar(select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status == PAY_PAID)) or 0
    total = len(bookings)
    done = sum(1 for b in bookings if b.status == ST_COMPLETED)
    return {
        "series": monthly_series(bookings, 12),
        "by_category": [{"name": n or "—", "count": c} for n, c in by_cat],
        "by_city": [{"name": n or "—", "count": c} for n, c in by_city],
        "users_by_month": [{"month": k, "count": v} for k, v in sorted(users_m.items())],
        "payments_paid": paid, "conversion": round(done / total * 100, 1) if total else 0,
        "open_complaints": db.scalar(select(func.count(Complaint.id)).where(Complaint.status == "open")) or 0,
    }
