import { LockOutlined, MailOutlined, WarningOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Divider, Form, Input, Space, Typography, Tag } from "antd";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import GoogleLoginBtn from "../components/GoogleLoginBtn";
import ReCaptchaWidget from "../components/ReCaptchaWidget";
import RateLimitStatusCard from "../components/RateLimitStatusCard";

const { Title, Text } = Typography;

export default function Login() {
  const [form] = Form.useForm();
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaToken, setCaptchaToken] = useState(null);
  const [currentEmail, setCurrentEmail] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [blockedCountdown, setBlockedCountdown] = useState(0);

  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();

  // Đếm ngược thời gian nếu bị chặn (HTTP 429)
  useEffect(() => {
    if (blockedCountdown <= 0) return;
    const timer = setInterval(() => {
      setBlockedCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [blockedCountdown]);

  const handleValuesChange = (_, allValues) => {
    if (allValues.email !== currentEmail) {
      setCurrentEmail(allValues.email || "");
    }
  };

  const handleLoginError = (err) => {
    setServerError(err.message || "Đăng nhập thất bại");
    setRefreshKey((k) => k + 1);

    if (err.captcha_required || err.status === 428) {
      setShowCaptcha(true);
    } else if (err.status === 429) {
      setShowCaptcha(true);
      setBlockedCountdown(err.retry_after_seconds || 300);
    }
  };

  const submit = async (values) => {
    setServerError("");
    setSubmitting(true);
    try {
      await login({
        email: values.email.trim(),
        password: values.password,
        captcha_token: captchaToken,
      });
      navigate("/dashboard");
    } catch (err) {
      handleLoginError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async (idToken) => {
    setServerError("");
    setGoogleSubmitting(true);
    try {
      await googleLogin({
        id_token: idToken,
        captcha_token: captchaToken,
      });
      navigate("/dashboard");
    } catch (err) {
      handleLoginError(err);
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <Card className="auth-card" style={{ maxWidth: 460, margin: "24px auto", borderRadius: "16px", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <Title level={2} style={{ marginBottom: "4px" }}>Đăng nhập</Title>
          <Text type="secondary">Hệ thống xác thực bảo mật kết hợp Sliding Window & reCAPTCHA</Text>
        </div>

        {/* Bảng trạng thái Rate Limit Sliding Window */}
        <RateLimitStatusCard email={currentEmail} refreshKey={refreshKey} />

        {serverError && (
          <Alert
            className="top-alert"
            type={blockedCountdown > 0 ? "error" : showCaptcha ? "warning" : "error"}
            showIcon
            message={
              blockedCountdown > 0
                ? `Đã vượt quá số lần thử tối đa! Vui lòng đợi ${blockedCountdown}s trước khi thử lại.`
                : serverError
            }
            style={{ marginBottom: "16px", borderRadius: "8px" }}
          />
        )}

        {/* Nút đăng nhập Google */}
        <GoogleLoginBtn
          onGoogleSubmit={handleGoogleLogin}
          loading={googleSubmitting}
          disabled={blockedCountdown > 0 || submitting}
        />

        <Divider style={{ margin: "20px 0", fontSize: "12px", color: "#8c8c8c" }}>Hoặc đăng nhập bằng Email</Divider>

        <Form
          form={form}
          layout="vertical"
          onFinish={submit}
          onValuesChange={handleValuesChange}
          autoComplete="on"
          requiredMark="optional"
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "Vui lòng nhập email" },
              { type: "email", message: "Email chưa đúng định dạng" },
            ]}
          >
            <Input prefix={<MailOutlined style={{ color: "#bfbfbf" }} />} placeholder="anh@example.com" autoComplete="username" allowClear />
          </Form.Item>

          <Form.Item label="Mật khẩu" name="password" rules={[{ required: true, message: "Vui lòng nhập mật khẩu" }]}>
            <Input.Password prefix={<LockOutlined style={{ color: "#bfbfbf" }} />} placeholder="Mật khẩu" autoComplete="current-password" />
          </Form.Item>

          {/* ReCAPTCHA Widget khi vượt Soft Limit */}
          {showCaptcha && (
            <ReCaptchaWidget
              required={showCaptcha}
              onVerify={(token) => {
                setCaptchaToken(token);
                if (token && serverError.includes("reCAPTCHA")) setServerError("");
              }}
            />
          )}

          <Space style={{ width: "100%", justifyContent: "space-between", marginTop: "12px" }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              disabled={blockedCountdown > 0 || googleSubmitting || (showCaptcha && !captchaToken)}
              size="large"
              style={{ minWidth: "120px", borderRadius: "8px" }}
            >
              Đăng nhập
            </Button>
            <Button
              htmlType="button"
              onClick={() => {
                form.resetFields();
                setServerError("");
                setShowCaptcha(false);
                setCaptchaToken(null);
              }}
              size="large"
              style={{ borderRadius: "8px" }}
            >
              Nhập lại
            </Button>
          </Space>
        </Form>

        <div className="auth-footer" style={{ marginTop: "24px", textAlign: "center", fontSize: "14px", color: "#595959" }}>
          Chưa có tài khoản? <Link to="/register" style={{ fontWeight: 600, color: "#1890ff" }}>Đăng ký ngay</Link>
        </div>
      </Card>
    </div>
  );
}
