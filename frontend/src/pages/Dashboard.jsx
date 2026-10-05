import { LogoutOutlined, GoogleOutlined, UserOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { Avatar, Button, Card, Descriptions, Typography, Tag, Space } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import WeeklyBaselinePanel from "../components/WeeklyBaselinePanel";

const { Title, Text } = Typography;

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div style={{ maxWidth: 800, margin: "24px auto", padding: "0 16px" }}>
      <Card style={{ borderRadius: "16px", boxShadow: "0 8px 24px rgba(0,0,0,0.06)", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <Space size="middle">
            {user?.avatar_url ? (
              <Avatar size={64} src={user.avatar_url} />
            ) : (
              <Avatar size={64} style={{ backgroundColor: "#1890ff", fontSize: "24px" }}>
                {user?.full_name?.[0]?.toUpperCase() || "U"}
              </Avatar>
            )}
            <div>
              <Title level={3} style={{ margin: 0 }}>{user?.full_name}</Title>
              <Text type="secondary">{user?.email}</Text>
              <div style={{ marginTop: "4px" }}>
                {user?.google_id ? (
                  <Tag color="volcano" icon={<GoogleOutlined />}>Tài khoản Google OAuth</Tag>
                ) : (
                  <Tag color="blue" icon={<UserOutlined />}>Đăng nhập Mật khẩu</Tag>
                )}
                <Tag color="green" icon={<SafetyCertificateOutlined />}>Rate Limit Protected</Tag>
              </div>
            </div>
          </Space>

          <Button danger icon={<LogoutOutlined />} onClick={doLogout} size="large" style={{ borderRadius: "8px" }}>
            Đăng xuất
          </Button>
        </div>

        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="ID người dùng">{user?.id}</Descriptions.Item>
          <Descriptions.Item label="Phương thức xác thực">{user?.google_id ? "Google OAuth" : "Email & Password"}</Descriptions.Item>
          <Descriptions.Item label="Họ và tên">{user?.full_name}</Descriptions.Item>
          <Descriptions.Item label="Email">{user?.email}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Panel Quản lý Log Đối chiếu Baseline Tuần */}
      <WeeklyBaselinePanel />
    </div>
  );
}
