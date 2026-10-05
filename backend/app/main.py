from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
import jwt

from .database import Base, engine, get_db, init_db
from .models import User, WeeklyBaseline
from .schemas import (
    AuthResponse,
    GoogleLoginRequest,
    LoginRequest,
    RateLimitStatusResponse,
    RegisterRequest,
    UserResponse,
    WeeklyBaselineResponse,
)
from .security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_google_id_token,
    verify_password,
    verify_recaptcha_token,
)
from .rate_limiter import (
    check_login_rate_limit,
    calculate_effective_thresholds,
    generate_weekly_baseline,
    record_login_attempt,
)

init_db()

app = FastAPI(title="React + Python Auth Demo with Dynamic Rate Limiting")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Bạn chưa đăng nhập")
    try:
        user_id = decode_access_token(credentials.credentials)
    except (jwt.PyJWTError, ValueError, KeyError):
        raise HTTPException(status_code=401, detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn")
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=401, detail="Tài khoản không còn hiệu lực")
    return user


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/auth/rate-limit-status", response_model=RateLimitStatusResponse)
def get_rate_limit_status(request: Request, email: str | None = None, db: Session = Depends(get_db)):
    """Lấy trạng thái Sliding Window & đối chiếu baseline tuần cho IP hiện tại."""
    client_ip = get_client_ip(request)
    res = calculate_effective_thresholds(db, client_ip, email)
    return {
        "ip_address": client_ip,
        "soft_limit": res["soft_limit"],
        "hard_limit": res["hard_limit"],
        "captcha_required": res["captcha_required"],
        "baseline_multiplier": res["baseline_multiplier"],
        "estimated_baseline_rpm": res.get("estimated_baseline_rpm", 0.0),
        "has_baseline": res["has_baseline"],
        "stats": res["stats"],
    }



@app.post("/api/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Mật khẩu nhập lại không khớp")
    if payload.password.lower() == payload.email.split("@")[0].lower():
        raise HTTPException(status_code=400, detail="Mật khẩu không nên trùng với tên email")
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email đã được đăng ký")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return AuthResponse(access_token=create_access_token(user.id), user=user)


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    client_ip = get_client_ip(request)

    # 1. Kiểm tra xác minh reCAPTCHA nếu client có gửi token
    captcha_valid = False
    if payload.captcha_token:
        captcha_valid = await verify_recaptcha_token(payload.captcha_token, client_ip)

    # 2. Kiểm tra Rate Limit theo Sliding Window + Baseline
    check_login_rate_limit(db, client_ip, payload.email, captcha_verified=captcha_valid)

    # 3. Tìm user và xác minh password
    user = db.query(User).filter(User.email == payload.email).first()

    if not user or not user.password_hash or not verify_password(payload.password, user.password_hash):
        record_login_attempt(db, client_ip, payload.email, "password", "failed")
        raise HTTPException(status_code=401, detail="Email hoặc mật khẩu không đúng")

    if not user.is_active:
        record_login_attempt(db, client_ip, payload.email, "password", "blocked")
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")

    record_login_attempt(db, client_ip, payload.email, "password", "success")
    return AuthResponse(access_token=create_access_token(user.id), user=user)


@app.post("/api/auth/google", response_model=AuthResponse)
async def google_login(request: Request, payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Đăng nhập qua Google OAuth có áp dụng Rate Limit & reCAPTCHA."""
    client_ip = get_client_ip(request)

    captcha_valid = False
    if payload.captcha_token:
        captcha_valid = await verify_recaptcha_token(payload.captcha_token, client_ip)

    # Rate limiting cho Google Login
    check_login_rate_limit(db, client_ip, None, captcha_verified=captcha_valid)

    # Xác minh Google ID Token
    google_data = await verify_google_id_token(payload.id_token)
    if not google_data:
        record_login_attempt(db, client_ip, None, "google", "failed")
        raise HTTPException(status_code=401, detail="Google Token không hợp lệ hoặc đã hết hạn")

    email = google_data["email"].lower()
    google_id = google_data["google_id"]
    full_name = google_data["name"]
    avatar_url = google_data.get("avatar_url")

    user = db.query(User).filter((User.google_id == google_id) | (User.email == email)).first()

    if user:
        if not user.google_id:
            user.google_id = google_id
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        db.commit()
        db.refresh(user)
    else:
        user = User(
            full_name=full_name,
            email=email,
            password_hash="oauth_google_account",
            google_id=google_id,
            avatar_url=avatar_url,
        )
        db.add(user)
        db.commit()
        db.refresh(user)


    if not user.is_active:
        record_login_attempt(db, client_ip, email, "google", "blocked")
        raise HTTPException(status_code=403, detail="Tài khoản đã bị khóa")

    record_login_attempt(db, client_ip, email, "google", "success")
    return AuthResponse(access_token=create_access_token(user.id), user=user)


@app.get("/api/auth/me", response_model=UserResponse)
def me(user: User = Depends(current_user)):
    return user


@app.post("/api/auth/logout")
def logout():
    return {"message": "Đăng xuất thành công"}


# --- API Quản lý Baseline Tuần & Rate Limit Logs ---

@app.get("/api/admin/rate-limit/baselines", response_model=list[WeeklyBaselineResponse])
def get_weekly_baselines(db: Session = Depends(get_db)):
    """Lấy danh sách các bản ghi đối chiếu hàng tuần (Weekly Baselines)."""
    return db.query(WeeklyBaseline).order_by(WeeklyBaseline.id.desc()).all()


@app.post("/api/admin/rate-limit/trigger-weekly-log", response_model=WeeklyBaselineResponse)
def trigger_weekly_log(db: Session = Depends(get_db)):
    """Tạo nhanh 1 bản ghi đối chiếu log tuần (Weekly Baseline Snapshot) thủ công."""
    return generate_weekly_baseline(db)
