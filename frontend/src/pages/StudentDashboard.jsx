import React, { useState, useEffect } from 'react';
import { Card, List, Button, Modal, message, Badge, Tabs, Form, Input, Switch, Statistic, DatePicker, InputNumber } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import dayjs from 'dayjs';
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
    BulbOutlined,
    LineChartOutlined,
    SendOutlined
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
    const [topUpModalVisible, setTopUpModalVisible] = useState(false);
    const [activeTab, setActiveTab] = useState('home');
    const [requestAmount, setRequestAmount] = useState(10);
    const [requestDate, setRequestDate] = useState(dayjs());
    const [studentData, setStudentData] = useState(user);
    const [darkMode, setDarkMode] = useState(localStorage.getItem('studentDarkMode') === 'true');

    // Forms
    const [passkeyForm] = Form.useForm();

    // ALL hooks must be called before any conditional returns
    useEffect(() => {
        if (!user?.studentId) return;
        loadData();

        // Real-time Updates
        const socket = io('https://fugen-backend.onrender.com');
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
            document.body.style.backgroundColor = '#f5f5f5';
        }
    }, [darkMode]);

    const loadData = async () => {
        if (!user?.studentId) return;
        setLoading(true);
        try {
            const [tRes, sRes] = await Promise.all([
                transactionService.getTransactions(user.studentId),
                studentService.getStudent(user.studentId)
            ]);

            const transList = tRes.data.data || [];
            setTransactions(transList);
            const freshStudent = sRes.data.data || sRes.data;
            setStudentData(freshStudent);

            // Keep localStorage in sync with fresh student data
            const savedAuth = localStorage.getItem('fugen_auth');
            if (savedAuth) {
                try {
                    const parsed = JSON.parse(savedAuth);
                    parsed.user = freshStudent;
                    localStorage.setItem('fugen_auth', JSON.stringify(parsed));
                } catch (e) { /* ignore */ }
            }

        } catch (err) {
            message.error('Failed to load student data');
        } finally {
            setLoading(false);
        }
    };

    // Safe early return AFTER all hooks
    if (!studentData) {
        return <div style={{ padding: 20, textAlign: 'center', color: darkMode ? '#fff' : '#333' }}>Loading user data...</div>;
    }

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
        if (type === 'TOPUP') return <DollarOutlined />;
        if (type === 'PURCHASE') return <ShoppingOutlined />;
        return <ArrowDownOutlined />;
    };

    const handleTopUpRequest = async () => {
        try {
            await transactionService.requestTopup(user.studentId, requestAmount, requestDate.format('YYYY-MM-DD'));
            message.success("Top-up request sent to admin!");
            setTopUpModalVisible(false);
        } catch (error) {
            message.error("Failed to send request.");
        }
    };

    const getChartData = () => {
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = dayjs().subtract(i, 'day');
            const dayStr = d.format('YYYY-MM-DD');
            const dayName = d.format('ddd');

            const dayTotal = transactions
                .filter(t => t.type === 'PURCHASE' && dayjs(t.timestamp).format('YYYY-MM-DD') === dayStr)
                .reduce((sum, t) => sum + Math.abs(t.amount), 0);

            data.push({ name: dayName, amount: dayTotal });
        }
        return data;
    };

    const containerClass = `student-app-container ${darkMode ? 'dark-mode' : ''}`;

    return (
        <div className={containerClass}>
            {/* Header */}
            <div className="app-header">
                <div className="title-dashboard">Dashboard</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div className="avatar">
                        <UserOutlined />
                    </div>
                </div>
            </div>

            {/* Balance Card */}
            <div className={`balance-card ${darkMode ? 'dark-card' : ''}`}>
                <div className="card-top">
                    <span className="label">Total Balance</span>
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

                <div className="card-buttons">
                    <div className="card-btn" onClick={() => setQrModalVisible(true)}>
                        <QrcodeOutlined />
                        <span>Show ID</span>
                    </div>
                    <div className="card-btn" onClick={() => setTopUpModalVisible(true)}>
                        <ArrowDownOutlined />
                        <span>Request</span>
                    </div>
                </div>
            </div>

            {activeTab === 'home' && (
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
                                        <div className={`item-icon-bg ${item.type.toLowerCase()}`}>
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
            )}

            {activeTab === 'stats' && (
                <div className="history-section" style={{ background: 'transparent', padding: 0 }}>
                    <div className="chart-section">
                        <h3>Spending Overview (Last 7 Days)</h3>
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={getChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} dy={10} />
                                <YAxis axisLine={false} tickLine={false} fontSize={12} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                    contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="amount" fill="#0D47A1" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Bottom Navigation */}
            <div className="bottom-nav">
                <div className={`nav-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
                    <HomeOutlined />
                    <span>Home</span>
                </div>
                <div className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
                    <LineChartOutlined />
                    <span>Stats</span>
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

            {/* Top Up Request Modal */}
            <Modal
                title="Request Top Up Schedule"
                open={topUpModalVisible}
                onCancel={() => setTopUpModalVisible(false)}
                footer={null}
                centered
            >
                <div style={{ marginBottom: 20 }}>
                    <p style={{ color: '#666', fontSize: '14px', lineHeight: '1.5' }}>
                        Schedule a time to give cash to the admin to top up your account balance.
                        Please prepare the exact amount you wish to load and bring it to the admin
                        (<strong>Room 12 - Olivera Classroom</strong>) at the scheduled time.
                    </p>
                    <p style={{ color: '#888', fontSize: '13px', fontStyle: 'italic', marginTop: '10px' }}>
                        * Note: This is only a <strong>schedule request</strong>. Your balance will be updated
                        once the physical payment is collected by the admin.
                    </p>
                </div>

                <div style={{ marginBottom: 15 }}>
                    <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Schedule Date</label>
                    <DatePicker
                        style={{ width: '100%' }}
                        value={requestDate}
                        onChange={(d) => setRequestDate(d || dayjs())}
                        size="large"
                    />
                </div>

                <div style={{ marginBottom: 25 }}>
                    <label style={{ display: 'block', marginBottom: 5, fontWeight: 'bold' }}>Amount to Top Up (Points)</label>
                    <InputNumber
                        style={{ width: '100%' }}
                        value={requestAmount}
                        onChange={(v) => setRequestAmount(v || 10)}
                        min={1}
                        size="large"
                        prefix={<DollarOutlined />}
                    />
                </div>

                <Button type="primary" block size="large" onClick={handleTopUpRequest} icon={<SendOutlined />}>
                    Send Request to Admin
                </Button>
            </Modal>

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

