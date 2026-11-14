from datetime import date, timedelta

from app.cli import create_admin
from conftest import png_bytes, register_and_verify


def _luhn(prefix: str, n=16) -> str:
    body = prefix + "0" * (n - len(prefix) - 1)
    for d in range(10):
        num = body + str(d)
        t, alt = 0, False
        for ch in reversed(num):
            x = int(ch)
            if alt:
                x = x * 2 - (9 if x * 2 > 9 else 0)
            t += x
            alt = not alt
        if t % 10 == 0:
            return num


def _admin(client):
    create_admin("adm-f@example.com", "Admin12345", "Admin F")
    r = client.post("/api/auth/login", json={"email": "adm-f@example.com", "password": "Admin12345"})
    return {"Authorization": "Bearer " + r.json()["access_token"]}


def _people(client, tag):
    ch = register_and_verify(client, f"f{tag}-foto@example.com", role="creator", name=f"Foto {tag}")
    mh = register_and_verify(client, f"f{tag}-mijoz@example.com", role="client", name=f"Mijoz Test {tag}")
    cid = client.put("/api/creator/profile", headers=ch, json={
        "display_name": f"Foto {tag}", "category": "videographer", "city": "Samarqand", "price_from": 500000,
        "bio": "Tajribali videograf, to'y va tadbirlar uchun ishlayman.", "specialties": ["To'y"],
        "experience_years": 3, "lat": 39.65, "lng": 66.96, "address": "Registon"}).json()["id"]
    return ch, mh, cid


def _booked(client, ch, mh, cid, days, title="To'y"):
    day = date.today() + timedelta(days=days)
    b = client.post("/api/bookings", headers=mh, json={
        "creator_id": cid, "title": title, "event_date": day.isoformat(), "start_time": "10:00",
        "duration_hours": 3, "location": "Samarqand", "price": 1_000_000, "lat": 39.65, "lng": 66.96}).json()
    assert client.post(f"/api/bookings/{b['id']}/status", headers=ch, json={"status": "accepted"}).status_code == 200
    return b


def _sign(client, codes, h, email, c, ask=True):
    if ask:
        assert client.post(f"/api/contracts/{c['id']}/sign-code", headers=h).status_code == 200
    code = codes[f"{email}:sign_contract:{c['id']}"]
    return client.post(f"/api/contracts/{c['id']}/sign", headers=h, json={
        "code": code, "name": "Test Imzo", "signature": "data:image/png;base64,iVBORw0KGgo="})


def test_contract_sign_payment_receipt(client, codes):
    ch, mh, cid = _people(client, "a")
    ah = _admin(client)
    b = _booked(client, ch, mh, cid, 30)
    c = client.get(f"/api/contracts/by-booking/{b['id']}", headers=mh).json()
    assert c["number"].startswith("PM-") and c["status"] == "awaiting"
    full = client.get(f"/api/contracts/{c['id']}", headers=ch).json()
    assert len(full["terms"]) >= 10 and full["can_sign"] and full["doc_hash"]
    ru = client.get(f"/api/contracts/{c['id']}", headers={**mh, "Accept-Language": "ru"}).json()
    assert "Предмет" in ru["terms"][0]["title"]
    assert full["platform_fee"] + full["creator_amount"] == full["price"] == 1_000_000
    # imzo: noto'g'ri kod rad etiladi
    client.post(f"/api/contracts/{c['id']}/sign-code", headers=mh)
    assert client.post(f"/api/contracts/{c['id']}/sign", headers=mh, json={"code": "000000", "name": "Abc Def"}).status_code == 400
    assert _sign(client, codes, mh, "fa-mijoz@example.com", c, ask=False).status_code == 200
    assert client.post(f"/api/contracts/{c['id']}/sign-code", headers=mh).status_code in (200, 409, 429)
    assert _sign(client, codes, mh, "fa-mijoz@example.com", c, ask=False).status_code == 409  # ikkinchi marta emas
    r = _sign(client, codes, ch, "fa-foto@example.com", c)
    assert r.status_code == 200 and r.json()["status"] == "signed"
    v = client.get(f"/api/contracts/verify/{c['number']}", params={"h": r.json()["doc_hash"]}).json()
    assert v["valid"] and v["hash_match"] and v["client"].startswith("Mijoz")
    assert client.get("/api/contracts/verify/PM-0000-000000").json()["valid"] is False
    assert any(x["id"] == c["id"] for x in client.get("/api/contracts", headers=ah).json()["items"])
    # begona foydalanuvchi ko'ra olmaydi
    other = register_and_verify(client, "fa-other@example.com", role="client")
    assert client.get(f"/api/contracts/{c['id']}", headers=other).status_code == 404

    # karta va to'lov
    num = _luhn("8600")
    r = client.post("/api/cards", headers=mh, json={"number": num, "holder": "mijoz test", "exp": "12/39"})
    assert r.status_code == 201 and r.json()["masked"] == f"{num[:4]} **** **** {num[-4:]}" and "number" not in r.json()
    assert r.json()["brand"] == "uzcard" and r.json()["is_default"]
    assert client.post("/api/cards", headers=mh, json={"number": num, "holder": "mijoz test", "exp": "12/39"}).status_code == 409
    assert client.post("/api/cards", headers=mh, json={"number": "1234567812345678", "holder": "mijoz", "exp": "12/39"}).status_code == 400
    assert client.post("/api/cards", headers=mh, json={"number": _luhn("4"), "holder": "mijoz", "exp": "01/20"}).status_code == 400
    card_id = client.get("/api/cards", headers=mh).json()[0]["id"]
    assert client.get("/api/cards", headers=ah).status_code == 403

    r = client.post("/api/payments", headers=mh, json={"booking_id": b["id"], "amount": 400000, "method": "card"})
    assert r.status_code == 400  # chek (isbot) kerak
    proof = client.post("/api/payments/proof", headers=mh, files={"file": ("c.png", png_bytes(), "image/png")}).json()["url"]
    r = client.post("/api/payments", headers=mh, json={"booking_id": b["id"], "amount": 400000, "method": "card",
                                                       "proof_url": proof, "card_id": card_id})
    assert r.status_code == 200 and r.json()["status"] == "pending"
    pid = r.json()["id"]
    assert client.patch(f"/api/payments/{pid}", headers=ch, json={"status": "paid"}).status_code == 403
    assert client.patch(f"/api/admin/payments/{pid}", headers=mh, json={"status": "paid"}).status_code == 403
    r = client.patch(f"/api/admin/payments/{pid}", headers=ah, json={"status": "paid"}).json()
    assert r["status"] == "paid" and r["receipt_no"].startswith("CHK-") and r["payout_status"] == "pending"
    assert r["fee"] + r["creator_amount"] == 400000 and r["card"] == f"{num[:4]} **** **** {num[-4:]}"
    rc = client.get(f"/api/payments/{pid}/receipt", headers=mh).json()
    assert rc["approved"] and rc["contract_no"] == c["number"] and rc["amount"] == 400000
    assert client.get(f"/api/payments/{pid}/receipt", headers=ch).status_code == 200
    assert client.get(f"/api/payments/{pid}/receipt", headers=other).status_code == 404
    notes = client.get("/api/notifications", headers=mh).json()
    assert any(n["kind"] == "payment_receipt" for n in (notes["items"] if isinstance(notes, dict) else notes))
    assert client.post(f"/api/admin/payments/{pid}/payout", headers=ah).json()["payout_status"] == "sent"
    assert client.post(f"/api/admin/payments/{pid}/payout", headers=ah).status_code == 409
    assert client.get("/api/payments/instructions", headers=mh).status_code == 200


def test_cancellation_fee(client, codes):
    ch, mh, cid = _people(client, "b")
    near = _booked(client, ch, mh, cid, 2, "Yaqin")
    c = client.get(f"/api/contracts/by-booking/{near['id']}", headers=mh).json()
    _sign(client, codes, mh, "fb-mijoz@example.com", c)
    _sign(client, codes, ch, "fb-foto@example.com", c)
    client.post(f"/api/bookings/{near['id']}/status", headers=mh, json={"status": "cancelled"})
    c2 = client.get(f"/api/contracts/{c['id']}", headers=mh).json()
    assert c2["status"] == "cancelled" and c2["cancel_fee"] == 300000
    assert c2["cancel_to_platform"] + c2["cancel_to_creator"] == 300000 and c2["cancel_to_platform"] == 120000
    far = _booked(client, ch, mh, cid, 60, "Uzoq")
    c = client.get(f"/api/contracts/by-booking/{far['id']}", headers=mh).json()
    _sign(client, codes, mh, "fb-mijoz@example.com", c)
    _sign(client, codes, ch, "fb-foto@example.com", c)
    client.post(f"/api/bookings/{far['id']}/status", headers=mh, json={"status": "cancelled"})
    assert client.get(f"/api/contracts/{c['id']}", headers=mh).json()["cancel_fee"] == 0
    # imzosiz shartnoma bekor qilinsa "void"
    v = _booked(client, ch, mh, cid, 70, "Imzosiz")
    c = client.get(f"/api/contracts/by-booking/{v['id']}", headers=mh).json()
    client.post(f"/api/bookings/{v['id']}/status", headers=ch, json={"status": "cancelled"})
    assert client.get(f"/api/contracts/{c['id']}", headers=mh).json()["status"] == "void"


def test_ads_reports_impersonation_nearest(client):
    ch, mh, cid = _people(client, "c")
    ah = _admin(client)
    ad = client.post("/api/admin/ads", headers=ah, json={"title": "Aksiya", "text": "-20%", "placement": "home",
                                                          "link_url": "https://example.com"}).json()
    assert client.post("/api/admin/ads", headers=mh, json={"title": "X"}).status_code == 403
    assert client.post("/api/admin/ads", headers=ah, json={"title": "Bad", "link_url": "javascript:alert(1)"}).status_code == 422
    pub = client.get("/api/ads", params={"placement": "home"}).json()
    assert any(a["id"] == ad["id"] for a in pub)
    assert client.post(f"/api/ads/{ad['id']}/click").status_code == 200
    adm = [a for a in client.get("/api/admin/ads", headers=ah).json() if a["id"] == ad["id"]][0]
    assert adm["clicks"] == 1 and adm["views"] >= 1
    assert client.put(f"/api/admin/ads/{ad['id']}", headers=ah, json={"title": "Aksiya", "active": False}).status_code == 200
    assert not any(a["id"] == ad["id"] for a in client.get("/api/ads", params={"placement": "home"}).json())
    up = client.post("/api/admin/upload?folder=ads", headers=ah, files={"file": ("a.png", png_bytes(), "image/png")})
    assert up.status_code == 200 and up.json()["url"]

    for kind in ("users", "creators", "bookings", "payments", "contracts", "revenue", "reviews", "complaints"):
        r = client.get(f"/api/admin/reports/{kind}", headers=ah)
        assert r.status_code == 200 and r.json()["columns"] is not None, kind
    ru = client.get("/api/admin/reports/users", headers=ah, params={"role": "creator"}).json()
    assert ru["rows"] and all(x["role"] == "Ijodkor" for x in ru["rows"])
    rc = client.get("/api/admin/reports/creators", headers=ah, params={"specialty": "To'y"}).json()
    assert rc["rows"]
    assert client.get("/api/admin/reports/nope", headers=ah).status_code == 404
    assert client.get("/api/admin/reports/users", headers=mh).status_code == 403
    ex = client.get("/api/admin/overview-extra", headers=ah).json()
    assert {"contracts", "payments", "ads"} <= set(ex)

    # kuzatuv rejimi: faqat o'qish
    uid = client.get("/api/auth/me", headers=mh).json()["id"]
    assert client.post(f"/api/admin/impersonate/{uid}", headers=mh).status_code == 403
    tok = client.post(f"/api/admin/impersonate/{uid}", headers=ah).json()["access_token"]
    ro = {"Authorization": "Bearer " + tok}
    assert client.get("/api/auth/me", headers=ro).json()["id"] == uid
    assert client.get("/api/bookings", headers=ro).status_code == 200
    assert client.post("/api/favorites/1", headers=ro).status_code == 403
    assert client.post("/api/notifications/read-all", headers=ro).status_code == 403
    adm_id = client.get("/api/auth/me", headers=ah).json()["id"]
    assert client.post(f"/api/admin/impersonate/{adm_id}", headers=ah).status_code == 400
    avatar = client.put(f"/api/admin/users/{uid}/avatar", headers=ah, files={"file": ("a.png", png_bytes(), "image/png")})
    assert avatar.status_code == 200 and avatar.json()["avatar_url"]

    # eng yaqin ijodkor
    r = client.get("/api/creators", params={"sort": "nearest", "lat": 39.6, "lng": 66.9}).json()
    assert r["items"][0]["distance_km"] is not None and r["items"][0]["city"] == "Samarqand"
