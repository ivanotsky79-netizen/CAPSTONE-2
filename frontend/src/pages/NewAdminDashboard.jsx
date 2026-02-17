import React, { useState, useEffect } from 'react';
import {
    Layout, Menu, Table, Button, Input, Form, Modal, message, Card, Statistic,
    Row, Col, Checkbox, Typography, Tag, Space, Tabs, DatePicker, InputNumber
} from 'antd';
import {
    UserOutlined, SearchOutlined, PlusOutlined, DeleteOutlined,
    HistoryOutlined, FileTextOutlined, DatabaseOutlined, LogoutOutlined,
    DollarOutlined, CreditCardOutlined, ShoppingCartOutlined, WalletOutlined, LockOutlined
} from '@ant-design/icons';
import { studentService, transactionService } from '../services/api';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import './AdminDashboard.css';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

export default function AdminDashboard({ onLogout }) {
    const [collapsed, setCollapsed] = useState(false);
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
        totalSales: 0,
        totalCash: 0,
        totalCredit: 0,
        todayCreditSales: 0,
        allTransactions: [],
        creditList: [],
        cashList: []
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

        const socket = io('https://0028afc3-f39b-496c-a4a7-0daee7c3afcc-00-28bvg4oui5u20.pike.replit.dev');
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
                // Enforce limit: Cannot withdraw more than today's POS Cash Collected
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
        setSelectedStudent(null); // Null student means Withdrawal
        setTopUpAmount(null);
        setTopUpPasskey('');
        setTopUpModalVisible(true);
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
                    <Button type="link" size="small" onClick={() => showQRCode(record)}>
                        QR Code
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
        { key: 'users', icon: <UserOutlined />, label: 'Students' },
        { key: 'transactions', icon: <ShoppingCartOutlined />, label: 'Canteen Transactions' },
        { key: 'systemdata', icon: <DatabaseOutlined />, label: 'System Overview' },
        { key: 'reports', icon: <FileTextOutlined />, label: 'Historical Reports' },
    ];

    const renderContent = () => {
        switch (currentSection) {
            case 'users':
                return (
                    <div>
                        <Title level={3}>Student Management</Title>

                        <Row gutter={16} style={{ marginBottom: 24 }}>
                            <Col span={8}>
                                <Card>
                                    <Statistic
                                        title="Total Students"
                                        value={students.length}
                                        prefix={<UserOutlined />}
                                    />
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card>
                                    <Statistic
                                        title="Total Prepaid Load"
                                        value={totalBalance.toFixed(2)}
                                        prefix="SAR"
                                        valueStyle={{ color: '#2E7D32' }}
                                    />
                                </Card>
                            </Col>
                            <Col span={8}>
                                <Card>
                                    <Statistic
                                        title="Total Student Debt"
                                        value={totalCredit.toFixed(2)}
                                        prefix="SAR"
                                        valueStyle={{ color: '#d32f2f' }}
                                    />
                                </Card>
                            </Col>
                        </Row>

                        <Tabs defaultActiveKey="all" type="card" style={{ marginTop: 16 }}>
                            <TabPane tab="All Students" key="all">
                                <Space style={{ marginBottom: 16 }}>
                                    <Input
                                        placeholder="Search by name, ID, or grade..."
                                        prefix={<SearchOutlined />}
                                        value={searchText}
                                        onChange={(e) => setSearchText(e.target.value)}
                                        style={{ width: 300 }}
                                    />
                                    <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalVisible(true)}>
                                        Add Student
                                    </Button>
                                    <Button
                                        danger
                                        icon={<DeleteOutlined />}
                                        onClick={handleRemoveStudents}
                                        disabled={selectedRowKeys.length === 0}
                                    >
                                        Remove Selected ({selectedRowKeys.length})
                                    </Button>
                                </Space>

                                <Table
                                    rowSelection={rowSelection}
                                    columns={columns}
                                    dataSource={filteredStudents}
                                    rowKey="studentId"
                                    loading={loading}
                                    pagination={{ pageSize: 10 }}
                                />
                            </TabPane>
                            <TabPane tab="Students with Credit" key="credit">
                                <Table
                                    columns={columns}
                                    dataSource={students.filter(s => parseFloat(s.balance) < 0)}
                                    rowKey="studentId"
                                    loading={loading}
                                    pagination={{ pageSize: 10 }}
                                />
                            </TabPane>
                        </Tabs>
                    </div >
                );

            case 'transactions':
                return (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Title level={3} style={{ margin: 0 }}>Canteen Transactions <Text type="secondary" style={{ fontSize: '16px' }}>(Today)</Text></Title>
                            <Button type="primary" danger size="large" onClick={showWithdraw}>
                                Withdraw Cash
                            </Button>
                        </div>

                        <Row gutter={16} style={{ marginBottom: 24 }}>
                            <Col span={6}>
                                <Card>
                                    <Statistic
                                        title="Today's Canteen Points"
                                        value={dailyStats.canteen?.totalSales?.toFixed(2) || '0.00'}
                                        prefix={<ShoppingCartOutlined />}
                                        suffix="Pts"
                                        valueStyle={{ color: '#1890ff' }}
                                    />
                                </Card>
                            </Col>
                            <Col span={6}>
                                <Card>
                                    <Statistic
                                        title="Today's Points Collected"
                                        value={dailyStats.canteen?.cashCollected?.toFixed(2) || '0.00'}
                                        prefix={<DollarOutlined />}
                                        suffix="Pts"
                                        valueStyle={{ color: '#2E7D32' }}
                                    />
                                </Card>
                            </Col>
                            <Col span={6}>
                                <Card>
                                    <Statistic
                                        title="Today's Credit Points"
                                        value={dailyStats.canteen?.totalCredit?.toFixed(2) || '0.00'}
                                        prefix={<CreditCardOutlined />}
                                        suffix="Pts"
                                        valueStyle={{ color: '#d32f2f' }}
                                    />
                                </Card>
                            </Col>
                            <Col span={6}>
                                <Card>
                                    <Statistic
                                        title="System Cash Balance"
                                        value={dailyStats.system?.totalCashOnHand?.toFixed(2) || '0.00'}
                                        prefix={<WalletOutlined />}
                                        suffix="SAR"
                                        valueStyle={{ color: '#722ed1' }}
                                    />
                                </Card>
                            </Col>
                        </Row>

                        <Tabs defaultActiveKey="all" type="card">
                            <TabPane tab="All Transactions" key="all">
                                <Table
                                    dataSource={dailyStats.canteen?.transactions || []}
                                    columns={[
                                        { title: 'Time', dataIndex: 'timestamp', render: (t) => new Date(t).toLocaleTimeString() },
                                        { title: 'Student ID', dataIndex: 'studentId' },
                                        { title: 'Name', dataIndex: 'studentName' },
                                        { title: 'Grade', dataIndex: 'grade' },
                                        { title: 'Amount', dataIndex: 'amount', render: (a) => `${parseFloat(a).toFixed(2)} Pts` },
                                        {
                                            title: 'Type',
                                            render: (_, record) => {
                                                if (record.type === 'TOPUP') return <Tag color="blue">TOPUP</Tag>;
                                                const hasCash = record.cashAmount > 0;
                                                const hasCredit = record.creditAmount > 0;
                                                if (hasCash && hasCredit) return <Tag color="orange">MIXED</Tag>;
                                                if (hasCredit) return <Tag color="red">CREDIT</Tag>;
                                                return <Tag color="green">POINTS</Tag>;
                                            }
                                        }
                                    ]}
                                    rowKey={(record, index) => `${record.id}-${index}`}
                                    pagination={{ pageSize: 10 }}
                                />
                            </TabPane>
                            <TabPane tab="Cash Sales" key="cash">
                                <Table
                                    dataSource={(dailyStats.canteen?.transactions || []).filter(t => t.cashAmount > 0)}
                                    columns={[
                                        { title: 'Time', dataIndex: 'timestamp', render: (t) => new Date(t).toLocaleTimeString() },
                                        { title: 'Student ID', dataIndex: 'studentId' },
                                        { title: 'Name', dataIndex: 'studentName' },
                                        { title: 'Grade', dataIndex: 'grade' },
                                        { title: 'Total Amount', dataIndex: 'amount', render: (a) => `${parseFloat(a).toFixed(2)} Pts` },
                                        { title: 'Points Paid', dataIndex: 'cashAmount', render: (a) => <Text strong style={{ color: '#2E7D32' }}>{parseFloat(a).toFixed(2)} Pts</Text> },
                                        {
                                            title: 'Type',
                                            render: (_, record) => <Tag color="green">POINTS</Tag>
                                        }
                                    ]}
                                    rowKey={(record, index) => `cash-${record.id}-${index}`}
                                    pagination={{ pageSize: 10 }}
                                />
                            </TabPane>
                            <TabPane tab="Credit Sales" key="credit">
                                <Table
                                    dataSource={(dailyStats.canteen?.transactions || []).filter(t => t.creditAmount > 0)}
                                    columns={[
                                        { title: 'Time', dataIndex: 'timestamp', render: (t) => new Date(t).toLocaleTimeString() },
                                        { title: 'Student ID', dataIndex: 'studentId' },
                                        { title: 'Name', dataIndex: 'studentName' },
                                        { title: 'Grade', dataIndex: 'grade' },
                                        { title: 'Total Amount', dataIndex: 'amount', render: (a) => `${parseFloat(a).toFixed(2)} Pts` },
                                        { title: 'Credit Used', dataIndex: 'creditAmount', render: (a) => <Text strong style={{ color: '#d32f2f' }}>{parseFloat(a).toFixed(2)} Pts</Text> },
                                        {
                                            title: 'Type',
                                            render: (_, record) => <Tag color="red">CREDIT</Tag>
                                        }
                                    ]}
                                    rowKey={(record, index) => `credit-${record.id}-${index}`}
                                    pagination={{ pageSize: 10 }}
                                />
                            </TabPane>
                        </Tabs>
                    </div>
                );

            case 'systemdata':
                return (
                    <div>
                        <Title level={3}>System Overview</Title>
                        <Row gutter={16} style={{ marginBottom: 24 }}>
                            <Col span={6}>
                                <Card>
                                    <Statistic
                                        title="Total System Cash"
                                        value={dailyStats.system?.totalCashOnHand?.toFixed(2) || '0.00'}
                                        prefix="SAR"
                                        valueStyle={{ color: '#3f8600' }}
                                    />
                                </Card>
                            </Col>
                            <Col span={6}>
                                <Card>
                                    <Statistic
                                        title="Total Outstanding Debt"
                                        value={dailyStats.system?.totalDebt?.toFixed(2) || '0.00'}
                                        prefix="SAR"
                                        valueStyle={{ color: '#d32f2f' }}
                                    />
                                </Card>
                            </Col>
                            <Col span={6}>
                                <Card>
                                    <Statistic
                                        title="Today's Top-Ups"
                                        value={dailyStats.system?.todayTopups?.toFixed(2) || '0.00'}
                                        prefix="SAR"
                                        valueStyle={{ color: '#1890ff' }}
                                    />
                                </Card>
                            </Col>
                            <Col span={6}>
                                <Card>
                                    <Statistic
                                        title="Today's Withdrawals"
                                        value={dailyStats.system?.todayWithdrawals?.toFixed(2) || '0.00'}
                                        prefix="SAR"
                                        valueStyle={{ color: '#faad14' }}
                                    />
                                </Card>
                            </Col>
                        </Row>

                        <Card title="System Transactions (Top-ups & Withdrawals)">
                            <Table
                                dataSource={dailyStats.system?.transactions || []}
                                columns={[
                                    { title: 'Time', dataIndex: 'timestamp', render: (t) => new Date(t).toLocaleTimeString() },
                                    { title: 'Student', dataIndex: 'studentName', render: (text) => text || 'System Admin' },
                                    { title: 'Type', dataIndex: 'type', render: (t) => <Tag color={t === 'WITHDRAWAL' ? 'orange' : 'blue'}>{t}</Tag> },
                                    { title: 'Amount', dataIndex: 'amount', render: (a) => `SAR ${parseFloat(a).toFixed(2)}` }
                                ]}
                                rowKey="id"
                            />
                        </Card>
                    </div>
                );

            case 'reports':
                const reportTransactions = reportStats ?
                    [...(reportStats.canteen?.transactions || []), ...(reportStats.system?.transactions || [])]
                        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    : [];
                const reportColumns = [
                    { title: 'Time', dataIndex: 'timestamp', render: (t) => new Date(t).toLocaleTimeString() },
                    { title: 'Student ID', dataIndex: 'studentId' },
                    { title: 'Name', dataIndex: 'studentName' },
                    { title: 'Amount', dataIndex: 'amount', render: (a) => `${parseFloat(a).toFixed(2)} Pts` },
                    {
                        title: 'Type',
                        render: (_, record) => {
                            if (record.type === 'TOPUP') return <Tag color="blue">TOPUP</Tag>;
                            if (record.type === 'WITHDRAWAL') return <Tag color="orange">WITHDRAWAL</Tag>;
                            const hasCash = record.cashAmount > 0;
                            const hasCredit = record.creditAmount > 0;
                            if (hasCash && hasCredit) return <Tag color="orange">MIXED</Tag>;
                            if (hasCredit) return <Tag color="red">CREDIT</Tag>;
                            return <Tag color="green">POINTS</Tag>;
                        }
                    }
                ];

                const navigateToMonth = (index) => {
                    if (index > new Date().getMonth() && currentYear === new Date().getFullYear()) {
                        message.warning('Cannot view future months');
                        return;
                    }
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

                const resetView = () => {
                    setReportViewMode('months');
                    setSelectedMonth(null);
                    setSelectedDay(null);
                    setReportStats(null);
                };

                return (
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
                            <Title level={3} style={{ margin: 0 }}>Historical Reports</Title>
                            {reportViewMode !== 'months' && (
                                <Button type="link" onClick={() => setReportViewMode('months')} style={{ marginLeft: 16 }}>
                                    Change Month
                                </Button>
                            )}
                            {reportViewMode === 'details' && (
                                <Button type="link" onClick={() => setReportViewMode('days')}>
                                    Change Day
                                </Button>
                            )}
                        </div>

                        {reportViewMode === 'months' && (
                            <Row gutter={[16, 16]}>
                                {months.map((month, index) => {
                                    const isFuture = index > new Date().getMonth() && currentYear === new Date().getFullYear();
                                    return (
                                        <Col span={6} key={month}>
                                            <Card
                                                hoverable={!isFuture}
                                                className={isFuture ? 'disabled-card' : ''}
                                                onClick={() => !isFuture && navigateToMonth(index)}
                                                style={{ textAlign: 'center', cursor: isFuture ? 'not-allowed' : 'pointer' }}
                                            >
                                                <HistoryOutlined style={{ fontSize: 32, color: isFuture ? '#808080' : '#000080', marginBottom: 12 }} />
                                                <Title level={4} style={{ color: isFuture ? '#808080' : '#000000' }}>{month}</Title>
                                                <Text style={{ color: isFuture ? '#808080' : '#000000' }}>{currentYear}</Text>
                                            </Card>
                                        </Col>
                                    );
                                })}
                            </Row>
                        )}

                        {reportViewMode === 'days' && (
                            <div>
                                <div style={{ marginBottom: 16 }}>
                                    <Title level={4}>{months[selectedMonth]} {currentYear}</Title>
                                    <Button onClick={() => setReportViewMode('months')}>Back to Months</Button>
                                </div>
                                <Row gutter={[8, 8]}>
                                    {Array.from({ length: new Date(currentYear, selectedMonth + 1, 0).getDate() }, (_, i) => i + 1).map(day => {
                                        const date = new Date(currentYear, selectedMonth, day);
                                        const isFuture = date > new Date();
                                        return (
                                            <Col span={3} key={day}>
                                                <Card
                                                    hoverable={!isFuture}
                                                    onClick={() => !isFuture && navigateToDay(day)}
                                                    className={isFuture ? 'disabled-card' : ''}
                                                    style={{
                                                        textAlign: 'center',
                                                        cursor: isFuture ? 'not-allowed' : 'pointer',
                                                    }}
                                                >
                                                    <Title level={5} style={{ margin: 0, color: isFuture ? '#808080' : '#000000' }}>{day}</Title>
                                                </Card>
                                            </Col>
                                        );
                                    })}
                                </Row>
                            </div>
                        )}

                        {reportViewMode === 'details' && (
                            <div>
                                <div style={{ marginBottom: 16 }}>
                                    <Title level={4}>Report for {months[selectedMonth]} {selectedDay}, {currentYear}</Title>
                                    <Button onClick={() => setReportViewMode('days')}>Back to Days</Button>
                                </div>

                                {reportStats ? (
                                    <>
                                        <Row gutter={16} style={{ marginBottom: 24 }}>
                                            <Col span={8}>
                                                <Card>
                                                    <Statistic
                                                        title="Total Sales"
                                                        value={reportStats.totalSales?.toFixed(2)}
                                                        prefix={<ShoppingCartOutlined />}
                                                        suffix="Pts"
                                                    />
                                                </Card>
                                            </Col>
                                            <Col span={8}>
                                                <Card>
                                                    <Statistic
                                                        title="Points Collected"
                                                        value={reportStats.totalCash?.toFixed(2)}
                                                        prefix={<DollarOutlined />}
                                                        suffix="Pts"
                                                        valueStyle={{ color: '#2E7D32' }}
                                                    />
                                                </Card>
                                            </Col>
                                            <Col span={8}>
                                                <Card>
                                                    <Statistic
                                                        title="Total Credit"
                                                        value={reportStats.todayCreditSales?.toFixed(2)}
                                                        prefix={<CreditCardOutlined />}
                                                        suffix="Pts"
                                                        valueStyle={{ color: '#d32f2f' }}
                                                    />
                                                </Card>
                                            </Col>
                                        </Row>

                                        <Card title={`Transactions List`}>
                                            <Tabs defaultActiveKey="all" type="card">
                                                <TabPane tab="All Transactions" key="all">
                                                    <Table
                                                        dataSource={reportTransactions}
                                                        columns={reportColumns}
                                                        rowKey={(record, index) => `rep-all-${index}`}
                                                        pagination={{ pageSize: 10 }}
                                                    />
                                                </TabPane>
                                                <TabPane tab="Purchases" key="purchases">
                                                    <Table
                                                        dataSource={reportTransactions.filter(t => t.type === 'PURCHASE' || !t.type)}
                                                        columns={reportColumns}
                                                        rowKey={(record, index) => `rep-pur-${index}`}
                                                        pagination={{ pageSize: 10 }}
                                                    />
                                                </TabPane>
                                                <TabPane tab="Top-ups" key="topups">
                                                    <Table
                                                        dataSource={reportTransactions.filter(t => t.type === 'TOPUP')}
                                                        columns={reportColumns}
                                                        rowKey={(record, index) => `rep-top-${index}`}
                                                        pagination={{ pageSize: 10 }}
                                                    />
                                                </TabPane>
                                                <TabPane tab="Credits" key="credits">
                                                    <Table
                                                        dataSource={reportTransactions.filter(t => t.creditAmount > 0)}
                                                        columns={reportColumns}
                                                        rowKey={(record, index) => `rep-cred-${index}`}
                                                        pagination={{ pageSize: 10 }}
                                                    />
                                                </TabPane>
                                            </Tabs>
                                        </Card>
                                    </>
                                ) : (
                                    <div style={{ padding: 40, textAlign: 'center', background: '#f5f5f5', borderRadius: 8 }}>
                                        <Text>Loading report data...</Text>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="dark">
                <div className="logo">
                    <Title level={4} style={{ color: 'white', padding: '16px', margin: 0 }}>
                        {collapsed ? 'FS' : 'FUGEN SmartPay'}
                    </Title>
                </div>
                <Menu
                    theme="dark"
                    selectedKeys={[currentSection]}
                    mode="inline"
                    items={menuItems}
                    onClick={({ key }) => setCurrentSection(key)}
                />
                <div style={{ position: 'absolute', bottom: 20, width: '100%', padding: '0 16px' }}>
                    <Button
                        type="text"
                        icon={<LogoutOutlined />}
                        onClick={onLogout}
                        style={{ color: 'white', width: '100%' }}
                    >
                        {!collapsed && 'Logout'}
                    </Button>
                </div>
            </Sider>

            <Layout>
                <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Title level={4} style={{ margin: 0 }}>Admin Dashboard</Title>
                    <Text type="secondary">{new Date().toLocaleDateString()}</Text>
                </Header>

                <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', minHeight: 280 }}>
                    {renderContent()}
                </Content>
            </Layout>

            {/* Add Student Modal */}
            <Modal
                title="Add New Student"
                open={addModalVisible}
                onCancel={() => {
                    setAddModalVisible(false);
                    form.resetFields();
                    setGeneratedPasskey('');
                }}
                footer={null}
                width={600}
            >
                <Form form={form} layout="vertical" onFinish={handleAddStudent}>
                    <Form.Item
                        label="Full Name"
                        name="fullName"
                        rules={[{ required: true, message: 'Please enter full name' }]}
                    >
                        <Input placeholder="e.g., Juan Dela Cruz" />
                    </Form.Item>

                    <Form.Item
                        label="Grade & Section"
                        name="gradeSection"
                        rules={[{ required: true, message: 'Please enter grade and section' }]}
                    >
                        <Input placeholder="e.g., Grade 10 - A" />
                    </Form.Item>

                    <Form.Item
                        label="LRN (12-digit number)"
                        name="lrn"
                        rules={[
                            { required: true, message: 'Please enter LRN' },
                            { len: 12, message: 'LRN must be exactly 12 digits' },
                            { pattern: /^\d+$/, message: 'LRN must contain only numbers' }
                        ]}
                    >
                        <Input
                            placeholder="123456789012"
                            maxLength={12}
                            onChange={handleLRNChange}
                        />
                    </Form.Item>

                    {generatedPasskey && (
                        <Card style={{ marginBottom: 16, background: '#f0f2f5' }}>
                            <Text strong>Generated Passkey: </Text>
                            <Text code style={{ fontSize: 18, color: '#1A237E' }}>{generatedPasskey}</Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                (Digits 3, 6, 9, 12 from LRN)
                            </Text>
                        </Card>
                    )}

                    <Form.Item>
                        <Space>
                            <Button type="primary" htmlType="submit">
                                Add Student
                            </Button>
                            <Button onClick={() => {
                                setAddModalVisible(false);
                                form.resetFields();
                                setGeneratedPasskey('');
                            }}>
                                Cancel
                            </Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>

            {/* Top Up / Withdraw Modal */}
            <Modal
                title={selectedStudent ? `Top Up: ${selectedStudent.fullName}` : 'Withdraw System Cash'}
                open={topUpModalVisible}
                onCancel={() => setTopUpModalVisible(false)}
                footer={[
                    <Button key="cancel" onClick={() => setTopUpModalVisible(false)}>
                        Cancel
                    </Button>,
                    <Button key="submit" type="primary" danger={!selectedStudent} loading={topUpLoading} onClick={handleTopUp}>
                        {selectedStudent ? 'Confirm Top Up' : 'Confirm Withdrawal'}
                    </Button>,
                ]}
            >
                <div style={{ marginBottom: 16 }}>
                    <Text strong>{selectedStudent ? 'Amount to Load (SAR)' : 'Amount to Withdraw (SAR)'}</Text>
                    <InputNumber
                        style={{ width: '100%', marginTop: 8 }}
                        size="large"
                        min={1}
                        value={topUpAmount}
                        onChange={setTopUpAmount}
                        prefix="SAR"
                    />
                </div>
                <div>
                    <Text strong>{selectedStudent ? 'Student Passkey' : 'Admin Password'}</Text>
                    <Input.Password
                        style={{ width: '100%', marginTop: 8 }}
                        size="large"
                        placeholder={selectedStudent ? "Enter 4-digit PIN" : "Enter Password"}
                        maxLength={20}
                        value={topUpPasskey}
                        onChange={(e) => setTopUpPasskey(e.target.value)}
                    />
                </div>
            </Modal>

            {/* QR Code Modal */}
            <Modal
                title="Student QR Code"
                open={qrModalVisible}
                onCancel={() => setQrModalVisible(false)}
                footer={null}
            >
                {selectedStudent && (
                    <div style={{ textAlign: 'center' }}>
                        <Title level={4}>{selectedStudent.fullName}</Title>
                        <Text type="secondary">{selectedStudent.studentId}</Text>
                        <div style={{ margin: '20px 0' }}>
                            <canvas
                                id="qr-canvas"
                                ref={(canvas) => {
                                    if (canvas && selectedStudent) {
                                        QRCode.toCanvas(
                                            canvas,
                                            `FUGEN:${selectedStudent.studentId}`,
                                            { width: 300, margin: 2 }
                                        );
                                    }
                                }}
                            />
                        </div>
                        <Button type="primary" onClick={() => {
                            const canvas = document.getElementById('qr-canvas');
                            const url = canvas.toDataURL();
                            const link = document.createElement('a');
                            link.download = `${selectedStudent.studentId}_QR.png`;
                            link.href = url;
                            link.click();
                        }}>
                            Download QR Code
                        </Button>
                    </div>
                )}
            </Modal>

            {/* Student Profile Modal */}
            <Modal
                title="Student Profile"
                open={profileModalVisible}
                onCancel={() => setProfileModalVisible(false)}
                footer={[<Button key="close" onClick={() => setProfileModalVisible(false)}>Close</Button>]}
                width={800}
            >
                {selectedStudent && (
                    <div>
                        <div style={{ marginBottom: 24, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
                            <Title level={4}>{selectedStudent.fullName}</Title>
                            <Text>ID: {selectedStudent.studentId}</Text><br />
                            <Text>Grade: {selectedStudent.gradeSection}</Text><br />
                            <div style={{ marginTop: 12 }}>
                                <Text strong>Credit Status: </Text>
                                {parseFloat(selectedStudent.balance) < 0 ? (
                                    <Tag color="red" style={{ fontSize: 14, padding: '4px 8px' }}>
                                        PENDING CREDIT: SAR {Math.abs(parseFloat(selectedStudent.balance)).toFixed(2)}
                                    </Tag>
                                ) : (
                                    <Tag color="green" style={{ fontSize: 14, padding: '4px 8px' }}>
                                        No Pending Credits
                                    </Tag>
                                )}
                            </div>
                        </div>

                        <Title level={5}>Transaction History</Title>
                        <Table
                            loading={transactionsLoading}
                            dataSource={studentTransactions}
                            rowKey="id"
                            pagination={{ pageSize: 5 }}
                            columns={[
                                { title: 'Time', dataIndex: 'timestamp', render: t => new Date(t).toLocaleString() },
                                {
                                    title: 'Type', dataIndex: 'type', render: t => {
                                        let color = 'blue';
                                        if (t === 'PURCHASE') color = 'green';
                                        if (t === 'WITHDRAWAL') color = 'orange';
                                        return <Tag color={color}>{t}</Tag>;
                                    }
                                },
                                { title: 'Amount', dataIndex: 'amount', render: a => `SAR ${parseFloat(a).toFixed(2)}` },
                                { title: 'Balance After', dataIndex: 'newBalance', render: b => b ? `SAR ${parseFloat(b).toFixed(2)}` : '-' }
                            ]}
                        />
                    </div>
                )}
            </Modal>
        </Layout>
    );
}
