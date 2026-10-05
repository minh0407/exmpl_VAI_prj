import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="card">Đang kiểm tra phiên đăng nhập...</div>;
  return user ? children : <Navigate to="/login" replace />;
}
