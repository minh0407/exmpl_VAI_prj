import base64
import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt

SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "dev-only-change-me")
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 60
ITERATIONS = 310_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iterations, salt_b64, digest_b64 = stored.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iterations))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> int:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return int(payload["sub"])


GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
RECAPTCHA_SECRET_KEY = os.getenv("RECAPTCHA_SECRET_KEY", "")


async def verify_recaptcha_token(token: str | None, client_ip: str | None = None) -> bool:
    """
    Xác minh Google reCAPTCHA Token.
    Nếu ở môi trường Dev (RECAPTCHA_SECRET_KEY chưa đặt hoặc token là mock-captcha-pass), tự động duyệt thành công.
    """
    if not token:
        return False

    # Dev/Test Mode Bypass
    if not RECAPTCHA_SECRET_KEY or token.startswith("mock-captcha-") or token == "dev-passed":
        return True

    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                "https://www.google.com/recaptcha/api/siteverify",
                data={
                    "secret": RECAPTCHA_SECRET_KEY,
                    "response": token,
                    "remoteip": client_ip,
                },
            )
            data = resp.json()
            return bool(data.get("success", False))
    except Exception:
        # Nếu không kết nối được Google reCAPTCHA server và ở môi trường test/dev:
        if not RECAPTCHA_SECRET_KEY:
            return True
        return False


async def verify_google_id_token(id_token: str) -> dict | None:
    """
    Xác minh Google OAuth ID Token.
    Hỗ trợ chế độ Dev Test khi token bắt đầu bằng mock-google-token- hoặc chưa cài GOOGLE_CLIENT_ID.
    """
    if not id_token:
        return None

    # Dev / Test Mode
    if id_token.startswith("mock-google-token") or not GOOGLE_CLIENT_ID:
        clean_token = id_token.replace("mock-google-token-", "").replace("mock-google-token", "")
        mock_id = clean_token if clean_token else "10987654321"
        return {
            "google_id": f"google_{mock_id}",
            "email": f"google_user_{mock_id[:5]}@gmail.com",
            "name": f"Google Dev User {mock_id[:5]}",
            "avatar_url": "https://lh3.googleusercontent.com/a/default-user=s96-c",
        }


    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            # Kiểm tra audience nếu GOOGLE_CLIENT_ID được cấu hình
            if GOOGLE_CLIENT_ID and data.get("aud") != GOOGLE_CLIENT_ID:
                return None

            return {
                "google_id": data.get("sub"),
                "email": data.get("email"),
                "name": data.get("name") or data.get("email", "").split("@")[0],
                "avatar_url": data.get("picture"),
            }
    except Exception:
        return None

