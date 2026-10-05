import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import get_db
from app.models import LoginAttempt

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_login_attempts():
    """Xóa sạch bảng login_attempts trước mỗi test để đảm bảo môi trường cô lập."""
    db = next(get_db())
    try:
        db.query(LoginAttempt).delete()
        db.commit()
    finally:
        db.close()


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_register_mismatch_password():
    response = client.post("/api/auth/register", json={
        "full_name": "Demo User",
        "email": "demo_mismatch@example.com",
        "password": "Password123!",
        "confirm_password": "Password456!",
    })
    assert response.status_code == 400


def test_google_login_dev_mode():
    response = client.post("/api/auth/google", json={
        "id_token": "mock-google-token-test12345"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "google_user_test1@gmail.com"


def test_sliding_window_rate_limit_and_recaptcha():
    test_email = "ratelimit_user@example.com"
    
    # 1. First 3 failed attempts
    for _ in range(3):
        res = client.post("/api/auth/login", json={
            "email": test_email,
            "password": "wrong_password"
        })
        assert res.status_code == 401

    # 4th attempt triggers Soft Limit (428 Precondition Required / recaptcha_required)
    res4 = client.post("/api/auth/login", json={
        "email": test_email,
        "password": "wrong_password"
    })
    assert res4.status_code == 428
    assert res4.json()["detail"]["captcha_required"] is True

    # Attempt with mock captcha token allows verification proceed to password check
    res5 = client.post("/api/auth/login", json={
        "email": test_email,
        "password": "wrong_password",
        "captcha_token": "mock-captcha-pass"
    })
    assert res5.status_code == 401  # Back to 401 password error instead of 428 captcha error


def test_weekly_baseline_snapshot():
    response = client.post("/api/admin/rate-limit/trigger-weekly-log")
    assert response.status_code == 200
    baseline_data = response.json()
    assert "avg_requests_per_minute" in baseline_data
    assert "week_number" in baseline_data

    list_res = client.get("/api/admin/rate-limit/baselines")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1
