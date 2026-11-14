from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ---- Konstantalar ----
ROLE_CLIENT = "client"
ROLE_CREATOR = "creator"
ROLE_ADMIN = "admin"
ROLES = (ROLE_CLIENT, ROLE_CREATOR, ROLE_ADMIN)

CATEGORIES = ("photographer", "videographer", "both")

ST_PENDING = "pending"
ST_ACCEPTED = "accepted"
ST_REJECTED = "rejected"
ST_CANCELLED = "cancelled"
ST_COMPLETED = "completed"
STATUSES = (ST_PENDING, ST_ACCEPTED, ST_REJECTED, ST_CANCELLED, ST_COMPLETED)

PURPOSE_VERIFY = "verify_email"
PURPOSE_RESET = "reset_password"


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default=ROLE_CLIENT, index=True)
    avatar_url: Mapped[str] = mapped_column(String(500), default="")
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    lang: Mapped[str] = mapped_column(String(2), default="uz")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    creator_profile: Mapped["CreatorProfile | None"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class EmailCode(Base):
    __tablename__ = "email_codes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(30))
    code_hash: Mapped[str] = mapped_column(String(128))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class CreatorProfile(Base):
    __tablename__ = "creator_profiles"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    display_name: Mapped[str] = mapped_column(String(140))
    category: Mapped[str] = mapped_column(String(20), default="photographer", index=True)
    city: Mapped[str] = mapped_column(String(80), default="Toshkent", index=True)
    price_from: Mapped[int] = mapped_column(Integer, default=0)
    bio: Mapped[str] = mapped_column(Text, default="")
    specialties: Mapped[str] = mapped_column(String(500), default="")  # vergul bilan
    experience_years: Mapped[int] = mapped_column(Integer, default=0)
    cover_url: Mapped[str] = mapped_column(String(500), default="")
    instagram: Mapped[str] = mapped_column(String(120), default="")
    telegram: Mapped[str] = mapped_column(String(120), default="")
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0)
    completed_count: Mapped[int] = mapped_column(Integer, default=0)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    address: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    user: Mapped[User] = relationship(back_populates="creator_profile")
    portfolio: Mapped[list["PortfolioItem"]] = relationship(
        back_populates="creator", cascade="all, delete-orphan", order_by="PortfolioItem.position"
    )
    services: Mapped[list["Service"]] = relationship(
        back_populates="creator", cascade="all, delete-orphan", order_by="Service.price"
    )

    @property
    def specialties_list(self) -> list[str]:
        return [s.strip() for s in (self.specialties or "").split(",") if s.strip()]


class PortfolioItem(Base):
    __tablename__ = "portfolio_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("creator_profiles.id", ondelete="CASCADE"), index=True)
    image_url: Mapped[str] = mapped_column(String(500))
    title: Mapped[str] = mapped_column(String(140), default="")
    category: Mapped[str] = mapped_column(String(60), default="")
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    creator: Mapped[CreatorProfile] = relationship(back_populates="portfolio")


class Service(Base):
    __tablename__ = "services"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("creator_profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(140))
    description: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[int] = mapped_column(Integer, default=0)
    duration_hours: Mapped[float] = mapped_column(Float, default=1.0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    creator: Mapped[CreatorProfile] = relationship(back_populates="services")


class BlockedDate(Base):
    __tablename__ = "blocked_dates"
    __table_args__ = (UniqueConstraint("creator_id", "day", name="uq_blocked_creator_day"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("creator_profiles.id", ondelete="CASCADE"), index=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    note: Mapped[str] = mapped_column(String(200), default="")


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (Index("ix_booking_creator_date", "creator_id", "event_date"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("creator_profiles.id", ondelete="CASCADE"), index=True)
    service_id: Mapped[int | None] = mapped_column(ForeignKey("services.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(140))
    event_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[str] = mapped_column(String(5), default="")  # HH:MM
    duration_hours: Mapped[float] = mapped_column(Float, default=2.0)
    location: Mapped[str] = mapped_column(String(255))
    details: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=ST_PENDING, index=True)
    status_note: Mapped[str] = mapped_column(String(500), default="")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    client: Mapped[User] = relationship(foreign_keys=[client_id])
    creator: Mapped[CreatorProfile] = relationship(foreign_keys=[creator_id])
    service: Mapped[Service | None] = relationship()
    review: Mapped["Review | None"] = relationship(back_populates="booking", uselist=False, cascade="all, delete-orphan")


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), unique=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("creator_profiles.id", ondelete="CASCADE"), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text, default="")
    reply: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    booking: Mapped[Booking] = relationship(back_populates="review")
    client: Mapped[User] = relationship(foreign_keys=[client_id])
    creator: Mapped[CreatorProfile] = relationship(foreign_keys=[creator_id])


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_msg_pair", "sender_id", "recipient_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)
    body: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(String(1000), default="")
    link: Mapped[str] = mapped_column(String(300), default="")
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "creator_id", name="uq_fav_user_creator"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("creator_profiles.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    creator: Mapped[CreatorProfile] = relationship()


PAY_METHODS = ("cash", "card", "transfer")
PAY_PENDING, PAY_PAID, PAY_REJECTED = "pending", "paid", "rejected"


class Payment(Base):
    """To'lov yozuvi. Platforma pulni o'zi ushlab turmaydi: mijoz ijodkorga to'g'ridan-to'g'ri to'laydi,
    ikkala tomon to'lovni shu yerda qayd etadi (mijoz kiritadi -> ijodkor tasdiqlaydi)."""
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), index=True)
    payer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("creator_profiles.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    method: Mapped[str] = mapped_column(String(20), default="cash")
    status: Mapped[str] = mapped_column(String(12), default=PAY_PENDING, index=True)
    note: Mapped[str] = mapped_column(String(300), default="")
    created_by: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    proof_url: Mapped[str] = mapped_column(String(500), default="")      # mijoz yuklagan chek/skrinshot
    card_id: Mapped[int | None] = mapped_column(Integer, nullable=True)   # mijozning saqlangan kartasi
    receipt_no: Mapped[str] = mapped_column(String(30), default="")
    fee: Mapped[int] = mapped_column(Integer, default=0)                   # platforma ulushi
    creator_amount: Mapped[int] = mapped_column(Integer, default=0)        # ijodkorga o'tadigan qism
    payout_status: Mapped[str] = mapped_column(String(10), default="none")  # none | pending | sent
    admin_note: Mapped[str] = mapped_column(String(300), default="")
    confirmed_by: Mapped[int] = mapped_column(Integer, default=0)
    booking: Mapped[Booking] = relationship()


class Category(Base):
    """Xizmat yo'nalishi (admin boshqaradi). name_uz ijodkor mutaxassisliklari bilan mos keladi."""
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    name_uz: Mapped[str] = mapped_column(String(80), unique=True)
    name_ru: Mapped[str] = mapped_column(String(80), default="")
    name_en: Mapped[str] = mapped_column(String(80), default="")
    image_url: Mapped[str] = mapped_column(String(500), default="")
    position: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


COMPLAINT_STATUSES = ("open", "in_review", "resolved", "dismissed")


class Complaint(Base):
    __tablename__ = "complaints"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    creator_id: Mapped[int | None] = mapped_column(ForeignKey("creator_profiles.id", ondelete="SET NULL"), nullable=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True)
    reason: Mapped[str] = mapped_column(String(20), default="other")
    text: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(12), default="open", index=True)
    admin_note: Mapped[str] = mapped_column(String(1000), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    reporter: Mapped[User] = relationship(foreign_keys=[reporter_id])
    creator: Mapped[CreatorProfile | None] = relationship(foreign_keys=[creator_id])


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")


CONTRACT_AWAITING, CONTRACT_SIGNED, CONTRACT_CANCELLED, CONTRACT_VOID = "awaiting", "signed", "cancelled", "void"


class Contract(Base):
    """Elektron shartnoma (mijoz–ijodkor, platforma kafil). Matn kategoriya bo'yicha shablondan yig'iladi."""
    __tablename__ = "contracts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), unique=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("creator_profiles.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String(20), default="photographer", index=True)
    title: Mapped[str] = mapped_column(String(160), default="")
    price: Mapped[int] = mapped_column(Integer, default=0)
    commission_percent: Mapped[int] = mapped_column(Integer, default=0)
    platform_fee: Mapped[int] = mapped_column(Integer, default=0)
    creator_amount: Mapped[int] = mapped_column(Integer, default=0)
    cancel_free_days: Mapped[int] = mapped_column(Integer, default=3)
    cancel_fee_percent: Mapped[int] = mapped_column(Integer, default=30)
    cancel_platform_share: Mapped[int] = mapped_column(Integer, default=40)
    status: Mapped[str] = mapped_column(String(12), default=CONTRACT_AWAITING, index=True)
    doc_hash: Mapped[str] = mapped_column(String(64), default="")
    client_signed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    client_sign_name: Mapped[str] = mapped_column(String(140), default="")
    client_signature: Mapped[str] = mapped_column(Text, default="")
    client_sign_ip: Mapped[str] = mapped_column(String(64), default="")
    creator_signed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    creator_sign_name: Mapped[str] = mapped_column(String(140), default="")
    creator_signature: Mapped[str] = mapped_column(Text, default="")
    creator_sign_ip: Mapped[str] = mapped_column(String(64), default="")
    cancelled_by: Mapped[int] = mapped_column(Integer, default=0)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancel_fee: Mapped[int] = mapped_column(Integer, default=0)
    cancel_to_platform: Mapped[int] = mapped_column(Integer, default=0)
    cancel_to_creator: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    booking: Mapped[Booking] = relationship()
    client: Mapped[User] = relationship(foreign_keys=[client_id])
    creator: Mapped[CreatorProfile] = relationship(foreign_keys=[creator_id])


class SavedCard(Base):
    """Bank kartasi: faqat maskalangan ko'rinish saqlanadi (to'liq raqam va CVV hech qachon saqlanmaydi)."""
    __tablename__ = "saved_cards"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    holder: Mapped[str] = mapped_column(String(80), default="")
    brand: Mapped[str] = mapped_column(String(12), default="card")
    first4: Mapped[str] = mapped_column(String(4), default="")
    last4: Mapped[str] = mapped_column(String(4), default="")
    exp: Mapped[str] = mapped_column(String(5), default="")
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Ad(Base):
    """E'lon / reklama bannerlari (admin boshqaradi)."""
    __tablename__ = "ads"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(140))
    text: Mapped[str] = mapped_column(String(400), default="")
    image_url: Mapped[str] = mapped_column(String(500), default="")
    link_url: Mapped[str] = mapped_column(String(500), default="")
    advertiser: Mapped[str] = mapped_column(String(120), default="")
    placement: Mapped[str] = mapped_column(String(12), default="home", index=True)  # home | dashboard | creators
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    starts_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    ends_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    views: Mapped[int] = mapped_column(Integer, default=0)
    clicks: Mapped[int] = mapped_column(Integer, default=0)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
