from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str

    @field_validator("full_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return " ".join(value.strip().split())

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    captcha_token: str | None = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class GoogleLoginRequest(BaseModel):
    id_token: str = Field(min_length=1)
    captcha_token: str | None = None


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    avatar_url: str | None = None
    google_id: str | None = None

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class SlidingWindowStatsResponse(BaseModel):
    total_attempts: int
    failed_attempts: int
    captcha_triggers: int
    window_minutes: int


class RateLimitStatusResponse(BaseModel):
    ip_address: str
    soft_limit: int
    hard_limit: int
    captcha_required: bool
    baseline_multiplier: float
    estimated_baseline_rpm: float = 0.0
    has_baseline: bool
    stats: SlidingWindowStatsResponse



class WeeklyBaselineResponse(BaseModel):
    id: int
    week_number: int
    year: int
    start_time: datetime
    end_time: datetime
    total_attempts: int
    failed_attempts: int
    captcha_triggered_count: int
    blocked_count: int
    avg_requests_per_minute: float
    peak_requests_per_minute: float
    created_at: datetime

    model_config = {"from_attributes": True}


# --- EMPLOYEE MANAGEMENT SCHEMAS FOR FASTAPI + POSTGRESQL ---

class EmployeeCreate(BaseModel):
    staff_code: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=255)
    phone: str | None = None
    address: str | None = None
    job_title: str | None = None
    department: str | None = None
    role: str = "User"


class EmployeeUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    job_title: str | None = None
    department: str | None = None
    role: str | None = None


class EmployeeResponse(BaseModel):
    id: int
    staff_code: str
    full_name: str
    email: str
    phone: str | None = None
    address: str | None = None
    job_title: str | None = None
    department: str | None = None
    role: str = "User"
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedEmployeeResponse(BaseModel):
    data: list[EmployeeResponse]
    total: int
    page: int
    pageSize: int


class BatchImportRequest(BaseModel):
    users: list[EmployeeCreate]
    allow_overwrite: bool = True


class BatchImportResponse(BaseModel):
    updated_count: int
    inserted_count: int
    total_processed: int

