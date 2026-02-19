import React, { useState, useEffect } from 'react';
import {
    Layout, Table, Button, Input, Form, Modal, message, Card, Statistic,
    Row, Col, Typography, Tag, Space, Tabs, InputNumber
} from 'antd';
import {
    UserOutlined, SearchOutlined, PlusOutlined, DeleteOutlined,
    HistoryOutlined, FileTextOutlined, DatabaseOutlined, LogoutOutlined,
    ShoppingCartOutlined, WalletOutlined, QrcodeOutlined, BarChartOutlined,
    SettingOutlined
} from '@ant-design/icons';
import { studentService, transactionService } from '../services/api';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import './AdminDashboard.css';

const { Content } = Layout;
const { Title, Text } = Typography;

export default function AdminDashboard({ onLogout }) {
    const [currentSection, setCurrentSection] = useState('users');
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);

    // Modals
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [qrModalVisible, setQrModalVisible] = useState(false);
    const [topUpModalVisible, setTopUpModalVisible] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [generatedPasskey, setGeneratedPasskey] = useState('');

    // Top Up
    const [topUpAmount, setTopUpAmount] = useState(null);
    const [topUpPasskey, setTopUpPasskey] = useState('');
    const [topUpLoading, setTopUpLoading] = useState(false);

    // Profile Modal
    const [profileModalVisible, setProfileModalVisible] = useState(false);
    const [studentTransactions, setStudentTransactions] = useState([]);
    const [transactionsLoading, setTransactionsLoading] = useState(false);

    // Stats
    const [dailyStats, setDailyStats] = useState({
        canteen: { totalSales: 0, cashCollected: 0, totalCredit: 0, transactions: [] },
        system: { topups: 0, withdrawals: 0, totalCashOnHand: 0, totalDebt: 0, transactions: [] }
    });
    const [reportStats, setReportStats] = useState(null);
    const [reportDate, setReportDate] = useState(null);

    // Report Navigation
    const [reportViewMode, setReportViewMode] = useState('months'); // 'months', 'days', 'details'
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [selectedDay, setSelectedDay] = useState(null);
    const currentYear = new Date().getFullYear();
    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const [totalBalance, setTotalBalance] = useState(0);
    const [totalCredit, setTotalCredit] = useState(0);

    const [form] = Form.useForm();

    useEffect(() => {
        fetchStudents();
        fetchDailyStats();

        const socket = io('https://fugen-backend.onrender.com');
        socket.on('balanceUpdate', () => {
            fetchStudents();
            fetchDailyStats();
        });
        socket.on('studentCreated', () => {
            fetchStudents();
        });
        socket.on('studentDeleted', () => {
            fetchStudents();
        });

        return () => socket.disconnect();
    }, []);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await studentService.getAllStudents();
            const allStudents = res.data.data;
            setStudents(allStudents);

            const total = allStudents.reduce((acc, curr) => acc + (parseFloat(curr.balance) || 0), 0);
            setTotalBalance(total);

            const negativeStudents = allStudents.filter(s => parseFloat(s.balance) < 0);
            const creditSum = negativeStudents.reduce((acc, curr) => acc + Math.abs(parseFloat(curr.balance)), 0);
            setTotalCredit(creditSum);
        } catch (err) {
            message.error('Failed to fetch students');
        } finally {
            setLoading(false);
        }
    };

    const fetchDailyStats = async () => {
        try {
            const res = await transactionService.getDailyStats(null, true);
            if (res.data.status === 'success') {
                setDailyStats(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch daily stats:', err);
        }
    };

    const fetchReportStats = async (dateString) => {
        if (!dateString) return;
        try {
            const res = await transactionService.getDailyStats(dateString);
            if (res.data.status === 'success') {
                setReportStats(res.data.data);
            }
        } catch (err) {
            message.error('Failed to load report');
        }
    };

    const generatePasskeyFromLRN = (lrn) => {
        if (!lrn || lrn.length !== 12) return '';
        return lrn[2] + lrn[5] + lrn[8] + lrn[11];
    };

    const handleLRNChange = (e) => {
        const lrn = e.target.value;
        if (lrn.length === 12) {
            setGeneratedPasskey(generatePasskeyFromLRN(lrn));
        } else {
            setGeneratedPasskey('');
        }
    };

    const handleAddStudent = async (values) => {
        try {
            const passkey = generatePasskeyFromLRN(values.lrn);
            if (!passkey) {
                message.error('Invalid LRN.'); return;
            }
            await studentService.createStudent({ ...values, passkey });
            message.success('Student added successfully!');
            setAddModalVisible(false); form.resetFields(); setGeneratedPasskey('');
            fetchStudents();
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to add student');
        }
    };

    const handleRemoveStudents = () => {
        if (selectedRowKeys.length === 0) return;
        Modal.confirm({
            title: 'Confirm Removal',
            content: `Remove ${selectedRowKeys.length} student(s)?`,
            okText: 'Remove', okType: 'danger',
            onOk: async () => {
                try {
                    for (const id of selectedRowKeys) await studentService.deleteStudent(id);
                    message.success('Removed successfully'); setSelectedRowKeys([]); fetchStudents();
                } catch (err) { message.error('Failed'); }
            }
        });
    };

    const handleTopUp = async () => {
        if (!topUpAmount || topUpAmount <= 0) return;
        if (!topUpPasskey) { message.warning('Enter passkey'); return; }

        setTopUpLoading(true);
        try {
            if (selectedStudent) {
                await studentService.verifyPasskey(selectedStudent.studentId, topUpPasskey);
                await transactionService.topUp(selectedStudent.studentId, topUpAmount);
                message.success(`Added SAR ${topUpAmount} to ${selectedStudent.fullName}`);
            } else {
                const maxWithdrawal = dailyStats.canteen?.cashCollected || 0;
                if (topUpAmount > maxWithdrawal) {
                    message.error(`Start limit: SAR ${maxWithdrawal.toFixed(2)}`); setTopUpLoading(false); return;
                }
                if (topUpPasskey !== '170206') {
                    message.error('Invalid Admin PIN'); setTopUpLoading(false); return;
                }
                await transactionService.withdraw(topUpAmount, topUpPasskey);
                message.success(`Withdrew SAR ${topUpAmount}`);
            }
            setTopUpModalVisible(false); setTopUpAmount(null); setTopUpPasskey('');
            fetchStudents(); fetchDailyStats();
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed');
        } finally { setTopUpLoading(false); }
    };

    const handleShowProfile = async (student) => {
        setSelectedStudent(student); setProfileModalVisible(true); setTransactionsLoading(true);
        try {
            const res = await transactionService.getTransactions(student.studentId);
            setStudentTransactions(res.data.data || []);
        } catch (err) { } finally { setTransactionsLoading(false); }
    };

    const showQRCode = (student) => { setSelectedStudent(student); setQrModalVisible(true); };
    const showTopUp = (student) => { setSelectedStudent(student); setTopUpAmount(null); setTopUpPasskey(''); setTopUpModalVisible(true); };
    const showWithdraw = () => { setSelectedStudent(null); setTopUpAmount(null); setTopUpPasskey(''); setTopUpModalVisible(true); };

    const downloadQRWithID = () => {
        const canvas = document.getElementById('qr-canvas');
        if (!canvas || !selectedStudent) return;
        const size = canvas.width;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = size; newCanvas.height = size + 60;
        const ctx = newCanvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
        ctx.drawImage(canvas, 0, 0);
        ctx.fillStyle = '#000000'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center';
        ctx.fillText(selectedStudent.studentId, size / 2, size + 40);
        const link = document.createElement('a');
        link.download = `${selectedStudent.studentId}_QR.png`;
        link.href = newCanvas.toDataURL('image/png');
        link.click();
    };

    const filteredStudents = students.filter(s =>
        s.fullName?.toLowerCase().includes(searchText.toLowerCase()) ||
        s.studentId?.toLowerCase().includes(searchText.toLowerCase())
    );

    const renderContent = () => {
        switch (currentSection) {
            case 'users':
                return (
                    <div className="main-panel">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                            <Title level={4} className="section-title">Customers (Students)</Title>
                            <Space>
                                <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>New</Button>
                                <Button danger icon={<DeleteOutlined />} onClick={handleRemoveStudents} disabled={!selectedRowKeys.length}>Remove</Button>
                            </Space>
                        </div>
                        <Row gutter={16} style={{ marginBottom: 24 }}>
                            <Col span={8}><Card><Statistic title="Total Students" value={students.length} prefix={<UserOutlined />} /></Card></Col>
                            <Col span={8}><Card><Statistic title="Prepaid Load" value={totalBalance.toFixed(2)} prefix="SAR" valueStyle={{ color: '#2E7D32' }} /></Card></Col>
                            <Col span={8}><Card><Statistic title="Pending Debt" value={totalCredit.toFixed(2)} prefix="SAR" valueStyle={{ color: '#d32f2f' }} /></Card></Col>
                        </Row>
                        <Input placeholder="Search Student..." prefix={<SearchOutlined />} value={searchText} onChange={e => setSearchText(e.target.value)} style={{ marginBottom: 16 }} size="large" />
                        <Table
                            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
                            columns={[
                                { title: 'ID', dataIndex: 'studentId' },
                                { title: 'Name', dataIndex: 'fullName', render: (t, r) => <a onClick={() => handleShowProfile(r)}>{t}</a> },
                                { title: 'Grade', dataIndex: 'gradeSection' },
                                { title: 'Balance', dataIndex: 'balance', render: b => <Text strong style={{ color: b < 0 ? 'red' : 'green' }}>SAR {parseFloat(b).toFixed(2)}</Text> },
                                { title: 'Actions', render: (_, r) => <Space><Button size="small" icon={<QrcodeOutlined />} onClick={() => showQRCode(r)}>QR</Button><Button type="primary" size="small" icon={<WalletOutlined />} onClick={() => showTopUp(r)}>Top Up</Button></Space> }
                            ]}
                            dataSource={filteredStudents} rowKey="studentId" pagination={{ pageSize: 8 }} loading={loading}
                        />
                    </div>
                );
            case 'transactions':
                return (
                    <div className="main-panel">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                            <Title level={4} className="section-title">Today's Sales</Title>
                            <Button danger onClick={showWithdraw}>Withdraw Cash</Button>
                        </div>
                        <Row gutter={16} style={{ marginBottom: 24 }}>
                            <Col span={6}><Card><Statistic title="Sales" value={dailyStats.canteen?.totalSales?.toFixed(2)} suffix="Pts" valueStyle={{ color: '#1890ff' }} /></Card></Col>
                            <Col span={6}><Card><Statistic title="Cash Collected" value={dailyStats.canteen?.cashCollected?.toFixed(2)} suffix="Pts" valueStyle={{ color: '#2E7D32' }} /></Card></Col>
                            <Col span={6}><Card><Statistic title="System Cash" value={dailyStats.system?.totalCashOnHand?.toFixed(2)} suffix="SAR" valueStyle={{ color: '#722ed1' }} /></Card></Col>
                        </Row>
                        <Table dataSource={dailyStats.canteen?.transactions || []} columns={[
                            { title: 'Time', dataIndex: 'timestamp', render: t => new Date(t).toLocaleTimeString() },
                            { title: 'Student', dataIndex: 'studentName' },
                            { title: 'Amount', dataIndex: 'amount', render: a => `${parseFloat(a).toFixed(2)} Pts` },
                            { title: 'Type', render: (_, r) => <Tag color={r.type === 'TOPUP' ? 'blue' : 'green'}>{r.type}</Tag> }
                        ]} rowKey={(r, i) => i} pagination={{ pageSize: 8 }} />
                    </div>
                );
            case 'reports':
                const txns = reportStats ? [...(reportStats.canteen?.transactions || []), ...(reportStats.system?.transactions || [])].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) : [];
                return (
                    <div className="main-panel">
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                            <Title level={4} className="section-title">Historical Reports</Title>
                            {reportViewMode !== 'months' && <Button type="link" onClick={() => setReportViewMode('months')}>Change Month</Button>}
                            {reportViewMode === 'details' && <Button type="link" onClick={() => setReportViewMode('days')}>Change Day</Button>}
                        </div>
                        {reportViewMode === 'months' && <Row gutter={[16, 16]}>{months.map((m, i) => <Col span={6} key={m}><Card hoverable onClick={() => { setSelectedMonth(i); setReportViewMode('days'); }}><HistoryOutlined style={{ fontSize: 24, color: '#1890ff' }} /><Title level={5}>{m}</Title></Card></Col>)}</Row>}
                        {reportViewMode === 'days' && <Row gutter={[8, 8]}>{Array.from({ length: 31 }, (_, i) => i + 1).map(d => <Col span={3} key={d}><Card hoverable onClick={() => { setSelectedDay(d); const dt = `${currentYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`; setReportDate(dt); fetchReportStats(dt); setReportViewMode('details'); }}><Text strong>{d}</Text></Card></Col>)}</Row>}
                        {reportViewMode === 'details' && reportStats && (
                            <div>
                                <Row gutter={16} style={{ marginBottom: 24 }}>
                                    <Col span={8}><Card><Statistic title="Total Sales" value={reportStats.canteen?.totalSales?.toFixed(2)} suffix="Pts" /></Card></Col>
                                    <Col span={8}><Card><Statistic title="Cash Collected" value={reportStats.canteen?.cashCollected?.toFixed(2)} suffix="Pts" valueStyle={{ color: '#2E7D32' }} /></Card></Col>
                                    <Col span={8}><Card><Statistic title="Credit" value={reportStats.canteen?.totalCredit?.toFixed(2)} suffix="Pts" valueStyle={{ color: '#d32f2f' }} /></Card></Col>
                                </Row>
                                <Table dataSource={txns} columns={[{ title: 'Time', dataIndex: 'timestamp', render: t => new Date(t).toLocaleTimeString() }, { title: 'Name', dataIndex: 'studentName' }, { title: 'Amount', dataIndex: 'amount', render: a => `${parseFloat(a).toFixed(2)} Pts` }, { title: 'Type', render: (_, r) => <Tag>{r.type}</Tag> }]} rowKey={(r, i) => i} pagination={{ pageSize: 8 }} />
                            </div>
                        )}
                    </div>
                );
            case 'systemdata':
                return (
                    <div className="main-panel">
                        <Title level={4} className="section-title">System Overview</Title>
                        <Row gutter={16} style={{ marginBottom: 24 }}>
                            <Col span={8}><Card><Statistic title="Total System Cash" value={dailyStats.system?.totalCashOnHand?.toFixed(2)} prefix="SAR" valueStyle={{ color: '#3f8600' }} /></Card></Col>
                            <Col span={8}><Card><Statistic title="Outstanding Debt" value={dailyStats.system?.totalDebt?.toFixed(2)} prefix="SAR" valueStyle={{ color: '#d32f2f' }} /></Card></Col>
                        </Row>
                        <Table dataSource={dailyStats.system?.transactions || []} columns={[{ title: 'Time', dataIndex: 'timestamp', render: t => new Date(t).toLocaleTimeString() }, { title: 'Type', dataIndex: 'type', render: t => <Tag color={t === 'WITHDRAWAL' ? 'orange' : 'blue'}>{t}</Tag> }, { title: 'Amount', dataIndex: 'amount', render: a => `SAR ${parseFloat(a).toFixed(2)}` }]} rowKey="id" />
                    </div>
                );
            default: return null;
        }
    };

    return (
        <Layout className="ospos-layout" style={{ minHeight: '100vh' }}>
            {/* OSPOS Header */}
            <div className="ospos-header">
                <div className="ospos-logo">FUGEN SmartPay</div>
                <div className="ospos-header-actions">
                    <Text style={{ color: '#bdc3c7' }}>{new Date().toLocaleDateString()}</Text>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#95a5a6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <UserOutlined />
                        </div>
                        <Text style={{ color: '#ecf0f1' }}>Admin</Text>
                    </div>
                    <Button type="primary" danger icon={<LogoutOutlined />} onClick={onLogout} size="small">Logout</Button>
                </div>
            </div>

            {/* OSPOS Navigation Bar */}
            <div className="ospos-nav-bar">
                <div className={`nav-item users ${currentSection === 'users' ? 'active' : ''}`} onClick={() => setCurrentSection('users')}>
                    <div className="nav-icon"><UserOutlined style={{ color: 'white' }} /></div>
                    <span className="nav-text">Customers</span>
                </div>
                <div className={`nav-item transactions ${currentSection === 'transactions' ? 'active' : ''}`} onClick={() => setCurrentSection('transactions')}>
                    <div className="nav-icon"><ShoppingCartOutlined style={{ color: 'white' }} /></div>
                    <span className="nav-text">Sales</span>
                </div>
                <div className={`nav-item reports ${currentSection === 'reports' ? 'active' : ''}`} onClick={() => setCurrentSection('reports')}>
                    <div className="nav-icon"><BarChartOutlined style={{ color: 'white' }} /></div>
                    <span className="nav-text">Reports</span>
                </div>
                <div className={`nav-item systemdata ${currentSection === 'systemdata' ? 'active' : ''}`} onClick={() => setCurrentSection('systemdata')}>
                    <div className="nav-icon"><SettingOutlined style={{ color: 'white' }} /></div>
                    <span className="nav-text">System</span>
                </div>
            </div>

            <Content className="ospos-content">
                {renderContent()}
            </Content>

            {/* Hidden QR Canvas */}
            <Modal title="Student QR Code" open={qrModalVisible} onCancel={() => setQrModalVisible(false)} footer={null}>
                {selectedStudent && (
                    <div style={{ textAlign: 'center' }}>
                        <Title level={4}>{selectedStudent.fullName}</Title>
                        <div style={{ margin: '20px 0' }}>
                            <canvas id="qr-canvas" ref={c => { if (c && selectedStudent) QRCode.toCanvas(c, `FUGEN:${selectedStudent.studentId}`, { width: 250, margin: 2 }); }} />
                        </div>
                        <Button type="primary" onClick={downloadQRWithID} icon={<QrcodeOutlined />}>Download with ID</Button>
                    </div>
                )}
            </Modal>

            {/* Other Modals */}
            <Modal title="Add New Student" open={addModalVisible} onCancel={() => setAddModalVisible(false)} footer={null}>
                <Form form={form} layout="vertical" onFinish={handleAddStudent}>
                    <Form.Item label="Full Name" name="fullName" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item label="Grade & Section" name="gradeSection" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item label="LRN (12-digit)" name="lrn" rules={[{ required: true, len: 12 }]}><Input maxLength={12} onChange={handleLRNChange} /></Form.Item>
                    {generatedPasskey && <Text type="success">Passkey: {generatedPasskey}</Text>}
                    <Button type="primary" htmlType="submit" style={{ marginTop: 16 }} block>Add Student</Button>
                </Form>
            </Modal>

            <Modal title={selectedStudent ? 'Top Up' : 'Withdraw'} open={topUpModalVisible} onCancel={() => setTopUpModalVisible(false)} footer={null}>
                <InputNumber style={{ width: '100%', marginBottom: 16 }} size="large" min={1} value={topUpAmount} onChange={setTopUpAmount} prefix="SAR" placeholder="Amount" />
                <Input.Password style={{ width: '100%', marginBottom: 16 }} size="large" value={topUpPasskey} onChange={e => setTopUpPasskey(e.target.value)} placeholder="Passkey/PIN" />
                <Button type="primary" onClick={handleTopUp} loading={topUpLoading} block>Confirm</Button>
            </Modal>

            <Modal title="Profile" open={profileModalVisible} onCancel={() => setProfileModalVisible(false)} footer={null} width={700}>
                {selectedStudent && (<div><Title level={4}>{selectedStudent.fullName}</Title><Text>ID: {selectedStudent.studentId}</Text><Table dataSource={studentTransactions} columns={[{ title: 'Time', dataIndex: 'timestamp', render: t => new Date(t).toLocaleString() }, { title: 'Type', dataIndex: 'type' }, { title: 'Amount', dataIndex: 'amount' }]} rowKey="id" size="small" pagination={{ pageSize: 5 }} loading={transactionsLoading} /></div>)}
            </Modal>
        </Layout>
    );
}
