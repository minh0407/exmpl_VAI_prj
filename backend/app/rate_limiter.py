from datetime import datetime, timedelta
import os
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .models import LoginAttempt, WeeklyBaseline


# Sliding Window Config
WINDOW_MINUTES = 5
DEFAULT_SOFT_LIMIT = 3   # Bật yêu cầu reCAPTCHA khi thử sai/tổng lần thử >= 3
DEFAULT_HARD_LIMIT = 10  # Chặn (429 Too Many Requests) khi tổng lần thử >= 10


def get_current_window_stats(db: Session, ip_address: str, email: str | None = None) -> dict:
    """
    Tính số lượt thử trong cửa sổ trượt (Sliding Window) 5 phút gần nhất theo IP hoặc Email.
    """
    now = datetime.utcnow()
    window_start = now - timedelta(minutes=WINDOW_MINUTES)

    query = db.query(LoginAttempt).filter(LoginAttempt.timestamp >= window_start)
    
    # Lọc theo IP hoặc Email để phát hiện brute force từ 1 IP hoặc hướng tới 1 Email
    if email:
        ip_or_email_attempts = query.filter(
            (LoginAttempt.ip_address == ip_address) | (LoginAttempt.email == email)
        ).all()
    else:
        ip_or_email_attempts = query.filter(LoginAttempt.ip_address == ip_address).all()

    total_attempts = len(ip_or_email_attempts)
    failed_attempts = sum(1 for a in ip_or_email_attempts if a.status in ("failed", "captcha_failed"))
    captcha_triggers = sum(1 for a in ip_or_email_attempts if a.status == "captcha_required")

    return {
        "total_attempts": total_attempts,
        "failed_attempts": failed_attempts,
        "captcha_triggers": captcha_triggers,
        "window_minutes": WINDOW_MINUTES,
    }


def get_latest_weekly_baseline(db: Session) -> WeeklyBaseline | None:
    """Lấy bản ghi đối chiếu baseline tuần gần nhất."""
    return db.query(WeeklyBaseline).order_by(WeeklyBaseline.id.desc()).first()


def estimate_weighted_baseline_rpm(db: Session) -> tuple[float, bool]:
    """
    Ước lượng tỷ lệ baseline trung bình dựa trên công thức nội suy trọng số giữa 2 tuần:
    Ước lượng = RPM_Tuần1 * (Ngày_Tuần1 / 7) + RPM_Tuần2 * (Ngày_Tuần2 / 7)
    """
    baselines = db.query(WeeklyBaseline).order_by(WeeklyBaseline.id.desc()).limit(2).all()
    if not baselines:
        return 0.0, False

    if len(baselines) == 1:
        return baselines[0].avg_requests_per_minute, True

    b1, b2 = baselines[0], baselines[1]  # b1: tuần mới nhất, b2: tuần trước đó
    now = datetime.utcnow()
    
    # Tính số ngày giao thoa của cửa sổ 7 ngày hiện tại với Tuần 1 và Tuần 2
    time_diff_days = (now - b1.start_time).total_seconds() / (24 * 3600.0)
    days_w1 = min(7.0, max(0.0, time_diff_days))
    days_w2 = max(0.0, 7.0 - days_w1)

    weighted_rpm = (b1.avg_requests_per_minute * (days_w1 / 7.0)) + (b2.avg_requests_per_minute * (days_w2 / 7.0))
    return round(weighted_rpm, 4), True


def calculate_effective_thresholds(db: Session, ip_address: str, email: str | None = None) -> dict:
    """
    Đối chiếu cửa sổ trượt với Baseline tuần ước lượng (dùng công thức trọng số giữa 2 tuần).
    Nếu lưu lượng hiện tại đột biến gấp 2 lần mức trung bình ước lượng, siết chặt Soft Limit xuống 1 lần thử sai.
    """
    stats = get_current_window_stats(db, ip_address, email)
    baseline_rpm, has_baseline = estimate_weighted_baseline_rpm(db)

    soft_limit = DEFAULT_SOFT_LIMIT
    hard_limit = DEFAULT_HARD_LIMIT
    baseline_multiplier = 1.0

    if has_baseline and baseline_rpm > 0 and stats["total_attempts"] >= 3:
        current_rpm = stats["total_attempts"] / float(WINDOW_MINUTES)
        if current_rpm > (baseline_rpm * 2.0):
            soft_limit = max(1, DEFAULT_SOFT_LIMIT - 2)
            baseline_multiplier = round(current_rpm / baseline_rpm, 2)

    captcha_required = (stats["failed_attempts"] >= soft_limit) or (stats["total_attempts"] >= soft_limit * 2)

    return {
        "stats": stats,
        "soft_limit": soft_limit,
        "hard_limit": hard_limit,
        "captcha_required": captcha_required,
        "baseline_multiplier": baseline_multiplier,
        "estimated_baseline_rpm": baseline_rpm,
        "has_baseline": has_baseline,
    }




def record_login_attempt(
    db: Session,
    ip_address: str,
    email: str | None,
    auth_method: str,
    status: str,
):
    """Ghi nhận log lần thử đăng nhập vào DB."""
    attempt = LoginAttempt(
        ip_address=ip_address,
        email=email.lower() if email else None,
        auth_method=auth_method,
        status=status,
        timestamp=datetime.utcnow(),
    )
    db.add(attempt)
    db.commit()


def check_login_rate_limit(
    db: Session,
    ip_address: str,
    email: str | None,
    captcha_verified: bool = False,
):
    """
    Kiểm tra và áp dụng Rate Limit (Hài hòa Sliding Window & Google reCAPTCHA).
    - Vượt Hard Limit -> Ném 429 Too Many Requests.
    - Vượt Soft Limit mà chưa xác minh reCAPTCHA -> Ném 428 / 400 yêu cầu reCAPTCHA.
    """
    eval_res = calculate_effective_thresholds(db, ip_address, email)
    stats = eval_res["stats"]

    # 1. Kiểm tra Hard Limit
    if stats["total_attempts"] >= eval_res["hard_limit"]:
        record_login_attempt(db, ip_address, email, "password", "blocked")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "too_many_requests",
                "message": f"Tài khoản hoặc IP đã thử quá {eval_res['hard_limit']} lần trong 5 phút. Vui lòng thử lại sau.",
                "retry_after_seconds": WINDOW_MINUTES * 60,
            },
        )

    # 2. Kiểm tra Soft Limit (Xác minh Google reCAPTCHA)
    if eval_res["captcha_required"] and not captcha_verified:
        record_login_attempt(db, ip_address, email, "password", "captcha_required")
        raise HTTPException(
            status_code=status.HTTP_428_PRECONDITION_REQUIRED,
            detail={
                "error": "recaptcha_required",
                "captcha_required": True,
                "message": "Phát hiện nhiều lượt đăng nhập bất thường. Vui lòng xác minh Google reCAPTCHA để tiếp tục.",
                "failed_attempts": stats["failed_attempts"],
            },
        )


def generate_weekly_baseline(db: Session) -> WeeklyBaseline:
    """
    Cơ chế ghi log mỗi tuần 1 lần để làm cơ sở đối chiếu cho Sliding Window.
    Gom nhóm dữ liệu log của 7 ngày qua, tính toán lượng request trung bình/phút & đỉnh điểm.
    """
    now = datetime.utcnow()
    one_week_ago = now - timedelta(days=7)

    attempts = db.query(LoginAttempt).filter(LoginAttempt.timestamp >= one_week_ago).all()

    total_attempts = len(attempts)
    failed_attempts = sum(1 for a in attempts if a.status in ("failed", "captcha_failed"))
    captcha_triggered_count = sum(1 for a in attempts if a.status == "captcha_required")
    blocked_count = sum(1 for a in attempts if a.status == "blocked")

    total_minutes = 7 * 24 * 60
    avg_rpm = total_attempts / float(total_minutes)

    # Tính đỉnh điểm (peak requests) theo từng khung 5 phút
    peak_rpm = 0.0
    if attempts:
        # Nhóm theo các khung 5 phút
        minute_counts = {}
        for a in attempts:
            bucket = a.timestamp.replace(second=0, microsecond=0)
            bucket_5m = bucket - timedelta(minutes=bucket.minute % 5)
            minute_counts[bucket_5m] = minute_counts.get(bucket_5m, 0) + 1
        
        if minute_counts:
            max_in_5m = max(minute_counts.values())
            peak_rpm = max_in_5m / 5.0

    year, week_num, _ = now.isocalendar()

    baseline = WeeklyBaseline(
        week_number=week_num,
        year=year,
        start_time=one_week_ago,
        end_time=now,
        total_attempts=total_attempts,
        failed_attempts=failed_attempts,
        captcha_triggered_count=captcha_triggered_count,
        blocked_count=blocked_count,
        avg_requests_per_minute=round(avg_rpm, 4),
        peak_requests_per_minute=round(peak_rpm, 4),
        created_at=now,
    )
    db.add(baseline)
    db.commit()
    db.refresh(baseline)
    return baseline
