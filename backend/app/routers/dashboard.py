from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, true
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import get_current_user
from ..models import Booking, CreatorProfile, User, ROLE_CLIENT, ROLE_CREATOR, ST_ACCEPTED, ST_COMPLETED, ST_PENDING
from ..i18n import current_lang
from ..services import booking_out

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

MONTHS_SHORT = {
    "uz": ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"],
    "ru": ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"],
    "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
}


def month_keys(n: int = 6) -> list[tuple[int, int]]:
    t = date.today()
    y, m = t.year, t.month
    keys = []
    for _ in range(n):
        keys.append((y, m))
        m -= 1
        if m == 0:
            y, m = y - 1, 12
    return list(reversed(keys))


def monthly_series(bookings: list[Booking], n: int = 6) -> list[dict]:
    keys = month_keys(n)
    data = {k: {"bookings": 0, "completed": 0, "revenue": 0} for k in keys}
    for b in bookings:
        k = (b.event_date.year, b.event_date.month)
        if k in data:
            data[k]["bookings"] += 1
            if b.status == ST_COMPLETED:
                data[k]["completed"] += 1
                data[k]["revenue"] += b.price or 0
    months = MONTHS_SHORT.get(current_lang.get(), MONTHS_SHORT["uz"])
    return [{"label": f"{months[m - 1]} {str(y)[2:]}", **data[(y, m)]} for y, m in keys]


@router.get("/stats")
def stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == ROLE_CREATOR and user.creator_profile:
        cond = Booking.creator_id == user.creator_profile.id
    elif user.role == ROLE_CLIENT:
        cond = Booking.client_id == user.id
    else:
        cond = true()
    counts = dict(db.execute(select(Booking.status, func.count()).where(cond).group_by(Booking.status)).all())
    total_money = db.scalar(select(func.coalesce(func.sum(Booking.price), 0)).where(
        cond, Booking.status == ST_COMPLETED)) or 0
    start = date.today().replace(day=1) - timedelta(days=200)
    recent = db.scalars(select(Booking).where(cond, Booking.event_date >= start)).all()
    upcoming = db.scalars(select(Booking).where(cond, Booking.event_date >= date.today(),
                                                Booking.status.in_([ST_ACCEPTED, ST_PENDING]))
                          .options(selectinload(Booking.client),
                                   selectinload(Booking.creator).selectinload(CreatorProfile.user),
                                   selectinload(Booking.service), selectinload(Booking.review))
                          .order_by(Booking.event_date, Booking.start_time).limit(6)).all()
    out = {
        "counts": counts,
        "total": sum(counts.values()),
        "money": total_money,
        "series": monthly_series(recent),
        "upcoming": [booking_out(b) for b in upcoming],
    }
    if user.role == ROLE_CREATOR and user.creator_profile:
        c = user.creator_profile
        decided = counts.get(ST_ACCEPTED, 0) + counts.get(ST_COMPLETED, 0) + counts.get("rejected", 0)
        out.update({
            "rating": c.rating, "reviews_count": c.reviews_count,
            "acceptance_rate": round(100 * (decided - counts.get("rejected", 0)) / decided) if decided else None,
            "portfolio_count": len(c.portfolio), "services_count": len(c.services),
        })
    return out
