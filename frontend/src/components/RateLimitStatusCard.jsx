import { Card, Tag, Progress, Statistic, Row, Col, Tooltip } from "antd";
import { SafetyOutlined, WarningOutlined, FieldTimeOutlined, LineChartOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { api } from "../api";

export default function RateLimitStatusCard({ email, refreshKey = 0 }) {
  const [status, setStatus] = useState(null);

  const fetchStatus = async () => {
    try {
      const path = email ? `/auth/rate-limit-status?email=${encodeURIComponent(email)}` : "/auth/rate-limit-status";
      const data = await api(path);
      setStatus(data);
    } catch {
      // Bỏ qua lỗi hiển thị phụ
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, [email, refreshKey]);

  if (!status) return null;

  const { stats, soft_limit, hard_limit, captcha_required, baseline_multiplier, has_baseline } = status;
  const percentFailed = Math.min(100, Math.round((stats.failed_attempts / soft_limit) * 100));

  return (
    <Card
      size="small"
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
          <FieldTimeOutlined style={{ color: "#1890ff" }} />
          <span>Sliding Window Rate Limit (5 phút)</span>
        </div>
      }
      extra={
        captcha_required ? (
          <Tag color="error" icon={<WarningOutlined />}>Cần reCAPTCHA</Tag>
        ) : (
          <Tag color="success" icon={<SafetyOutlined />}>Bình thường</Tag>
        )
      }
      style={{ marginBottom: "16px", borderRadius: "10px", background: "#fafafa" }}
    >
      <Row gutter={12}>
        <Col span={8}>
          <Statistic
            title={<span style={{ fontSize: "11px" }}>Thử sai</span>}
            value={stats.failed_attempts}
            suffix={`/ ${soft_limit}`}
            valueStyle={{ fontSize: "15px", color: stats.failed_attempts >= soft_limit ? "#cf1322" : "#3f8600" }}
          />
        </Col>
        <Col span={8}>
          <Statistic
            title={<span style={{ fontSize: "11px" }}>Tổng lượt (5m)</span>}
            value={stats.total_attempts}
            suffix={`/ ${hard_limit}`}
            valueStyle={{ fontSize: "15px" }}
          />
        </Col>
        <Col span={8}>
          <Tooltip title={has_baseline ? `Đang đối chiếu dữ liệu log snapshot 1 tuần. Hệ số hiện tại: ${baseline_multiplier}x` : "Chưa có log snapshot tuần làm đối chiếu"}>
            <Statistic
              title={<span style={{ fontSize: "11px" }}>Đối chiếu Tuần</span>}
              value={has_baseline ? `${baseline_multiplier}x` : "Chưa có"}
              valueStyle={{ fontSize: "14px", color: baseline_multiplier > 1.5 ? "#d4b106" : "#1890ff" }}
              prefix={<LineChartOutlined />}
            />
          </Tooltip>
        </Col>
      </Row>

      <div style={{ marginTop: "10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#8c8c8c" }}>
          <span>Ngưỡng kích hoạt reCAPTCHA (Soft Limit):</span>
          <span>{stats.failed_attempts}/{soft_limit} lần</span>
        </div>
        <Progress
          percent={percentFailed}
          status={captcha_required ? "exception" : "normal"}
          size="small"
          showInfo={false}
        />
      </div>
    </Card>
  );
}
