from datetime import date, timedelta

from app.cli import create_admin
from conftest import png_bytes, register_and_verify


def test_health(client):
    assert client.get("/api/health").json()["status"] == "ok"


def test_register_verify_login_reset(client, codes):
    email = "ali@example.com"
    r = client.post("/api/auth/register", json={"name": "Ali", "email": email, "password": "short", "role": "client"})
    assert r.status_code == 422 and "Parol" in r.json()["detail"]

    r = client.post("/api/auth/register", json={"name": "Ali", "email": email, "password": "Parol123"})
    assert r.status_code == 200
    # tasdiqlanmagan holatda login -> EMAIL_NOT_VERIFIED
    r = client.post("/api/auth/login", json={"email": email, "password": "Parol123"})
    assert r.status_code == 403 and r.json()["detail"] == "EMAIL_NOT_VERIFIED"
    # noto'g'ri kod
    r = client.post("/api/auth/verify-email", json={"email": email, "code": "000000" if codes[f"{email}:verify_email"] != "000000" else "111111"})
    assert r.status_code == 400 and "noto'g'ri" in r.json()["detail"]
    # qayta yuborish cooldown
    r = client.post("/api/auth/resend-code", json={"email": email})
    assert r.status_code == 429
    r = client.post("/api/auth/verify-email", json={"email": email, "code": codes[f"{email}:verify_email"]})
    assert r.status_code == 200
    token = r.json()["access_token"]
    assert r.json()["user"]["is_verified"] is True
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["email"] == email
    # takroriy ro'yxat
    r = client.post("/api/auth/register", json={"name": "Ali", "email": email, "password": "Parol123"})
    assert r.status_code == 409
    # noto'g'ri parol
    assert client.post("/api/auth/login", json={"email": email, "password": "Xato1234"}).status_code == 401
    # parolni tiklash
    assert client.post("/api/auth/forgot-password", json={"email": email}).status_code == 200
    code = codes[f"{email}:reset_password"]
    r = client.post("/api/auth/reset-password", json={"email": email, "code": code, "new_password": "Yangi1234"})
    assert r.status_code == 200
    # eski token endi yaroqsiz
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": email, "password": "Yangi1234"}).status_code == 200
    # noma'lum email uchun ham bir xil javob (ma'lumot sizdirmaslik)
    assert client.post("/api/auth/forgot-password", json={"email": "yoq@example.com"}).status_code == 200


def test_full_marketplace_flow(client, codes):
    creator_h = register_and_verify(client, "foto@example.com", role="creator", name="Foto Usta")
    client_h = register_and_verify(client, "mijoz@example.com", role="client", name="Mijoz Aka")
    other_client_h = register_and_verify(client, "boshqa@example.com", role="client", name="Boshqa")

    # rol tekshiruvi: mijoz ijodkor kabinetiga kira olmaydi
    assert client.get("/api/creator/profile", headers=client_h).status_code == 403

    r = client.put("/api/creator/profile", headers=creator_h, json={
        "display_name": "Foto Usta", "category": "photographer", "city": "Toshkent", "price_from": 800000,
        "bio": "Professional to'y va portret fotografi, 5 yillik tajriba bilan ishlayman.",
        "specialties": ["To'y", "Portret"], "experience_years": 5})
    assert r.status_code == 200, r.text
    cid = r.json()["id"]
    r = client.post("/api/creator/portfolio", headers=creator_h, data={"title": "To'y"},
                    files={"file": ("a.png", png_bytes(), "image/png")})
    assert r.status_code == 200, r.text
    assert r.json()["image_url"].endswith(".webp")
    assert client.get(r.json()["image_url"]).status_code == 200
    bad = client.post("/api/creator/portfolio", headers=creator_h, files={"file": ("a.txt", b"hello", "text/plain")})
    assert bad.status_code == 400
    svc = client.post("/api/creator/services", headers=creator_h,
                      json={"title": "Portret", "price": 700000, "duration_hours": 2}).json()

    # qidiruv va filtrlar
    lst = client.get("/api/creators", params={"city": "Toshkent", "category": "photographer", "q": "portret"}).json()
    assert lst["total"] == 1 and lst["items"][0]["id"] == cid and lst["items"][0]["price_from"] == 700000
    assert client.get("/api/creators", params={"max_price": 100000}).json()["total"] == 0
    assert client.get("/api/creators", params={"category": "videographer"}).json()["total"] == 0
    meta = client.get("/api/creators/meta").json()
    assert "Toshkent" in meta["cities"]

    # band kun
    blocked_day = date.today() + timedelta(days=10)
    assert client.post("/api/creator/blocked", headers=creator_h, json={"day": blocked_day.isoformat()}).status_code == 200
    assert client.get("/api/creators", params={"available_on": blocked_day.isoformat()}).json()["total"] == 0

    day = date.today() + timedelta(days=14)
    payload = {"creator_id": cid, "service_id": svc["id"], "title": "Oilaviy portret", "event_date": day.isoformat(),
               "start_time": "10:00", "duration_hours": 2, "location": "Toshkent, Yunusobod"}
    # ijodkor buyurtma bera olmaydi
    assert client.post("/api/bookings", headers=creator_h, json=payload).status_code == 403
    # band kunga buyurtma -> 409
    r = client.post("/api/bookings", headers=client_h, json={**payload, "event_date": blocked_day.isoformat()})
    assert r.status_code == 409
    r = client.post("/api/bookings", headers=client_h, json=payload)
    assert r.status_code == 201, r.text
    b = r.json()
    assert b["price"] == 700000 and b["status"] == "pending" and b["client_contact"] is None
    bid = b["id"]

    # boshqa mijoz bu buyurtmani ko'ra olmaydi
    assert client.get(f"/api/bookings/{bid}", headers=other_client_h).status_code == 404
    # ijodkor bildirishnoma oldi
    n = client.get("/api/notifications", headers=creator_h).json()
    assert n["items"][0]["kind"] == "booking_new"
    # mijoz tahrir qiladi
    r = client.put(f"/api/bookings/{bid}", headers=client_h, json={**payload, "details": "4 kishi", "start_time": "11:00"})
    assert r.status_code == 200 and r.json()["details"] == "4 kishi"
    # kesishgan ikkinchi buyurtma (boshqa mijoz)
    r2 = client.post("/api/bookings", headers=other_client_h, json={**payload, "start_time": "12:00"})
    assert r2.status_code == 201
    # mijoz "qabul qilish" qila olmaydi
    assert client.post(f"/api/bookings/{bid}/status", headers=client_h, json={"status": "accepted"}).status_code == 400
    r = client.post(f"/api/bookings/{bid}/status", headers=creator_h, json={"status": "accepted"})
    assert r.status_code == 200 and r.json()["client_contact"]["email"] == "mijoz@example.com"
    # kesishgan vaqtni qabul qilish -> 409
    r = client.post(f"/api/bookings/{r2.json()['id']}/status", headers=creator_h, json={"status": "accepted"})
    assert r.status_code == 409
    # qabul qilingandan keyin tahrir mumkin emas
    assert client.put(f"/api/bookings/{bid}", headers=client_h, json=payload).status_code == 400
    # kelajakdagi buyurtmani "bajarildi" qilib bo'lmaydi
    assert client.post(f"/api/bookings/{bid}/status", headers=creator_h, json={"status": "completed"}).status_code == 400

    # filtr va kalendar
    lst = client.get("/api/bookings", headers=creator_h, params={"status": "accepted"}).json()
    assert lst["total"] == 1 and lst["counts"]["pending"] == 1
    cal = client.get("/api/bookings/calendar", headers=creator_h, params={"month": day.strftime("%Y-%m")}).json()
    assert any(x["id"] == bid for x in cal["bookings"])
    av = client.get(f"/api/creators/{cid}/availability", params={"month": day.strftime("%Y-%m")}).json()
    assert day.isoformat() in av["booked"]

    # xabarlar
    creator_user_id = client.get("/api/auth/me", headers=creator_h).json()["id"]
    client_user_id = client.get("/api/auth/me", headers=client_h).json()["id"]
    assert client.post("/api/messages", headers=client_h, json={"recipient_id": creator_user_id, "body": "Salom!"}).status_code == 201
    assert client.get("/api/messages/unread-count", headers=creator_h).json()["messages"] == 1
    conv = client.get("/api/messages/conversations", headers=creator_h).json()
    assert conv[0]["user"]["id"] == client_user_id and conv[0]["unread"] == 1
    th = client.get(f"/api/messages/with/{client_user_id}", headers=creator_h).json()
    assert th["messages"][0]["body"] == "Salom!" and th["can_send"]
    assert client.get("/api/messages/unread-count", headers=creator_h).json()["messages"] == 0
    assert client.post("/api/messages", headers=creator_h, json={"recipient_id": client_user_id, "body": "Va alaykum"}).status_code == 201
    # mijoz -> mijoz taqiqlangan
    other_id = client.get("/api/auth/me", headers=other_client_h).json()["id"]
    assert client.post("/api/messages", headers=client_h, json={"recipient_id": other_id, "body": "hey"}).status_code == 403

    # admin orqali o'tgan sanaga ko'chirib, bajarildi + sharh
    create_admin("admin@example.com", "Admin1234", "Admin")
    tok = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "Admin1234"}).json()["access_token"]
    admin_h = {"Authorization": f"Bearer {tok}"}
    r = client.post(f"/api/bookings/{bid}/status", headers=admin_h, json={"status": "completed"})
    assert r.status_code == 200, r.text
    r = client.post(f"/api/bookings/{bid}/review", headers=client_h, json={"rating": 5, "comment": "Zo'r!"})
    assert r.status_code == 201
    assert client.post(f"/api/bookings/{bid}/review", headers=client_h, json={"rating": 4}).status_code == 409
    prof = client.get(f"/api/creators/{cid}").json()
    assert prof["rating"] == 5 and prof["reviews_count"] == 1 and prof["rating_breakdown"]["5"] == 1
    rid = r.json()["id"]
    assert client.post(f"/api/reviews/{rid}/reply", headers=creator_h, json={"reply": "Rahmat!"}).status_code == 200

    # statistika
    st = client.get("/api/dashboard/stats", headers=creator_h).json()
    assert st["counts"]["completed"] == 1 and st["money"] == 700000 and len(st["series"]) == 6
    ast = client.get("/api/admin/stats", headers=admin_h).json()
    assert ast["users"]["total"] >= 4 and ast["revenue"] == 700000
    # admin huquqlari
    assert client.get("/api/admin/users", headers=client_h).status_code == 403
    users = client.get("/api/admin/users", headers=admin_h, params={"q": "boshqa"}).json()
    uid = users["items"][0]["id"]
    assert client.patch(f"/api/admin/users/{uid}", headers=admin_h, json={"is_active": False}).status_code == 200
    assert client.get("/api/auth/me", headers=other_client_h).status_code == 401  # token bekor
    assert client.post("/api/auth/login", json={"email": "boshqa@example.com", "password": "Parol123"}).status_code == 403
    assert client.patch(f"/api/admin/creators/{cid}", headers=admin_h, json={"verified": True}).json()["verified"]
    assert client.get("/api/creators", params={"verified": True}).json()["total"] == 1
    # admin sharhni o'chiradi -> reyting qayta hisoblanadi
    assert client.delete(f"/api/admin/reviews/{rid}", headers=admin_h).status_code == 200
    assert client.get(f"/api/creators/{cid}").json()["reviews_count"] == 0

    # mijoz kutilayotgan buyurtmani o'chiradi (CRUD - delete)
    p2 = {**payload, "event_date": (day + timedelta(days=1)).isoformat()}
    nb = client.post("/api/bookings", headers=client_h, json=p2).json()
    assert client.delete(f"/api/bookings/{nb['id']}", headers=client_h).status_code == 200
    assert client.get(f"/api/bookings/{nb['id']}", headers=client_h).status_code == 404


def test_email_failure_is_reported(client, codes):
    from app import services
    original = services.send_code_email
    services.send_code_email = lambda *a, **k: False
    try:
        r = client.post("/api/auth/register", json={"name": "Vali", "email": "vali@example.com", "password": "Parol123"})
        assert r.status_code == 502 and "Emailga kod" in r.json()["detail"]
    finally:
        services.send_code_email = original
    # SMTP tiklangach, qayta ro'yxatdan o'tish ishlaydi
    r = client.post("/api/auth/register", json={"name": "Vali", "email": "vali@example.com", "password": "Parol123"})
    assert r.status_code == 200 and codes["vali@example.com:verify_email"]


def test_public_meta_and_latest_reviews(client):
    meta = client.get("/api/creators/meta").json()
    assert "completed_bookings" in meta and "avg_rating" in meta
    assert isinstance(client.get("/api/reviews/latest").json(), list)
