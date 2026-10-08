from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
import jwt

from .database import Base, engine, get_db, init_db
from .models import User, WeeklyBaseline, Employee
from .schemas import (
    AuthResponse,
    GoogleLoginRequest,
    LoginRequest,
    RateLimitStatusResponse,
    RegisterRequest,
    UserResponse,
    WeeklyBaselineResponse,
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    PaginatedEmployeeResponse,
    BatchImportRequest,
    BatchImportResponse,
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

app = FastAPI(title="React + Python Auth Demo with Dynamic Rate Limiting & PostgreSQL Employee Management")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)


# --- INITIAL DATA SEEDING FOR POSTGRESQL / DATABASE ---
INITIAL_EMPLOYEES = [
    { "full_name": 'Super Admin', "staff_code": '999999', "email": 'super_admin@viettelai.vn', "phone": '', "address": 'Hà Nội', "job_title": 'Super Admin', "department": 'CNM-VAI', "role": 'Admin' },
    { "full_name": 'Trần Huy Hoàng', "staff_code": '431452', "email": 'hoangth33@viettel.com.vn', "phone": '868695383', "address": 'Hà Nội', "job_title": 'Kỹ sư trí tuệ nhân tạo', "department": 'CNM-VAI', "role": 'Admin' },
    { "full_name": 'Nguyễn Khắc Minh', "staff_code": '431451', "email": 'minhnk2@viettel.com.vn', "phone": '', "address": 'Hà Nội', "job_title": 'AI Eng', "department": 'CNM - VAI', "role": 'User' },
    { "full_name": 'AI Service', "staff_code": '888888', "email": 'ai_service@viettelai.vn', "phone": '', "address": 'Hà Nội', "job_title": 'AI Service', "department": 'CNM-VAI', "role": 'User' },
    { "full_name": 'Nguyễn Đức Huy', "staff_code": '467055', "email": 'huynd277@viettel.com.vn', "phone": '', "address": 'Hà Nội', "job_title": 'Kỹ sư', "department": 'VTNet', "role": 'Editor' },
    { "full_name": 'Đinh Quang Lâm', "staff_code": '434831', "email": 'lamdq3@viettel.com.vn', "phone": '', "address": 'Hà Nội', "job_title": 'Kỹ sư', "department": 'VTNet', "role": 'Admin' },
    { "full_name": 'Kiều Nhật Long', "staff_code": '472777', "email": 'longkn@viettel.com.vn', "phone": '', "address": 'Hà Nội', "job_title": 'BA', "department": 'VAI', "role": 'User' },
    { "full_name": 'TT KTKV2', "staff_code": '222222', "email": 'ktkv2@viettel.com.vn', "phone": '', "address": 'Hà Nội', "job_title": 'Kỹ sư', "department": 'VTNet', "role": 'Admin' },
    { "full_name": 'TT KTKV1', "staff_code": '111111', "email": 'ktkv1@viettel.com.vn', "phone": '', "address": 'Hà Nội', "job_title": 'Kỹ sư', "department": 'VTNet', "role": 'Admin' },
    { "full_name": 'TT KTKV3', "staff_code": '333333', "email": 'ktkv3@viettel.com.vn', "phone": '', "address": 'Hà Nội', "job_title": 'Kỹ sư', "department": 'VTNet', "role": 'Admin' },
]

def seed_initial_employees():
    db = next(get_db())
    try:
        count = db.query(Employee).count()
        if count == 0:
            for item in INITIAL_EMPLOYEES:
                emp = Employee(**item)
                db.add(emp)
            db.commit()
    except Exception as e:
        print(f"Seed employees info: {e}")
        db.rollback()

seed_initial_employees()


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

    captcha_valid = False
    if payload.captcha_token:
        captcha_valid = await verify_recaptcha_token(payload.captcha_token, client_ip)

    check_login_rate_limit(db, client_ip, payload.email, captcha_verified=captcha_valid)

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
    client_ip = get_client_ip(request)

    captcha_valid = False
    if payload.captcha_token:
        captcha_valid = await verify_recaptcha_token(payload.captcha_token, client_ip)

    check_login_rate_limit(db, client_ip, None, captcha_verified=captcha_valid)

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


# --- API QUẢN LÝ BASELINE TUẦN & LOGS ---

@app.get("/api/admin/rate-limit/baselines", response_model=list[WeeklyBaselineResponse])
def get_weekly_baselines(db: Session = Depends(get_db)):
    return db.query(WeeklyBaseline).order_by(WeeklyBaseline.id.desc()).all()


@app.post("/api/admin/rate-limit/trigger-weekly-log", response_model=WeeklyBaselineResponse)
def trigger_weekly_log(db: Session = Depends(get_db)):
    return generate_weekly_baseline(db)


# --- FASTAPI + POSTGRESQL EMPLOYEE CRUD & BATCH IMPORT ENDPOINTS ---

@app.get("/api/employees", response_model=PaginatedEmployeeResponse)
def get_employees(
    page: int = 1,
    pageSize: int = 10,
    search: str | None = None,
    department: str | None = None,
    jobTitle: str | None = None,
    role: str | None = None,
    sortBy: str | None = None,
    sortOrder: str | None = None,
    db: Session = Depends(get_db)
):
    """Lấy danh sách người dùng từ Database với Phân trang, Tìm kiếm Fuzzy, Filter & Sort."""
    query = db.query(Employee)

    # Search (Họ tên, Mã NV, Email, SĐT, Chức danh, Đơn vị, Vai trò)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (Employee.full_name.ilike(term)) |
            (Employee.staff_code.ilike(term)) |
            (Employee.email.ilike(term)) |
            (Employee.phone.ilike(term)) |
            (Employee.job_title.ilike(term)) |
            (Employee.department.ilike(term)) |
            (Employee.role.ilike(term))
        )

    # Filter By Category
    if department:
        query = query.filter(Employee.department == department)
    if jobTitle:
        query = query.filter(Employee.job_title == jobTitle)
    if role:
        query = query.filter(Employee.role == role)

    # Sắp xếp theo Cột
    if sortBy and hasattr(Employee, sortBy):
        column_attr = getattr(Employee, sortBy)
        if sortOrder == "descend":
            query = query.order_by(column_attr.desc())
        else:
            query = query.order_by(column_attr.asc())
    else:
        query = query.order_by(Employee.id.desc())

    total = query.count()
    offset = (page - 1) * pageSize
    items = query.offset(offset).limit(pageSize).all()

    return PaginatedEmployeeResponse(
        data=items,
        total=total,
        page=page,
        pageSize=pageSize
    )


@app.get("/api/employees/staff-codes")
def get_existing_staff_codes(db: Session = Depends(get_db)):
    """Lấy danh sách tất cả các Mã nhân viên hiện có trong DB (phục vụ kiểm tra trùng lặp)."""
    codes = db.query(Employee.staff_code).all()
    return [c[0] for c in codes]


@app.post("/api/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db)):
    """Tạo mới 1 người dùng vào Database."""
    existing = db.query(Employee).filter(Employee.staff_code == payload.staff_code).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Mã nhân viên '{payload.staff_code}' đã tồn tại trong Hệ thống!")

    emp = Employee(**payload.model_dump())
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return emp


@app.put("/api/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee(employee_id: int, payload: EmployeeUpdate, db: Session = Depends(get_db)):
    """Cập nhật thông tin người dùng theo ID."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    update_data = payload.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(emp, key, val)

    db.commit()
    db.refresh(emp)
    return emp


@app.delete("/api/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    """Xóa người dùng khỏi Database."""
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    db.delete(emp)
    db.commit()
    return {"ok": True, "message": "Đã xóa người dùng thành công"}


@app.post("/api/employees/batch-import", response_model=BatchImportResponse)
def batch_import_employees(payload: BatchImportRequest, db: Session = Depends(get_db)):
    """Import hàng loạt dữ liệu vào CSDL PostgreSQL với Hỗ trợ Ghi đè (Upsert Batch)."""
    updated_count = 0
    inserted_count = 0

    existing_map = {e.staff_code: e for e in db.query(Employee).all()}

    for item in payload.users:
        code = item.staff_code.strip()
        if not code:
            continue

        if code in existing_map:
            if payload.allow_overwrite:
                emp = existing_map[code]
                emp.full_name = item.full_name
                emp.email = item.email
                if item.phone: emp.phone = item.phone
                if item.address: emp.address = item.address
                if item.job_title: emp.job_title = item.job_title
                if item.department: emp.department = item.department
                if item.role: emp.role = item.role
                updated_count += 1
        else:
            new_emp = Employee(**item.model_dump())
            db.add(new_emp)
            existing_map[code] = new_emp
            inserted_count += 1

    db.commit()
    return BatchImportResponse(
        updated_count=updated_count,
        inserted_count=inserted_count,
        total_processed=updated_count + inserted_count
    )

