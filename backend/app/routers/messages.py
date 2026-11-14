from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import and_, case, func, or_, select, update
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Booking, Message, Notification, User, ROLE_ADMIN, ROLE_CLIENT, ROLE_CREATOR
from ..ratelimit import limit
from ..schemas import MessageIn
from ..services import notify, user_public

router = APIRouter(prefix="/api/messages", tags=["messages"])


def _msg_out(m: Message) -> dict:
    return {"id": m.id, "sender_id": m.sender_id, "recipient_id": m.recipient_id, "booking_id": m.booking_id,
            "body": m.body, "is_read": m.is_read, "created_at": m.created_at}


def _pair(a: int, b: int):
    return or_(and_(Message.sender_id == a, Message.recipient_id == b),
               and_(Message.sender_id == b, Message.recipient_id == a))


def _can_message(db: Session, me: User, other: User) -> bool:
    if ROLE_ADMIN in (me.role, other.role):
        return True
    if me.role == ROLE_CLIENT and other.role == ROLE_CREATOR:
        return True
    if me.role == ROLE_CREATOR and other.role == ROLE_CLIENT:
        # ijodkor faqat o'ziga yozgan yoki buyurtma bergan mijozga yoza oladi
        has_thread = db.scalar(select(Message.id).where(_pair(me.id, other.id)).limit(1))
        has_booking = me.creator_profile and db.scalar(select(Booking.id).where(
            Booking.creator_id == me.creator_profile.id, Booking.client_id == other.id).limit(1))
        return bool(has_thread or has_booking)
    return False


@router.get("/conversations")
def conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    partner = case((Message.sender_id == user.id, Message.recipient_id), else_=Message.sender_id).label("partner")
    unread = func.sum(case((and_(Message.recipient_id == user.id, Message.is_read.is_(False)), 1), else_=0))
    rows = db.execute(
        select(partner, func.max(Message.id).label("last_id"), unread.label("unread"))
        .where(or_(Message.sender_id == user.id, Message.recipient_id == user.id))
        .group_by(partner).order_by(func.max(Message.id).desc()).limit(100)
    ).all()
    if not rows:
        return []
    users = {u.id: u for u in db.scalars(select(User).where(User.id.in_([r.partner for r in rows])))}
    lasts = {m.id: m for m in db.scalars(select(Message).where(Message.id.in_([r.last_id for r in rows])))}
    out = []
    for r in rows:
        u = users.get(r.partner)
        if not u:
            continue
        pub = user_public(u)
        if u.creator_profile:
            pub["creator_id"] = u.creator_profile.id
            pub["display_name"] = u.creator_profile.display_name
        out.append({"user": pub, "last_message": _msg_out(lasts[r.last_id]), "unread": int(r.unread or 0)})
    return out


@router.get("/unread-count")
def unread_count(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    msgs = db.scalar(select(func.count(Message.id)).where(Message.recipient_id == user.id,
                                                          Message.is_read.is_(False))) or 0
    notifs = db.scalar(select(func.count(Notification.id)).where(Notification.user_id == user.id,
                                                                 Notification.is_read.is_(False))) or 0
    return {"messages": msgs, "notifications": notifs}


@router.get("/with/{other_id}")
def thread(other_id: int, after_id: int = Query(0, ge=0), user: User = Depends(get_current_user),
           db: Session = Depends(get_db)):
    other = db.get(User, other_id)
    if not other or other.id == user.id:
        raise HTTPException(404, "Foydalanuvchi topilmadi")
    stmt = select(Message).where(_pair(user.id, other.id))
    if after_id:
        stmt = stmt.where(Message.id > after_id).order_by(Message.id.asc()).limit(200)
        msgs = list(db.scalars(stmt))
    else:
        msgs = list(reversed(db.scalars(stmt.order_by(Message.id.desc()).limit(200)).all()))
    db.execute(update(Message).where(Message.sender_id == other.id, Message.recipient_id == user.id,
                                     Message.is_read.is_(False)).values(is_read=True))
    db.commit()
    pub = user_public(other)
    if other.creator_profile:
        pub["creator_id"] = other.creator_profile.id
        pub["display_name"] = other.creator_profile.display_name
    return {"user": pub, "can_send": _can_message(db, user, other), "messages": [_msg_out(m) for m in msgs]}


@router.post("", status_code=201)
def send_message(data: MessageIn, background: BackgroundTasks, user: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    limit(f"msg:{user.id}", 30, 60)
    if not data.body:
        raise HTTPException(400, "Xabar bo'sh bo'lmasin")
    other = db.get(User, data.recipient_id)
    if not other or other.id == user.id or not other.is_active or not other.is_verified:
        raise HTTPException(404, "Qabul qiluvchi topilmadi")
    if not _can_message(db, user, other):
        raise HTTPException(403, "Bu foydalanuvchiga xabar yuborib bo'lmaydi")
    if data.booking_id:
        b = db.get(Booking, data.booking_id)
        if not b or user.id not in (b.client_id, b.creator.user_id) and user.role != ROLE_ADMIN:
            data.booking_id = None
    m = Message(sender_id=user.id, recipient_id=other.id, body=data.body, booking_id=data.booking_id)
    db.add(m)
    # Bir suhbatdan ketma-ket ko'p bildirishnoma bo'lmasligi uchun: o'qilmagan birinchi xabardagina
    prev_unread = db.scalar(select(func.count(Message.id)).where(
        Message.sender_id == user.id, Message.recipient_id == other.id, Message.is_read.is_(False)))
    if not prev_unread:
        notify(db, other, "message", f"Yangi xabar: {user.name}", data.body[:200],
               f"/dashboard/messages/{user.id}")
    db.commit()
    return _msg_out(m)
