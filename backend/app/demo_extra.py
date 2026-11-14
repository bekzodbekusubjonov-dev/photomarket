"""Demo faollik: mijozlar, buyurtmalar, shartnomalar, to'lovlar/cheklar, kartalar, e'lonlar, shikoyatlar, xabarlar.
Faqat taqdimot uchun (demo.photomarket.uz hisoblari). `python -m app.cli remove-demo` hammasini o'chiradi."""
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .contracts import ensure_contract, split
from .models import (
    Ad, Booking, Complaint, Contract, CreatorProfile, Message, Notification, Payment, Review, SavedCard, User,
    CONTRACT_AWAITING, CONTRACT_SIGNED, PAY_PAID, PAY_PENDING, ROLE_CLIENT, utcnow,
)
from .security import hash_password
from .services import recalc_creator_rating

DEMO_DOMAIN = "demo.photomarket.uz"
CITY_GEO = {
    "Toshkent": (41.3111, 69.2797, "Amir Temur xiyoboni"), "Samarqand": (39.6542, 66.9597, "Registon maydoni"),
    "Buxoro": (39.7747, 64.4286, "Lyabi-hovuz"), "Andijon": (40.7821, 72.3442, "Navoiy ko'chasi"),
    "Farg'ona": (40.3864, 71.7864, "Mustaqillik ko'chasi"), "Namangan": (41.0011, 71.6726, "Bobur ko'chasi"),
    "Xiva": (41.3783, 60.3639, "Ichan-Qala"), "Nukus": (42.4531, 59.6103, "Berdaq ko'chasi"),
}
CLIENTS = [("Otabek Rahimov", "Toshkent"), ("Madina Ergasheva", "Samarqand"), ("Shahzoda Yusupova", "Farg'ona"),
           ("Doniyor Aliyev", "Toshkent")]


def luhn_card(prefix: str, seed: int, n: int = 16) -> str:
    body = prefix + str((seed * 7919) % 10 ** (n - len(prefix) - 1)).zfill(n - len(prefix) - 1)
    for d in range(10):
        num, tot, alt = body + str(d), 0, False
        for ch in reversed(num):
            x = int(ch)
            if alt:
                x = x * 2 - (9 if x * 2 > 9 else 0)
            tot += x
            alt = not alt
        if tot % 10 == 0:
            return num
    return body + "0"


def _card(db, user, prefix, seed, holder, default=True):
    num = luhn_card(prefix, seed)
    brand = "uzcard" if prefix == "8600" else "humo" if prefix == "9860" else "visa"
    db.add(SavedCard(user_id=user.id, holder=holder.upper(), brand=brand, first4=num[:4], last4=num[-4:],
                     exp="12/29", is_default=default))
    return num


def seed_activity(db: Session):
    if db.scalar(select(User).where(User.email == f"democlient1@{DEMO_DOMAIN}")):
        return
    creators = db.scalars(select(CreatorProfile).join(User, User.id == CreatorProfile.user_id).where(
        User.email.like(f"%@{DEMO_DOMAIN}")).order_by(CreatorProfile.id)).all()
    if not creators:
        return
    for i, c in enumerate(creators):
        if c.lat is None:
            lat, lng, addr = CITY_GEO.get(c.city, CITY_GEO["Toshkent"])
            c.lat, c.lng, c.address = lat + (i % 3) * 0.004, lng + (i % 4) * 0.004, addr
    cl = []
    for i, (name, _city) in enumerate(CLIENTS, 1):
        u = User(name=name, email=f"democlient{i}@{DEMO_DOMAIN}", role=ROLE_CLIENT, is_verified=True,
                 phone=f"+99891{2000000 + i:07d}", password_hash=hash_password("Demo12345"))
        db.add(u)
        cl.append(u)
    db.flush()
    for i, u in enumerate(cl):
        _card(db, u, "8600" if i % 2 == 0 else "9860", 100 + i, u.name)
    for i, c in enumerate(creators[:6]):
        _card(db, c.user, "9860" if i % 2 == 0 else "8600", 300 + i, c.display_name)
    today = date.today()
    # (mijoz, ijodkor, sarlavha, kun farqi, holat, imzo: both|client|none, to'lov: paid|pending|cash|none, baho)
    plan = [
        (0, 0, "Mening to'yim", -40, "completed", "both", "paid", 5),
        (1, 2, "To'y videosi", -25, "completed", "both", "paid", 5),
        (2, 1, "Oilaviy fotosessiya", -12, "completed", "both", "cash", 4),
        (3, 4, "Reels paket", -6, "completed", "both", "paid", 5),
        (0, 3, "Bitiruv albomi", 9, "accepted", "both", "pending", 0),
        (1, 0, "Love story", 14, "accepted", "both", "none", 0),
        (2, 2, "Klip syomkasi", 21, "accepted", "client", "none", 0),
        (3, 6, "Mahsulot suratlari", 5, "accepted", "none", "none", 0),
        (0, 5, "Tug'ilgan kun", 30, "pending", "none", "none", 0),
        (1, 7, "To'y (foto+video)", 45, "pending", "none", "none", 0),
        (2, 3, "Portret sessiya", 3, "cancelled", "both", "none", 0),
        (3, 1, "Bolalar sessiyasi", 18, "rejected", "none", "none", 0),
        (0, 4, "Korporativ tadbir", 60, "accepted", "both", "paid", 0),
    ]
    paid_n = 0
    for k, (ci, cri, title, off, st, sign, pay, rating) in enumerate(plan):
        client, cr = cl[ci], creators[cri % len(creators)]
        svc = cr.services[0] if cr.services else None
        price = svc.price if svc else (cr.price_from or 800_000)
        b = Booking(client_id=client.id, creator_id=cr.id, service_id=svc.id if svc else None, title=title,
                    event_date=today + timedelta(days=off), start_time=f"{10 + k % 6}:00", duration_hours=3,
                    location=f"{cr.city}, {cr.address or 'markaz'}", details="Namunaviy (demo) buyurtma.",
                    price=price, status=st, lat=(cr.lat or 41.3) + 0.01, lng=(cr.lng or 69.2) + 0.01,
                    status_note="Rejalarim o'zgardi" if st == "cancelled" else "")
        db.add(b)
        db.flush()
        if st in ("accepted", "completed", "cancelled"):
            con = ensure_contract(db, b)
            if sign in ("both", "client"):
                con.client_signed_at, con.client_sign_name = utcnow() - timedelta(days=abs(off) + 1), client.name
            if sign == "both":
                con.creator_signed_at, con.creator_sign_name = utcnow() - timedelta(days=abs(off)), cr.display_name
                con.status = CONTRACT_SIGNED
            if st == "cancelled":
                con.status, con.cancelled_by, con.cancelled_at = "cancelled", client.id, utcnow()
                con.cancel_fee = round(price * con.cancel_fee_percent / 100)
                con.cancel_to_platform = round(con.cancel_fee * con.cancel_platform_share / 100)
                con.cancel_to_creator = con.cancel_fee - con.cancel_to_platform
        if pay in ("paid", "cash", "pending"):
            amount = price if pay != "pending" else price // 2
            fee, cr_amt = split(amount, con.commission_percent)
            p = Payment(booking_id=b.id, payer_id=client.id, creator_id=cr.id, amount=amount,
                        method="cash" if pay == "cash" else "card", status=PAY_PENDING if pay == "pending" else PAY_PAID,
                        created_by=client.id, proof_url="/photos/f2.webp" if pay != "cash" else "",
                        note="Namunaviy (demo) to'lov")
            if pay != "pending":
                paid_n += 1
                db.add(p)
                db.flush()
                p.confirmed_at, p.fee, p.creator_amount = utcnow() - timedelta(days=abs(off)), fee, cr_amt
                p.receipt_no = f"CHK-{utcnow():%y%m%d}-{p.id:06d}"
                p.payout_status = "none" if pay == "cash" else ("sent" if st == "completed" else "pending")
            else:
                db.add(p)
        if rating and st == "completed":
            db.add(Review(booking_id=b.id, client_id=client.id, creator_id=cr.id, rating=rating,
                          comment=["Juda yoqdi, tavsiya qilaman!", "Sifatli va o'z vaqtida topshirdi.",
                                   "Professional yondashuv, rahmat!"][k % 3]))
        db.flush()
    for c in creators:
        recalc_creator_rating(db, c)
    # e'lonlar
    ads = [("Bahor aksiyasi: -20%", "Birinchi buyurtmaga chegirma", "/photos/f1.webp", "/creators", "home", "PhotoMarket (demo)"),
           ("Studiya ijarasi", "Toshkentda zamonaviy foto studiya", "/photos/f3.webp", "/categories", "home", "Studio One (demo)"),
           ("Yangi dron to'plami", "Aerosyomka uskunalari 15% arzon", "/photos/f4.webp", "/creators", "dashboard", "DronShop (demo)"),
           ("Ijodkor bo'ling", "PhotoMarket'da ishlang va daromad qiling", "/photos/f2.webp", "/register?role=creator", "creators", "PhotoMarket (demo)")]
    for i, (t, tx, img, link, pl, adv) in enumerate(ads):
        db.add(Ad(title=t, text=tx, image_url=img, link_url=link, placement=pl, advertiser=adv, position=i,
                  views=120 + i * 37, clicks=9 + i * 4))
    # shikoyat, xabar, bildirishnoma
    db.add(Complaint(reporter_id=cl[2].id, creator_id=creators[3 % len(creators)].id, reason="no_show",
                     text="Namunaviy (demo) shikoyat: ijodkor kelishilgan vaqtda kelmadi."))
    for i, (ci, cri) in enumerate([(0, 0), (1, 2), (3, 4)]):
        cu, cru = cl[ci], creators[cri].user
        db.add(Message(sender_id=cu.id, recipient_id=cru.id, body="Assalomu alaykum! Sanaga bo'sh vaqtingiz bormi?"))
        db.add(Message(sender_id=cru.id, recipient_id=cu.id, body="Vaalaykum assalom! Ha, bo'sh. Tafsilotlarni yozing.",
                       is_read=True))
        db.add(Notification(user_id=cu.id, kind="contract_new", title="Shartnoma tayyor — imzolang",
                            body="Elektron shartnoma yaratildi", link="/dashboard/contracts"))
        db.add(Notification(user_id=cru.id, kind="booking_new", title="Yangi buyurtma",
                            body=f"{cu.name} yangi buyurtma yubordi", link="/dashboard/bookings"))
    db.commit()
