"""Yangi modullar: shartnomalar, bank kartalari, e'lonlar, chek, hisobotlar, kuzatuv rejimi, admin yuklamalar."""
import hashlib
import re
from collections import Counter
from datetime import date, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from ..contracts import contract_out, ensure_contract, get_rules, money, split
from ..database import get_db
from ..deps import get_current_user, require_admin, require_roles
from ..i18n import current_lang
from ..models import (
    CONTRACT_AWAITING, CONTRACT_CANCELLED, CONTRACT_SIGNED, CONTRACT_VOID, PAY_PAID, PAY_PENDING, PAY_REJECTED,
    ROLE_ADMIN, ROLE_CLIENT, ROLE_CREATOR, ST_ACCEPTED, ST_COMPLETED, Ad, Booking, Complaint, Contract,
    CreatorProfile, Payment, Review, SavedCard, Setting, User, utcnow,
)
from ..ratelimit import rate_limit
from ..security import create_access_token
from ..services import consume_code, issue_code, notify, user_private, user_public
from ..uploads import delete_upload, save_image
from .extras import get_settings, pay_out

router = APIRouter(prefix="/api", tags=["features"])
admin = APIRouter(prefix="/api/admin", tags=["admin-features"], dependencies=[Depends(require_admin)])
non_admin = require_roles(ROLE_CLIENT, ROLE_CREATOR)


def _ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return (fwd.split(",")[0].strip() or (request.client.host if request.client else ""))[:64]


# =====================================================================
#  SHARTNOMALAR
# =====================================================================
def _load_contract(db: Session, cid: int, user: User) -> Contract:
    c = db.get(Contract, cid)
    if not c:
        raise HTTPException(404, "Shartnoma topilmadi")
    ok = user.role == ROLE_ADMIN or c.client_id == user.id or (
        user.role == ROLE_CREATOR and user.creator_profile and c.creator_id == user.creator_profile.id)
    if not ok:
        raise HTTPException(404, "Shartnoma topilmadi")
    return c


def _contract_q():
    return select(Contract).options(selectinload(Contract.booking), selectinload(Contract.client),
                                    selectinload(Contract.creator).selectinload(CreatorProfile.user))


@router.get("/contracts")
def list_contracts(status: str | None = None, q: str | None = None, user: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    stmt = _contract_q().order_by(Contract.id.desc())
    if user.role == ROLE_CLIENT:
        stmt = stmt.where(Contract.client_id == user.id)
    elif user.role == ROLE_CREATOR:
        stmt = stmt.where(Contract.creator_id == (user.creator_profile.id if user.creator_profile else -1))
    if status:
        stmt = stmt.where(Contract.status == status)
    if q:
        stmt = stmt.where(or_(Contract.number.ilike(f"%{q.strip()}%"), Contract.title.ilike(f"%{q.strip()}%")))
    lang = current_lang.get()
    rows = db.scalars(stmt.limit(300)).all()
    return {"items": [contract_out(c, lang) for c in rows]}


@router.get("/contracts/verify/{number}")
def verify_contract(number: str, h: str = "", db: Session = Depends(get_db)):
    """Ommaviy tekshiruv: shartnoma haqiqiyligi (shaxsiy ma'lumotlarsiz)."""
    c = db.scalar(_contract_q().where(Contract.number == number.strip().upper()))
    if not c:
        return {"valid": False}

    def mask(n: str) -> str:
        parts = n.split()
        return " ".join([parts[0]] + [p[0] + "." for p in parts[1:]]) if parts else ""
    return {"valid": True, "number": c.number, "status": c.status, "created_at": c.created_at,
            "event_date": c.booking.event_date if c.booking else None,
            "client": mask(c.client.name if c.client else ""), "creator": c.creator.display_name if c.creator else "",
            "client_signed": bool(c.client_signed_at), "creator_signed": bool(c.creator_signed_at),
            "hash_short": c.doc_hash[:16], "hash_match": bool(h) and h.lower() == c.doc_hash.lower()}


@router.get("/contracts/by-booking/{booking_id}")
def contract_by_booking(booking_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    b = db.get(Booking, booking_id)
    if not b:
        raise HTTPException(404, "Buyurtma topilmadi")
    ok = user.role == ROLE_ADMIN or b.client_id == user.id or (
        user.role == ROLE_CREATOR and user.creator_profile and b.creator_id == user.creator_profile.id)
    if not ok:
        raise HTTPException(404, "Buyurtma topilmadi")
    c = db.scalar(_contract_q().where(Contract.booking_id == booking_id))
    if not c and b.status in (ST_ACCEPTED, ST_COMPLETED) and user.role != ROLE_ADMIN:
        c = ensure_contract(db, b)  # eski (shartnomadan oldingi) qabul qilingan buyurtmalar uchun
        db.commit()
    return contract_out(c, current_lang.get()) if c else None


@router.get("/contracts/{cid}")
def get_contract(cid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    c = _load_contract(db, cid, user)
    d = contract_out(c, current_lang.get(), full=True, viewer_role=user.role)
    mine = "client" if c.client_id == user.id else ("creator" if user.role == ROLE_CREATOR else "")
    d["my_side"] = mine
    d["can_sign"] = bool(mine) and c.status == CONTRACT_AWAITING and not (
        c.client_signed_at if mine == "client" else c.creator_signed_at)
    return d


@router.post("/contracts/{cid}/sign-code", dependencies=[Depends(rate_limit("signcode", 8, 3600))])
def contract_sign_code(cid: int, user: User = Depends(non_admin), db: Session = Depends(get_db)):
    c = _load_contract(db, cid, user)
    if c.status != CONTRACT_AWAITING:
        raise HTTPException(409, "Bu shartnomani endi imzolab bo'lmaydi")
    issue_code(db, user, f"sign_contract:{c.id}")
    return {"message": "Imzo kodi emailingizga yuborildi"}


class SignIn(BaseModel):
    code: str = Field(min_length=6, max_length=6)
    name: str = Field(min_length=3, max_length=140)
    signature: str = Field(default="", max_length=120_000)  # chizilgan imzo (PNG data URL)


@router.post("/contracts/{cid}/sign", dependencies=[Depends(rate_limit("sign", 15, 3600))])
def sign_contract(cid: int, data: SignIn, request: Request, background: BackgroundTasks,
                  user: User = Depends(non_admin), db: Session = Depends(get_db)):
    c = _load_contract(db, cid, user)
    if c.status != CONTRACT_AWAITING:
        raise HTTPException(409, "Bu shartnomani endi imzolab bo'lmaydi")
    side = "client" if c.client_id == user.id else "creator"
    if getattr(c, f"{side}_signed_at"):
        raise HTTPException(409, "Siz bu shartnomani allaqachon imzolagansiz")
    if data.signature and not data.signature.startswith("data:image/png;base64,"):
        raise HTTPException(400, "Imzo rasmi noto'g'ri")
    consume_code(db, user, f"sign_contract:{c.id}", data.code)
    setattr(c, f"{side}_signed_at", utcnow())
    setattr(c, f"{side}_sign_name", data.name.strip())
    setattr(c, f"{side}_signature", data.signature)
    setattr(c, f"{side}_sign_ip", _ip(request))
    other = c.creator.user if side == "client" else c.client
    if c.client_signed_at and c.creator_signed_at:
        c.status = CONTRACT_SIGNED
        for u in (c.client, c.creator.user):
            notify(db, u, "contract_signed", f"Shartnoma {c.number} imzolandi ✓",
                   "Ikkala tomon imzoladi. Endi to'lovni amalga oshirishingiz mumkin.",
                   f"/dashboard/contracts/{c.id}", background, email=True)
    else:
        notify(db, other, "contract_sign", f"{user.name} shartnomani imzoladi",
               f"Shartnoma {c.number}: sizning imzoyingiz kutilmoqda.", f"/dashboard/contracts/{c.id}", background,
               email=True)
    db.commit()
    return contract_out(c, current_lang.get(), full=True)


# =====================================================================
#  BANK KARTALARI (faqat maskalangan ko'rinish)
# =====================================================================
def luhn_ok(num: str) -> bool:
    total, alt = 0, False
    for ch in reversed(num):
        d = int(ch)
        if alt:
            d *= 2
            d -= 9 if d > 9 else 0
        total += d
        alt = not alt
    return total % 10 == 0


def card_brand(n: str) -> str:
    if n.startswith("8600"):
        return "uzcard"
    if n.startswith("9860"):
        return "humo"
    if n.startswith("4"):
        return "visa"
    if re.match(r"^(5[1-5]|2[2-7])", n):
        return "mastercard"
    return "card"


def card_out(c: SavedCard) -> dict:
    return {"id": c.id, "holder": c.holder, "brand": c.brand, "masked": f"{c.first4} **** **** {c.last4}",
            "last4": c.last4, "exp": c.exp, "is_default": c.is_default, "created_at": c.created_at}


class CardIn(BaseModel):
    number: str = Field(min_length=13, max_length=24)
    holder: str = Field(min_length=3, max_length=80)
    exp: str = Field(pattern=r"^(0[1-9]|1[0-2])/\d{2}$")


@router.get("/cards")
def my_cards(user: User = Depends(non_admin), db: Session = Depends(get_db)):
    rows = db.scalars(select(SavedCard).where(SavedCard.user_id == user.id).order_by(
        SavedCard.is_default.desc(), SavedCard.id.desc()))
    return [card_out(c) for c in rows]


@router.post("/cards", status_code=201, dependencies=[Depends(rate_limit("cards", 20, 3600))])
def add_card(data: CardIn, user: User = Depends(non_admin), db: Session = Depends(get_db)):
    num = re.sub(r"[\s-]", "", data.number)
    if not num.isdigit() or not 13 <= len(num) <= 19 or not luhn_ok(num):
        raise HTTPException(400, "Karta raqami noto'g'ri")
    mm, yy = int(data.exp[:2]), 2000 + int(data.exp[3:])
    if (yy, mm) < (date.today().year, date.today().month):
        raise HTTPException(400, "Karta muddati tugagan")
    if db.scalar(select(SavedCard.id).where(SavedCard.user_id == user.id, SavedCard.first4 == num[:4],
                                            SavedCard.last4 == num[-4:])):
        raise HTTPException(409, "Bu karta allaqachon qo'shilgan")
    first = not db.scalar(select(func.count(SavedCard.id)).where(SavedCard.user_id == user.id))
    c = SavedCard(user_id=user.id, holder=data.holder.strip().upper(), brand=card_brand(num), first4=num[:4],
                  last4=num[-4:], exp=data.exp, is_default=first)  # to'liq raqam saqlanmaydi
    db.add(c)
    db.commit()
    return card_out(c)


@router.post("/cards/{cid}/default")
def card_default(cid: int, user: User = Depends(non_admin), db: Session = Depends(get_db)):
    c = db.get(SavedCard, cid)
    if not c or c.user_id != user.id:
        raise HTTPException(404, "Karta topilmadi")
    for x in db.scalars(select(SavedCard).where(SavedCard.user_id == user.id)):
        x.is_default = x.id == cid
    db.commit()
    return card_out(c)


@router.delete("/cards/{cid}")
def card_delete(cid: int, user: User = Depends(non_admin), db: Session = Depends(get_db)):
    c = db.get(SavedCard, cid)
    if not c or c.user_id != user.id:
        raise HTTPException(404, "Karta topilmadi")
    was_default = c.is_default
    db.delete(c)
    db.flush()
    if was_default:
        nxt = db.scalar(select(SavedCard).where(SavedCard.user_id == user.id).order_by(SavedCard.id.desc()))
        if nxt:
            nxt.is_default = True
    db.commit()
    return {"ok": True}


# =====================================================================
#  TO'LOV KO'RSATMASI, CHEK YUKLASH, CHEK (RECEIPT)
# =====================================================================
@router.get("/payments/instructions")
def pay_instructions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s = get_settings(db)
    return {"card_number": s.get("pay_card_number", ""), "card_holder": s.get("pay_card_holder", ""),
            "commission_percent": int(s.get("commission_percent") or 0)}


@router.post("/payments/proof", dependencies=[Depends(rate_limit("proof", 30, 3600))])
async def upload_proof(file: UploadFile = File(...), user: User = Depends(non_admin)):
    return {"url": await save_image(file, "proofs", max_side=1600)}


def _method_label(m: str) -> str:
    return {"cash": "Naqd", "card": "Karta", "transfer": "O'tkazma"}.get(m, m)


def receipt_out(p: Payment, db: Session) -> dict:
    b = p.booking
    contract = db.scalar(select(Contract).where(Contract.booking_id == p.booking_id))
    card = db.get(SavedCard, p.card_id) if p.card_id else None
    digits = re.sub(r"\D", "", p.receipt_no) or str(p.id)
    sig = hashlib.sha256(f"{p.receipt_no}|{p.amount}|{p.booking_id}|{p.confirmed_at}".encode()).hexdigest()[:12].upper()
    return {
        "id": p.id, "receipt_no": p.receipt_no, "status": p.status, "approved": p.status == PAY_PAID,
        "date": p.confirmed_at or p.created_at, "booking_id": p.booking_id, "booking_title": b.title if b else "",
        "event_date": b.event_date if b else None,
        "client": b.client.name if b and b.client else "", "creator": b.creator.display_name if b and b.creator else "",
        "amount": p.amount, "fee": p.fee, "creator_amount": p.creator_amount or max(p.amount - p.fee, 0),
        "method": p.method, "method_label": _method_label(p.method),
        "card": f"{card.first4} **** **** {card.last4}" if card else "",
        "contract_no": contract.number if contract else "", "barcode": digits, "signature": sig,
    }


@router.get("/payments/{pid}/receipt")
def payment_receipt(pid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    p = db.scalar(select(Payment).where(Payment.id == pid).options(
        selectinload(Payment.booking).selectinload(Booking.client),
        selectinload(Payment.booking).selectinload(Booking.creator)))
    if not p:
        raise HTTPException(404, "To'lov topilmadi")
    ok = user.role == ROLE_ADMIN or p.payer_id == user.id or (
        user.role == ROLE_CREATOR and user.creator_profile and p.creator_id == user.creator_profile.id)
    if not ok:
        raise HTTPException(404, "To'lov topilmadi")
    return receipt_out(p, db)


# ---------------- Admin: to'lovni tasdiqlash / chek yuborish / ijodkorga o'tkazish ----------------
class AdminPayDecision(BaseModel):
    status: str = Field(pattern="^(paid|rejected)$")
    note: str = Field(default="", max_length=300)


def confirm_payment(db: Session, p: Payment, status: str, note: str, admin_user: User, background: BackgroundTasks):
    p.status, p.confirmed_at, p.confirmed_by, p.admin_note = status, utcnow(), admin_user.id, note.strip()
    b = p.booking
    if status == PAY_PAID:
        contract = db.scalar(select(Contract).where(Contract.booking_id == p.booking_id))
        pct = contract.commission_percent if contract else get_rules(db)["commission_percent"]
        p.fee, p.creator_amount = split(p.amount, pct)
        p.receipt_no = f"CHK-{utcnow():%y%m%d}-{p.id:06d}"
        p.payout_status = "pending" if p.method in ("card", "transfer") else "none"
        body = f"«{b.title}»: {money(p.amount)} so'm. Chek: {p.receipt_no}"
        for u in (b.client, b.creator.user):
            notify(db, u, "payment_receipt", f"To'lov tasdiqlandi — chek {p.receipt_no}", body,
                   f"/dashboard/payments/{p.id}/receipt", background, email=True)
    else:
        body = f"«{b.title}»: {money(p.amount)} so'm." + (f" Izoh: {p.admin_note}" if p.admin_note else "")
        notify(db, b.client, "payment_rejected", "To'lov rad etildi", body, "/dashboard/payments", background,
               email=True)


@admin.patch("/payments/{pid}")
def admin_decide_payment(pid: int, data: AdminPayDecision, background: BackgroundTasks,
                         adm: User = Depends(require_admin), db: Session = Depends(get_db)):
    p = db.get(Payment, pid)
    if not p:
        raise HTTPException(404, "To'lov topilmadi")
    if p.status != PAY_PENDING:
        raise HTTPException(409, "Bu to'lov allaqachon ko'rib chiqilgan")
    confirm_payment(db, p, data.status, data.note, adm, background)
    db.commit()
    return pay_out(p)


@admin.post("/payments/{pid}/payout")
def admin_payout(pid: int, background: BackgroundTasks, db: Session = Depends(get_db)):
    p = db.get(Payment, pid)
    if not p or p.status != PAY_PAID:
        raise HTTPException(404, "To'lov topilmadi")
    if p.payout_status != "pending":
        raise HTTPException(409, "Ijodkorga o'tkazish talab qilinmaydi yoki allaqachon bajarilgan")
    p.payout_status = "sent"
    notify(db, p.booking.creator.user, "payout", f"Ulushingiz o'tkazildi: {money(p.creator_amount)} so'm",
           f"«{p.booking.title}» buyurtmasi bo'yicha", "/dashboard/earnings", background, email=True)
    db.commit()
    return pay_out(p)


# =====================================================================
#  E'LONLAR / REKLAMA
# =====================================================================
def ad_out(a: Ad, stats: bool = False) -> dict:
    d = {"id": a.id, "title": a.title, "text": a.text, "image_url": a.image_url, "link_url": a.link_url,
         "advertiser": a.advertiser, "placement": a.placement}
    if stats:
        d.update({"active": a.active, "starts_on": a.starts_on, "ends_on": a.ends_on, "views": a.views,
                  "clicks": a.clicks, "position": a.position,
                  "ctr": round(a.clicks / a.views * 100, 1) if a.views else 0})
    return d


@router.get("/ads")
def public_ads(placement: str = Query("home", pattern="^(home|dashboard|creators)$"), db: Session = Depends(get_db)):
    today = date.today()
    rows = db.scalars(select(Ad).where(Ad.active.is_(True), Ad.placement == placement).order_by(
        Ad.position, Ad.id.desc())).all()
    rows = [a for a in rows if (not a.starts_on or a.starts_on <= today) and (not a.ends_on or a.ends_on >= today)][:6]
    for a in rows:
        a.views += 1
    db.commit()
    return [ad_out(a) for a in rows]


@router.post("/ads/{aid}/click")
def ad_click(aid: int, db: Session = Depends(get_db)):
    a = db.get(Ad, aid)
    if not a:
        raise HTTPException(404, "E'lon topilmadi")
    a.clicks += 1
    db.commit()
    return {"ok": True}


class AdIn(BaseModel):
    title: str = Field(min_length=2, max_length=140)
    text: str = Field(default="", max_length=400)
    image_url: str = Field(default="", max_length=500)
    link_url: str = Field(default="", max_length=500, pattern=r"^(|https?://.+|/.*)$")
    advertiser: str = Field(default="", max_length=120)
    placement: str = Field(default="home", pattern="^(home|dashboard|creators)$")
    active: bool = True
    starts_on: date | None = None
    ends_on: date | None = None
    position: int = Field(default=0, ge=0, le=999)


@admin.get("/ads")
def admin_ads(db: Session = Depends(get_db)):
    return [ad_out(a, True) for a in db.scalars(select(Ad).order_by(Ad.position, Ad.id.desc()))]


@admin.post("/ads", status_code=201)
def admin_ad_create(data: AdIn, db: Session = Depends(get_db)):
    a = Ad(**data.model_dump())
    db.add(a)
    db.commit()
    return ad_out(a, True)


@admin.put("/ads/{aid}")
def admin_ad_update(aid: int, data: AdIn, db: Session = Depends(get_db)):
    a = db.get(Ad, aid)
    if not a:
        raise HTTPException(404, "E'lon topilmadi")
    for k, v in data.model_dump().items():
        setattr(a, k, v)
    db.commit()
    return ad_out(a, True)


@admin.delete("/ads/{aid}")
def admin_ad_delete(aid: int, db: Session = Depends(get_db)):
    a = db.get(Ad, aid)
    if a:
        delete_upload(a.image_url)
        db.delete(a)
        db.commit()
    return {"ok": True}


# =====================================================================
#  ADMIN: rasm yuklash, foydalanuvchi avatari, kuzatuv rejimi
# =====================================================================
@admin.post("/upload")
async def admin_upload(folder: str = Query("ads", pattern="^(ads|branding|categories)$"), file: UploadFile = File(...)):
    return {"url": await save_image(file, folder, max_side=1600)}


@admin.put("/users/{uid}/avatar")
async def admin_user_avatar(uid: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "Foydalanuvchi topilmadi")
    url = await save_image(file, "avatars", max_side=600)
    old, u.avatar_url = u.avatar_url, url
    db.commit()
    delete_upload(old)
    return user_private(u)


@admin.post("/impersonate/{uid}")
def admin_impersonate(uid: int, adm: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Foydalanuvchi ko'zi bilan KO'RISH rejimi: token faqat o'qish uchun (POST/PUT/PATCH/DELETE bloklanadi)."""
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "Foydalanuvchi topilmadi")
    if u.role == ROLE_ADMIN:
        raise HTTPException(400, "Administrator hisobini kuzatib bo'lmaydi")
    token = create_access_token(u.id, u.role, u.token_version, extra={"ro": True, "imp": adm.id}, minutes=60)
    return {"access_token": token, "user": user_private(u)}


# =====================================================================
#  ADMIN: bosiladigan hisobotlar
# =====================================================================
def _col(key, label, kind="text"):
    return {"key": key, "label": label, "type": kind}


def _groups(title, key, counter: Counter, labels: dict | None = None):
    items = [{"value": k, "label": (labels or {}).get(k, k or "—"), "count": n} for k, n in counter.most_common()]
    return {"key": key, "title": title, "items": items}


ROLE_UZ = {"client": "Mijoz", "creator": "Ijodkor", "admin": "Administrator"}
CAT_UZ = {"photographer": "Fotograf", "videographer": "Videograf", "both": "Foto + video"}
ST_UZ = {"pending": "Kutilmoqda", "accepted": "Qabul qilindi", "rejected": "Rad etildi",
         "cancelled": "Bekor qilindi", "completed": "Bajarildi"}
PAY_UZ = {"pending": "Kutilmoqda", "paid": "To'langan", "rejected": "Rad etilgan"}
CON_UZ = {"awaiting": "Imzo kutilmoqda", "signed": "Imzolangan", "cancelled": "Bekor qilingan", "void": "Bekor (imzosiz)"}
METHOD_UZ = {"cash": "Naqd", "card": "Karta", "transfer": "O'tkazma"}


@admin.get("/reports/{kind}")
def admin_report(kind: str, role: str | None = None, category: str | None = None, specialty: str | None = None,
                 city: str | None = None, status: str | None = None, method: str | None = None,
                 db: Session = Depends(get_db)):
    f = {"role": role, "category": category, "specialty": specialty, "city": city, "status": status, "method": method}
    if kind == "users":
        return _rep_users(db, f)
    if kind == "creators":
        return _rep_creators(db, f)
    if kind == "bookings":
        return _rep_bookings(db, f)
    if kind == "payments":
        return _rep_payments(db, f)
    if kind == "contracts":
        return _rep_contracts(db, f)
    if kind == "revenue":
        return _rep_revenue(db, f)
    if kind == "reviews":
        return _rep_reviews(db)
    if kind == "complaints":
        return _rep_complaints(db, f)
    raise HTTPException(404, "Hisobot topilmadi")


def _ok(val, want):
    return want in (None, "") or val == want


def _rep_users(db, f):
    users = db.scalars(select(User).options(selectinload(User.creator_profile)).order_by(User.id.desc()).limit(5000)).all()
    spec_c, cat_c, city_c, role_c, stat_c = Counter(), Counter(), Counter(), Counter(), Counter()
    rows = []
    for u in users:
        cp = u.creator_profile
        st = "blocked" if not u.is_active else ("unverified" if not u.is_verified else "active")
        role_c[u.role] += 1
        if cp:
            cat_c[cp.category] += 1
            city_c[cp.city] += 1
            for s in cp.specialties_list:
                spec_c[s] += 1
        stat_c[st] += 1
        if not (_ok(u.role, f["role"]) and _ok(cp.category if cp else None, f["category"]) and
                _ok(cp.city if cp else None, f["city"]) and _ok(st, f["status"])):
            continue
        if f["specialty"] and not (cp and f["specialty"] in cp.specialties_list):
            continue
        rows.append({"id": u.id, "name": u.name, "email": u.email, "role": ROLE_UZ.get(u.role, u.role),
                     "category": CAT_UZ.get(cp.category, "") if cp else "—", "city": cp.city if cp else "—",
                     "status": {"active": "Faol", "blocked": "Bloklangan", "unverified": "Tasdiqlanmagan"}[st],
                     "created_at": u.created_at, "user_id": u.id})
    st_lbl = {"active": "Faol", "blocked": "Bloklangan", "unverified": "Tasdiqlanmagan"}
    return {"kind": "users", "title": "Foydalanuvchilar", "total": len(rows),
            "summary": [{"label": "Jami", "value": len(users)}, {"label": "Mijozlar", "value": role_c.get("client", 0)},
                        {"label": "Ijodkorlar", "value": role_c.get("creator", 0)},
                        {"label": "Bloklangan", "value": stat_c.get("blocked", 0)}],
            "groups": [_groups("Rol bo'yicha", "role", role_c, ROLE_UZ),
                       _groups("Yo'nalish (ijodkorlar)", "category", cat_c, CAT_UZ),
                       _groups("Kategoriya (mutaxassislik)", "specialty", spec_c),
                       _groups("Shahar", "city", city_c), _groups("Holat", "status", stat_c, st_lbl)],
            "columns": [_col("name", "Ism"), _col("email", "Email"), _col("role", "Rol"), _col("category", "Yo'nalish"),
                        _col("city", "Shahar"), _col("status", "Holat"), _col("created_at", "Sana", "date")],
            "rows": rows[:200], "filters": {k: v for k, v in f.items() if v}, "link": "user"}


def _rep_creators(db, f):
    cps = db.scalars(select(CreatorProfile).options(selectinload(CreatorProfile.user)).order_by(
        CreatorProfile.rating.desc()).limit(3000)).all()
    spec_c, cat_c, city_c, ver_c = Counter(), Counter(), Counter(), Counter()
    rows = []
    for c in cps:
        cat_c[c.category] += 1
        city_c[c.city] += 1
        ver_c["yes" if c.verified else "no"] += 1
        for s in c.specialties_list:
            spec_c[s] += 1
        if not (_ok(c.category, f["category"]) and _ok(c.city, f["city"]) and
                _ok("yes" if c.verified else "no", f["status"])):
            continue
        if f["specialty"] and f["specialty"] not in c.specialties_list:
            continue
        rows.append({"id": c.id, "name": c.display_name, "category": CAT_UZ.get(c.category, c.category),
                     "city": c.city, "rating": c.rating, "completed": c.completed_count,
                     "price": c.price_from, "verified": "Ha" if c.verified else "Yo'q", "user_id": c.user_id})
    return {"kind": "creators", "title": "Ijodkorlar", "total": len(rows),
            "summary": [{"label": "Jami", "value": len(cps)}, {"label": "Tasdiqlangan", "value": ver_c.get("yes", 0)},
                        {"label": "Kutilmoqda", "value": ver_c.get("no", 0)}],
            "groups": [_groups("Yo'nalish", "category", cat_c, CAT_UZ),
                       _groups("Kategoriya (mutaxassislik)", "specialty", spec_c),
                       _groups("Shahar", "city", city_c),
                       _groups("Tasdiq", "status", ver_c, {"yes": "Tasdiqlangan", "no": "Tasdiqlanmagan"})],
            "columns": [_col("name", "Ijodkor"), _col("category", "Yo'nalish"), _col("city", "Shahar"),
                        _col("rating", "Reyting"), _col("completed", "Bajarilgan"), _col("price", "Narx (dan)", "money"),
                        _col("verified", "Tasdiq")],
            "rows": rows[:200], "filters": {k: v for k, v in f.items() if v}, "link": "creator"}


def _rep_bookings(db, f):
    bs = db.scalars(select(Booking).options(selectinload(Booking.client), selectinload(Booking.creator)).order_by(
        Booking.id.desc()).limit(5000)).all()
    st_c, cat_c, city_c = Counter(), Counter(), Counter()
    rows = []
    for b in bs:
        cat = b.creator.category if b.creator else ""
        st_c[b.status] += 1
        cat_c[cat] += 1
        city_c[b.creator.city if b.creator else ""] += 1
        if not (_ok(b.status, f["status"]) and _ok(cat, f["category"]) and
                _ok(b.creator.city if b.creator else "", f["city"])):
            continue
        rows.append({"id": b.id, "title": b.title, "client": b.client.name if b.client else "",
                     "creator": b.creator.display_name if b.creator else "", "date": b.event_date,
                     "price": b.price or 0, "status": ST_UZ.get(b.status, b.status), "booking_id": b.id})
    total_sum = sum(b.price or 0 for b in bs if b.status == ST_COMPLETED)
    return {"kind": "bookings", "title": "Buyurtmalar", "total": len(rows),
            "summary": [{"label": "Jami", "value": len(bs)}, {"label": "Kutilmoqda", "value": st_c.get("pending", 0)},
                        {"label": "Bajarilgan", "value": st_c.get("completed", 0)},
                        {"label": "Bajarilgan summa", "value": total_sum, "type": "money"}],
            "groups": [_groups("Holat", "status", st_c, ST_UZ), _groups("Yo'nalish", "category", cat_c, CAT_UZ),
                       _groups("Shahar", "city", city_c)],
            "columns": [_col("id", "№"), _col("title", "Buyurtma"), _col("client", "Mijoz"), _col("creator", "Ijodkor"),
                        _col("date", "Sana", "date"), _col("price", "Narx", "money"), _col("status", "Holat")],
            "rows": rows[:200], "filters": {k: v for k, v in f.items() if v}, "link": "booking"}


def _rep_payments(db, f):
    ps = db.scalars(select(Payment).options(selectinload(Payment.booking).selectinload(Booking.client),
                                            selectinload(Payment.booking).selectinload(Booking.creator)).order_by(
        Payment.id.desc()).limit(5000)).all()
    st_c, m_c = Counter(), Counter()
    rows = []
    for p in ps:
        st_c[p.status] += 1
        m_c[p.method] += 1
        if not (_ok(p.status, f["status"]) and _ok(p.method, f["method"])):
            continue
        b = p.booking
        rows.append({"id": p.id, "booking": b.title if b else "", "client": b.client.name if b and b.client else "",
                     "creator": b.creator.display_name if b and b.creator else "", "amount": p.amount,
                     "method": METHOD_UZ.get(p.method, p.method), "status": PAY_UZ.get(p.status, p.status),
                     "date": p.created_at, "payment_id": p.id})
    paid = sum(p.amount for p in ps if p.status == PAY_PAID)
    pending = sum(p.amount for p in ps if p.status == PAY_PENDING)
    return {"kind": "payments", "title": "To'lovlar", "total": len(rows),
            "summary": [{"label": "To'langan", "value": paid, "type": "money"},
                        {"label": "Tasdiq kutmoqda", "value": pending, "type": "money"},
                        {"label": "Platforma ulushi", "value": sum(p.fee for p in ps if p.status == PAY_PAID),
                         "type": "money"}],
            "groups": [_groups("Holat", "status", st_c, PAY_UZ), _groups("Usul", "method", m_c, METHOD_UZ)],
            "columns": [_col("id", "№"), _col("booking", "Buyurtma"), _col("client", "Mijoz"), _col("creator", "Ijodkor"),
                        _col("amount", "Summa", "money"), _col("method", "Usul"), _col("status", "Holat"),
                        _col("date", "Sana", "date")],
            "rows": rows[:200], "filters": {k: v for k, v in f.items() if v}, "link": "payment"}


def _rep_contracts(db, f):
    cs = db.scalars(_contract_q().order_by(Contract.id.desc()).limit(5000)).all()
    st_c, cat_c = Counter(), Counter()
    rows = []
    for c in cs:
        st_c[c.status] += 1
        cat_c[c.category] += 1
        if not (_ok(c.status, f["status"]) and _ok(c.category, f["category"])):
            continue
        rows.append({"number": c.number, "title": c.title, "client": c.client.name if c.client else "",
                     "creator": c.creator.display_name if c.creator else "", "price": c.price,
                     "fee": c.platform_fee, "status": CON_UZ.get(c.status, c.status), "date": c.created_at,
                     "contract_id": c.id})
    signed = [c for c in cs if c.status == CONTRACT_SIGNED]
    return {"kind": "contracts", "title": "Shartnomalar", "total": len(rows),
            "summary": [{"label": "Jami", "value": len(cs)}, {"label": "Imzolangan", "value": len(signed)},
                        {"label": "Imzo kutilmoqda", "value": st_c.get("awaiting", 0)},
                        {"label": "Shartnomalar summasi", "value": sum(c.price for c in signed), "type": "money"},
                        {"label": "Platforma komissiyasi", "value": sum(c.platform_fee for c in signed), "type": "money"},
                        {"label": "Ushlab qolingan (bekor)", "value": sum(c.cancel_to_platform for c in cs),
                         "type": "money"}],
            "groups": [_groups("Holat", "status", st_c, CON_UZ), _groups("Yo'nalish", "category", cat_c, CAT_UZ)],
            "columns": [_col("number", "Raqam"), _col("title", "Buyurtma"), _col("client", "Mijoz"),
                        _col("creator", "Ijodkor"), _col("price", "Narx", "money"), _col("fee", "Komissiya", "money"),
                        _col("status", "Holat"), _col("date", "Sana", "date")],
            "rows": rows[:200], "filters": {k: v for k, v in f.items() if v}, "link": "contract"}


def _rep_revenue(db, f):
    ps = db.scalars(select(Payment).where(Payment.status == PAY_PAID).options(
        selectinload(Payment.booking)).order_by(Payment.id.desc()).limit(5000)).all()
    cs = db.scalars(select(Contract).where(Contract.cancel_to_platform > 0)).all()
    month = Counter()
    for p in ps:
        month[(p.confirmed_at or p.created_at).strftime("%Y-%m")] += p.fee
    fee_total = sum(p.fee for p in ps)
    return {"kind": "revenue", "title": "Platforma daromadi", "total": len(ps),
            "summary": [{"label": "Komissiya", "value": fee_total, "type": "money"},
                        {"label": "Bekor qilish ulushi", "value": sum(c.cancel_to_platform for c in cs), "type": "money"},
                        {"label": "Jami aylanma", "value": sum(p.amount for p in ps), "type": "money"},
                        {"label": "Ijodkorlarga", "value": sum(p.creator_amount for p in ps), "type": "money"}],
            "groups": [_groups("Oylar bo'yicha komissiya (so'm)", "month", Counter(dict(sorted(month.items())[-12:])))],
            "columns": [_col("id", "№"), _col("booking", "Buyurtma"), _col("amount", "Summa", "money"),
                        _col("fee", "Komissiya", "money"), _col("creator_amount", "Ijodkorga", "money"),
                        _col("date", "Sana", "date")],
            "rows": [{"id": p.id, "booking": p.booking.title if p.booking else "", "amount": p.amount, "fee": p.fee,
                      "creator_amount": p.creator_amount, "date": p.confirmed_at or p.created_at,
                      "payment_id": p.id} for p in ps[:200]],
            "filters": {}, "link": "payment"}


def _rep_reviews(db):
    rs = db.scalars(select(Review).options(selectinload(Review.client), selectinload(Review.creator)).order_by(
        Review.id.desc()).limit(3000)).all()
    c = Counter(f"{r.rating}★" for r in rs)
    avg = round(sum(r.rating for r in rs) / len(rs), 2) if rs else 0
    return {"kind": "reviews", "title": "Sharhlar", "total": len(rs),
            "summary": [{"label": "Jami", "value": len(rs)}, {"label": "O'rtacha baho", "value": avg}],
            "groups": [_groups("Baho bo'yicha", "rating", c)],
            "columns": [_col("client", "Mijoz"), _col("creator", "Ijodkor"), _col("rating", "Baho"),
                        _col("comment", "Sharh"), _col("date", "Sana", "date")],
            "rows": [{"client": r.client.name if r.client else "", "creator": r.creator.display_name if r.creator else "",
                      "rating": r.rating, "comment": (r.comment or "")[:120], "date": r.created_at} for r in rs[:200]],
            "filters": {}, "link": ""}


def _rep_complaints(db, f):
    cs = db.scalars(select(Complaint).options(selectinload(Complaint.reporter), selectinload(Complaint.creator)).order_by(
        Complaint.id.desc()).limit(3000)).all()
    st_c = Counter(c.status for c in cs)
    lbl = {"open": "Ochiq", "in_review": "Ko'rilmoqda", "resolved": "Hal qilindi", "dismissed": "Rad etildi"}
    rows = [{"reporter": c.reporter.name if c.reporter else "", "creator": c.creator.display_name if c.creator else "",
             "reason": c.reason, "text": c.text[:100], "status": lbl.get(c.status, c.status), "date": c.created_at}
            for c in cs if _ok(c.status, f["status"])]
    return {"kind": "complaints", "title": "Shikoyatlar", "total": len(rows),
            "summary": [{"label": "Jami", "value": len(cs)}, {"label": "Ochiq", "value": st_c.get("open", 0)}],
            "groups": [_groups("Holat", "status", st_c, lbl)],
            "columns": [_col("reporter", "Shikoyatchi"), _col("creator", "Ijodkor"), _col("text", "Matn"),
                        _col("status", "Holat"), _col("date", "Sana", "date")],
            "rows": rows[:200], "filters": {k: v for k, v in f.items() if v}, "link": ""}


@admin.get("/overview-extra")
def overview_extra(db: Session = Depends(get_db)):
    """Bosh sahifadagi shartnoma / to'lov / e'lon kartalari uchun qisqa statistika."""
    cs = db.scalars(select(Contract)).all()
    signed = [c for c in cs if c.status == CONTRACT_SIGNED]
    ps = db.scalars(select(Payment)).all()
    ads = db.scalars(select(Ad)).all()
    return {
        "contracts": {"total": len(cs), "signed": len(signed),
                      "awaiting": sum(1 for c in cs if c.status == CONTRACT_AWAITING),
                      "cancelled": sum(1 for c in cs if c.status in (CONTRACT_CANCELLED, CONTRACT_VOID)),
                      "value": sum(c.price for c in signed), "commission": sum(c.platform_fee for c in signed),
                      "cancel_income": sum(c.cancel_to_platform for c in cs)},
        "payments": {"pending": sum(1 for p in ps if p.status == PAY_PENDING),
                     "paid_sum": sum(p.amount for p in ps if p.status == PAY_PAID),
                     "payouts_due": sum(1 for p in ps if p.payout_status == "pending"),
                     "fee_sum": sum(p.fee for p in ps if p.status == PAY_PAID)},
        "ads": {"active": sum(1 for a in ads if a.active), "views": sum(a.views for a in ads),
                "clicks": sum(a.clicks for a in ads)},
    }
