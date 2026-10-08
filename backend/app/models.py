from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, Integer, String, Index
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ip_address: Mapped[str] = mapped_column(String(45), index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    auth_method: Mapped[str] = mapped_column(String(20), default="password")  # password, google
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # success, failed, captcha_required, blocked
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class WeeklyBaseline(Base):
    __tablename__ = "weekly_baselines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    total_attempts: Mapped[int] = mapped_column(Integer, default=0)
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    captcha_triggered_count: Mapped[int] = mapped_column(Integer, default=0)
    blocked_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_requests_per_minute: Float = mapped_column(Float, default=0.0)
    peak_requests_per_minute: Float = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Employee(Base):
    __tablename__ = "employees"

    # 🔑 DATABASE INDEXES: B-Tree Indexes trên các cột tìm kiếm và lọc thường xuyên
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    staff_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    role: Mapped[str] = mapped_column(String(50), index=True, default="User")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # 🔑 COMPOSITE INDEXES: Chỉ mục kết hợp tăng tốc độ lọc theo Đơn vị + Vai trò & Tìm kiếm nhanh
    __table_args__ = (
        Index("idx_emp_dept_role", "department", "role"),
        Index("idx_emp_search_composite", "full_name", "staff_code", "email"),
    )



