from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/


class Settings(BaseSettings):
    app_name: str = "PhotoMarket"
    jwt_secret: str = "dev-only-change-me-dev-only-change-me"
    jwt_expire_minutes: int = 10080
    database_url: str = "sqlite:///./data/photomarket.db"
    cors_origins: str = "http://localhost:5173"
    frontend_url: str = "http://localhost:5173"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_ssl: bool = False

    # Google Apps Script orqali yuborish (Render bepul rejasida SMTP portlari yopiq)
    # Supabase Storage (Render'da fayllar saqlanib qolmaydi, shuning uchun rasmlar shu yerga yuklanadi)
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_bucket: str = "uploads"

    default_lang: str = "uz"

    # Birinchi ishga tushishda admin yaratish (Render bepul rejasida terminal yo'q)
    admin_email: str = ""
    admin_password: str = ""
    seed_demo: bool = False

    mail_script_url: str = ""
    mail_script_key: str = ""

    email_code_ttl_minutes: int = 10
    email_code_cooldown_seconds: int = 60
    email_code_max_attempts: int = 5

    upload_dir: str = "uploads"
    max_upload_mb: int = 8

    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(",") if x.strip()]

    @property
    def script_enabled(self) -> bool:
        return bool(self.mail_script_url and self.mail_script_key)

    @property
    def email_enabled(self) -> bool:
        return self.script_enabled or bool(self.smtp_host and self.smtp_user and self.smtp_password)

    @property
    def upload_path(self) -> Path:
        p = Path(self.upload_dir)
        return p if p.is_absolute() else BASE_DIR / p

    @property
    def storage_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key)

    @property
    def resolved_database_url(self) -> str:
        url = self.database_url.strip()
        # Supabase/Heroku uslubidagi manzillarni SQLAlchemy + psycopg3 ga moslaymiz
        for old in ("postgresql://", "postgres://"):
            if url.startswith(old):
                url = "postgresql+psycopg://" + url[len(old):]
        if url.startswith("postgresql+psycopg://") and "sslmode=" not in url and "localhost" not in url and "127.0.0.1" not in url:
            url += ("&" if "?" in url else "?") + "sslmode=require"
        if url.startswith("sqlite:///./"):
            rel = url[len("sqlite:///./"):]
            path = BASE_DIR / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{path.as_posix()}"
        return url


settings = Settings()
