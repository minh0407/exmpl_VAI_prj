import { Button, Tooltip } from "antd";
import { GoogleOutlined } from "@ant-design/icons";
import { useState } from "react";

export default function GoogleLoginBtn({ onGoogleSubmit, loading = false, disabled = false }) {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

  const handleGoogleClick = () => {
    // Nếu có google client id real thì kích hoạt Google OAuth flow
    if (googleClientId && window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
      return;
    }

    // Dev mode fallback token
    const mockToken = `mock-google-token-devuser-${Math.floor(1000 + Math.random() * 9000)}`;
    onGoogleSubmit(mockToken);
  };

  return (
    <Tooltip title={!googleClientId ? "Chế độ Dev Test (Tự tạo tài khoản Google thử nghiệm)" : "Đăng nhập bằng tài khoản Google"}>
      <Button
        icon={<GoogleOutlined style={{ color: "#ea4335" }} />}
        size="large"
        block
        onClick={handleGoogleClick}
        loading={loading}
        disabled={disabled}
        style={{
          borderColor: "#d9d9d9",
          borderRadius: "8px",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        {googleClientId ? "Đăng nhập với Google" : "Đăng nhập bằng Google (Dev Test)"}
      </Button>
    </Tooltip>
  );
}
