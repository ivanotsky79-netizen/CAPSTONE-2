import React, { useState, useEffect } from 'react';
import { Card, List, Button, Modal, message, Badge, Tabs, Form, Input, Switch, Statistic } from 'antd';
import {
    HomeOutlined,
    WalletOutlined,
    UserOutlined,
    BellOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
    QrcodeOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,
    ShoppingOutlined,
    DollarOutlined,
    SettingOutlined,
    LockOutlined,
    BulbOutlined
} from '@ant-design/icons';
import { QRCodeCanvas } from 'qrcode.react';
import { transactionService, studentService } from '../services/api';
import './StudentDashboard.css';
import { io } from 'socket.io-client';

const { TabPane } = Tabs;

export default function StudentDashboard({ user, onLogout }) {
    const [balanceVisible, setBalanceVisible] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Feature States
    const [qrModalVisible, setQrModalVisible] = useState(false);
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [studentData, setStudentData] = useState(user);
    const [darkMode, setDarkMode] = useState(localStorage.getItem('studentDarkMode') === 'true');

    // Forms
    const [passkeyForm] = Form.useForm();

    if (!studentData) {
        return <div style={{ padding: 20, textAlign: 'center', color: darkMode ? '#fff' : '#333' }}>Loading user data...</div>;
    }

    useEffect(() => {
        loadData();

        // Real-time Updates
        const socket = io('https://fugen-backend.onrender.com'); // Or use API_BASE_URL from a config if available
        socket.on('balanceUpdate', (data) => {
            if (data.studentId === user.studentId) {
                console.log('Real-time update received', data);
                loadData();
            }
        });

        return () => socket.disconnect();
    }, []);

    useEffect(() => {
        // Persist Dark Mode
        localStorage.setItem('studentDarkMode', darkMode);
        if (darkMode) {
            document.body.style.backgroundColor = '#121212';
        } else {
            document.body.style.backgroundColor = '#f5f5f5'; // Mobile POS default
        }
    }, [darkMode]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [tRes, sRes] = await Promise.all([
                transactionService.getTransactions(user.studentId),
                studentService.getStudent(user.studentId)
            ]);

            const transList = tRes.data.data || [];
            setTransactions(transList);
            setStudentData(sRes.data.data || sRes.data);

        } catch (err) {
            message.error('Failed to load student data');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePasskey = async (values) => {
        try {
            if (values.newPasskey !== values.confirmPasskey) {
                return message.error('New passkeys do not match');
            }
            await studentService.updatePasskey(studentData.studentId, values.currentPasskey, values.newPasskey);
            message.success('Passkey updated successfully!');
            passkeyForm.resetFields();
            setSettingsVisible(false);
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to update passkey');
        }
    };

    const getIcon = (type) => {
        if (type === 'TOPUP') return <DollarOutlined style={{ color: '#52c41a' }} />;
        if (type === 'PURCHASE') return <ShoppingOutlined style={{ color: '#1890ff' }} />;
        return <ArrowDownOutlined style={{ color: '#ff4d4f' }} />;
    };

    const containerClass = `student-app-container ${darkMode ? 'dark-mode' : ''}`;

    return (
        <div className={containerClass}>
            {/* Header */}
            <div className="app-header">
                <div className="user-profile">
                    <div className="avatar">
                        <UserOutlined />
                    </div>
                    <div className="user-info">
                        <span className="greeting">Hi, {(studentData.fullName || 'User').split(' ')[0]}</span>
                        <span className="welcome-back">Welcome back!</span>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <div className="icon-btn" onClick={() => { console.log('Opening Settings'); setSettingsVisible(true); }}>
                        <SettingOutlined className="notification-icon" />
                    </div>
                    {/* <Badge dot color="red">
                        <BellOutlined className="notification-icon" />
                    </Badge> */}
                </div>
            </div>

            {/* Balance Card */}
            <div className={`balance-card ${darkMode ? 'dark-card' : ''}`}>
                <div className="card-top">
                    <span className="label">Available Balance</span>
                    <div className="balance-amount-row">
                        <span className="currency">Points</span>
                        <span className="amount">
                            {balanceVisible ? parseFloat(studentData.balance).toFixed(2) : '****'}
                        </span>
                        <div className="toggle-visibility" onClick={() => setBalanceVisible(!balanceVisible)}>
                            {balanceVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                        </div>
                    </div>
                </div>
                <div className="card-bottom">
                    <div className="card-info">
                        <span className="card-label">Credit Limit</span>
                        <span className="card-value">500.00 Points</span>
                    </div>
                    <span className="card-number">**** {(studentData.studentId || '0000').slice(-4)}</span>
                </div>
                <div className="chip"></div>
            </div>

            {/* Action Buttons */}
            <div className="action-grid">
                <button className="action-btn primary" onClick={() => { console.log('Opening QR Modal'); setQrModalVisible(true); }}>
                    <div className="btn-icon"><QrcodeOutlined /></div>
                    <span>Show ID</span>
                </button>
                <button className="action-btn" onClick={loadData}>
                    <div className="btn-icon"><ArrowUpOutlined /></div>
                    <span>Refresh</span>
                </button>
            </div>



            {/* History Section */}
            <div className="history-section">
                <div className="section-header">
                    <h3>Recent Transactions</h3>
                    <a href="#" onClick={(e) => { e.preventDefault(); loadData(); }}>View All</a>
                </div>

                <div className="history-list-container">
                    <List
                        loading={loading}
                        dataSource={transactions}
                        renderItem={item => (
                            <List.Item className="history-item">
                                <div className="item-left">
                                    <div className="item-icon-bg">
                                        {getIcon(item.type)}
                                    </div>
                                    <div className="item-details">
                                        <span className="item-title">{item.type}</span>
                                        <span className="item-subtitle">
                                            {new Date(item.timestamp).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className={`item-amount ${item.type === 'TOPUP' ? 'positive' : ''}`}>
                                    {item.type === 'TOPUP' ? '+' : '-'} Points {Math.abs(item.amount).toFixed(2)}
                                </div>
                            </List.Item>
                        )}
                        locale={{ emptyText: 'No transactions yet' }}
                    />
                </div>
            </div>

            {/* Bottom Navigation */}
            <div className="bottom-nav">
                <div className="nav-item active">
                    <HomeOutlined style={{ color: '#3B5ED2' }} />
                    <span style={{ color: '#3B5ED2' }}>Home</span>
                </div>
                <div className="nav-item" onClick={() => setSettingsVisible(true)}>
                    <SettingOutlined />
                    <span>Settings</span>
                </div>
                <div className="nav-item logout" onClick={onLogout}>
                    <UserOutlined />
                    <span>Logout</span>
                </div>
            </div>

            {/* Digital ID Modal */}
            <Modal
                title={null}
                open={qrModalVisible}
                onCancel={() => setQrModalVisible(false)}
                footer={null}
                centered
                className="digital-id-modal"
                styles={{ body: { padding: 0, borderRadius: 20, overflow: 'hidden' } }}
            >
                <div className="digital-id-card" style={{ background: 'linear-gradient(135deg, #1A237E 0%, #3949AB 100%)', color: 'white', padding: 30, textAlign: 'center' }}>
                    <div style={{ marginBottom: 20 }}>
                        <img src="https://via.placeholder.com/80" alt="School Logo" style={{ borderRadius: '50%', marginBottom: 10 }} />
                        <h2 style={{ color: 'white', margin: 0 }}>FUGEN SCHOOL</h2>
                        <p style={{ opacity: 0.8, margin: 0 }}>Student Identity Card</p>
                    </div>


                    <div style={{ background: 'white', padding: 15, borderRadius: 10, display: 'inline-block', marginBottom: 20 }}>
                        <QRCodeCanvas value={`FUGEN:${studentData.studentId}`} size={180} level="H" />
                    </div>

                    <h2 style={{ color: 'white', fontSize: 24, margin: '10px 0' }}>{studentData.fullName}</h2>
                    <p style={{ fontSize: 16, opacity: 0.9 }}>ID: <strong>{studentData.studentId}</strong></p>
                    <p style={{ fontSize: 16, opacity: 0.9 }}>Grade: <strong>{studentData.gradeSection}</strong></p>

                    <div style={{ marginTop: 20, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 15, display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <small style={{ opacity: 0.7 }}>Status</small>
                            <div style={{ fontWeight: 'bold', color: '#4CAF50' }}>ACTIVE</div>
                        </div>
                        <div>
                            <small style={{ opacity: 0.7 }}>Credit Limit</small>
                            <div style={{ fontWeight: 'bold' }}>500 Points</div>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Settings Modal */}
            <Modal
                title="Settings"
                open={settingsVisible}
                onCancel={() => setSettingsVisible(false)}
                footer={null}
            >
                <Tabs defaultActiveKey="1" items={[
                    {
                        key: '1',
                        label: <span><UserOutlined />Profile</span>,
                        children: (
                            <>
                                <List>
                                    <List.Item>
                                        <List.Item.Meta title="Full Name" description={studentData.fullName} />
                                    </List.Item>
                                    <List.Item>
                                        <List.Item.Meta title="Student ID" description={studentData.studentId} />
                                    </List.Item>
                                    <List.Item>
                                        <List.Item.Meta title="Grade & Section" description={studentData.gradeSection} />
                                    </List.Item>
                                </List>

                                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 0', borderTop: '1px solid #eee' }}>
                                    <span><BulbOutlined /> Dark Mode</span>
                                    <Switch checked={darkMode} onChange={(val) => { console.log('Dark Mode: ', val); setDarkMode(val); }} />
                                </div>
                            </>
                        )
                    },
                    {
                        key: '2',
                        label: <span><LockOutlined />Security</span>,
                        children: (
                            <>
                                <div style={{ marginBottom: 15 }}>
                                    <p>Change your 4-digit Passkey</p>
                                </div>
                                <Form form={passkeyForm} layout="vertical" onFinish={handleUpdatePasskey}>
                                    <Form.Item name="currentPasskey" label="Current Passkey" rules={[{ required: true, len: 4 }]}>
                                        <Input.Password maxLength={4} placeholder="Enter current PIN" />
                                    </Form.Item>
                                    <Form.Item name="newPasskey" label="New Passkey" rules={[{ required: true, len: 4, message: 'Must be 4 digits', pattern: /^[0-9]+$/ }]}>
                                        <Input.Password maxLength={4} placeholder="Enter new 4-digit PIN" />
                                    </Form.Item>
                                    <Form.Item name="confirmPasskey" label="Confirm New Passkey" rules={[{ required: true, len: 4 }]}>
                                        <Input.Password maxLength={4} placeholder="Confirm new PIN" />
                                    </Form.Item>
                                    <Button type="primary" htmlType="submit" block style={{ background: '#3B5ED2' }}>
                                        Update Passkey
                                    </Button>
                                </Form>
                            </>
                        )
                    }
                ]} />
            </Modal>
        </div>
    );
}

