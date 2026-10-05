import { Checkbox, Card, Typography, Badge, Tag, Button } from "antd";
import { SafetyCertificateOutlined, CheckCircleFilled } from "@ant-design/icons";
import { useEffect, useState } from "react";

const { Text } = Typography;

export default function ReCaptchaWidget({ onVerify, required = false }) {
  const [checked, setChecked] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

  useEffect(() => {
    if (siteKey && window.grecaptcha) {
      try {
        window.grecaptcha.render("google-recaptcha-container", {
          sitekey: siteKey,
          callback: (token) => {
            setChecked(true);
            onVerify(token);
          },
        });
      } catch (e) {
        console.warn("reCAPTCHA already rendered or failed:", e);
      }
    }
  }, [siteKey]);

  const handleDevCheck = (e) => {
    const isChecked = e.target.checked;
    setChecked(isChecked);
    if (isChecked) {
      setVerifying(true);
      setTimeout(() => {
        setVerifying(false);
        const mockToken = `mock-captcha-pass-${Date.now()}`;
        onVerify(mockToken);
      }, 500);
    } else {
      onVerify(null);
    }
  };

  return (
    <Card
      size="small"
      style={{
        margin: "16px 0",
        background: checked ? "#f6ffed" : "#fffbe6",
        borderColor: checked ? "#b7eb8f" : "#ffe58f",
        borderRadius: "8px",
        transition: "all 0.3s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {siteKey ? (
            <div id="google-recaptcha-container"></div>
          ) : (
            <Checkbox checked={checked} onChange={handleDevCheck} disabled={verifying}>
              <span style={{ fontWeight: 500, fontSize: "14px" }}>
                {verifying ? "Đang xác minh..." : "Tôi không phải là người máy"}
              </span>
            </Checkbox>
          )}

          {checked && <CheckCircleFilled style={{ color: "#52c41a", fontSize: "18px" }} />}
        </div>

        <div style={{ textAlign: "right" }}>
          <SafetyCertificateOutlined style={{ fontSize: "20px", color: "#1890ff" }} />
          <div style={{ fontSize: "10px", color: "#8c8c8c" }}>
            {siteKey ? "Google reCAPTCHA v2" : <Tag color="blue">Dev Mode Test</Tag>}
          </div>
        </div>
      </div>
      {!siteKey && (
        <div style={{ fontSize: "11px", color: "#8c8c8c", marginTop: "6px" }}>
          💡 Môi trường phát triển: Đã tự động kích hoạt chế độ xác minh Dev Test.
        </div>
      )}
    </Card>
  );
}
