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
