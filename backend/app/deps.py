from contextvars import ContextVar

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import User, ROLE_ADMIN, ROLE_CREATOR
from .security import decode_token

bearer = HTTPBearer(auto_error=False)
read_only: ContextVar[bool] = ContextVar("read_only", default=False)  # admin kuzatuv rejimi


def _resolve(credentials, db: Session) -> User | None:
    if not credentials:
        return None
    payload = decode_token(credentials.credentials)
    if not payload or not payload.get("sub"):
        return None
    user = db.get(User, int(payload["sub"]))
    if not user or payload.get("tv") != user.token_version:
        return None
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    user = _resolve(credentials, db)
    if not user:
        raise HTTPException(401, "Tizimga qayta kiring (sessiya tugagan)")
    if not user.is_active:
        raise HTTPException(403, "Hisobingiz bloklangan. Administrator bilan bog'laning")
    if not user.is_verified:
        raise HTTPException(403, "EMAIL_NOT_VERIFIED")
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User | None:
    user = _resolve(credentials, db)
    return user if user and user.is_active else None


def require_roles(*roles: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "Bu amal uchun ruxsat yo'q")
        return user
    return checker


require_admin = require_roles(ROLE_ADMIN)


def require_creator(user: User = Depends(require_roles(ROLE_CREATOR))):
    if not user.creator_profile:
        raise HTTPException(400, "Ijodkor profili topilmadi")
    return user
