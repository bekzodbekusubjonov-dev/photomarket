import calendar
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..contracts import apply_cancellation, ensure_contract, money
from ..database import get_db
from ..deps import get_current_user, require_roles
from ..models import (
    BlockedDate, Booking, CreatorProfile, Review, Service, User,
    ROLE_ADMIN, ROLE_CLIENT, ROLE_CREATOR,
    ST_ACCEPTED, ST_CANCELLED, ST_COMPLETED, ST_PENDING, ST_REJECTED, STATUSES,
)
from ..schemas import BookingIn, BookingUpdateIn, ReplyIn, ReviewIn, StatusIn
from ..services import STATUS_LABELS, booking_out, check_slot_free, notify, recalc_creator_rating, review_out

router = APIRouter(prefix="/api/bookings", tags=["bookings"])

_LOAD = (selectinload(Booking.client), selectinload(Booking.creator).selectinload(CreatorProfile.user),
         selectinload(Booking.service), selectinload(Booking.review))


def _scoped(user: User):
    stmt = select(Booking)
    if user.role == ROLE_CLIENT:
        stmt = stmt.where(Booking.client_id == user.id)
    elif user.role == ROLE_CREATOR:
        cid = user.creator_profile.id if user.creator_profile else -1
        stmt = stmt.where(Booking.creator_id == cid)
    return stmt


def _get_booking(db: Session, booking_id: int, user: User) -> Booking:
    b = db.scalar(_scoped(user).where(Booking.id == booking_id).options(*_LOAD))
    if not b:
        raise HTTPException(404, "Buyurtma topilmadi")
    return b


def _out(b: Booking, user: User) -> dict:
    d = booking_out(b, detail=True)
    # mijoz kontaktlari faqat qabul qilingan/bajarilgan buyurtmada ijodkorga ko'rinadi
    if user.role == ROLE_CREATOR and b.status not in (ST_ACCEPTED, ST_COMPLETED):
        d["client_contact"] = None
    if user.role == ROLE_CLIENT:
        d["client_contact"] = None
        d["creator_contact"] = ({"email": b.creator.user.email, "phone": b.creator.user.phone,
                                 "telegram": b.creator.telegram}
                                if b.status in (ST_ACCEPTED, ST_COMPLETED) else None)
    return d


@router.post("", status_code=201)
def create_booking(data: BookingIn, background: BackgroundTasks,
                   user: User = Depends(require_roles(ROLE_CLIENT)), db: Session = Depends(get_db)):
    creator = db.get(CreatorProfile, data.creator_id)
    if not creator or not creator.active or not creator.user.is_active:
        raise HTTPException(404, "Ijodkor topilmadi yoki hozir buyurtma qabul qilmaydi")
    if data.event_date < date.today():
        raise HTTPException(400, "O'tgan sanaga buyurtma berib bo'lmaydi")
    open_count = db.scalar(select(func.count(Booking.id)).where(
        Booking.client_id == user.id, Booking.creator_id == creator.id, Booking.status == ST_PENDING)) or 0
    if open_count >= 3:
        raise HTTPException(429, "Bu ijodkorga javob kutilayotgan buyurtmalaringiz ko'p. Avval javobni kuting")
    price = data.price
    service = None
    if data.service_id:
        service = db.get(Service, data.service_id)
        if not service or service.creator_id != creator.id or not service.active:
            raise HTTPException(400, "Tanlangan xizmat topilmadi")
        price = service.price
    check_slot_free(db, creator.id, data.event_date, data.start_time, data.duration_hours)
    b = Booking(client_id=user.id, creator_id=creator.id, service_id=service.id if service else None,
                title=data.title.strip(), event_date=data.event_date, start_time=data.start_time,
                duration_hours=data.duration_hours, location=data.location.strip(),
                details=data.details.strip(), price=price, lat=data.lat, lng=data.lng)
    db.add(b)
    db.flush()
    notify(db, creator.user, "booking_new", "Yangi buyurtma",
           f"{user.name}: «{b.title}», {b.event_date.strftime('%d.%m.%Y')} {b.start_time}, {b.location}",
           f"/dashboard/bookings/{b.id}", background, email=True)
    db.commit()
    return _out(_get_booking(db, b.id, user), user)


@router.get("")
def list_bookings(
    status: str | None = None,
    q: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    sort: str = Query("newest", pattern="^(newest|oldest|event_asc|event_desc)$"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = _scoped(user)
    if status:
        sts = [s for s in status.split(",") if s in STATUSES]
        if sts:
            stmt = stmt.where(Booking.status.in_(sts))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.join(User, User.id == Booking.client_id).join(
            CreatorProfile, CreatorProfile.id == Booking.creator_id).where(
            or_(Booking.title.ilike(like), Booking.location.ilike(like), User.name.ilike(like),
                CreatorProfile.display_name.ilike(like)))
    if date_from:
        stmt = stmt.where(Booking.event_date >= date_from)
    if date_to:
        stmt = stmt.where(Booking.event_date <= date_to)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    order = {"newest": Booking.created_at.desc(), "oldest": Booking.created_at.asc(),
             "event_asc": Booking.event_date.asc(), "event_desc": Booking.event_date.desc()}[sort]
    rows = db.scalars(stmt.options(*_LOAD).order_by(order, Booking.id.desc())
                      .offset((page - 1) * size).limit(size)).all()
    # status bo'yicha hisoblagich (filtrsiz)
    sq = _scoped(user).subquery()
    counts = dict(db.execute(select(sq.c.status, func.count()).group_by(sq.c.status)).all())
    return {"items": [booking_out(b) for b in rows], "total": total, "page": page,
            "pages": max(1, -(-total // size)), "counts": counts}


@router.get("/calendar")
def bookings_calendar(month: str | None = None, user: User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    today = date.today()
    try:
        y, m = (int(x) for x in month.split("-")) if month else (today.year, today.month)
        first = date(y, m, 1)
    except ValueError:
        raise HTTPException(400, "Oy formati YYYY-MM bo'lsin")
    last = date(y, m, calendar.monthrange(y, m)[1])
    rows = db.scalars(_scoped(user).where(Booking.event_date.between(first, last),
                                          Booking.status.in_([ST_PENDING, ST_ACCEPTED, ST_COMPLETED]))
                      .options(*_LOAD).order_by(Booking.event_date, Booking.start_time)).all()
    blocked = []
    if user.role == ROLE_CREATOR and user.creator_profile:
        blocked = [{"id": b.id, "day": b.day, "note": b.note} for b in db.scalars(
            select(BlockedDate).where(BlockedDate.creator_id == user.creator_profile.id,
                                      BlockedDate.day.between(first, last)))]
    return {"month": first.strftime("%Y-%m"), "bookings": [booking_out(b) for b in rows], "blocked": blocked}


@router.get("/{booking_id}")
def get_booking(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _out(_get_booking(db, booking_id, user), user)


@router.put("/{booking_id}")
def update_booking(booking_id: int, data: BookingUpdateIn, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    b = _get_booking(db, booking_id, user)
    if user.role not in (ROLE_CLIENT, ROLE_ADMIN):
        raise HTTPException(403, "Buyurtmani faqat mijoz tahrirlay oladi")
    if b.status != ST_PENDING:
        raise HTTPException(400, "Faqat javob kutilayotgan buyurtmani tahrirlash mumkin")
    if data.event_date < date.today():
        raise HTTPException(400, "O'tgan sanani tanlab bo'lmaydi")
    check_slot_free(db, b.creator_id, data.event_date, data.start_time, data.duration_hours, b.id)
    b.title, b.event_date, b.start_time = data.title.strip(), data.event_date, data.start_time
    b.duration_hours, b.location, b.details = data.duration_hours, data.location.strip(), data.details.strip()
    b.lat, b.lng = data.lat, data.lng
    if not b.service_id:
        b.price = data.price
    notify(db, b.creator.user, "booking_updated", "Buyurtma o'zgartirildi",
           f"«{b.title}» buyurtmasi tafsilotlari yangilandi", f"/dashboard/bookings/{b.id}")
    db.commit()
    return _out(b, user)


# Ruxsat etilgan o'tishlar: rol -> {joriy_holat: {yangi_holatlar}}
TRANSITIONS = {
    ROLE_CREATOR: {ST_PENDING: {ST_ACCEPTED, ST_REJECTED}, ST_ACCEPTED: {ST_COMPLETED, ST_CANCELLED}},
    ROLE_CLIENT: {ST_PENDING: {ST_CANCELLED}, ST_ACCEPTED: {ST_CANCELLED}},
    ROLE_ADMIN: {s: set(STATUSES) - {s, ST_PENDING} for s in STATUSES},
}


@router.post("/{booking_id}/status")
def change_status(booking_id: int, data: StatusIn, background: BackgroundTasks,
                  user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = _get_booking(db, booking_id, user)
    allowed = TRANSITIONS.get(user.role, {}).get(b.status, set())
    if data.status not in allowed:
        raise HTTPException(400, f"«{STATUS_LABELS[b.status]}» holatidagi buyurtmani "
                                 f"«{STATUS_LABELS[data.status]}» holatiga o'tkazib bo'lmaydi")
    if data.status == ST_ACCEPTED:
        check_slot_free(db, b.creator_id, b.event_date, b.start_time, b.duration_hours, b.id)
    if data.status == ST_COMPLETED and b.event_date > date.today() and user.role != ROLE_ADMIN:
        raise HTTPException(400, "Tadbir sanasi hali kelmagan — bajarildi deb belgilab bo'lmaydi")
    b.status = data.status
    b.status_note = data.note.strip()
    link = f"/dashboard/bookings/{b.id}"
    label = STATUS_LABELS[data.status]
    body = f"«{b.title}» ({b.event_date.strftime('%d.%m.%Y')}) — {label}."
    if b.status_note:
        body += f" Izoh: {b.status_note}"
    if user.role in (ROLE_CREATOR, ROLE_ADMIN):
        notify(db, b.client, f"booking_{data.status}", f"Buyurtma holati: {label}", body, link, background,
               email=data.status in (ST_ACCEPTED, ST_REJECTED, ST_CANCELLED, ST_COMPLETED))
    if user.role in (ROLE_CLIENT, ROLE_ADMIN):
        notify(db, b.creator.user, f"booking_{data.status}", f"Buyurtma holati: {label}", body, link,
               background, email=data.status == ST_CANCELLED)
    if data.status == ST_COMPLETED:
        db.flush()
        recalc_creator_rating(db, b.creator)
    if data.status == ST_ACCEPTED:
        db.flush()
        con = ensure_contract(db, b)
        for u in (b.client, b.creator.user):
            notify(db, u, "contract_new", f"Shartnoma {con.number} tayyor — imzolang",
                   f"«{b.title}» buyurtmasi uchun elektron shartnoma yaratildi", f"/dashboard/contracts/{con.id}",
                   background, email=True)
    if data.status == ST_CANCELLED:
        con = apply_cancellation(db, b, user.role, user.id)
        if con and con.cancel_fee:
            notify(db, b.creator.user, "contract_cancel_fee",
                   f"Bekor qilish kompensatsiyasi: {money(con.cancel_to_creator)} so'm",
                   f"Shartnoma {con.number}", f"/dashboard/contracts/{con.id}", background)
    db.commit()
    return _out(b, user)


@router.delete("/{booking_id}")
def delete_booking(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = _get_booking(db, booking_id, user)
    if user.role == ROLE_CLIENT and b.status not in (ST_PENDING, ST_CANCELLED, ST_REJECTED):
        raise HTTPException(400, "Faqat kutilayotgan, bekor qilingan yoki rad etilgan buyurtmani o'chirish mumkin")
    if user.role == ROLE_CREATOR:
        raise HTTPException(403, "Ijodkor buyurtmani o'chira olmaydi — rad eting yoki bekor qiling")
    creator = b.creator
    db.delete(b)
    db.flush()
    recalc_creator_rating(db, creator)
    db.commit()
    return {"ok": True}


# ---------------- Sharhlar ----------------
@router.post("/{booking_id}/review", status_code=201)
def add_review(booking_id: int, data: ReviewIn, background: BackgroundTasks,
               user: User = Depends(require_roles(ROLE_CLIENT)), db: Session = Depends(get_db)):
    b = _get_booking(db, booking_id, user)
    if b.status != ST_COMPLETED:
        raise HTTPException(400, "Sharh faqat bajarilgan buyurtmaga yoziladi")
    if b.review:
        raise HTTPException(409, "Bu buyurtmaga sharh allaqachon yozilgan")
    r = Review(booking_id=b.id, client_id=user.id, creator_id=b.creator_id, rating=data.rating,
               comment=data.comment.strip())
    db.add(r)
    db.flush()
    recalc_creator_rating(db, b.creator)
    notify(db, b.creator.user, "review_new", f"Yangi sharh: {'★' * data.rating}",
           (data.comment.strip() or "Mijoz baho qoldirdi")[:300], "/dashboard/reviews", background, email=True)
    db.commit()
    db.refresh(r)
    return review_out(r)


reviews = APIRouter(prefix="/api/reviews", tags=["reviews"])


@reviews.get("/latest")
def latest_reviews(limit: int = Query(6, ge=1, le=20), db: Session = Depends(get_db)):
    """Bosh sahifa uchun: haqiqiy mijozlarning so'nggi ijobiy sharhlari."""
    rows = db.scalars(select(Review).where(Review.rating >= 4, Review.comment != "")
                      .options(selectinload(Review.client), selectinload(Review.creator))
                      .order_by(Review.created_at.desc()).limit(limit))
    return [review_out(r) for r in rows]


@reviews.get("/mine")
def my_reviews(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Review).options(selectinload(Review.client), selectinload(Review.creator))
    if user.role == ROLE_CREATOR:
        stmt = stmt.where(Review.creator_id == (user.creator_profile.id if user.creator_profile else -1))
    elif user.role == ROLE_CLIENT:
        stmt = stmt.where(Review.client_id == user.id)
    return [review_out(r) for r in db.scalars(stmt.order_by(Review.created_at.desc()).limit(200))]


@reviews.post("/{review_id}/reply")
def reply_review(review_id: int, data: ReplyIn, user: User = Depends(require_roles(ROLE_CREATOR)),
                 db: Session = Depends(get_db)):
    r = db.get(Review, review_id)
    if not r or not user.creator_profile or r.creator_id != user.creator_profile.id:
        raise HTTPException(404, "Sharh topilmadi")
    r.reply = data.reply.strip()
    notify(db, r.client, "review_reply", "Sharhingizga javob berildi", r.reply[:300],
           f"/creators/{r.creator_id}")
    db.commit()
    return review_out(r)
