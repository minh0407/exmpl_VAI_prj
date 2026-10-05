const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

export async function api(path, options = {}) {
  const token = localStorage.getItem("access_token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error("Không kết nối được backend. Hãy kiểm tra server Python.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/google")) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("auth_user");
    }

    const errDetail = data.detail;
    let message = typeof errDetail === "string" ? errDetail : errDetail?.message || `Lỗi HTTP ${response.status}`;
    
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    if (typeof errDetail === "object") {
      err.captcha_required = errDetail?.captcha_required || false;
      err.retry_after_seconds = errDetail?.retry_after_seconds || 0;
    }
    throw err;
  }
  return data;
}
