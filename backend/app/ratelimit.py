"""Oddiy xotiradagi (in-memory) rate limiter. Bitta server jarayoni uchun yetarli."""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request

_hits: dict[str, deque] = defaultdict(deque)
_lock = Lock()


def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def limit(key: str, max_hits: int, window_seconds: int):
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > window_seconds:
            q.popleft()
        if len(q) >= max_hits:
            wait = int(window_seconds - (now - q[0])) + 1
            raise HTTPException(429, f"Juda ko'p urinish. {wait} soniyadan keyin qayta urinib ko'ring")
        q.append(now)


def rate_limit(action: str, max_hits: int, window_seconds: int):
    def dep(request: Request):
        limit(f"{action}:{client_ip(request)}", max_hits, window_seconds)
    return dep
