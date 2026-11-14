"""Elektron shartnoma: kategoriya bo'yicha universal shablon, komissiya va bekor qilish hisob-kitobi, xesh."""
import hashlib
import json
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import (
    CONTRACT_AWAITING, CONTRACT_CANCELLED, CONTRACT_SIGNED, CONTRACT_VOID, Booking, Contract, Setting, utcnow,
)

KIND = {
    "photographer": {"uz": "fotosuratga olish", "ru": "фотосъёмки", "en": "photography"},
    "videographer": {"uz": "videoga olish", "ru": "видеосъёмки", "en": "videography"},
    "both": {"uz": "foto va video suratga olish", "ru": "фото- и видеосъёмки", "en": "photo and video"},
}
DELIVERY_DAYS = {"photographer": 10, "videographer": 21, "both": 21}
DELIVERABLE = {
    "photographer": {"uz": "rang-tuzatilgan (retush) suratlarni", "ru": "обработанные (ретушированные) фотографии",
                     "en": "colour-corrected, retouched photos"},
    "videographer": {"uz": "montaj qilingan videoni", "ru": "смонтированное видео", "en": "the edited video"},
    "both": {"uz": "retush qilingan suratlar va montaj qilingan videoni",
             "ru": "обработанные фотографии и смонтированное видео", "en": "retouched photos and the edited video"},
}

# (id, sarlavha, matn) — har bir til uchun. {..} joylari shartnoma qiymatlari bilan to'ldiriladi
CLAUSES = [
    ("subject",
     {"uz": "Shartnoma predmeti", "ru": "Предмет договора", "en": "Subject of the agreement"},
     {"uz": "Ijodkor mijozga {kind} xizmatini ko'rsatadi: «{title}». Sana: {date}, boshlanish vaqti: {time}, "
            "davomiyligi: {hours} soat, manzil: {location}.",
      "ru": "Исполнитель оказывает Заказчику услугу {kind}: «{title}». Дата: {date}, время начала: {time}, "
            "длительность: {hours} ч., место: {location}.",
      "en": "The Creator provides {kind} services to the Client: “{title}”. Date: {date}, start time: {time}, "
            "duration: {hours} h, location: {location}."}),
    ("price",
     {"uz": "Narx va platforma ulushi", "ru": "Цена и доля платформы", "en": "Price and platform share"},
     {"uz": "Xizmat narxi — {price} so'm. Shundan PhotoMarket xizmat haqi {pct}% ({fee} so'm) ushlab qolinadi, "
            "ijodkorga {creator} so'm o'tkaziladi.",
      "ru": "Стоимость услуги — {price} сум. Из неё удерживается сервисный сбор PhotoMarket {pct}% ({fee} сум), "
            "Исполнителю перечисляется {creator} сум.",
      "en": "The price of the service is {price} UZS. PhotoMarket withholds a {pct}% service fee ({fee} UZS); "
            "{creator} UZS is paid to the Creator."}),
    ("payment",
     {"uz": "To'lov tartibi", "ru": "Порядок оплаты", "en": "Payment"},
     {"uz": "Mijoz to'lovni PhotoMarket orqali amalga oshiradi va to'lov chekini yuklaydi. Administrator to'lovni "
            "tasdiqlagach, ikkala tomonga elektron chek yuboriladi. Ijodkor ulushi xizmat bajarilgach to'lanadi.",
      "ru": "Заказчик оплачивает услугу через PhotoMarket и загружает чек. После подтверждения платежа "
            "администратором обеим сторонам отправляется электронный чек. Доля Исполнителя выплачивается "
            "после выполнения услуги.",
      "en": "The Client pays through PhotoMarket and uploads the payment receipt. After the administrator confirms "
            "the payment, an electronic receipt is sent to both parties. The Creator's share is paid out after "
            "the service is delivered."}),
    ("delivery",
     {"uz": "Topshirish muddati", "ru": "Сроки сдачи", "en": "Delivery"},
     {"uz": "Ijodkor tadbir tugagach {days} kun ichida {deliv} elektron shaklda topshiradi.",
      "ru": "Исполнитель передаёт {deliv} в электронном виде в течение {days} дней после мероприятия.",
      "en": "Within {days} days after the event the Creator delivers {deliv} in electronic form."}),
    ("creator_duties",
     {"uz": "Ijodkor majburiyatlari", "ru": "Обязанности Исполнителя", "en": "Creator's duties"},
     {"uz": "Ijodkor belgilangan vaqtda yetib keladi, sifatli uskunalar va zaxira jihozlar bilan ishlaydi, "
            "mijozning shaxsiy ma'lumotlari va materiallarini uchinchi shaxslarga bermaydi.",
      "ru": "Исполнитель прибывает в назначенное время, работает с качественным и резервным оборудованием "
            "и не передаёт личные данные и материалы Заказчика третьим лицам.",
      "en": "The Creator arrives on time, works with quality and backup equipment, and does not share the "
            "Client's personal data or materials with third parties."}),
    ("client_duties",
     {"uz": "Mijoz majburiyatlari", "ru": "Обязанности Заказчика", "en": "Client's duties"},
     {"uz": "Mijoz tadbir vaqti va joyi haqida to'g'ri ma'lumot beradi, suratga olish uchun sharoit yaratadi va "
            "o'zgarishlar haqida ijodkorni oldindan ogohlantiradi.",
      "ru": "Заказчик предоставляет точные сведения о времени и месте, создаёт условия для съёмки и заранее "
            "предупреждает Исполнителя об изменениях.",
      "en": "The Client provides accurate details of the time and place, enables the shoot and warns the "
            "Creator of any changes in advance."}),
    ("rights",
     {"uz": "Mualliflik huquqi", "ru": "Авторские права", "en": "Copyright"},
     {"uz": "Tayyor ishlardan mijoz shaxsiy maqsadda foydalanadi. Ijodkor ishni portfolio uchun ko'rsatish "
            "huquqini saqlab qoladi, mijoz yozma ravishda qarshi bo'lmasa.",
      "ru": "Заказчик использует готовые материалы в личных целях. Исполнитель сохраняет право показывать работу "
            "в портфолио, если Заказчик не возражает письменно.",
      "en": "The Client uses the finished work for personal purposes. The Creator may show the work in a "
            "portfolio unless the Client objects in writing."}),
    ("cancel",
     {"uz": "Bekor qilish va ushlab qolish", "ru": "Отмена и удержание", "en": "Cancellation and withholding"},
     {"uz": "Tadbirga {free} kundan ko'p qolganda bekor qilish bepul. {free} kun va undan kam qolganda mijoz "
            "bekor qilsa, narxning {cfee}% qismi ({cfee_sum} so'm) ushlab qolinadi: uning {cplat}% i "
            "PhotoMarketga, qolgan qismi ijodkorga kompensatsiya sifatida o'tadi, qolgan to'lov mijozga qaytariladi. "
            "Ijodkor bekor qilsa, mijozga to'lov to'liq qaytariladi.",
      "ru": "Если до мероприятия остаётся больше {free} дн., отмена бесплатна. Если остаётся {free} дн. или меньше "
            "и отменяет Заказчик, удерживается {cfee}% стоимости ({cfee_sum} сум): {cplat}% этой суммы получает "
            "PhotoMarket, остальное — Исполнитель в качестве компенсации; остаток платежа возвращается Заказчику. "
            "При отмене Исполнителем платёж возвращается полностью.",
      "en": "Cancellation is free when more than {free} days remain before the event. With {free} days or fewer, "
            "if the Client cancels, {cfee}% of the price ({cfee_sum} UZS) is withheld: {cplat}% of it goes to "
            "PhotoMarket and the rest to the Creator as compensation; the remaining payment is refunded to the "
            "Client. If the Creator cancels, the payment is refunded in full."}),
    ("force",
     {"uz": "Fors-major", "ru": "Форс-мажор", "en": "Force majeure"},
     {"uz": "Tomonlar nazorat qilib bo'lmaydigan holatlar (tabiiy ofat, favqulodda holat, og'ir kasallik) sababli "
            "majburiyatni bajara olmasa, javobgarlikdan ozod bo'ladi; sana kelishuv bilan ko'chiriladi yoki to'lov "
            "qaytariladi.",
      "ru": "Стороны освобождаются от ответственности при обстоятельствах непреодолимой силы (стихийное бедствие, "
            "чрезвычайная ситуация, тяжёлая болезнь); дата переносится по согласованию либо платёж возвращается.",
      "en": "Neither party is liable for failure caused by events beyond their control (natural disaster, "
            "emergency, serious illness); the date is rescheduled by agreement or the payment is refunded."}),
    ("disputes",
     {"uz": "Nizolarni hal qilish", "ru": "Разрешение споров", "en": "Disputes"},
     {"uz": "Nizolar avval PhotoMarket ma'muriyati orqali ko'rib chiqiladi. Kelishuvga erishilmasa, "
            "O'zbekiston Respublikasi qonunchiligiga muvofiq hal etiladi.",
      "ru": "Споры рассматриваются сначала администрацией PhotoMarket. Если согласие не достигнуто, они разрешаются "
            "в соответствии с законодательством Республики Узбекистан.",
      "en": "Disputes are first reviewed by PhotoMarket administration. If no agreement is reached, they are "
            "resolved under the laws of the Republic of Uzbekistan."}),
    ("esign",
     {"uz": "Elektron imzo", "ru": "Электронная подпись", "en": "Electronic signature"},
     {"uz": "Tomonlar shartnomani elektron imzo bilan tasdiqlaydilar: email orqali kelgan bir martalik kod va "
            "imzo (chizilgan yoki ism). Tomonlar bunday imzoni qo'lyozma imzo bilan teng deb kelishadilar. "
            "Hujjat yaxlitligi SHA-256 xesh bilan himoyalanadi; uni shartnoma tekshiruv sahifasida tekshirish mumkin.",
      "ru": "Стороны подтверждают договор электронной подписью: одноразовый код из email и подпись "
            "(нарисованная или имя). Стороны договорились приравнять такую подпись к собственноручной. "
            "Целостность документа защищена хешем SHA-256; его можно проверить на странице проверки договора.",
      "en": "The parties confirm the agreement by electronic signature: a one-time email code plus a signature "
            "(drawn or typed name). The parties agree to treat it as equal to a handwritten signature. Document "
            "integrity is protected by a SHA-256 hash that can be checked on the contract verification page."}),
]


def money(n: int) -> str:
    return f"{int(n):,}".replace(",", " ")


def get_rules(db: Session) -> dict:
    vals = {s.key: s.value for s in db.scalars(select(Setting).where(Setting.key.in_(
        ["commission_percent", "cancel_free_days", "cancel_fee_percent", "cancel_platform_share"])))}

    def g(k, d):
        try:
            return max(0, min(100, int(vals.get(k, d))))
        except (TypeError, ValueError):
            return d
    return {"commission_percent": g("commission_percent", 10), "cancel_free_days": g("cancel_free_days", 3),
            "cancel_fee_percent": g("cancel_fee_percent", 30), "cancel_platform_share": g("cancel_platform_share", 40)}


def split(price: int, pct: int) -> tuple[int, int]:
    fee = round(price * pct / 100)
    return fee, price - fee


def contract_hash(c: Contract) -> str:
    b = c.booking
    data = {"n": c.number, "bk": c.booking_id, "c": c.client_id, "cr": c.creator_id, "cat": c.category,
            "t": c.title, "p": c.price, "pct": c.commission_percent, "cf": c.cancel_free_days,
            "cfp": c.cancel_fee_percent, "cps": c.cancel_platform_share,
            "d": b.event_date.isoformat() if b else "", "st": b.start_time if b else "",
            "h": b.duration_hours if b else 0, "l": b.location if b else ""}
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def price_of(b: Booking) -> int:
    if b.price:
        return int(b.price)
    if b.service and b.service.price:
        return int(b.service.price)
    return int(b.creator.price_from or 0) if b.creator else 0


def ensure_contract(db: Session, b: Booking) -> Contract:
    c = db.scalar(select(Contract).where(Contract.booking_id == b.id))
    if c:
        return c
    rules = get_rules(db)
    price = price_of(b)
    fee, creator_amount = split(price, rules["commission_percent"])
    c = Contract(number=f"TMP{b.id}", booking_id=b.id, client_id=b.client_id, creator_id=b.creator_id,
                 category=b.creator.category if b.creator else "photographer", title=b.title[:160], price=price,
                 commission_percent=rules["commission_percent"], platform_fee=fee, creator_amount=creator_amount,
                 cancel_free_days=rules["cancel_free_days"], cancel_fee_percent=rules["cancel_fee_percent"],
                 cancel_platform_share=rules["cancel_platform_share"])
    db.add(c)
    db.flush()
    c.number = f"PM-{utcnow().year}-{c.id:06d}"
    c.booking = b
    c.doc_hash = contract_hash(c)
    return c


def render_terms(c: Contract, lang: str) -> list[dict]:
    lang = lang if lang in ("uz", "ru", "en") else "uz"
    b = c.booking
    cfee_sum = round(c.price * c.cancel_fee_percent / 100)
    vals = {
        "kind": KIND.get(c.category, KIND["photographer"])[lang], "title": c.title,
        "date": b.event_date.strftime("%d.%m.%Y") if b else "", "time": (b.start_time or "—") if b else "—",
        "hours": f"{b.duration_hours:g}" if b else "", "location": b.location if b else "",
        "price": money(c.price), "pct": c.commission_percent, "fee": money(c.platform_fee),
        "creator": money(c.creator_amount), "days": DELIVERY_DAYS.get(c.category, 14),
        "deliv": DELIVERABLE.get(c.category, DELIVERABLE["photographer"])[lang],
        "free": c.cancel_free_days, "cfee": c.cancel_fee_percent, "cfee_sum": money(cfee_sum),
        "cplat": c.cancel_platform_share,
    }
    return [{"n": i, "id": cid, "title": titles[lang], "text": texts[lang].format(**vals)}
            for i, (cid, titles, texts) in enumerate(CLAUSES, 1)]


def apply_cancellation(db: Session, b: Booking, actor_role: str, actor_id: int) -> Contract | None:
    """Buyurtma bekor qilinganda shartnomani yopadi va (mijoz kech bekor qilsa) ushlab qolinadigan qismni hisoblaydi."""
    c = db.scalar(select(Contract).where(Contract.booking_id == b.id))
    if not c or c.status in (CONTRACT_CANCELLED, CONTRACT_VOID):
        return c
    c.cancelled_by, c.cancelled_at = actor_id, utcnow()
    if c.status == CONTRACT_AWAITING:
        c.status = CONTRACT_VOID
        return c
    c.status = CONTRACT_CANCELLED
    if actor_role == "client" and (b.event_date - date.today()).days < c.cancel_free_days:
        fee = round(c.price * c.cancel_fee_percent / 100)
        plat = round(fee * c.cancel_platform_share / 100)
        c.cancel_fee, c.cancel_to_platform, c.cancel_to_creator = fee, plat, fee - plat
    return c


def contract_out(c: Contract, lang: str, full: bool = False, viewer_role: str = "client") -> dict:
    b = c.booking
    d = {
        "id": c.id, "number": c.number, "booking_id": c.booking_id, "title": c.title, "category": c.category,
        "price": c.price, "commission_percent": c.commission_percent, "platform_fee": c.platform_fee,
        "creator_amount": c.creator_amount, "status": c.status, "created_at": c.created_at,
        "event_date": b.event_date if b else None,
        "client": {"id": c.client_id, "name": c.client.name if c.client else ""},
        "creator": {"id": c.creator_id, "name": c.creator.display_name if c.creator else ""},
        "client_signed_at": c.client_signed_at, "creator_signed_at": c.creator_signed_at,
        "cancel_fee": c.cancel_fee, "cancel_to_platform": c.cancel_to_platform,
        "cancel_to_creator": c.cancel_to_creator, "hash_short": c.doc_hash[:16],
    }
    if full:
        d.update({
            "doc_hash": c.doc_hash, "terms": render_terms(c, lang),
            "cancel_free_days": c.cancel_free_days, "cancel_fee_percent": c.cancel_fee_percent,
            "cancel_platform_share": c.cancel_platform_share,
            "event": {"date": b.event_date, "start_time": b.start_time, "duration_hours": b.duration_hours,
                      "location": b.location} if b else None,
            "client_sign_name": c.client_sign_name, "creator_sign_name": c.creator_sign_name,
            "client_signature": c.client_signature, "creator_signature": c.creator_signature,
            "client_contact": {"email": c.client.email, "phone": c.client.phone} if c.client else None,
            "creator_contact": {"email": c.creator.user.email, "phone": c.creator.user.phone}
            if c.creator and c.creator.user else None,
        })
    return d


__all__ = ["ensure_contract", "apply_cancellation", "render_terms", "contract_out", "contract_hash", "get_rules",
           "split", "money", "CONTRACT_SIGNED"]
