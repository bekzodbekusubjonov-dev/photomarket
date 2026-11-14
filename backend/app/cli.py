"""Boshqaruv buyruqlari (backend papkasida, venv yoqilgan holda):

  python -m app.cli setup-email            # Gmail/SMTP ni sozlash (savollar beradi) va sinov xati
  python -m app.cli setup-script           # Google Script orqali email (tavsiya)
  python -m app.cli test-email siz@gmail.com   # sinov xati yuborish
  python -m app.cli create-admin --email admin@example.com --password Parol123 [--name "Admin"]
  python -m app.cli fetch-images           # rasmlarni bir marta yuklab olish (sayt tashqi CDN ga bog'liq bo'lmaydi)
  python -m app.cli seed-demo              # namunaviy ijodkorlar (faqat taqdimot/sinov uchun)
  python -m app.cli remove-demo            # namunaviy ijodkorlarni o'chirish (haqiqiy ishga tushirishdan oldin)
"""
import argparse
import getpass
import re
import sys

from sqlalchemy import select

from .config import BASE_DIR, settings
from .database import Base, SessionLocal, engine
from .images import px
from .models import CreatorProfile, PortfolioItem, Service, User, ROLE_ADMIN, ROLE_CREATOR
from .security import hash_password

DEMO_DOMAIN = "demo.photomarket.uz"

# Namunaviy (demo) ijodkorlar — faqat taqdimot/sinov uchun. Ishga tushirishdan oldin: python -m app.cli remove-demo
# (ism, yo'nalish, shahar, narx, mutaxassislik, tajriba, bio, xizmatlar, avatar, muqova, portfolio[(rasm, sarlavha)])
DEMO = [
    ("Aziz Karimov", "photographer", "Toshkent", 1_500_000, "To'y,Love story,Portret", 7,
     "Toshkentdagi to'y va love story fotografi. Tabiiy yorug'lik, jonli his-tuyg'ular va kino uslubidagi kadrlar. "
     "Tahrirlangan suratlar 10 kun ichida topshiriladi.",
     [("To'y — to'liq kun", 4_500_000, 10), ("Love story", 1_500_000, 2), ("ZAGS + sayr", 2_500_000, 4)],
     30767572, 0,
     [(9755941, "To'y"), (863098, "Kelin portreti"), (3361200, "Love story"), (19679440, "To'y"),
      (4873577, "Love story"), (160803, "Kelin")]),
    ("Malika Studio", "both", "Toshkent", 900_000, "Oilaviy,Bolalar,Portret", 5,
     "Studiyada va tashqarida oilaviy, bolalar va portret suratlari. Qisqa reels videolar ham tayyorlaymiz.",
     [("Oilaviy fotosessiya", 900_000, 1.5), ("Bolalar sessiyasi", 700_000, 1)],
     30004322, 0,
     [(38758066, "Oilaviy"), (30697993, "Oilaviy"), (39513498, "Bolalar"), (34381970, "Bolalar"),
      (2709388, "Portret")]),
    ("Jasur Media", "videographer", "Samarqand", 2_000_000, "To'y,Klip,Drone (aerosyomka)", 9,
     "Samarqanddagi to'y va klip videograflari. 4K kamera, drone, kunning o'zida qisqa trailer.",
     [("To'y videosi (4K)", 5_000_000, 12), ("Musiqiy klip", 3_500_000, 8), ("Drone syomka", 1_200_000, 2)],
     12437056, 0,
     [(19439122, "Kechki Samarqand"), (4941721, "Syomka jarayoni"), (2363675, "Ko'cha syomkasi"),
      (6942523, "Drone"), (878998, "Klip")]),
    ("Dilnoza Foto", "photographer", "Buxoro", 600_000, "Portret,Bitiruv,Tug'ilgan kun", 4,
     "Buxoro bo'ylab portret va bitiruv suratlari. Tarixiy joylarda sayr-fotosessiyalar.",
     [("Portret sessiya", 600_000, 1), ("Bitiruv albomi (sinf)", 3_000_000, 5)],
     5379785, 0,
     [(267885, "Bitiruv"), (1205651, "Bitiruv"), (9604191, "Portret"), (31649570, "Portret"),
      (16110767, "Portret")]),
    ("Sardor Production", "videographer", "Toshkent", 1_200_000, "Korporativ,Reklama,Reels / SMM", 6,
     "Bizneslar uchun reklama roliklari, korporativ tadbirlar va SMM uchun reels kontent.",
     [("Reels paket (5 ta)", 1_200_000, 3), ("Korporativ tadbir", 3_000_000, 6)],
     29856511, 0,
     [(7647995, "Biznes uchrashuv"), (28728922, "Studiya"), (5314217, "Syomka"),
      (2263435, "Sahna"), (39705635, "Tadbir")]),
    ("Nodira Kids", "photographer", "Andijon", 500_000, "Bolalar,Oilaviy,Tug'ilgan kun", 3,
     "Bolalar va oilalar uchun iliq, yorqin suratlar. Tug'ilgan kun va bog'cha tadbirlari.",
     [("Tug'ilgan kun", 800_000, 3), ("Bolalar portreti", 500_000, 1)],
     4906289, 0,
     [(8104206, "Tug'ilgan kun"), (3341189, "Chaqaloq"), (10998327, "Chaqaloq"),
      (8088381, "Oilaviy"), (2608519, "Oilaviy")]),
    ("Bekzod Product", "photographer", "Toshkent", 400_000, "Mahsulot (predmet),Taom,Reklama", 5,
     "Onlayn do'konlar uchun mahsulot va taom suratlari. Oq fon, lifestyle, marketplace formatlari.",
     [("10 ta mahsulot (oq fon)", 400_000, 2), ("Restoran menyusi", 1_500_000, 4)],
     31268612, 0,
     [(7797009, "Flatlay"), (306059, "Taom"), (3298057, "Taom"),
      (15061732, "Mahsulot"), (13516802, "Mahsulot")]),
    ("Kamola Wedding", "both", "Farg'ona", 1_800_000, "To'y,Nikoh (ZAGS),Love story", 8,
     "Farg'ona vodiysida to'y foto va videosi bir jamoadan. Albom va 5 daqiqalik film.",
     [("Foto + video to'y paketi", 6_500_000, 12)],
     3763156, 0,
     [(5729135, "Kelin"), (7994345, "Kelin"), (15524744, "Kelin"), (9915424, "Love story"),
      (4352151, "Love story")]),
]


def create_admin(email: str, password: str, name: str):
    with SessionLocal() as db:
        email = email.strip().lower()
        u = db.scalar(select(User).where(User.email == email))
        if u:
            u.role, u.is_verified, u.is_active = ROLE_ADMIN, True, True
            u.password_hash = hash_password(password)
            u.token_version += 1
            print(f"Mavjud foydalanuvchi admin qilindi: {email}")
        else:
            db.add(User(name=name, email=email, role=ROLE_ADMIN, is_verified=True,
                        password_hash=hash_password(password)))
            print(f"Admin yaratildi: {email}")
        db.commit()


def seed_demo():
    with SessionLocal() as db:
        n = 0
        for i, (name, cat, city, price, spec, exp, bio, services, avatar, cover, photos) in enumerate(DEMO, 1):
            email = f"demo{i}@{DEMO_DOMAIN}"
            if db.scalar(select(User).where(User.email == email)):
                continue
            u = User(name=name, email=email, role=ROLE_CREATOR, is_verified=True, phone=f"+99890{1000000 + i:07d}",
                     password_hash=hash_password("Demo12345"), avatar_url=px(avatar, 400))
            db.add(u)
            db.flush()
            c = CreatorProfile(user_id=u.id, display_name=name, category=cat, city=city, price_from=price,
                               specialties=spec, experience_years=exp, bio=bio, verified=i % 3 != 0,
                               featured=i <= 3, cover_url=px(cover, 1800) if cover else "",
                               instagram=name.lower().replace(" ", "_"))
            db.add(c)
            db.flush()
            for j, (pid, title) in enumerate(photos):
                db.add(PortfolioItem(creator_id=c.id, position=j, image_url=px(pid, 1400), title=title))
            for title, p, h in services:
                db.add(Service(creator_id=c.id, title=title, price=p, duration_hours=h,
                               description=f"{title}. Tahrirlangan suratlar/video 7–14 kun ichida topshiriladi."))
            n += 1
        db.commit()
    print(f"{n} ta demo ijodkor qo'shildi. Kirish: demo1@{DEMO_DOMAIN} ... parol: Demo12345")
    print("Eslatma: bu namunaviy profillar. Saytni haqiqiy ishga tushirishdan oldin: python -m app.cli remove-demo")


def remove_demo():
    with SessionLocal() as db:
        users = db.scalars(select(User).where(User.email.like(f"%@{DEMO_DOMAIN}"))).all()
        for u in users:
            db.delete(u)
        db.commit()
    print(f"{len(users)} ta demo hisob (portfolio, xizmat va buyurtmalari bilan) o'chirildi")


def test_email(to: str) -> bool:
    from .emailer import send_code_email
    if not settings.email_enabled:
        print("Email sozlanmagan — kod faqat terminalga chiqadi. Sozlash: python -m app.cli setup-script")
    ok = send_code_email(to, "Sinov", "123456", "verify_email")
    print("✓ Xat yuborildi — pochtangizni (va «Spam» papkasini) tekshiring" if ok
          else "✗ Yuborilmadi — yuqoridagi xato matniga qarang")
    return ok


def _write_env(values: dict[str, str]):
    env = BASE_DIR / ".env"
    lines = env.read_text("utf-8").splitlines() if env.exists() else []
    done = set()
    for i, line in enumerate(lines):
        key = line.split("=", 1)[0].strip()
        if key in values:
            lines[i] = f"{key}={values[key]}"
            done.add(key)
    lines += [f"{k}={v}" for k, v in values.items() if k not in done]
    env.write_text("\n".join(lines) + "\n", "utf-8")


def setup_email():
    print("=== PhotoMarket: email (SMTP) sozlash ===")
    print("Gmail uchun: 1) Google hisobida 2 bosqichli tekshiruvni yoqing")
    print("             2) https://myaccount.google.com/apppasswords da «App password» yarating (16 harf)\n")
    user = input("Gmail manzilingiz: ").strip()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", user):
        sys.exit("Email noto'g'ri")
    pw = getpass.getpass("App password (ko'rinmaydi, bo'shliqlar bilan ham bo'ladi): ").replace(" ", "").strip()
    if len(pw) < 8:
        sys.exit("Parol juda qisqa")
    host = "smtp.gmail.com" if user.lower().endswith(("@gmail.com", "@googlemail.com")) else \
        (input("SMTP server (masalan smtp.mail.ru): ").strip() or "smtp.gmail.com")
    values = {"SMTP_HOST": host, "SMTP_PORT": "587", "SMTP_USER": user, "SMTP_PASSWORD": pw,
              "SMTP_FROM": f'"PhotoMarket <{user}>"', "SMTP_USE_SSL": "false"}
    _write_env(values)
    for k, v in values.items():
        setattr(settings, k.lower(), int(v) if k == "SMTP_PORT" else (v == "true" if k == "SMTP_USE_SSL" else v.strip('"')))
    print("\n.env yangilandi. Sinov xati yuborilmoqda...")
    if test_email(user):
        print("Tayyor! Backendni qayta ishga tushiring — endi kodlar haqiqiy emailga boradi.")


def setup_script():
    print("=== PhotoMarket: Google Script orqali email sozlash ===")
    print("google-script/Code.gs ni script.google.com ga joylab, veb-ilova sifatida joylashtiring (README'ga qarang)\n")
    url = input("Veb-ilova manzili (https://script.google.com/macros/s/.../exec): ").strip()
    if not url.startswith("https://script.google.com/"):
        sys.exit("Manzil https://script.google.com/ bilan boshlanishi kerak")
    key = getpass.getpass("Maxfiy kalit (Script properties dagi MAIL_KEY bilan bir xil): ").strip()
    if len(key) < 12:
        sys.exit("Kalit kamida 12 belgi bo'lsin")
    _write_env({"MAIL_SCRIPT_URL": url, "MAIL_SCRIPT_KEY": key})
    settings.mail_script_url, settings.mail_script_key = url, key
    to = input("Sinov xati yuboriladigan email: ").strip()
    print(".env yangilandi. Sinov xati yuborilmoqda...")
    if test_email(to):
        print("Tayyor! Backendni qayta ishga tushiring.")


def main(argv=None):
    Base.metadata.create_all(bind=engine)
    p = argparse.ArgumentParser(prog="python -m app.cli")
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("create-admin")
    a.add_argument("--email", required=True)
    a.add_argument("--password", required=True)
    a.add_argument("--name", default="Administrator")
    sub.add_parser("setup-email")
    sub.add_parser("setup-script")
    t = sub.add_parser("test-email")
    t.add_argument("to")
    f = sub.add_parser("fetch-images")
    f.add_argument("--force", action="store_true")
    sub.add_parser("seed-demo")
    sub.add_parser("remove-demo")
    args = p.parse_args(argv)
    if args.cmd == "create-admin":
        if len(args.password) < 8:
            sys.exit("Parol kamida 8 belgi bo'lsin")
        create_admin(args.email, args.password, args.name)
    elif args.cmd == "setup-email":
        setup_email()
    elif args.cmd == "setup-script":
        setup_script()
    elif args.cmd == "test-email":
        test_email(args.to)
    elif args.cmd == "fetch-images":
        from .images import fetch_site_images, localize_db_images
        print("Sayt rasmlari yuklanmoqda...")
        m = fetch_site_images(force=args.force)
        print(f"✓ {len(m)} ta sayt rasmi tayyor. Bazadagi tashqi rasmlar lokal qilinmoqda...")
        print(f"✓ {localize_db_images()} ta rasm lokal fayllarga ko'chirildi")
    elif args.cmd == "seed-demo":
        seed_demo()
    elif args.cmd == "remove-demo":
        remove_demo()


if __name__ == "__main__":
    main()
