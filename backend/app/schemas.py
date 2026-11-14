"""Kiruvchi ma'lumotlar sxemalari (validatsiya)."""
import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _clean(v: str | None) -> str:
    return (v or "").strip()


def _password_rules(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Parol kamida 8 belgidan iborat bo'lsin")
    if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
        raise ValueError("Parolda kamida bitta harf va bitta raqam bo'lsin")
    return v


# ---------- Auth ----------
class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(max_length=128)
    phone: str | None = Field(default=None, max_length=40)
    role: Literal["client", "creator"] = "client"
    lang: Literal["uz", "ru", "en"] = "uz"

    _n = field_validator("name")(lambda cls, v: _clean(v))
    _p = field_validator("password")(lambda cls, v: _password_rules(v))


class EmailIn(BaseModel):
    email: EmailStr


class VerifyIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ResetIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(max_length=128)
    _p = field_validator("new_password")(lambda cls, v: _password_rules(v))


class ProfileUpdateIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    lang: Literal["uz", "ru", "en"] | None = None


class PasswordChangeIn(BaseModel):
    old_password: str
    new_password: str = Field(max_length=128)
    _p = field_validator("new_password")(lambda cls, v: _password_rules(v))


# ---------- Creator ----------
class CreatorProfileIn(BaseModel):
    display_name: str = Field(min_length=2, max_length=140)
    category: Literal["photographer", "videographer", "both"] = "photographer"
    city: str = Field(min_length=2, max_length=80)
    price_from: int = Field(ge=0, le=1_000_000_000)
    bio: str = Field(default="", max_length=3000)
    specialties: list[str] = Field(default_factory=list, max_length=12)
    experience_years: int = Field(default=0, ge=0, le=60)
    instagram: str = Field(default="", max_length=120)
    telegram: str = Field(default="", max_length=120)
    active: bool = True

    @field_validator("specialties")
    @classmethod
    def _spec(cls, v: list[str]) -> list[str]:
        out = []
        for s in v:
            s = s.strip().replace(",", " ")[:40]
            if s and s not in out:
                out.append(s)
        return out


class ServiceIn(BaseModel):
    title: str = Field(min_length=2, max_length=140)
    description: str = Field(default="", max_length=2000)
    price: int = Field(ge=0, le=1_000_000_000)
    duration_hours: float = Field(default=1, gt=0, le=72)
    active: bool = True


class PortfolioUpdateIn(BaseModel):
    title: str = Field(default="", max_length=140)
    category: str = Field(default="", max_length=60)
    position: int | None = None


class BlockedDateIn(BaseModel):
    day: date
    note: str = Field(default="", max_length=200)


# ---------- Booking ----------
class BookingUpdateIn(BaseModel):
    title: str = Field(min_length=2, max_length=140)
    event_date: date
    start_time: str = ""
    duration_hours: float = Field(default=2, gt=0, le=72)
    location: str = Field(min_length=2, max_length=255)
    details: str = Field(default="", max_length=3000)
    price: int | None = Field(default=None, ge=0, le=1_000_000_000)

    @field_validator("start_time")
    @classmethod
    def _time(cls, v: str) -> str:
        v = (v or "").strip()
        if v and not TIME_RE.match(v):
            raise ValueError("Vaqt HH:MM formatida bo'lsin")
        return v


class BookingIn(BookingUpdateIn):
    creator_id: int
    service_id: int | None = None


class StatusIn(BaseModel):
    status: Literal["accepted", "rejected", "cancelled", "completed"]
    note: str = Field(default="", max_length=500)


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=2000)


class ReplyIn(BaseModel):
    reply: str = Field(min_length=1, max_length=2000)


# ---------- Messages ----------
class MessageIn(BaseModel):
    recipient_id: int
    body: str = Field(min_length=1, max_length=4000)
    booking_id: int | None = None

    _b = field_validator("body")(lambda cls, v: _clean(v))


# ---------- Admin ----------
class AdminUserPatch(BaseModel):
    role: Literal["client", "creator", "admin"] | None = None
    is_active: bool | None = None
    is_verified: bool | None = None


class AdminCreatorPatch(BaseModel):
    verified: bool | None = None
    featured: bool | None = None
    active: bool | None = None
