from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import CreatorProfile, User, PURPOSE_RESET, PURPOSE_VERIFY, ROLE_CREATOR, utcnow
from ..ratelimit import rate_limit
from ..schemas import EmailIn, LoginIn, PasswordChangeIn, ProfileUpdateIn, RegisterIn, ResetIn, VerifyIn
from ..security import create_access_token, hash_password, verify_password
from ..services import consume_code, issue_code, user_private
from ..uploads import delete_upload, save_image

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _norm(email: str) -> str:
    return email.strip().lower()


def _token_response(user: User) -> dict:
    return {
        "access_token": create_access_token(user.id, user.role, user.token_version),
        "token_type": "bearer",
        "user": user_private(user),
    }


@router.post("/register", dependencies=[Depends(rate_limit("register", 8, 3600))])
def register(data: RegisterIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    email = _norm(data.email)
    user = db.scalar(select(User).where(User.email == email))
    if user and user.is_verified:
        raise HTTPException(409, "Bu email bilan hisob mavjud. Tizimga kiring yoki parolni tiklang")
    if user:  # tasdiqlanmagan eski urinish — ma'lumotlarni yangilaymiz
        user.name, user.phone, user.role, user.lang = data.name, data.phone, data.role, data.lang
        user.password_hash = hash_password(data.password)
    else:
        user = User(name=data.name, email=email, phone=data.phone, role=data.role,
                    password_hash=hash_password(data.password), lang=data.lang)
        db.add(user)
    db.flush()
    if data.role == ROLE_CREATOR and not user.creator_profile:
        db.add(CreatorProfile(user_id=user.id, display_name=data.name, price_from=0))
    db.commit()
    issue_code(db, user, PURPOSE_VERIFY, background, enforce_cooldown=False)
    return {"message": "Emailingizga 6 xonali tasdiqlash kodi yuborildi", "email": email}


@router.post("/verify-email", dependencies=[Depends(rate_limit("verify", 20, 600))])
def verify_email(data: VerifyIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == _norm(data.email)))
    if not user:
        raise HTTPException(400, "Kod noto'g'ri yoki muddati tugagan")
    if user.is_verified:
        raise HTTPException(400, "Email allaqachon tasdiqlangan. Tizimga kiring")
    consume_code(db, user, PURPOSE_VERIFY, data.code)
    user.is_verified = True
    user.last_login_at = utcnow()
    db.commit()
    return _token_response(user)


@router.post("/resend-code", dependencies=[Depends(rate_limit("resend", 6, 3600))])
def resend_code(data: EmailIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == _norm(data.email)))
    if user and not user.is_verified:
        issue_code(db, user, PURPOSE_VERIFY, background)
    return {"message": "Agar hisob mavjud bo'lsa, yangi kod yuborildi"}


@router.post("/login", dependencies=[Depends(rate_limit("login", 15, 900))])
def login(data: LoginIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == _norm(data.email)))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Email yoki parol noto'g'ri")
    if not user.is_active:
        raise HTTPException(403, "Hisobingiz bloklangan. Administrator bilan bog'laning")
    if not user.is_verified:
        try:
            issue_code(db, user, PURPOSE_VERIFY, background)
        except HTTPException:
            pass  # kod yaqinda yuborilgan
        raise HTTPException(403, "EMAIL_NOT_VERIFIED")
    user.last_login_at = utcnow()
    db.commit()
    return _token_response(user)


@router.post("/forgot-password", dependencies=[Depends(rate_limit("forgot", 6, 3600))])
def forgot_password(data: EmailIn, background: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == _norm(data.email)))
    if user and user.is_active:
        issue_code(db, user, PURPOSE_RESET, background)
    return {"message": "Agar bu email ro'yxatdan o'tgan bo'lsa, parolni tiklash kodi yuborildi"}


@router.post("/reset-password", dependencies=[Depends(rate_limit("reset", 15, 900))])
def reset_password(data: ResetIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == _norm(data.email)))
    if not user or not user.is_active:
        raise HTTPException(400, "Kod noto'g'ri yoki muddati tugagan")
    consume_code(db, user, PURPOSE_RESET, data.code)
    user.password_hash = hash_password(data.new_password)
    user.token_version += 1  # boshqa qurilmalardagi sessiyalarni yopish
    user.is_verified = True
    user.last_login_at = utcnow()
    db.commit()
    return _token_response(user)


# ---------------- Joriy foydalanuvchi ----------------
@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return user_private(user)


@router.put("/me")
def update_me(data: ProfileUpdateIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.name = data.name.strip()
    user.phone = (data.phone or "").strip() or None
    if data.lang:
        user.lang = data.lang
    db.commit()
    return user_private(user)


@router.post("/me/avatar")
async def upload_avatar(file: UploadFile = File(...), user: User = Depends(get_current_user),
                        db: Session = Depends(get_db)):
    url = await save_image(file, "avatars", max_side=512)
    delete_upload(user.avatar_url)
    user.avatar_url = url
    db.commit()
    return user_private(user)


@router.post("/me/password")
def change_password(data: PasswordChangeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(data.old_password, user.password_hash):
        raise HTTPException(400, "Joriy parol noto'g'ri")
    user.password_hash = hash_password(data.new_password)
    user.token_version += 1
    db.commit()
    return _token_response(user)
