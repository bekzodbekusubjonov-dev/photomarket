import io
import os
import sys
import tempfile
from pathlib import Path

import pytest

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_tmp, 'test.db').as_posix()}"
os.environ["UPLOAD_DIR"] = str(Path(_tmp, "uploads"))
os.environ["SMTP_HOST"] = ""
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from app import services  # noqa: E402
from app.main import app  # noqa: E402
from app import ratelimit  # noqa: E402

SENT: dict[str, str] = {}


def _capture(to, name, code, purpose, lang="uz"):
    SENT[f"{to}:{purpose}"] = code
    return True


services.send_code_email = _capture
services.send_notice_email = lambda *a, **k: True


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def _no_rate_limit():
    ratelimit._hits.clear()


@pytest.fixture
def codes():
    return SENT


def png_bytes(color=(200, 120, 60)) -> bytes:
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (640, 480), color).save(buf, "PNG")
    return buf.getvalue()


def register_and_verify(client, email, role="client", name="Test User", password="Parol123"):
    r = client.post("/api/auth/register", json={"name": name, "email": email, "password": password, "role": role})
    assert r.status_code == 200, r.text
    code = SENT[f"{email}:verify_email"]
    r = client.post("/api/auth/verify-email", json={"email": email, "code": code})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
