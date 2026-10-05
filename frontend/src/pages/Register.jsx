import { LockOutlined, MailOutlined, UserOutlined } from "@ant-design/icons";
import { Alert, AutoComplete, Button, Card, Form, Input, Space, Typography } from "antd";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const { Title, Text } = Typography;
const domains = ["gmail.com", "outlook.com", "yahoo.com", "viettel.com.vn"];

export default function Register() {
  const [form] = Form.useForm();
  const [emailOptions, setEmailOptions] = useState([]);
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const suggestEmail = (value) => {
    if (!value || value.includes("@")) return setEmailOptions([]);
    setEmailOptions(domains.map((domain) => ({ value: `${value}@${domain}` })));
  };

  const submit = async (values) => {
    setServerError("");
    setSubmitting(true);
    try {
      await register({
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        password: values.password,
        confirm_password: values.confirm_password,
      });
      navigate("/dashboard");
    } catch (err) {
      setServerError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="auth-card">
      <Title level={2}>Đăng ký</Title>
      <Text type="secondary">Tạo tài khoản mới với kiểm tra dữ liệu cả frontend và backend.</Text>
      {serverError && <Alert className="top-alert" type="error" showIcon message={serverError} />}

      <Form form={form} layout="vertical" onFinish={submit} autoComplete="on" requiredMark="optional">
        <Form.Item label="Họ và tên" name="full_name" rules={[{ required: true, message: "Vui lòng nhập họ tên" }, { min: 2, message: "Họ tên tối thiểu 2 ký tự" }]}>
          <Input prefix={<UserOutlined />} placeholder="Nguyễn Văn A" autoComplete="name" allowClear />
        </Form.Item>

        <Form.Item label="Email" name="email" rules={[{ required: true, message: "Vui lòng nhập email" }, { type: "email", message: "Email chưa đúng định dạng" }]}>
          <AutoComplete options={emailOptions} onSearch={suggestEmail}>
            <Input prefix={<MailOutlined />} placeholder="Gõ tên email để nhận gợi ý" autoComplete="email" allowClear />
          </AutoComplete>
        </Form.Item>

        <Form.Item
          label="Mật khẩu"
          name="password"
          rules={[
            { required: true, message: "Vui lòng nhập mật khẩu" },
            { min: 8, message: "Mật khẩu tối thiểu 8 ký tự" },
            { pattern: /^(?=.*[A-Za-z])(?=.*\d).+$/, message: "Mật khẩu phải có cả chữ và số" }
          ]}
          hasFeedback
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Tối thiểu 8 ký tự" autoComplete="new-password" />
        </Form.Item>

        <Form.Item
          label="Nhập lại mật khẩu"
          name="confirm_password"
          dependencies={["password"]}
          hasFeedback
          rules={[
            { required: true, message: "Vui lòng nhập lại mật khẩu" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value || getFieldValue("password") === value
                  ? Promise.resolve()
                  : Promise.reject(new Error("Mật khẩu nhập lại không khớp"));
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu" autoComplete="new-password" />
        </Form.Item>

        <Space wrap>
          <Button type="primary" htmlType="submit" loading={submitting}>Đăng ký</Button>
          <Button htmlType="button" onClick={() => { form.resetFields(); setEmailOptions([]); setServerError(""); }}>Nhập lại</Button>
        </Space>
      </Form>

      <div className="auth-footer">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></div>
    </Card>
  );
}
