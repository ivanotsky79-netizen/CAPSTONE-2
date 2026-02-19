import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Radio } from 'antd';
import { UserOutlined, LockOutlined, IdcardOutlined } from '@ant-design/icons';
import { studentService } from '../services/api';
import './LoginPage.css';

const ADMIN_CREDENTIALS = {
    username: 'grpfive',
    password: '170206'
};

export default function LoginPage({ onLogin }) {
    const [loading, setLoading] = useState(false);
    const [loginRole, setLoginRole] = useState('admin'); // 'admin' or 'student'

    const handleLogin = async (values) => {
        setLoading(true);

        if (loginRole === 'admin') {
            // Admin Login (Static)
            setTimeout(() => {
                if (values.username === ADMIN_CREDENTIALS.username && values.password === ADMIN_CREDENTIALS.password) {
                    message.success('Admin login successful!');
                    onLogin('admin');
                } else {
                    message.error('Invalid admin credentials');
                }
                setLoading(false);
            }, 500);
        } else {
            // Student Login (API)
            try {
                const response = await studentService.verifyPasskey(values.studentId, values.passkey);
                message.success(`Welcome, ${response.data.student.fullName}!`);
                onLogin('student', response.data.student);
            } catch (err) {
                message.error(err.response?.data?.error || 'Invalid Student ID or Passkey');
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <h1 className="system-name">FUGEN <span className="accent">SmartPay</span></h1>
                    <p className="system-subtitle">{loginRole === 'admin' ? 'Admin Dashboard' : 'Student Portal'}</p>
                </div>

                <Card className="login-card">
                    <div style={{ marginBottom: 20, textAlign: 'center' }}>
                        <Radio.Group
                            value={loginRole}
                            onChange={e => setLoginRole(e.target.value)}
                            buttonStyle="solid"
                        >
                            <Radio.Button value="admin">Admin</Radio.Button>
                            <Radio.Button value="student">Student</Radio.Button>
                        </Radio.Group>
                    </div>

                    <Form
                        name="login-form"
                        onFinish={handleLogin}
                        layout="vertical"
                        size="large"
                    >
                        {loginRole === 'admin' ? (
                            <>
                                <Form.Item
                                    name="username"
                                    rules={[{ required: true, message: 'Please enter username' }]}
                                >
                                    <Input prefix={<UserOutlined />} placeholder="Username" autoFocus />
                                </Form.Item>
                                <Form.Item
                                    name="password"
                                    rules={[{ required: true, message: 'Please enter password' }]}
                                >
                                    <Input.Password prefix={<LockOutlined />} placeholder="Password" />
                                </Form.Item>
                            </>
                        ) : (
                            <>
                                <Form.Item
                                    name="studentId"
                                    rules={[{ required: true, message: 'Please enter Student ID' }]}
                                >
                                    <Input prefix={<IdcardOutlined />} placeholder="Student ID (e.g. 2024-001)" autoFocus />
                                </Form.Item>
                                <Form.Item
                                    name="passkey"
                                    rules={[{ required: true, message: 'Please enter 4-digit Passkey' }]}
                                >
                                    <Input.Password prefix={<LockOutlined />} placeholder="Passkey" maxLength={4} />
                                </Form.Item>
                            </>
                        )}

                        <Form.Item>
                            <Button type="primary" htmlType="submit" block loading={loading} size="large">
                                Login to {loginRole === 'admin' ? 'Dashboard' : 'Portal'}
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>

                <div className="login-footer">
                    <p>FUGEN SmartPay © 2026 | {loginRole === 'admin' ? 'Secure Admin' : 'Student'} Access</p>
                </div>
            </div>
        </div>
    );
}
