import React, { useState } from 'react'; // Force Vercel Build
import { Form, Input, Button, Card, message, Typography, Space, Modal, Row, Col } from 'antd';
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

            // Payload for Backend
            // Backend generates 'studentId' automatically (S-202X-XXXX)
            // We pass 'lrn' explicitly so it's saved in the record
            const studentData = {
                lrn: lrn,
                fullName: values.fullName,
                gradeSection: values.gradeSection,
                passkey: generatedPasskey
            };

            const response = await studentService.createStudent(studentData);
            const newStudentId = response.data.data.studentId;

            Modal.success({
                title: 'Registration Successful!',
                width: 500,
                content: (
                    <div style={{ textAlign: 'center', marginTop: 10 }}>
                        <p style={{ fontSize: 16 }}>Your account has been created.</p>

                        <div style={{ background: '#f0f5ff', padding: 15, borderRadius: 8, margin: '15px 0' }}>
                            <p style={{ margin: 5, color: '#555' }}>Your Student ID:</p>
                            <h2 style={{ color: '#1A237E', margin: 0, fontSize: 28, letterSpacing: 1 }}>{newStudentId}</h2>
                        </div>

                        <div style={{ background: '#f9f9f9', padding: 15, borderRadius: 8, margin: '15px 0', border: '1px dashed #d9d9d9' }}>
                            <p style={{ margin: 5, color: '#555' }}>Your Passkey:</p>
                            <h2 style={{ color: '#1890ff', margin: 0, fontSize: 24, letterSpacing: 2 }}>{generatedPasskey}</h2>
                            <p style={{ margin: 0, fontSize: 12, color: '#888' }}>(Derived from your LRN)</p>
                        </div>

                        <p style={{ color: 'red', fontWeight: 'bold' }}>Please save these credentials!</p>
                        <p>You will use the <strong>Student ID</strong> ({newStudentId}) to login, NOT your LRN.</p>
                    </div>
                ),
                onOk: () => setView('student-login')
            });

        } catch (err) {
            console.error(err);
            message.error(err.response?.data?.message || 'Registration failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // --- LANDING VIEW ---
    if (view === 'landing') {
        return (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                background: 'linear-gradient(135deg, #1A237E 0%, #283593 100%)',
                padding: '10vh 20px 40px',
            }}>
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
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            background: 'linear-gradient(135deg, #1A237E 0%, #283593 100%)',
            padding: '5vh 20px 40px',
        }}>
            <div style={{ width: '100%', maxWidth: view === 'student-register' ? 700 : 450, margin: '0 auto', transition: 'max-width 0.3s ease' }}>
                <div className="login-header">
                    <h1 className="system-name">FUGEN <span className="accent">SmartPay</span></h1>
                    <p className="system-subtitle">
                        {view === 'admin' ? 'Admin Dashboard' :
                            view === 'student-register' ? 'Student Registration' : 'Student Login'}
                    </p>
                </div>

                <Card className="login-card" styles={{ body: { padding: 40, overflow: 'visible' } }}>
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
                                <Input prefix={<IdcardOutlined />} placeholder="Student ID (e.g. S2026-1234)" autoFocus />
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
                            <Row gutter={24}>
                                <Col xs={24} sm={12}>
                                    <Form.Item name="fullName" rules={[{ required: true, message: 'Enter Full Name' }]}>
                                        <Input prefix={<UserOutlined />} placeholder="Full Name (e.g., Juan Dela Cruz)" autoFocus />
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={12}>
                                    <Form.Item name="studentId" rules={[
                                        { required: true, message: 'Enter 12-digit LRN' },
                                        { len: 12, message: 'LRN must be exactly 12 digits' },
                                        { pattern: /^\d+$/, message: 'LRN must contain only numbers' }
                                    ]}>
                                        <Input prefix={<IdcardOutlined />} placeholder="12-Digit LRN (Student ID)" maxLength={12} />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Row gutter={24}>
                                <Col xs={24} sm={12}>
                                    <Form.Item name="gradeSection" rules={[{ required: true, message: 'Enter Grade & Section' }]}>
                                        <Input prefix={<UserAddOutlined />} placeholder="Grade & Section (e.g., Grade 12 - A)" />
                                    </Form.Item>
                                </Col>
                            </Row>

                            <Button type="primary" htmlType="submit" block loading={loading} size="large" style={{ marginTop: 10 }}>
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
