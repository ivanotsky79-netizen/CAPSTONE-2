import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import './LoginPage.css';

const ADMIN_PASSKEY = '1234'; // Change this to your desired admin passkey

export default function LoginPage({ onLogin }) {
    const [loading, setLoading] = useState(false);

    const handleLogin = (values) => {
        setLoading(true);

        // Simulate authentication delay
        setTimeout(() => {
            if (values.passkey === ADMIN_PASSKEY) {
                message.success('Login successful!');
                onLogin();
            } else {
                message.error('Invalid admin passkey');
            }
            setLoading(false);
        }, 500);
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <h1 className="system-name">FUGEN <span className="accent">SmartPay</span></h1>
                    <p className="system-subtitle">Admin Dashboard</p>
                </div>

                <Card className="login-card">
                    <Form
                        name="admin-login"
                        onFinish={handleLogin}
                        layout="vertical"
                        size="large"
                    >
                        <Form.Item
                            name="passkey"
                            rules={[
                                { required: true, message: 'Please enter admin passkey' }
                            ]}
                        >
                            <Input.Password
                                prefix={<LockOutlined />}
                                placeholder="Enter Admin Passkey"
                                autoFocus
                            />
                        </Form.Item>

                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                block
                                loading={loading}
                                size="large"
                            >
                                Login to Dashboard
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>

                <div className="login-footer">
                    <p>FUGEN SmartPay © 2026 | Secure Admin Access</p>
                </div>
            </div>
        </div>
    );
}
