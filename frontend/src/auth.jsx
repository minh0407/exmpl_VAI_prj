import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("auth_user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return setLoading(false);
    api("/auth/me")
      .then((me) => {
        setUser(me);
        localStorage.setItem("auth_user", JSON.stringify(me));
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const completeAuth = (data) => {
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("auth_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const login = async (payload) => completeAuth(await api("/auth/login", { method: "POST", body: JSON.stringify(payload) }));
  const googleLogin = async (payload) => completeAuth(await api("/auth/google", { method: "POST", body: JSON.stringify(payload) }));
  const register = async (payload) => completeAuth(await api("/auth/register", { method: "POST", body: JSON.stringify(payload) }));
  
  const logout = async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch { /* vẫn xóa local */ }
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, googleLogin, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
