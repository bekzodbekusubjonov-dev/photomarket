# PhotoMarket — fotograf/videograf xizmatlarini onlayn buyurtma qilish platformasi

Mijozlar fotograf va videograflarni topadi, portfolio va narxlarni solishtiradi, bo'sh sanani ko'rib onlayn buyurtma beradi.
Ijodkorlar profil, portfolio, xizmat paketlari, bandlik kalendari va statistikani bitta kabinetda boshqaradi.

**Stek:** FastAPI + SQLAlchemy 2 (SQLite → PostgreSQL/Supabase) · React 18 + TypeScript + Vite · JWT · email (Google Script/SMTP).

**Tillar:** O'zbekcha · Русский · English — sayt, xato xabarlari, bildirishnomalar va email xatlar foydalanuvchi tilida (tanlov `localStorage` va profilda saqlanadi).

**To'rt interfeys:** mehmon, mijoz, ijodkor, administrator — har biri alohida menyu va sahifalar bilan; telefonda kirgan foydalanuvchi uchun pastki navigatsiya paneli.

## Imkoniyatlar (topshiriq talablari bo'yicha)

| Talab | Qanday bajarilgan |
|---|---|
| Ro'yxatdan o'tish va kirish (2+ rol) | Mijoz / Ijodkor / Administrator. Emailga **6 xonali kod** yuboriladi (10 daqiqa amal qiladi, 5 urinish, 60 soniya qayta yuborish chegarasi). Parolni email kod orqali tiklash. |
| Buyurtma CRUD | Yaratish, ko'rish, tahrirlash (javob kutilayotganda), o'chirish, holat o'zgartirish: kutilmoqda → qabul → bajarildi / rad / bekor |
| Qidiruv va filtr | Matn, yo'nalish, shahar, narx oralig'i, reyting, mutaxassislik, **bo'sh sana**, tasdiqlangan; 6 xil saralash; sahifalash |
| Rolga asoslangan avtorizatsiya | Har bir API serverda rolni tekshiradi; foydalanuvchi faqat o'z ma'lumotini ko'radi; parol o'zgarsa yoki bloklansa eski tokenlar bekor bo'ladi |
| Responsive interfeys | Telefon, planshet, kompyuter |
| Alohida kabinetlar | Mijoz va ijodkor uchun alohida dashboard (statistika, grafiklar, yaqin buyurtmalar) |
| Ro'yxat va tafsilot | Buyurtmalar jadvali (filtr/holat tablari) va to'liq tafsilot sahifasi |
| Portfolio va kalendar | Rasm yuklash (avtomatik siqish, WEBP), galereya + lightbox; bandlik kalendari, dam olish kunlarini band qilish, vaqt kesishuvini tekshirish |
| Xabar / bildirishnoma | Ichki chat (o'qildi belgisi), bildirishnomalar markazi, muhim hodisalarda **email xabar** |
| Sharh / reyting / statistika | 1–5 yulduz, izoh, ijodkor javobi, reyting taqsimoti; daromad va buyurtmalar grafiklari |
| Admin panel | Statistika, foydalanuvchilar (bloklash/rol), ijodkorlarni tasdiqlash, sharhlar moderatsiyasi, barcha buyurtmalar, **kategoriyalar (3 tilda)**, **to'lovlar**, **shikoyatlar**, **platforma sozlamalari**, **tahlil** |
| Mijoz kabineti | Buyurtmalar, **sevimlilar**, **to'lovlar tarixi**, mening sharhlarim, shikoyat yozish, xabarlar, kalendar |
| Ijodkor kabineti | Profil, portfolio, xizmatlar, bandlik kalendari, **daromad**, to'lovlarni tasdiqlash, sharhlarga javob |

## Ishga tushirish (Windows, VS Code)

Talab: **Python 3.10+** va **Node.js 20+**.

### 1. Backend
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env      # agar .env bo'lmasa
python -m app.cli create-admin --email sizning@gmail.com --password Admin12345
python -m app.cli seed-demo      # ixtiyoriy: 8 ta namunaviy ijodkor (parol: Demo12345)
python -m app.cli fetch-images   # ixtiyoriy: rasmlarni lokal yuklab olish
uvicorn app.main:app --reload --port 8000
```
API hujjatlari: http://localhost:8000/docs

### 2. Frontend (ikkinchi terminal)
```powershell
cd frontend
npm install
npm run dev
```
Sayt: http://localhost:5173 (Vite `/api` va `/uploads` so'rovlarini avtomatik 8000-portga yo'naltiradi).

Yoki ildiz papkadagi `start-backend.bat` va `start-frontend.bat` fayllarini ikki marta bosing.

## Email kodlar: Google Script orqali (tavsiya)

Render bepul rejasida SMTP yopiq bo'lgani uchun xat Google Apps Script orqali yuboriladi (kuniga ~100 ta xat):

1. https://script.google.com → **Yangi loyiha**. `google-script/Code.gs` mazmunini qo'ying.
2. **Project Settings → Script properties → Add**: `MAIL_KEY` = o'zingiz o'ylab topgan uzun maxfiy kalit (16+ belgi).
3. Yuqoridagi `authorize` funksiyasini tanlab **Run** bosing va Gmail ruxsatini bering.
4. **Deploy → New deployment → Web app**: Execute as **Me**, Who has access **Anyone** → manzilni nusxalang.
5. `backend` papkasida: `python -m app.cli setup-script` (manzil, kalit va sinov emailini so'raydi).
   Tekshirish: http://localhost:8000/api/health → `"email":"script"`.

## Email kodlar: Gmail SMTP (ixtiyoriy, faqat lokal)

SMTP sozlanmaguncha kod faqat **backend terminaliga** chiqadi (`[DEV EMAIL] ... KOD: 123456`).
Haqiqiy pochtaga yuborish — 3 qadam:

1. Google hisobingizda **2 bosqichli tekshiruv**ni yoqing: https://myaccount.google.com/security
2. **App password** yarating: https://myaccount.google.com/apppasswords → nom bering (masalan *PhotoMarket*) →
   16 harfli parol chiqadi (`abcd efgh ijkl mnop`). Bu oddiy Gmail parolingiz emas!
3. `backend` papkasida (venv yoqilgan holda):
   ```powershell
   python -m app.cli setup-email
   ```
   Gmail manzilingiz va App password'ni so'raydi, `.env` ga yozadi va o'zingizga **sinov xati** yuboradi.
   Keyin backendni qayta ishga tushiring. Tekshirish: http://localhost:8000/api/health → `"email":"smtp"`.

Keyinchalik tekshirish: `python -m app.cli test-email siz@gmail.com`.
Agar xat kelmasa: «Spam» papkasini ko'ring; terminalda `SMTP login rad etildi` bo'lsa — App password noto'g'ri.
Kod yuborilmasa sayt foydalanuvchiga darhol xabar beradi («Emailga kod yuborib bo'lmadi»).
Gmail kuniga ~500 xat chegarasiga ega; ko'proq kerak bo'lsa Brevo/Mailgun SMTP ma'lumotlarini shu tarzda kiriting.

## Rasmlar

Bosh sahifa, kategoriyalar, kirish sahifasi va demo ijodkorlar uchun [Pexels](https://www.pexels.com/license/)
dagi bepul suratlar ishlatilgan (manzillar: `backend/app/images.py`). Sukut bo'yicha ular brauzerda Pexels
CDN'dan ochiladi. Sayt tashqi saytga bog'liq bo'lmasligi uchun bir marta yuklab oling:
```powershell
python -m app.cli fetch-images
```
O'z rasmlaringizni qo'yish: `images.py` dagi `SITE_SLOTS` ID larini o'zgartiring yoki
`backend/uploads/site/<slot>.webp` faylini almashtiring.

## Demo ma'lumotlar

`python -m app.cli seed-demo` — 8 ta namunaviy ijodkor (har birining rasmlari takrorlanmaydi; ro'yxat: `docs/IMAGES.md`) (taqdimot va sinov uchun, parol `Demo12345`).
Saytni haqiqiy foydalanuvchilarga ochishdan oldin albatta o'chiring: `python -m app.cli remove-demo`.

## Testlar
```powershell
cd backend
pip install -r requirements-dev.txt
pytest -q
```
Testlar to'liq oqimni tekshiradi: ro'yxat → noto'g'ri/to'g'ri kod → kirish → parol tiklash, rollar, filtrlar,
band kunlar, vaqt kesishuvi, chat ruxsatlari, sharh va reyting, admin bloklash.

## Internetga joylash (production): GitHub → Supabase → Render → Google Script

Repozitoriy: https://github.com/bekzodbekusubjonov-dev/photomarket.git

1. **GitHub** — loyiha papkasida: `git init`, `git add .`, `git commit -m "PhotoMarket"`, `git branch -M main`,
   `git remote add origin <repozitoriy>`, `git push -u origin main`.
2. **Supabase** — yangi loyiha (Postgres + Storage). Storage'da **public** `uploads` bucket yarating.
   `DATABASE_URL` uchun *Session pooler* manzilini oling; `SUPABASE_URL` va `SUPABASE_SERVICE_KEY` ni Render'ga kiriting.
3. **Render** — *New → Blueprint* → shu repozitoriy (Blueprint Path bo'sh qoladi, `render.yaml` o'zi topiladi).
   Muhit o'zgaruvchilari: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `MAIL_SCRIPT_URL`, `MAIL_SCRIPT_KEY`,
   `FRONTEND_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (`JWT_SECRET` ni Render o'zi yaratadi). Sog'liq tekshiruvi: `/api/health`.
4. **Google Apps Script** — `google-script/Code.gs` ni yuklab web-ilova qiling (yuqoridagi «Email kodlar» bo'limi).
Maxfiy kalitlar faqat Render sozlamalari yoki lokal `.env` da turadi — GitHub'ga yuklanmaydi.

Lokal production tekshiruvi:
```bash
cd frontend && npm install && npm run build      # frontend/dist
cd ../backend && pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Loyiha tuzilmasi
```
backend/app/
  main.py          ilova, xatoliklar, statik fayllar, SPA
  models.py        jadvallar: users, email_codes, creator_profiles, portfolio_items, services,
                   blocked_dates, bookings, reviews, messages, notifications
  schemas.py       kiruvchi ma'lumot validatsiyasi
  security.py      parol xeshi (PBKDF2), JWT, email kodlar
  emailer.py       SMTP va HTML xat shablonlari
  services.py      bandlik tekshiruvi, bildirishnoma, reyting
  routers/         auth, creators, bookings, messages, notifications, dashboard, admin
  cli.py           create-admin, seed-demo
backend/tests/     avtomatik testlar
frontend/src/
  pages/           Home, Creators, CreatorProfile, auth/*, dashboard/*, creator/*, admin/*
  components/      Layout, ui, BookingForm, MonthCalendar, BarChart, Lightbox
```

## Daromad modeli g'oyalari
- Ijodkorlar uchun "Tavsiya" (featured) joylashuvi — oylik obuna
- Har bir bajarilgan buyurtmadan komissiya (Payme/Click integratsiyasi keyingi bosqich)
- "Tasdiqlangan" belgisi uchun tekshiruv xizmati
