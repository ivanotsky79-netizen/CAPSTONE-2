import React, { useState, useEffect } from 'react';
import {
    Layout, Menu, Table, Button, Input, Form, Modal, message, Card, Statistic,
    Row, Col, Checkbox, Typography, Tag, Space, Tabs, DatePicker, InputNumber
} from 'antd';
import {
    UserOutlined, SearchOutlined, PlusOutlined, DeleteOutlined,
    HistoryOutlined, FileTextOutlined, DatabaseOutlined, LogoutOutlined,
    DollarOutlined, CreditCardOutlined, ShoppingCartOutlined, WalletOutlined, LockOutlined,
    QrcodeOutlined
} from '@ant-design/icons';
import { studentService, transactionService } from '../services/api';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import './AdminDashboard.css';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

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
            // Request global stats (includeGlobal = true)
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

    // Generate passkey from LRN
    const generatePasskeyFromLRN = (lrn) => {
        if (!lrn || lrn.length !== 12) {
            return '';
        }
        const passkey = lrn[2] + lrn[5] + lrn[8] + lrn[11];
        return passkey;
    };

    const handleLRNChange = (e) => {
        const lrn = e.target.value;
        if (lrn.length === 12) {
            const passkey = generatePasskeyFromLRN(lrn);
            setGeneratedPasskey(passkey);
        } else {
            setGeneratedPasskey('');
        }
    };

    const handleAddStudent = async (values) => {
        try {
            const passkey = generatePasskeyFromLRN(values.lrn);
            if (!passkey) {
                message.error('Invalid LRN. Must be 12 digits.');
                return;
            }

            await studentService.createStudent({
                fullName: values.fullName,
                gradeSection: values.gradeSection,
                lrn: values.lrn,
                passkey: passkey
            });

            message.success('Student added successfully!');
            setAddModalVisible(false);
            form.resetFields();
            setGeneratedPasskey('');
            fetchStudents();
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to add student');
        }
    };

    const handleRemoveStudents = () => {
        if (selectedRowKeys.length === 0) {
            message.warning('Please select students to remove');
            return;
        }

        Modal.confirm({
            title: 'Confirm Removal',
            content: `Are you sure you want to remove ${selectedRowKeys.length} student(s)?`,
            okText: 'Remove',
            okType: 'danger',
            onOk: async () => {
                try {
                    for (const id of selectedRowKeys) {
                        await studentService.deleteStudent(id);
                    }
                    message.success(`${selectedRowKeys.length} student(s) removed successfully`);
                    setSelectedRowKeys([]);
                    fetchStudents();
                } catch (err) {
                    message.error('Failed to remove students');
                }
            }
        });
    };

    const handleTopUp = async () => {
        if (!topUpAmount || topUpAmount <= 0) {
            message.warning('Please enter a valid amount');
            return;
        }

        if (!topUpPasskey) {
            message.warning('Please enter passkey/PIN');
            return;
        }

        setTopUpLoading(true);
        try {
            if (selectedStudent) {
                // STUDENT TOP UP
                // 1. Verify Passkey
                await studentService.verifyPasskey(selectedStudent.studentId, topUpPasskey);

                // 2. Perform Top Up
                await transactionService.topUp(selectedStudent.studentId, topUpAmount);
                message.success(`Successfully added SAR ${topUpAmount} to ${selectedStudent.fullName}`);
            } else {
                // SYSTEM WITHDRAWAL (No student selected)
                const maxWithdrawal = dailyStats.canteen?.cashCollected || 0;

                if (topUpAmount > maxWithdrawal) {
                    message.error(`Cannot withdraw more than Today's Cash Sales (SAR ${maxWithdrawal.toFixed(2)})`);
                    setTopUpLoading(false);
                    return;
                }

                if (topUpPasskey !== '170206') {
                    message.error('Invalid Admin Password');
                    setTopUpLoading(false);
                    return;
                }

                await transactionService.withdraw(topUpAmount, topUpPasskey);
                message.success(`Successfully withdrew SAR ${topUpAmount}`);
            }

            setTopUpModalVisible(false);
            setTopUpAmount(null);
            setTopUpPasskey('');
            fetchStudents();
            fetchDailyStats();
        } catch (err) {
            message.error(err.response?.data?.message || 'Transaction Failed');
        } finally {
            setTopUpLoading(false);
        }
    };

    const handleShowProfile = async (student) => {
        setSelectedStudent(student);
        setProfileModalVisible(true);
        setTransactionsLoading(true);
        try {
            const res = await transactionService.getTransactions(student.studentId);
            if (res.data.status === 'success') {
                setStudentTransactions(res.data.data);
            }
        } catch (err) {
            message.error('Failed to load transactions');
        } finally {
            setTransactionsLoading(false);
        }
    };

    const showQRCode = async (student) => {
        setSelectedStudent(student);
        setQrModalVisible(true);
    };

    const showTopUp = (student) => {
        setSelectedStudent(student);
        setTopUpAmount(null);
        setTopUpPasskey('');
        setTopUpModalVisible(true);
    };

    const showWithdraw = () => {
        setSelectedStudent(null);
        setTopUpAmount(null);
        setTopUpPasskey('');
        setTopUpModalVisible(true);
    };

    const downloadQRWithID = () => {
        const canvas = document.getElementById('qr-canvas');
        if (!canvas || !selectedStudent) return;

        // Create composite canvas
        const size = canvas.width;
        const newCanvas = document.createElement('canvas');
        newCanvas.width = size;
        newCanvas.height = size + 60; // Extra space for ID
        const ctx = newCanvas.getContext('2d');

        // White background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);

        // Draw QR
        ctx.drawImage(canvas, 0, 0);

        // Draw ID text
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(selectedStudent.studentId, size / 2, size + 40);

        // Download
        const url = newCanvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${selectedStudent.studentId}_QR.png`;
        link.href = url;
        link.click();
    };

    const filteredStudents = students.filter(s =>
        s.fullName?.toLowerCase().includes(searchText.toLowerCase()) ||
        s.studentId?.toLowerCase().includes(searchText.toLowerCase()) ||
        s.gradeSection?.toLowerCase().includes(searchText.toLowerCase())
    );

    const columns = [
        {
            title: 'Student ID',
            dataIndex: 'studentId',
            key: 'studentId',
            width: 150,
        },
        {
            title: 'Full Name',
            dataIndex: 'fullName',
            key: 'fullName',
            render: (text, record) => (
                <a onClick={() => handleShowProfile(record)} style={{ fontWeight: 'bold' }}>
                    {text}
                </a>
            ),
        },
        {
            title: 'Grade & Section',
            dataIndex: 'gradeSection',
            key: 'gradeSection',
            width: 150,
        },
        {
            title: 'Balance',
            dataIndex: 'balance',
            key: 'balance',
            width: 150,
            render: (bal) => (
                <Text strong style={{ color: bal < 0 ? '#d32f2f' : '#2E7D32' }}>
                    SAR {parseFloat(bal).toFixed(2)}
                </Text>
            ),
        },
        {
            title: 'Actions',
            key: 'actions',
            width: 200,
            render: (_, record) => (
                <Space>
                    <Button type="default" size="small" icon={<QrcodeOutlined />} onClick={() => showQRCode(record)}>
                        QR
                    </Button>
                    <Button type="primary" size="small" icon={<WalletOutlined />} onClick={() => showTopUp(record)}>
                        Top Up
                    </Button>
                </Space>
            ),
        },
    ];

    const rowSelection = {
        selectedRowKeys,
        onChange: (keys) => setSelectedRowKeys(keys),
    };

    const menuItems = [
        { key: 'users', icon: <UserOutlined />, label: 'Customers' },
        { key: 'transactions', icon: <ShoppingCartOutlined />, label: 'Sales' },
        { key: 'reports', icon: <FileTextOutlined />, label: 'Reports' },
        { key: 'systemdata', icon: <DatabaseOutlined />, label: 'System' },
    ];

    const renderContent = () => {
        switch (currentSection) {
            case 'users':
                return (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                            <Title level={4}>Student Management</Title>
                            <Space>
                                <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
                                    New Student
                                </Button>
                                <Button
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={handleRemoveStudents}
                                    disabled={selectedRowKeys.length === 0}
                                >
                                    Remove ({selectedRowKeys.length})
                                </Button>
                            </Space>
                        </div>

                        <Row gutter={16} style={{ marginBottom: 24 }}>
                            <Col span={8}>
                                <Card size="small">
                                    <Statistic title="Total Students" value={students.length} prefix={<UserOutlined />} />
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card size="small">
                                    <Statistic title="Total Prepaid Load" value={totalBalance.toFixed(2)} prefix="SAR" valueStyle={{ color: '#2E7D32' }} />
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card size="small">
                                    <Statistic title="Total Student Debt" value={totalCredit.toFixed(2)} prefix="SAR" valueStyle={{ color: '#d32f2f' }} />
                                </Card>
                            </Col>
                        </Row>

                        <Input
                            placeholder="Find/Scan Student..."
                            prefix={<SearchOutlined />}
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            style={{ marginBottom: 16, width: '100%' }}
                            size="large"
                        />

                        <Table
                            rowSelection={rowSelection}
                            columns={columns}
                            dataSource={filteredStudents}
                            rowKey="studentId"
                            loading={loading}
                            pagination={{ pageSize: 10 }}
                            size="middle"
                        />
                    </div>
                );

            case 'transactions':
                return (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Title level={4} style={{ margin: 0 }}>Today's Sales</Title>
                            <Button type="primary" danger onClick={showWithdraw}>
                                Withdraw Cash
                            </Button>
                        </div>

                        <Row gutter={16} style={{ marginBottom: 24 }}>
                            <Col span={6}>
                                <Card size="small">
                                    <Statistic title="Canteen Points" value={dailyStats.canteen?.totalSales?.toFixed(2) || '0.00'} suffix="Pts" valueStyle={{ color: '#1890ff' }} />
                                </Card>
                            </Col>
                            <Col span={6}>
                                <Card size="small">
                                    <Statistic title="Cash Collected" value={dailyStats.canteen?.cashCollected?.toFixed(2) || '0.00'} suffix="Pts" valueStyle={{ color: '#2E7D32' }} />
                                </Card>
                            </Col>
                            <Col span={6}>
                                <Card size="small">
                                    <Statistic title="Credit Given" value={dailyStats.canteen?.totalCredit?.toFixed(2) || '0.00'} suffix="Pts" valueStyle={{ color: '#d32f2f' }} />
                                </Card>
                            </Col>
                            <Col span={6}>
                                <Card size="small">
                                    <Statistic title="System Cash" value={dailyStats.system?.totalCashOnHand?.toFixed(2) || '0.00'} suffix="SAR" valueStyle={{ color: '#722ed1' }} />
                                </Card>
                            </Col>
                        </Row>

                        <Table
                            dataSource={dailyStats.canteen?.transactions || []}
                            columns={[
                                { title: 'Time', dataIndex: 'timestamp', render: (t) => new Date(t).toLocaleTimeString() },
                                { title: 'Student', dataIndex: 'studentName' },
                                { title: 'Amount', dataIndex: 'amount', render: (a) => `${parseFloat(a).toFixed(2)} Pts` },
                                { title: 'Type', render: (_, r) => r.type === 'TOPUP' ? <Tag color="blue">TOPUP</Tag> : <Tag color="green">SALE</Tag> }
                            ]}
                            rowKey={(record, index) => `${record.id}-${index}`}
                            pagination={{ pageSize: 10 }}
                            size="middle"
                        />
                    </div>
                );

            case 'systemdata':
                return (
                    <div>
                        <Title level={4}>System Overview</Title>
                        <Row gutter={16} style={{ marginBottom: 24 }}>
                            <Col span={8}>
                                <Card size="small">
                                    <Statistic title="Total System Cash" value={dailyStats.system?.totalCashOnHand?.toFixed(2) || '0.00'} prefix="SAR" valueStyle={{ color: '#3f8600' }} />
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card size="small">
                                    <Statistic title="Total Outstanding Debt" value={dailyStats.system?.totalDebt?.toFixed(2) || '0.00'} prefix="SAR" valueStyle={{ color: '#d32f2f' }} />
                                </Card>
                            </Col>
                        </Row>
                        <Table
                            dataSource={dailyStats.system?.transactions || []}
                            columns={[
                                { title: 'Time', dataIndex: 'timestamp', render: (t) => new Date(t).toLocaleTimeString() },
                                { title: 'Type', dataIndex: 'type', render: (t) => <Tag color={t === 'WITHDRAWAL' ? 'orange' : 'blue'}>{t}</Tag> },
                                { title: 'Amount', dataIndex: 'amount', render: (a) => `SAR ${parseFloat(a).toFixed(2)}` }
                            ]}
                            rowKey="id"
                        />
                    </div>
                );

            case 'reports':
                const reportTransactions = reportStats ?
                    [...(reportStats.canteen?.transactions || []), ...(reportStats.system?.transactions || [])]
                        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    : [];

                const reportColumns = [
                    { title: 'Time', dataIndex: 'timestamp', render: (t) => new Date(t).toLocaleTimeString() },
                    { title: 'Name', dataIndex: 'studentName' },
                    { title: 'Amount', dataIndex: 'amount', render: (a) => `${parseFloat(a).toFixed(2)} Pts` },
                    { title: 'Type', render: (_, r) => <Tag>{r.type}</Tag> }
                ];

                const navigateToMonth = (index) => {
                    setSelectedMonth(index);
                    setReportViewMode('days');
                };

                const navigateToDay = (day) => {
                    setSelectedDay(day);
                    const dateStr = `${currentYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    setReportDate(dateStr);
                    fetchReportStats(dateStr);
                    setReportViewMode('details');
                };

                return (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                            <Title level={4} style={{ margin: 0 }}>Historical Reports</Title>
                            {reportViewMode !== 'months' && <Button type="link" onClick={() => setReportViewMode('months')}>Change Month</Button>}
                            {reportViewMode === 'details' && <Button type="link" onClick={() => setReportViewMode('days')}>Change Day</Button>}
                        </div>

                        {reportViewMode === 'months' && (
                            <Row gutter={[16, 16]}>
                                {months.map((month, index) => (
                                    <Col span={6} key={month}>
                                        <Card hoverable onClick={() => navigateToMonth(index)} style={{ textAlign: 'center' }}>
                                            <HistoryOutlined style={{ fontSize: 24, marginBottom: 12, color: '#1890ff' }} />
                                            <Title level={5}>{month}</Title>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        )}

                        {reportViewMode === 'days' && (
                            <Row gutter={[8, 8]}>
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                    <Col span={3} key={day}>
                                        <Card hoverable onClick={() => navigateToDay(day)} style={{ textAlign: 'center' }}>
                                            <Text strong>{day}</Text>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        )}

                        {reportViewMode === 'details' && reportStats && (
                            <div>
                                <Row gutter={16} style={{ marginBottom: 24 }}>
                                    <Col span={8}><Card size="small"><Statistic title="Total Sales" value={reportStats.canteen?.totalSales?.toFixed(2)} suffix="Pts" /></Card></Col>
                                    <Col span={8}><Card size="small"><Statistic title="Points Collected" value={reportStats.canteen?.cashCollected?.toFixed(2)} suffix="Pts" valueStyle={{ color: '#2E7D32' }} /></Card></Col>
                                    <Col span={8}><Card size="small"><Statistic title="Credit" value={reportStats.canteen?.totalCredit?.toFixed(2)} suffix="Pts" valueStyle={{ color: '#d32f2f' }} /></Card></Col>
                                </Row>

                                <Table dataSource={reportTransactions} columns={reportColumns} rowKey={(r, i) => i} pagination={{ pageSize: 10 }} size="middle" />
                            </div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Layout className="layout" style={{ minHeight: '100vh' }}>
            <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: '#34495e', height: 64 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Title level={4} style={{ color: 'white', margin: '0 40px 0 0', minWidth: 150 }}>
                        FUGEN SmartPay
                    </Title>
                    <Menu
                        theme="dark"
                        mode="horizontal"
                        selectedKeys={[currentSection]}
                        items={menuItems}
                        onClick={({ key }) => setCurrentSection(key)}
                        style={{ background: '#34495e', borderBottom: 'none', width: 500 }}
                    />
                </div>
                <Space>
                    <Text style={{ color: '#bdc3c7' }}>Admin</Text>
                    <Button type="primary" danger icon={<LogoutOutlined />} onClick={onLogout}>
                        Logout
                    </Button>
                </Space>
            </Header>

            <Content style={{ padding: '24px 50px', background: '#f0f2f5' }}>
                <div style={{ background: '#fff', padding: 24, minHeight: '80vh', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    {renderContent()}
                </div>
            </Content>

            {/* Hidden QR Canvas */}
            <Modal title="Student QR Code" open={qrModalVisible} onCancel={() => setQrModalVisible(false)} footer={null}>
                {selectedStudent && (
                    <div style={{ textAlign: 'center' }}>
                        <Title level={4}>{selectedStudent.fullName}</Title>
                        <div style={{ margin: '20px 0' }}>
                            <canvas id="qr-canvas" ref={(canvas) => {
                                if (canvas && selectedStudent) {
                                    QRCode.toCanvas(canvas, `FUGEN:${selectedStudent.studentId}`, { width: 250, margin: 2 });
                                }
                            }} />
                        </div>
                        <Button type="primary" onClick={downloadQRWithID} icon={<QrcodeOutlined />}>
                            Download with ID
                        </Button>
                    </div>
                )}
            </Modal>

            {/* Other Modals (Add, TopUp, Profile) - Simplified Rendering */}
            <Modal title="Add New Student" open={addModalVisible} onCancel={() => setAddModalVisible(false)} footer={null}>
                <Form form={form} layout="vertical" onFinish={handleAddStudent}>
                    <Form.Item label="Full Name" name="fullName" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item label="Grade & Section" name="gradeSection" rules={[{ required: true }]}><Input /></Form.Item>
                    <Form.Item label="LRN (12-digit)" name="lrn" rules={[{ required: true, len: 12 }]}><Input maxLength={12} onChange={handleLRNChange} /></Form.Item>
                    {generatedPasskey && <Text type="success">Passkey: {generatedPasskey}</Text>}
                    <Button type="primary" htmlType="submit" style={{ marginTop: 16 }}>Add Student</Button>
                </Form>
            </Modal>

            <Modal title={selectedStudent ? 'Top Up' : 'Withdraw'} open={topUpModalVisible} onCancel={() => setTopUpModalVisible(false)} footer={null}>
                <InputNumber style={{ width: '100%', marginBottom: 16 }} size="large" min={1} value={topUpAmount} onChange={setTopUpAmount} prefix="SAR" placeholder="Amount" />
                <Input.Password style={{ width: '100%', marginBottom: 16 }} size="large" value={topUpPasskey} onChange={(e) => setTopUpPasskey(e.target.value)} placeholder="Passkey/PIN" />
                <Button type="primary" onClick={handleTopUp} loading={topUpLoading} block>Confirm</Button>
            </Modal>

            <Modal title="Profile" open={profileModalVisible} onCancel={() => setProfileModalVisible(false)} footer={null} width={700}>
                {selectedStudent && (
                    <div>
                        <Title level={4}>{selectedStudent.fullName}</Title>
                        <Text>ID: {selectedStudent.studentId}</Text>
                        <Table dataSource={studentTransactions} columns={[
                            { title: 'Time', dataIndex: 'timestamp', render: t => new Date(t).toLocaleString() },
                            { title: 'Type', dataIndex: 'type' },
                            { title: 'Amount', dataIndex: 'amount' }
                        ]} rowKey="id" size="small" pagination={{ pageSize: 5 }} loading={transactionsLoading} />
                    </div>
                )}
            </Modal>
        </Layout>
    );
}
