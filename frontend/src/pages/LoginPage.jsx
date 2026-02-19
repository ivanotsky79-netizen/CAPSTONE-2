import React, { useState } from 'react'; // Force Vercel Build
import { Form, Input, Button, Card, message, Typography, Space, Modal } from 'antd';
import { UserOutlined, LockOutlined, IdcardOutlined, ArrowLeftOutlined, UserAddOutlined } from '@ant-design/icons';
import { studentService } from '../services/api';
import './LoginPage.css';

const { Title, Text } = Typography;

const ADMIN_CREDENTIALS = {
    username: 'grpfive',
    password: '170206'
};

export default function LoginPage({ onLogin }) {
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('landing'); // 'landing', 'admin', 'student-login', 'student-register'

    // Admin Login Handler
    const handleAdminLogin = async (values) => {
        setLoading(true);
        setTimeout(() => {
            if (values.username === ADMIN_CREDENTIALS.username && values.password === ADMIN_CREDENTIALS.password) {
                message.success('Admin login successful!');
                onLogin('admin');
            } else {
                message.error('Invalid admin credentials');
            }
            setLoading(false);
        }, 800);
    };

    // Student Login Handler
    const handleStudentLogin = async (values) => {
        setLoading(true);
        try {
            const response = await studentService.verifyPasskey(values.studentId, values.passkey);
            message.success(`Welcome back, ${response.data.student.fullName}!`);
            onLogin('student', response.data.student);
        } catch (err) {
            message.error(err.response?.data?.error || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    // Student Registration Handler
    const handleRegister = async (values) => {
        setLoading(true);
        try {
            const lrn = values.studentId.replace(/\D/g, ''); // Ensure only digits

            if (lrn.length !== 12) {
                message.error('Student ID (LRN) must be exactly 12 digits to generate Passkey.');
                setLoading(false);
                return;
            }

            // Generate Passkey: 3rd, 6th, 9th, 12th digits
            // Indices (0-based): 2, 5, 8, 11
            const generatedPasskey = lrn[2] + lrn[5] + lrn[8] + lrn[11];

            // Include default balance and structure for new student
            const studentData = {
                studentId: lrn,
                fullName: values.fullName,
                gradeSection: values.gradeSection,
                passkey: generatedPasskey,
                balance: 0,
                status: 'Active'
            };

            await studentService.createStudent(studentData);

            Modal.success({
                title: 'Registration Successful!',
                content: (
                    <div>
                        <p>Your account has been created.</p>
                        <p><strong>Your Auto-Generated Passkey is: <span style={{ color: '#1890ff', fontSize: 18 }}>{generatedPasskey}</span></strong></p>
                        <p>Please memorize this 4-digit code to login.</p>
                    </div>
                ),
                onOk: () => setView('student-login')
            });

        } catch (err) {
            message.error(err.response?.data?.error || 'Registration failed. ID might be taken.');
        } finally {
            setLoading(false);
        }
    };

    // --- LANDING VIEW ---
    if (view === 'landing') {
        return (
            <div className="login-container">
                <div className="login-box landing-box">
                    <div className="login-header">
                        <h1 className="system-name">FUGEN <span className="accent">SmartPay</span></h1>
                        <p className="system-subtitle">Select Access Portal</p>
                    </div>

                    <div className="portal-choices">
                        <Card
                            className="portal-card admin-choice"
                            hoverable
                            onClick={() => setView('admin')}
                        >
                            <UserOutlined className="portal-icon" />
                            <h3>Admin Access</h3>
                            <p>Manage system, students, and reports</p>
                        </Card>

                        <Card
                            className="portal-card student-choice"
                            hoverable
                            onClick={() => setView('student-login')}
                        >
                            <IdcardOutlined className="portal-icon" />
                            <h3>Student Portal</h3>
                            <p>Check balance, history, and register</p>
                        </Card>
                    </div>

                    <div className="login-footer">
                        <p>FUGEN SmartPay © 2026 | Secure Transaction System</p>
                    </div>
                </div>
            </div>
        );
    }

    // --- GENERIC WRAPPER FOR FORMS ---
    return (
        <div className="login-container">
            <div className="login-box">
                <div className="login-header">
                    <h1 className="system-name">FUGEN <span className="accent">SmartPay</span></h1>
                    <p className="system-subtitle">
                        {view === 'admin' ? 'Admin Dashboard' :
                            view === 'student-register' ? 'Student Registration' : 'Student Login'}
                    </p>
                </div>

                <Card className="login-card">
                    {/* Back Button */}
                    <div className="card-nav">
                        <Button
                            type="text"
                            icon={<ArrowLeftOutlined />}
                            onClick={() => setView('landing')}
                        >
                            Back to Home
                        </Button>
                    </div>

                    {/* ADMIN LOGIN FORM */}
                    {view === 'admin' && (
                        <Form onFinish={handleAdminLogin} layout="vertical" size="large">
                            <Form.Item name="username" rules={[{ required: true, message: 'Required' }]}>
                                <Input prefix={<UserOutlined />} placeholder="Username" autoFocus />
                            </Form.Item>
                            <Form.Item name="password" rules={[{ required: true, message: 'Required' }]}>
                                <Input.Password prefix={<LockOutlined />} placeholder="Password" />
                            </Form.Item>
                            <Button type="primary" htmlType="submit" block loading={loading} size="large">
                                Access Dashboard
                            </Button>
                        </Form>
                    )}

                    {/* STUDENT LOGIN FORM */}
                    {view === 'student-login' && (
                        <Form onFinish={handleStudentLogin} layout="vertical" size="large">
                            <Form.Item name="studentId" rules={[{ required: true, message: 'Enter Student ID' }]}>
                                <Input prefix={<IdcardOutlined />} placeholder="Student ID (LRN)" autoFocus />
                            </Form.Item>
                            <Form.Item name="passkey" rules={[{ required: true, message: 'Enter 4-digit Passkey' }]}>
                                <Input.Password prefix={<LockOutlined />} placeholder="Passkey" maxLength={4} />
                            </Form.Item>
                            <Button type="primary" htmlType="submit" block loading={loading} size="large">
                                Login to Portal
                            </Button>

                            <div className="auth-switch">
                                <Text type="secondary">New student? </Text>
                                <Button type="link" onClick={() => setView('student-register')}>Register here</Button>
                            </div>
                        </Form>
                    )}

                    {/* STUDENT REGISTRATION FORM */}
                    {view === 'student-register' && (
                        <Form onFinish={handleRegister} layout="vertical" size="large">
                            <Form.Item name="fullName" rules={[{ required: true, message: 'Enter Full Name' }]}>
                                <Input prefix={<UserOutlined />} placeholder="Full Name (e.g., Juan Dela Cruz)" autoFocus />
                            </Form.Item>
                            <Form.Item name="studentId" rules={[
                                { required: true, message: 'Enter 12-digit LRN' },
                                { len: 12, message: 'LRN must be exactly 12 digits' },
                                { pattern: /^\d+$/, message: 'LRN must contain only numbers' }
                            ]}>
                                <Input prefix={<IdcardOutlined />} placeholder="12-Digit LRN (Student ID)" maxLength={12} />
                            </Form.Item>
                            <Form.Item name="gradeSection" rules={[{ required: true, message: 'Enter Grade & Section' }]}>
                                <Input prefix={<UserAddOutlined />} placeholder="Grade & Section (e.g., Grade 12 - A)" />
                            </Form.Item>

                            <div style={{ marginBottom: 20, padding: 15, background: '#f6f8fa', borderRadius: 8, fontSize: 13, color: '#555', border: '1px solid #e1e4e8' }}>
                                <strong>Note:</strong> Your 4-digit Passkey will be automatically generated from the <strong>3rd, 6th, 9th, and 12th</strong> digits of your LRN.
                            </div>

                            <Button type="primary" htmlType="submit" block loading={loading} size="large">
                                Create Account
                            </Button>

                            <div className="auth-switch">
                                <Text type="secondary">Already registered? </Text>
                                <Button type="link" onClick={() => setView('student-login')}>Login here</Button>
                            </div>
                        </Form>
                    )}
                </Card>
            </div>
        </div>
    );
}
