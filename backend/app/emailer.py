import json
import logging
import urllib.request
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr, parseaddr
from html import escape

from .config import settings
from .i18n import tr

log = logging.getLogger("photomarket.email")


def _send_via_script(to: str, subject: str, html: str, text: str) -> bool:
    """Google Apps Script veb-ilovasi orqali (google-script/Code.gs). Ma'lumot HTTPS bilan, maxfiy kalit bilan boradi."""
    payload = json.dumps({"key": settings.mail_script_key, "to": to, "subject": subject, "html": html,
                          "text": text, "name": settings.app_name}).encode("utf-8")
    req = urllib.request.Request(settings.mail_script_url, data=payload, method="POST",
                                 headers={"Content-Type": "text/plain; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:  # Apps Script 302 bilan yo'naltiradi, urllib kuzatadi
            body = r.read().decode("utf-8", "replace")
        data = json.loads(body)
        if data.get("ok"):
            log.info("Email (Google Script) yuborildi: %s (%s)", to, subject)
            return True
        log.error("Google Script rad etdi: %s", data.get("error", body[:200]))
    except Exception as exc:
        log.exception("Google Script orqali yuborilmadi (%s): %s", to, exc)
    return False


def send_email(to: str, subject: str, html: str, text: str) -> bool:
    if not settings.email_enabled:
        print("\n" + "=" * 64)
        print(f"[DEV EMAIL] Kimga: {to}\nMavzu: {subject}\n\n{text}")
        print("=" * 64 + "\n", flush=True)
        return True
    if settings.script_enabled:
        return _send_via_script(to, subject, html, text)
    msg = EmailMessage()
    sender = settings.smtp_from or settings.smtp_user
    name, addr = parseaddr(sender)
    msg["From"] = formataddr((name or settings.app_name, addr or settings.smtp_user))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    try:
        ctx = ssl.create_default_context()
        if settings.smtp_use_ssl or settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, context=ctx, timeout=20) as s:
                s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as s:
                s.ehlo()
                s.starttls(context=ctx)
                s.login(settings.smtp_user, settings.smtp_password)
                s.send_message(msg)
        log.info("Email yuborildi: %s (%s)", to, subject)
        return True
    except smtplib.SMTPAuthenticationError as exc:
        log.error("SMTP login rad etildi (%s). Gmail uchun oddiy parol emas, 16 belgili «App password» "
                  "kerak: https://myaccount.google.com/apppasswords", exc)
        return False
    except Exception as exc:  # tarmoq/SMTP xatolari serverni yiqitmasligi kerak
        log.exception("Email yuborilmadi (%s): %s", to, exc)
        return False


def _layout(title: str, inner_html: str, lang: str = "uz") -> str:
    return f"""<!doctype html><html><body style="margin:0;background:#f6f5fb;font-family:Segoe UI,Arial,sans-serif;color:#1c1917">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e2da">
<tr><td style="padding:22px 28px;border-bottom:1px solid #eee8df;font-size:20px;font-weight:700;letter-spacing:-.3px">
<span style="color:#6d28d9">&#9673;</span> {escape(settings.app_name)}</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 14px;font-size:20px">{escape(title)}</h1>
{inner_html}
</td></tr>
<tr><td style="padding:16px 28px;background:#faf8f5;color:#78716c;font-size:12px">
{escape(tr(lang, "Bu xat avtomatik yuborildi. Agar siz bu amalni bajarmagan bo'lsangiz, xatni e'tiborsiz qoldiring."))}</td></tr>
</table></td></tr></table></body></html>"""


def send_code_email(to: str, name: str, code: str, purpose: str, lang: str = "uz") -> bool:
    if purpose == "verify_email":
        subject = tr(lang, "{code} — {app} tasdiqlash kodi", code=code, app=settings.app_name)
        title = tr(lang, "Email manzilingizni tasdiqlang")
        lead = tr(lang, "Ro'yxatdan o'tishni yakunlash uchun quyidagi kodni kiriting:")
    else:
        subject = tr(lang, "{code} — parolni tiklash kodi", code=code)
        title = tr(lang, "Parolni tiklash")
        lead = tr(lang, "Yangi parol o'rnatish uchun quyidagi kodni kiriting:")
    ttl = settings.email_code_ttl_minutes
    hello = tr(lang, "Assalomu alaykum, {name}!", name=name)
    note = tr(lang, "Kod {ttl} daqiqa davomida amal qiladi. Uni hech kimga bermang.", ttl=ttl)
    inner = f"""<p style="margin:0 0 6px">{escape(hello)}</p>
<p style="margin:0 0 18px;color:#57534e">{escape(lead)}</p>
<div style="font-size:34px;font-weight:700;letter-spacing:10px;background:#f5f3ff;border:1px dashed #c4b5fd;
border-radius:12px;padding:16px;text-align:center;color:#5b21b6">{code}</div>
<p style="margin:18px 0 0;color:#78716c;font-size:13px">{escape(note)}</p>"""
    text = f"{hello}\n{lead}\n\nCODE: {code}\n\n{note}"
    return send_email(to, subject, _layout(title, inner, lang), text)


def send_notice_email(to: str, title: str, body: str, link: str = "", lang: str = "uz") -> bool:
    url = f"{settings.frontend_url.rstrip('/')}{link}" if link else settings.frontend_url
    inner = f"""<p style="margin:0 0 20px;color:#44403c;line-height:1.55">{escape(body)}</p>
<a href="{escape(url)}" style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;
padding:11px 20px;border-radius:10px;font-weight:600">{escape(tr(lang, "Ko'rish"))}</a>"""
    return send_email(to, f"{title} — {settings.app_name}", _layout(title, inner, lang), f"{title}\n\n{body}\n\n{url}")
