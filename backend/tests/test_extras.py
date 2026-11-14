from datetime import date, timedelta

from app.cli import create_admin
from conftest import register_and_verify


def _setup(client):
    ch = register_and_verify(client, "x-foto@example.com", role="creator", name="X Foto")
    mh = register_and_verify(client, "x-mijoz@example.com", role="client", name="X Mijoz")
    cid = client.put("/api/creator/profile", headers=ch, json={
        "display_name": "X Foto", "category": "photographer", "city": "Toshkent", "price_from": 500000,
        "bio": "Tajribali fotograf, to'y va portret suratlari bilan ishlayman.", "specialties": ["To'y"],
        "experience_years": 3}).json()["id"]
    return ch, mh, cid


def test_languages(client):
    # tilga qarab xato matni o'zgaradi
    r = client.post("/api/auth/login", json={"email": "yoq@example.com", "password": "Xato1234"},
                    headers={"Accept-Language": "ru"})
    assert r.status_code == 401 and "Неверный" in r.json()["detail"]
    r = client.post("/api/auth/login", json={"email": "yoq@example.com", "password": "Xato1234"},
                    headers={"Accept-Language": "en-US,en;q=0.9"})
    assert "Incorrect" in r.json()["detail"]
    r = client.post("/api/auth/register", json={"name": "A", "email": "bad", "password": "x"},
                    headers={"Accept-Language": "en"})
    assert r.status_code == 422 and "at least" in r.json()["detail"]
    assert client.get("/api/categories", headers={"Accept-Language": "en"}).json()[0]["name"] == "Wedding"


def test_favorites_payments_complaints_admin(client):
    ch, mh, cid = _setup(client)
    assert client.post(f"/api/favorites/{cid}", headers=mh).status_code == 200
    assert [c["id"] for c in client.get("/api/favorites", headers=mh).json()] == [cid]
    assert client.get("/api/favorites", headers=ch).status_code == 403
    assert client.delete(f"/api/favorites/{cid}", headers=mh).status_code == 200
    assert client.get("/api/favorites", headers=mh).json() == []

    day = date.today() + timedelta(days=20)
    b = client.post("/api/bookings", headers=mh, json={
        "creator_id": cid, "title": "To'y", "event_date": day.isoformat(), "start_time": "10:00",
        "duration_hours": 3, "location": "Toshkent", "price": 900000}).json()
    # kutilayotgan buyurtmaga to'lov qo'shib bo'lmaydi
    r = client.post("/api/payments", headers=mh, json={"booking_id": b["id"], "amount": 100000})
    assert r.status_code == 400
    assert client.post(f"/api/bookings/{b['id']}/status", headers=ch, json={"status": "accepted"}).status_code == 200
    r = client.post("/api/payments", headers=mh, json={"booking_id": b["id"], "amount": 300000, "method": "cash"})
    assert r.status_code == 200 and r.json()["status"] == "pending"
    pid = r.json()["id"]
    assert client.patch(f"/api/payments/{pid}", headers=mh, json={"status": "paid"}).status_code == 403
    assert client.patch(f"/api/payments/{pid}", headers=ch, json={"status": "paid"}).json()["status"] == "paid"
    assert client.get("/api/payments", headers=mh).json()["total_paid"] == 300000
    assert client.get("/api/creator/earnings", headers=ch).json()["paid"] == 300000

    r = client.post("/api/complaints", headers=mh, json={"booking_id": b["id"], "reason": "quality", "text": "Kech keldi"})
    assert r.status_code == 200
    assert len(client.get("/api/complaints/mine", headers=mh).json()) == 1

    create_admin("adm-x@example.com", "Admin12345", "Admin")
    ah = {"Authorization": "Bearer " + client.post("/api/auth/login", json={
        "email": "adm-x@example.com", "password": "Admin12345"}).json()["access_token"]}
    assert client.get("/api/admin/complaints", headers=mh).status_code == 403
    cl = client.get("/api/admin/complaints", headers=ah).json()
    assert client.patch(f"/api/admin/complaints/{cl[0]['id']}", headers=ah,
                        json={"status": "resolved", "admin_note": "Hal qilindi"}).json()["status"] == "resolved"
    assert client.get("/api/admin/bookings", headers=ah).json()["total"] >= 1
    c = client.post("/api/admin/categories", headers=ah, json={"name_uz": "Yangi yo'nalish", "name_en": "New"}).json()
    assert client.put(f"/api/admin/categories/{c['id']}", headers=ah, json={"name_uz": "Yangi yo'nalish 2"}).status_code == 200
    assert client.delete(f"/api/admin/categories/{c['id']}", headers=ah).status_code == 200
    s = client.put("/api/admin/settings", headers=ah, json={"platform_name": "PhotoMarket", "commission_percent": 5}).json()
    assert s["commission_percent"] == "5"
    assert client.get("/api/settings").json()["platform_name"] == "PhotoMarket"
    assert "series" in client.get("/api/admin/analytics", headers=ah).json()
