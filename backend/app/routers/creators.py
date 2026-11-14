import calendar
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import and_, distinct, exists, func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import require_creator
from ..models import (
    BlockedDate, Booking, CreatorProfile, PortfolioItem, Review, Service, User,
    ROLE_CREATOR, ST_ACCEPTED,
)
from ..schemas import BlockedDateIn, CreatorProfileIn, PortfolioUpdateIn, ServiceIn
from ..services import creator_card, creator_full, portfolio_out, review_out, service_out
from ..uploads import delete_upload, save_image

router = APIRouter(prefix="/api/creators", tags=["creators"])

SPECIALTIES = [
    "To'y", "Nikoh (ZAGS)", "Love story", "Portret", "Oilaviy", "Bolalar", "Tug'ilgan kun",
    "Korporativ", "Reklama", "Mahsulot (predmet)", "Taom", "Ko'chmas mulk", "Tadbir / konsert",
    "Bitiruv", "Klip", "Drone (aerosyomka)", "Reels / SMM",
]
MAX_PORTFOLIO = 60


def _parse_month(month: str | None) -> tuple[date, date]:
    today = date.today()
    try:
        y, m = (int(x) for x in month.split("-")) if month else (today.year, today.month)
        first = date(y, m, 1)
    except (ValueError, AttributeError):
        raise HTTPException(400, "Oy formati YYYY-MM bo'lsin")
    last = date(y, m, calendar.monthrange(y, m)[1])
    return first, last


def _public_base():
    return (
        select(CreatorProfile)
        .join(User, User.id == CreatorProfile.user_id)
        .where(CreatorProfile.active.is_(True), User.is_active.is_(True), User.is_verified.is_(True),
               User.role == ROLE_CREATOR)
    )


# ===================== Ommaviy =====================
@router.get("")
def list_creators(
    q: str | None = None,
    category: str | None = Query(None, pattern="^(photographer|videographer)$"),
    city: str | None = None,
    min_price: int | None = Query(None, ge=0),
    max_price: int | None = Query(None, ge=0),
    min_rating: float | None = Query(None, ge=0, le=5),
    specialty: str | None = None,
    available_on: date | None = None,
    verified: bool | None = None,
    sort: str = Query("recommended", pattern="^(recommended|rating|price_asc|price_desc|newest|reviews|nearest)$"),
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    page: int = Query(1, ge=1),
    size: int = Query(12, ge=1, le=48),
    db: Session = Depends(get_db),
):
    stmt = _public_base()
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(CreatorProfile.display_name.ilike(like), CreatorProfile.bio.ilike(like),
                              CreatorProfile.specialties.ilike(like), CreatorProfile.city.ilike(like)))
    if category:
        stmt = stmt.where(CreatorProfile.category.in_([category, "both"]))
    if city:
        stmt = stmt.where(CreatorProfile.city.ilike(city.strip()))
    if min_price is not None:
        stmt = stmt.where(CreatorProfile.price_from >= min_price)
    if max_price is not None:
        stmt = stmt.where(CreatorProfile.price_from <= max_price)
    if min_rating:
        stmt = stmt.where(CreatorProfile.rating >= min_rating)
    if specialty:
        stmt = stmt.where(CreatorProfile.specialties.ilike(f"%{specialty.strip()}%"))
    if verified:
        stmt = stmt.where(CreatorProfile.verified.is_(True))
    if available_on:
        stmt = stmt.where(
            ~exists().where(and_(BlockedDate.creator_id == CreatorProfile.id, BlockedDate.day == available_on)),
            ~exists().where(and_(Booking.creator_id == CreatorProfile.id, Booking.event_date == available_on,
                                 Booking.status == ST_ACCEPTED)),
        )

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    order = {
        "recommended": [CreatorProfile.featured.desc(), CreatorProfile.verified.desc(),
                        CreatorProfile.rating.desc(), CreatorProfile.reviews_count.desc()],
        "rating": [CreatorProfile.rating.desc(), CreatorProfile.reviews_count.desc()],
        "price_asc": [CreatorProfile.price_from.asc()],
        "price_desc": [CreatorProfile.price_from.desc()],
        "newest": [CreatorProfile.created_at.desc()],
        "reviews": [CreatorProfile.reviews_count.desc()],
        "nearest": [CreatorProfile.featured.desc(), CreatorProfile.rating.desc()],
    }[sort]
    if sort == "nearest" and lat is not None and lng is not None:
        from ..geo import haversine_km
        allrows = db.scalars(stmt.options(selectinload(CreatorProfile.portfolio), selectinload(CreatorProfile.user))
                             .limit(1000)).all()
        scored = sorted(allrows, key=lambda c: (haversine_km(lat, lng, c.lat, c.lng)
                                               if c.lat is not None and c.lng is not None else 1e9))
        page_rows = scored[(page - 1) * size: page * size]
        items = []
        for c in page_rows:
            d = creator_card(c)
            d["distance_km"] = (round(haversine_km(lat, lng, c.lat, c.lng), 1)
                                if c.lat is not None and c.lng is not None else None)
            items.append(d)
        return {"items": items, "total": len(scored), "page": page, "pages": max(1, -(-len(scored) // size))}
    rows = db.scalars(
        stmt.options(selectinload(CreatorProfile.portfolio), selectinload(CreatorProfile.user))
        .order_by(*order, CreatorProfile.id.desc()).offset((page - 1) * size).limit(size)
    ).all()
    return {"items": [creator_card(c) for c in rows], "total": total, "page": page,
            "pages": max(1, -(-total // size))}


@router.get("/meta")
def creators_meta(db: Session = Depends(get_db)):
    base = _public_base().subquery()
    cities = db.scalars(select(distinct(base.c.city)).order_by(base.c.city)).all()
    lo, hi = db.execute(select(func.min(base.c.price_from), func.max(base.c.price_from))).one()
    counts = db.execute(select(base.c.category, func.count()).group_by(base.c.category)).all()
    done = db.scalar(select(func.count(Booking.id)).where(Booking.status == "completed")) or 0
    avg = db.scalar(select(func.avg(Review.rating))) or 0
    return {"cities": [c for c in cities if c], "specialties": SPECIALTIES,
            "completed_bookings": done, "avg_rating": round(float(avg), 1),
            "price_min": lo or 0, "price_max": hi or 0,
            "counts": {k: v for k, v in counts}, "total": sum(v for _, v in counts)}


@router.get("/{creator_id}")
def get_creator(creator_id: int, db: Session = Depends(get_db)):
    c = db.scalar(_public_base().where(CreatorProfile.id == creator_id).options(
        selectinload(CreatorProfile.portfolio), selectinload(CreatorProfile.services),
        selectinload(CreatorProfile.user)))
    if not c:
        raise HTTPException(404, "Ijodkor topilmadi")
    d = creator_full(c)
    dist = db.execute(select(Review.rating, func.count()).where(Review.creator_id == c.id)
                      .group_by(Review.rating)).all()
    d["rating_breakdown"] = {str(k): 0 for k in range(1, 6)} | {str(r): n for r, n in dist}
    return d


@router.get("/{creator_id}/reviews")
def creator_reviews(creator_id: int, page: int = Query(1, ge=1), size: int = Query(10, ge=1, le=50),
                    db: Session = Depends(get_db)):
    base = select(Review).where(Review.creator_id == creator_id)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.scalars(base.options(selectinload(Review.client), selectinload(Review.creator))
                      .order_by(Review.created_at.desc()).offset((page - 1) * size).limit(size)).all()
    return {"items": [review_out(r) for r in rows], "total": total, "page": page,
            "pages": max(1, -(-total // size))}


@router.get("/{creator_id}/availability")
def creator_availability(creator_id: int, month: str | None = None, db: Session = Depends(get_db)):
    first, last = _parse_month(month)
    blocked = db.scalars(select(BlockedDate.day).where(
        BlockedDate.creator_id == creator_id, BlockedDate.day.between(first, last))).all()
    booked = db.execute(select(Booking.event_date, Booking.start_time, Booking.duration_hours).where(
        Booking.creator_id == creator_id, Booking.status == ST_ACCEPTED,
        Booking.event_date.between(first, last))).all()
    busy: dict[str, list] = {}
    for d, t, dur in booked:
        busy.setdefault(d.isoformat(), []).append({"start_time": t, "duration_hours": dur})
    return {"month": first.strftime("%Y-%m"), "blocked": [d.isoformat() for d in blocked], "booked": busy}


# ===================== Ijodkor kabineti =====================
me = APIRouter(prefix="/api/creator", tags=["creator-cabinet"])


def _profile(user: User) -> CreatorProfile:
    return user.creator_profile  # require_creator mavjudligini kafolatlaydi


@me.get("/profile")
def my_profile(user: User = Depends(require_creator)):
    c = _profile(user)
    d = creator_full(c)
    d["services"] = [service_out(s) for s in c.services]
    checks = [bool(user.avatar_url), bool(c.bio and len(c.bio) >= 40), c.price_from > 0,
              len(c.portfolio) >= 3, len(c.services) >= 1, bool(c.specialties_list), bool(user.phone)]
    d["completeness"] = round(100 * sum(checks) / len(checks))
    return d


@me.put("/profile")
def update_my_profile(data: CreatorProfileIn, user: User = Depends(require_creator), db: Session = Depends(get_db)):
    c = _profile(user)
    c.display_name = data.display_name.strip()
    c.category = data.category
    c.city = data.city.strip()
    c.price_from = data.price_from
    c.bio = data.bio.strip()
    c.specialties = ",".join(data.specialties)
    c.experience_years = data.experience_years
    c.instagram = data.instagram.strip().lstrip("@")
    c.telegram = data.telegram.strip().lstrip("@")
    c.active = data.active
    c.lat, c.lng, c.address = data.lat, data.lng, data.address.strip()
    db.commit()
    return creator_full(c)


@me.post("/cover")
async def upload_cover(file: UploadFile = File(...), user: User = Depends(require_creator),
                       db: Session = Depends(get_db)):
    c = _profile(user)
    url = await save_image(file, "covers", max_side=2000)
    delete_upload(c.cover_url)
    c.cover_url = url
    db.commit()
    return {"cover_url": url}


# ---- Portfolio ----
@me.get("/portfolio")
def my_portfolio(user: User = Depends(require_creator)):
    return [portfolio_out(p) for p in _profile(user).portfolio]


@me.post("/portfolio")
async def add_portfolio(file: UploadFile = File(...), title: str = Form(""), category: str = Form(""),
                        user: User = Depends(require_creator), db: Session = Depends(get_db)):
    c = _profile(user)
    if len(c.portfolio) >= MAX_PORTFOLIO:
        raise HTTPException(400, f"Portfolioda ko'pi bilan {MAX_PORTFOLIO} ta rasm bo'lishi mumkin")
    url = await save_image(file, "portfolio")
    pos = (max((p.position for p in c.portfolio), default=0) + 1)
    item = PortfolioItem(creator_id=c.id, image_url=url, title=title[:140], category=category[:60], position=pos)
    db.add(item)
    db.commit()
    return portfolio_out(item)


@me.put("/portfolio/{item_id}")
def update_portfolio(item_id: int, data: PortfolioUpdateIn, user: User = Depends(require_creator),
                     db: Session = Depends(get_db)):
    item = db.get(PortfolioItem, item_id)
    if not item or item.creator_id != _profile(user).id:
        raise HTTPException(404, "Rasm topilmadi")
    item.title, item.category = data.title, data.category
    if data.position is not None:
        item.position = data.position
    db.commit()
    return portfolio_out(item)


@me.delete("/portfolio/{item_id}")
def delete_portfolio(item_id: int, user: User = Depends(require_creator), db: Session = Depends(get_db)):
    item = db.get(PortfolioItem, item_id)
    if not item or item.creator_id != _profile(user).id:
        raise HTTPException(404, "Rasm topilmadi")
    delete_upload(item.image_url)
    db.delete(item)
    db.commit()
    return {"ok": True}


# ---- Xizmatlar (paketlar) ----
@me.get("/services")
def my_services(user: User = Depends(require_creator)):
    return [service_out(s) for s in _profile(user).services]


@me.post("/services")
def add_service(data: ServiceIn, user: User = Depends(require_creator), db: Session = Depends(get_db)):
    c = _profile(user)
    if len(c.services) >= 20:
        raise HTTPException(400, "Ko'pi bilan 20 ta xizmat qo'shish mumkin")
    s = Service(creator_id=c.id, **data.model_dump())
    db.add(s)
    db.flush()
    if c.price_from == 0 or data.price < c.price_from:
        c.price_from = data.price
    db.commit()
    return service_out(s)


@me.put("/services/{service_id}")
def update_service(service_id: int, data: ServiceIn, user: User = Depends(require_creator),
                   db: Session = Depends(get_db)):
    s = db.get(Service, service_id)
    if not s or s.creator_id != _profile(user).id:
        raise HTTPException(404, "Xizmat topilmadi")
    for k, v in data.model_dump().items():
        setattr(s, k, v)
    db.commit()
    return service_out(s)


@me.delete("/services/{service_id}")
def delete_service(service_id: int, user: User = Depends(require_creator), db: Session = Depends(get_db)):
    s = db.get(Service, service_id)
    if not s or s.creator_id != _profile(user).id:
        raise HTTPException(404, "Xizmat topilmadi")
    db.delete(s)
    db.commit()
    return {"ok": True}


# ---- Band kunlar (kalendar) ----
@me.get("/blocked")
def my_blocked(month: str | None = None, user: User = Depends(require_creator), db: Session = Depends(get_db)):
    first, last = _parse_month(month)
    rows = db.scalars(select(BlockedDate).where(BlockedDate.creator_id == _profile(user).id,
                                                BlockedDate.day.between(first, last)).order_by(BlockedDate.day))
    return [{"id": b.id, "day": b.day, "note": b.note} for b in rows]


@me.post("/blocked")
def add_blocked(data: BlockedDateIn, user: User = Depends(require_creator), db: Session = Depends(get_db)):
    c = _profile(user)
    if data.day < date.today():
        raise HTTPException(400, "O'tgan sanani band qilib bo'lmaydi")
    if db.scalar(select(BlockedDate).where(BlockedDate.creator_id == c.id, BlockedDate.day == data.day)):
        raise HTTPException(409, "Bu sana allaqachon band qilingan")
    if db.scalar(select(Booking.id).where(Booking.creator_id == c.id, Booking.event_date == data.day,
                                          Booking.status == ST_ACCEPTED)):
        raise HTTPException(409, "Bu sanada tasdiqlangan buyurtma bor")
    b = BlockedDate(creator_id=c.id, day=data.day, note=data.note)
    db.add(b)
    db.commit()
    return {"id": b.id, "day": b.day, "note": b.note}


@me.delete("/blocked/{blocked_id}")
def delete_blocked(blocked_id: int, user: User = Depends(require_creator), db: Session = Depends(get_db)):
    b = db.get(BlockedDate, blocked_id)
    if not b or b.creator_id != _profile(user).id:
        raise HTTPException(404, "Topilmadi")
    db.delete(b)
    db.commit()
    return {"ok": True}
