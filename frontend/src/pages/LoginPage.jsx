import React, { useState } from 'react'; // Force Vercel Build
import { Form, Input, Button, Card, message, Typography, Space, Modal, Row, Col, Select } from 'antd';
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
    const [view, setView] = useState('intro'); // 'intro', 'landing', 'admin', 'student-login', 'student-register'

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
                gradeSection: `${values.grade} - ${values.section}`,
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

    // --- INTRO / ABOUT VIEW ---
    if (view === 'intro') {
        return (
            <div className="login-container intro-container">
                <div className="intro-box">
                    <div className="login-header">
                        <h1 className="system-name">Fugen <span className="accent">Smart Pay</span></h1>
                        <p className="system-subtitle">Official Capstone Project</p>
                    </div>

                    <Card className="intro-card-glass">
                        <div className="intro-content">
                            <h2 className="intro-section-title">Project Overview</h2>
                            <p className="intro-description">
                                <strong>"Fugen Smart Pay"</strong> is a capstone project developed for the implementation of a
                                School ID–Based Cashless Canteen Management System at
                                <strong> Future Generation Philippine International School (FGPIS)</strong>.
                                The system is designed to improve canteen payment efficiency by using QR codes printed on student IDs,
                                enabling secure and convenient cashless transactions.
                            </p>

                            <div className="intro-team-section">
                                <h3 className="team-title">Development & Implementation</h3>
                                <div className="team-grid">
                                    <div className="team-item">
                                        <Text type="secondary" className="team-label">Developer</Text>
                                        <Text strong className="team-name">Samuel Ivan Malavi</Text>
                                    </div>
                                    <div className="team-item">
                                        <Text type="secondary" className="team-label">Implementers</Text>
                                        <Text strong className="team-name">Irish Nhycole Barber</Text>
                                        <Text strong className="team-name">John Kenneth Gerona</Text>
                                        <Text strong className="team-name">Julia Mendanao</Text>
                                    </div>
                                </div>
                            </div>

                            <p className="intro-description bottom-desc">
                                The platform supports automated balance tracking, reduces waiting time during transactions,
                                minimizes cash handling errors, and provides transparent transaction records accessible
                                only to authorized school personnel. Fugen Smart Pay aims to modernize the school canteen
                                payment process while maintaining secure and reliable system management.
                            </p>

                            <Button
                                type="primary"
                                size="large"
                                className="enter-btn"
                                onClick={() => setView('landing')}
                                block
                            >
                                Enter System Portal
                            </Button>
                        </div>
                    </Card>

                    <div className="login-footer">
                        <p>© 2026 Future Generation Philippine International School</p>
                    </div>
                </div>
            </div>
        );
    }

    // --- LANDING VIEW ---
    if (view === 'landing') {
        return (
            <div className="login-container">
                <div className="login-box landing-box">
                    <div className="login-header">
                        <h1 className="system-name">Fugen <span className="accent">Smart Pay</span></h1>
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
                        <p>Fugen Smart Pay © 2026 | Secure Transaction System</p>
                    </div>
                </div>
            </div>
        );
    }

    // --- GENERIC WRAPPER FOR FORMS ---
    return (
        <div className="login-container">
            <div style={{ width: '100%', maxWidth: view === 'student-register' ? 700 : 450, margin: '0 auto', transition: 'max-width 0.3s ease' }}>
                <div className="login-header">
                    <h1 className="system-name">Fugen <span className="accent">Smart Pay</span></h1>
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

                            <Row gutter={16}>
                                <Col xs={24} sm={8}>
                                    <Form.Item name="grade" label="Grade" rules={[{ required: true, message: 'Select grade' }]}>
                                        <Select placeholder="Grade" size="large">
                                            {[7, 8, 9, 10, 11, 12].map(g => (
                                                <Select.Option key={g} value={`Grade ${g}`}>Grade {g}</Select.Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                                <Col xs={24} sm={8}>
                                    <Form.Item name="section" label="Section" rules={[{ required: true, message: 'Enter section' }]}>
                                        <Input prefix={<UserAddOutlined />} placeholder="e.g. Olivera" />
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
