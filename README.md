# ReactJS + Ant Design + Python FastAPI Auth Demo

## Stack
- Frontend: ReactJS + Vite + Ant Design (`antd`) + React Router.
- Backend: Python FastAPI + SQLAlchemy + SQLite.
- Authentication: JWT access token.

## Chức năng đã có
- Đăng ký tài khoản.
- Kiểm tra họ tên, email, mật khẩu tối thiểu 8 ký tự và có cả chữ + số.
- Nhập lại mật khẩu và báo ngay khi không khớp.
- Kiểm tra email đã tồn tại ở backend.
- Đăng nhập và trả lỗi khi email/mật khẩu không đúng.
- Loading state để chống bấm submit liên tục.
- Nút `Nhập lại` reset toàn bộ form/lỗi.
- Ant Design `AutoComplete` gợi ý domain email khi đăng ký.
- Browser autocomplete đúng chuẩn: `name`, `email`, `username`, `current-password`, `new-password`.
- Giữ phiên đăng nhập sau refresh bằng JWT + `/auth/me`.
- Protected Route: chưa login thì không vào được Dashboard.
- Logout xóa token và user local.
- Bắt lỗi backend không chạy / lỗi HTTP.
- SQLite tự tạo `backend/auth_demo.db`.

## Cấu trúc
```text
react-python-ant-auth/
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ database.py
│  │  ├─ models.py
│  │  ├─ schemas.py
│  │  └─ security.py
│  ├─ tests/test_auth.py
│  └─ requirements.txt
├─ frontend/
│  ├─ src/
│  │  ├─ pages/
│  │  ├─ components/
│  │  ├─ api.js
│  │  ├─ auth.jsx
│  │  └─ App.jsx
│  └─ package.json
└─ README.md
```

## 1. Chạy backend
Windows PowerShell:
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
$env:AUTH_SECRET_KEY="doi-secret-key-khi-deploy"
python -m uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## 2. Chạy frontend
Mở terminal thứ hai:
```powershell
cd frontend
npm install
npm run dev
```

Mở: http://localhost:5173

## Test backend
```powershell
cd backend
python -m pytest -q
```

## Production nên bổ sung
- HttpOnly + Secure Cookie thay vì lưu JWT trong localStorage.
- Refresh token rotation / token revocation.
- Forgot password / reset password.
- Verify email bằng OTP/link.
- Rate limit login và chống brute-force.
- CAPTCHA sau nhiều lần login sai.
- Audit log.
- PostgreSQL/MySQL thay SQLite.
