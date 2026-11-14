from fastapi import APIRouter, Depends
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..images import site_images
from ..models import Booking, CreatorProfile, PortfolioItem, Review, User, ROLE_CREATOR, ST_COMPLETED
from ..services import review_out

router = APIRouter(prefix="/api/site", tags=["site"])


def _visible():
    return (select(CreatorProfile.id).join(User, User.id == CreatorProfile.user_id)
            .where(CreatorProfile.active.is_(True), User.is_active.is_(True), User.is_verified.is_(True),
                   User.role == ROLE_CREATOR))


@router.get("")
def site_info(db: Session = Depends(get_db)):
    vis = _visible().subquery()
    creators = db.scalar(select(func.count()).select_from(vis)) or 0
    cities = db.scalar(select(func.count(distinct(CreatorProfile.city))).where(CreatorProfile.id.in_(select(vis.c.id)))) or 0
    completed = db.scalar(select(func.count(Booking.id)).where(Booking.status == ST_COMPLETED)) or 0
    avg = db.scalar(select(func.avg(Review.rating))) or 0
    reviews_total = db.scalar(select(func.count(Review.id))) or 0
    # har ijodkordan 2 tadan — galereya xilma-xil bo'lsin
    items = db.scalars(select(PortfolioItem).where(PortfolioItem.creator_id.in_(select(vis.c.id)))
                       .options(selectinload(PortfolioItem.creator)).order_by(PortfolioItem.position, PortfolioItem.id.desc())
                       .limit(60)).all()
    showcase, per = [], {}
    for p in items:
        if per.get(p.creator_id, 0) >= 2:
            continue
        per[p.creator_id] = per.get(p.creator_id, 0) + 1
        showcase.append({"id": p.id, "image_url": p.image_url, "title": p.title, "creator_id": p.creator_id,
                         "creator_name": p.creator.display_name})
        if len(showcase) >= 10:
            break
    revs = db.scalars(select(Review).where(Review.rating >= 4, Review.comment != "")
                      .options(selectinload(Review.client), selectinload(Review.creator))
                      .order_by(Review.created_at.desc()).limit(6)).all()
    return {
        "images": site_images(),
        "stats": {"creators": creators, "cities": cities, "completed": completed,
                  "rating": round(float(avg), 1), "reviews": reviews_total},
        "showcase": showcase,
        "testimonials": [review_out(r) for r in revs],
    }
