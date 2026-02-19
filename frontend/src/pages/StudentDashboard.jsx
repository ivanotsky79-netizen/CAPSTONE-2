import React, { useState, useEffect } from 'react';
import { Card, List, Button, Modal, message, Badge } from 'antd';
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
    DollarOutlined
} from '@ant-design/icons';
import { QRCodeCanvas } from 'qrcode.react';
import { transactionService, studentService } from '../services/api';
import './StudentDashboard.css';

export default function StudentDashboard({ user, onLogout }) {
    const [balanceVisible, setBalanceVisible] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [qrModalVisible, setQrModalVisible] = useState(false);
    const [studentData, setStudentData] = useState(user);

    if (!studentData) {
        return <div style={{ padding: 20, textAlign: 'center' }}>Loading user data...</div>;
    }

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [tRes, sRes] = await Promise.all([
                transactionService.getTransactions(user.studentId),
                studentService.getStudent(user.studentId)
            ]);
            setTransactions(tRes.data.data || []);
            setStudentData(sRes.data.data || sRes.data);
        } catch (err) {
            message.error('Failed to load student data');
        } finally {
            setLoading(false);
        }
    };

    const getIcon = (type) => {
        if (type === 'TOPUP') return <DollarOutlined style={{ color: '#52c41a' }} />;
        if (type === 'PURCHASE') return <ShoppingOutlined style={{ color: '#1890ff' }} />;
        return <ArrowDownOutlined style={{ color: '#ff4d4f' }} />;
    };

    return (
        <div className="student-app-container">
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
                <Badge dot color="red">
                    <BellOutlined className="notification-icon" />
                </Badge>
            </div>

            {/* Balance Card */}
            <div className="balance-card">
                <div className="card-top">
                    <span className="label">Balance</span>
                    <div className="balance-amount-row">
                        <span className="currency">SAR</span>
                        <span className="amount">
                            {balanceVisible ? parseFloat(studentData.balance).toFixed(2) : '****'}
                        </span>
                        <div className="toggle-visibility" onClick={() => setBalanceVisible(!balanceVisible)}>
                            {balanceVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                        </div>
                    </div>
                </div>
                <div className="card-bottom">
                    <span className="card-number">**** **** **** {(studentData.studentId || '0000').slice(-4)}</span>
                    <div className="chip"></div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="action-grid">
                <button className="action-btn primary" onClick={() => setQrModalVisible(true)}>
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
                    <h3>Transaction History</h3>
                    <a href="#" onClick={(e) => { e.preventDefault(); loadData(); }}>Refresh</a>
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
                                            {new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                                <div className={`item-amount ${item.type === 'TOPUP' ? 'positive' : ''}`}>
                                    {item.type === 'TOPUP' ? '+' : '-'} SAR {Math.abs(item.amount).toFixed(2)}
                                </div>
                            </List.Item>
                        )}
                    />
                </div>
            </div>

            {/* Bottom Navigation */}
            <div className="bottom-nav">
                <div className="nav-item active">
                    <HomeOutlined style={{ color: '#3B5ED2' }} />
                    <span style={{ color: '#3B5ED2' }}>Home</span>
                </div>
                <div className="nav-item" onClick={() => message.info('Digital Wallet coming soon!')}>
                    <WalletOutlined />
                    <span>Wallet</span>
                </div>
                <div className="nav-item logout" onClick={onLogout}>
                    <UserOutlined />
                    <span>Logout</span>
                </div>
            </div>

            {/* QR Modal */}
            <Modal
                title="Student Digital ID"
                visible={qrModalVisible}
                onCancel={() => setQrModalVisible(false)}
                footer={null}
                centered
                bodyStyle={{ textAlign: 'center', padding: '40px 20px' }}
            >
                <div className="qr-card">
                    <QRCodeCanvas value={studentData.studentId || 'NO_ID'} size={200} level="H" includeMargin={true} />
                    <h2 style={{ marginTop: 20, marginBottom: 5 }}>{studentData.fullName}</h2>
                    <p style={{ color: '#888' }}>ID: {studentData.studentId}</p>
                    <p style={{ fontWeight: 'bold', color: '#3B5ED2', fontSize: 18 }}>{studentData.gradeSection}</p>
                </div>
            </Modal>
        </div>
    );
}
