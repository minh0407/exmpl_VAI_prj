import { Card, Table, Button, Tag, Statistic, Row, Col, Alert, message } from "antd";
import { HistoryOutlined, SyncOutlined, AreaChartOutlined, FileTextOutlined } from "@ant-design/icons";
import { useEffect, useState } from "react";
import { api } from "../api";

export default function WeeklyBaselinePanel() {
  const [baselines, setBaselines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const fetchBaselines = async () => {
    setLoading(true);
    try {
      const data = await api("/admin/rate-limit/baselines");
      setBaselines(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBaselines();
  }, []);

  const handleTriggerWeeklyLog = async () => {
    setTriggering(true);
    try {
      const newSnapshot = await api("/admin/rate-limit/trigger-weekly-log", { method: "POST" });
      message.success(`Đã ghi log snapshot đối chiếu tuần ${newSnapshot.week_number}/${newSnapshot.year} thành công!`);
      fetchBaselines();
    } catch (err) {
      message.error(err.message);
    } finally {
      setTriggering(false);
    }
  };

  const columns = [
    {
      title: "Tuần / Năm",
      dataIndex: "week_number",
      key: "week",
      render: (week, record) => <Tag color="blue">Tuần {week} ({record.year})</Tag>,
    },
    {
      title: "TB Request/Phút",
      dataIndex: "avg_requests_per_minute",
      key: "avg_rpm",
      render: (val) => <strong>{val.toFixed(4)} req/min</strong>,
    },
    {
      title: "Đỉnh điểm Peak/Phút",
      dataIndex: "peak_requests_per_minute",
      key: "peak_rpm",
      render: (val) => <Tag color="orange">{val.toFixed(2)} req/min</Tag>,
    },
    {
      title: "Tổng lượt thử",
      dataIndex: "total_attempts",
      key: "total",
    },
    {
      title: "Lần kích reCAPTCHA",
      dataIndex: "captcha_triggered_count",
      key: "captcha",
      render: (val) => <Tag color={val > 0 ? "warning" : "default"}>{val}</Tag>,
    },
    {
      title: "Lần bị Block 429",
      dataIndex: "blocked_count",
      key: "blocked",
      render: (val) => <Tag color={val > 0 ? "error" : "default"}>{val}</Tag>,
    },
    {
      title: "Thời gian ghi log",
      dataIndex: "created_at",
      key: "created_at",
      render: (t) => new Date(t).toLocaleString("vi-VN"),
    },
  ];

  return (
    <Card
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <HistoryOutlined style={{ color: "#722ed1" }} />
          <span>Cơ sở đối chiếu Baseline hàng tuần (Weekly Log Snapshots)</span>
        </div>
      }
      extra={
        <Button
          type="primary"
          icon={<SyncOutlined spin={triggering} />}
          onClick={handleTriggerWeeklyLog}
          loading={triggering}
          style={{ background: "#722ed1", borderColor: "#722ed1" }}
        >
          Ghi log snapshot tuần ngay
        </Button>
      }
      style={{ marginTop: "20px", borderRadius: "12px" }}
    >
      <Alert
        type="info"
        showIcon
        icon={<FileTextOutlined />}
        message="Cơ chế đối chiếu hài hòa Sliding Window & Google reCAPTCHA"
        description="Cứ sau 1 tuần, hệ thống tự động ghi log 1 lần để tổng hợp thông số trung bình (Baseline). Nếu Sliding Window 5 phút ghi nhận lượng request tăng vọt so với Baseline tuần, hệ thống sẽ chủ động hạ thấp ngưỡng Soft Limit để kích hoạt Google reCAPTCHA sớm hơn, bảo vệ hệ thống khỏi các đợt tấn công brute-force."
        style={{ marginBottom: "16px" }}
      />

      <Table
        dataSource={baselines}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 5 }}
        size="small"
      />
    </Card>
  );
}
