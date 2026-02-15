import React, { useState, useEffect } from 'react';
import { Tabs, Form, Input, Button, Table, Card, message, Modal, InputNumber, Tag, Row, Col, Typography, Statistic } from 'antd';
import { UserOutlined, QrcodeOutlined, DollarOutlined, FileTextOutlined, LockOutlined, ReloadOutlined } from '@ant-design/icons';
import { studentService, transactionService } from '../services/api';

import { io } from 'socket.io-client';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const AdminDashboard = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [qrModalVisible, setQrModalVisible] = useState(false);
    const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);

    // Stats
    const [totalBalance, setTotalBalance] = useState(0);
    const [totalCredit, setTotalCredit] = useState(0);
    const [creditedStudents, setCreditedStudents] = useState([]);
    const [dailyStats, setDailyStats] = useState({
        totalSales: 0,
        totalCash: 0,
        totalCredit: 0,
        creditList: [],
        cashList: []
    });

    useEffect(() => {
        fetchStudents();
        fetchDailyStats();

        // Socket connection for real-time updates
        const socket = io('https://0028afc3-f39b-496c-a4a7-0daee7c3afcc-00-28bvg4oui5u20.pike.replit.dev'); // Use your actual backend URL

        socket.on('balanceUpdate', (data) => {
            console.log('Real-time balance update:', data);
            fetchStudents();
            fetchDailyStats();
            message.info(`Balance updated for ${data.studentId}`);
        });

        socket.on('studentCreated', (data) => {
            console.log('Real-time student created:', data);
            fetchStudents();
            message.success(`New student added: ${data.fullName}`);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await studentService.getAllStudents();
            const allStudents = res.data.data;
            setStudents(allStudents);

            // Calc stats
            const total = allStudents.reduce((acc, curr) => acc + (parseFloat(curr.balance) || 0), 0);
            setTotalBalance(total);

            const negativeStudents = allStudents.filter(s => parseFloat(s.balance) < 0);
            setCreditedStudents(negativeStudents);

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
            const res = await transactionService.getDailyStats();
            if (res.data.status === 'success') {
                setDailyStats(res.data.data);
            }
        } catch (err) {
            console.error('Failed to fetch daily stats:', err);
        }
    };

    // --- TAB 1: MANAGE STUDENTS ---
    const [form] = Form.useForm();

    const handleCreateStudent = async (values) => {
        try {
            await studentService.createStudent(values);
            message.success('Student Created Successfully');
            form.resetFields();
            fetchStudents();
        } catch (err) {
            message.error(err.response?.data?.message || 'Failed to create student');
        }
    };

    const showQrModal = (student) => {
        setSelectedStudent(student);
        setQrModalVisible(true);
    };

    const printQr = () => {
        const printWindow = window.open('', '', 'width=600,height=600');
        printWindow.document.write('<html><body>');
        printWindow.document.write(`<h2>${selectedStudent.fullName}</h2>`);
        printWindow.document.write(`<img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(selectedStudent.qrData)}&t=${Date.now()}" />`);
        printWindow.document.write(`<p>${selectedStudent.studentId}</p>`);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    };

    const studentColumns = [
        { title: 'ID', dataIndex: 'studentId', key: 'studentId' },
        { title: 'Name', dataIndex: 'fullName', key: 'fullName' },
        { title: 'Grade', dataIndex: 'grade', key: 'grade' },
        {
            title: 'Balance',
            dataIndex: 'balance',
            key: 'balance',
            render: (bal) => <Tag color={bal < 0 ? 'red' : 'green'}>{parseFloat(bal).toFixed(2)} SAR</Tag>
        },
        {
            title: 'Action',
            key: 'action',
            render: (_, record) => (
                <Button icon={<QrcodeOutlined />} onClick={() => showQrModal(record)}>QR Code</Button>
            ),
        },
    ];

    // --- TAB 2: TOP UP ---
    const [topUpForm] = Form.useForm();
    const [searchQuery, setSearchQuery] = useState('');
    const [foundStudent, setFoundStudent] = useState(null);

    const handleSearchStudent = () => {
        const student = students.find(s => s.studentId === searchQuery.toUpperCase() || s.fullName.toLowerCase().includes(searchQuery.toLowerCase()));
        if (student) {
            setFoundStudent(student);
        } else {
            message.warning('Student not found');
            setFoundStudent(null);
        }
    };

    const handleTopUp = async (values) => {
        if (!foundStudent) return;
        try {
            // 1. Verify Passkey (Admin enters student passkey)
            await studentService.verifyPasskey(foundStudent.studentId, values.passkey);

            // 2. Add Funds
            await transactionService.topUp(foundStudent.studentId, values.amount);

            message.success(`Successfully added ${values.amount} SAR`);
            topUpForm.resetFields();
            setFoundStudent(null);
            setSearchQuery('');
            fetchStudents(); // Refresh data
        } catch (err) {
            message.error(err.response?.data?.message || 'Transaction Failed');
        }
    };

    return (
        <div className="admin-dashboard">
            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={8}>
                    <Card>
                        <Statistic title="Total System Balance" value={totalBalance} precision={2} prefix="SAR" />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic title="Total Students" value={students.length} prefix={<UserOutlined />} />
                    </Card>
                </Col>
                <Col span={8}>
                    <Card>
                        <Statistic title="Total Pending Credit" value={totalCredit} precision={2} prefix="SAR" valueStyle={{ color: '#cf1322' }} />
                    </Card>
                </Col>
            </Row>

            <Tabs defaultActiveKey="1">
                <TabPane tab={<span><UserOutlined />System</span>} key="1">
                    <Row gutter={24}>
                        <Col span={12}>
                            <Card title="System Overview">
                                <Statistic
                                    title="Total Cash at Hand (System)"
                                    value={dailyStats.system?.totalCashOnHand || 0}
                                    precision={2}
                                    prefix="SAR"
                                    valueStyle={{ color: '#3f8600' }}
                                />
                                <Statistic
                                    title="Total Outstanding Credits"
                                    value={totalCredit}
                                    precision={2}
                                    prefix="SAR"
                                    valueStyle={{ color: '#cf1322', marginTop: 20 }}
                                />
                                <Statistic
                                    title="Today's Top-Ups"
                                    value={dailyStats.system?.todayTopups || 0}
                                    precision={2}
                                    prefix="SAR"
                                    valueStyle={{ marginTop: 20 }}
                                />
                                <Statistic
                                    title="Today's Withdrawals"
                                    value={dailyStats.system?.todayWithdrawals || 0}
                                    precision={2}
                                    prefix="SAR"
                                    valueStyle={{ color: '#faad14', marginTop: 20 }}
                                />
                            </Card>
                        </Col>
                        <Col span={12}>
                            <Card title="Add New Student">
                                <Form form={form} layout="vertical" onFinish={handleCreateStudent}>
                                    <Form.Item name="fullName" label="Full Name" rules={[{ required: true }]}>
                                        <Input placeholder="e.g. Maria Cruz" />
                                    </Form.Item>
                                    <Form.Item name="grade" label="Grade Level" rules={[{ required: true }]}>
                                        <Input placeholder="e.g. Grade 10" />
                                    </Form.Item>
                                    <Form.Item name="section" label="Section">
                                        <Input placeholder="e.g. Ruby" />
                                    </Form.Item>
                                    <Form.Item name="passkey" label="4-Digit Passkey" rules={[{ required: true, len: 4 }]}>
                                        <Input.Password placeholder="XXXX" maxLength={4} />
                                    </Form.Item>
                                    <Button type="primary" htmlType="submit" block>Create Account</Button>
                                </Form>
                            </Card>
                        </Col>
                    </Row>
                    <Row style={{ marginTop: 20 }}>
                        <Col span={24}>
                            <Table
                                dataSource={students}
                                columns={studentColumns}
                                rowKey="studentId"
                                loading={loading}
                                pagination={{ pageSize: 6 }}
                            />
                        </Col>
                    </Row>
                </TabPane>

                <TabPane tab={<span><DollarOutlined />Top Up Balance</span>} key="2">
                    <Card title="Load Account">
                        <Row gutter={16}>
                            <Col span={12}>
                                <Input.Search
                                    placeholder="Enter Student ID or Name"
                                    enterButton="Find Student"
                                    size="large"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onSearch={handleSearchStudent}
                                />

                                {foundStudent && (
                                    <Card style={{ marginTop: 20, background: '#f0f2f5' }}>
                                        <Title level={4}>{foundStudent.fullName}</Title>
                                        <Text>ID: {foundStudent.studentId}</Text><br />
                                        <Text>Current Balance: </Text>
                                        <Text strong style={{ color: foundStudent.balance < 0 ? 'red' : 'green', fontSize: 18 }}>
                                            SAR {parseFloat(foundStudent.balance).toFixed(2)}
                                        </Text>
                                    </Card>
                                )}
                            </Col>

                            <Col span={12}>
                                <Form form={topUpForm} layout="vertical" onFinish={handleTopUp} disabled={!foundStudent}>
                                    <Form.Item name="amount" label="Amount to Load (SAR)" rules={[{ required: true }]}>
                                        <InputNumber style={{ width: '100%' }} min={1} prefix="SAR" size="large" />
                                    </Form.Item>

                                    <Form.Item
                                        name="passkey"
                                        label="Verify Student Passkey"
                                        rules={[{ required: true, message: 'Passkey required for verification' }]}
                                    >
                                        <Input.Password prefix={<LockOutlined />} size="large" placeholder="Enter student's 4-digit passkey" maxLength={4} />
                                    </Form.Item>

                                    <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                                        Confirm Transaction
                                    </Button>
                                </Form>
                            </Col>
                        </Row>
                    </Card>
                </TabPane>

                <TabPane tab={<span><FileTextOutlined />Pending Credits</span>} key="3">
                    <Card title="Students with Outstanding Debt">
                        <Table
                            dataSource={creditedStudents}
                            columns={[
                                { title: 'ID', dataIndex: 'studentId' },
                                { title: 'Name', dataIndex: 'fullName' },
                                { title: 'Grade', dataIndex: 'grade' },
                                {
                                    title: 'Debt Amount',
                                    dataIndex: 'balance',
                                    render: (bal) => <Tag color="red">{Math.abs(parseFloat(bal)).toFixed(2)} SAR</Tag>
                                },
                                {
                                    title: 'Status',
                                    render: () => <Tag color="warning">PENDING PAYMENT</Tag>
                                }
                            ]}
                            rowKey="studentId"
                            pagination={{ pageSize: 10 }}
                        />
                    </Card>
                </TabPane>

                <TabPane tab={<span><ReloadOutlined />Historical Reports</span>} key="4">
                    <Card title="Daily Financial Reports">
                        <div style={{ marginBottom: 20 }}>
                            <Text strong style={{ marginRight: 10 }}>Select Date:</Text>
                            <Input type="date" style={{ width: 200 }} onChange={(e) => {
                                const date = e.target.value;
                                if (date) {
                                    transactionService.getDailyStats(date, true).then(res => {
                                        if (res.data.status === 'success') {
                                            const data = res.data.data;
                                            // Show modal or update state to view this report
                                            Modal.info({
                                                title: `Report for ${new Date(date).toDateString()}`,
                                                width: 800,
                                                content: (
                                                    <div>
                                                        <Title level={4} style={{ color: '#1A237E' }}>System Financials</Title>
                                                        <Row gutter={16}>
                                                            <Col span={8}>
                                                                <Statistic title="Cash In (Topups)" value={data.system?.todayTopups} precision={2} prefix="SAR" valueStyle={{ color: '#3f8600' }} />
                                                            </Col>
                                                            <Col span={8}>
                                                                <Statistic title="Cash Out (Withdrawals)" value={data.system?.todayWithdrawals} precision={2} prefix="SAR" valueStyle={{ color: '#cf1322' }} />
                                                            </Col>
                                                            <Col span={8}>
                                                                <Statistic title="New Net Cash" value={(data.system?.todayTopups || 0) - (data.system?.todayWithdrawals || 0)} precision={2} prefix="SAR" />
                                                            </Col>
                                                        </Row>

                                                        <Title level={4} style={{ color: '#1A237E', marginTop: 20 }}>Canteen Financials</Title>
                                                        <Row gutter={16}>
                                                            <Col span={8}>
                                                                <Statistic title="Total Sales" value={data.canteen?.totalSales} precision={2} prefix="SAR" valueStyle={{ color: '#1890ff' }} />
                                                            </Col>
                                                            <Col span={8}>
                                                                <Statistic title="Cash Collected" value={data.canteen?.cashCollected} precision={2} prefix="SAR" valueStyle={{ color: '#52c41a' }} />
                                                            </Col>
                                                            <Col span={8}>
                                                                <Statistic title="Credit Issued" value={data.canteen?.totalCredit} precision={2} prefix="SAR" valueStyle={{ color: '#faad14' }} />
                                                            </Col>
                                                        </Row>

                                                        <Table
                                                            dataSource={data.canteen?.transactions || []}
                                                            columns={[
                                                                { title: 'Time', dataIndex: 'timestamp', render: t => new Date(t).toLocaleTimeString(), width: 100 },
                                                                { title: 'Student', dataIndex: 'studentName' },
                                                                { title: 'Type', dataIndex: 'type', render: t => <Tag>{t}</Tag> },
                                                                { title: 'Amount', dataIndex: 'amount', render: a => `${parseFloat(a).toFixed(2)} SAR` }
                                                            ]}
                                                            size="small"
                                                            style={{ marginTop: 20 }}
                                                            pagination={{ pageSize: 5 }}
                                                            rowKey="id"
                                                        />
                                                    </div>
                                                )
                                            });
                                        }
                                    });
                                }
                            }} />
                        </div>
                        <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
                            <FileTextOutlined style={{ fontSize: 48, marginBottom: 10 }} />
                            <p>Select a date to view the daily split report for System vs Canteen.</p>
                        </div>
                    </Card>
                </TabPane>

                <TabPane tab={<span><DollarOutlined />Canteen Transactions</span>} key="5">
                    <Card
                        title="Today's Canteen Transactions"
                        extra={
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <Statistic
                                    title="System Cash"
                                    value={dailyStats.system?.totalCashOnHand || 0}
                                    precision={2}
                                    prefix="SAR"
                                    valueStyle={{ fontSize: 20, color: '#3f8600' }}
                                />
                                <Button type="primary" danger onClick={() => setWithdrawModalVisible(true)}>
                                    Withdraw Cash
                                </Button>
                                <Statistic
                                    title="Total Sales"
                                    value={dailyStats.canteen?.totalSales || 0}
                                    precision={2}
                                    prefix="SAR"
                                    valueStyle={{ fontSize: 20, color: '#1890ff' }}
                                />
                            </div>
                        }
                    >
                        <Table
                            dataSource={dailyStats.canteen?.transactions || []}
                            columns={[
                                {
                                    title: 'Time',
                                    dataIndex: 'timestamp',
                                    render: (time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                    width: 100
                                },
                                { title: 'Student ID', dataIndex: 'studentId', width: 120 },
                                { title: 'Name', dataIndex: 'studentName' },
                                { title: 'Grade', dataIndex: 'grade', width: 100 },
                                {
                                    title: 'Amount',
                                    dataIndex: 'amount',
                                    render: (amt) => <Tag color="blue">{parseFloat(amt).toFixed(2)} SAR</Tag>,
                                    width: 120
                                },
                                {
                                    title: 'Payment Type',
                                    render: (_, record) => {
                                        if (record.type === 'TOPUP') {
                                            return <Tag color="blue">TOPUP</Tag>;
                                        }
                                        const hasCash = record.cashAmount > 0;
                                        const hasCredit = record.creditAmount > 0;
                                        if (hasCash && hasCredit) {
                                            return <Tag color="orange">MIXED</Tag>;
                                        } else if (hasCredit) {
                                            return <Tag color="red">CREDIT</Tag>;
                                        } else {
                                            return <Tag color="green">CASH</Tag>;
                                        }
                                    },
                                    width: 120
                                }
                            ]}
                            rowKey="id"
                            pagination={{ pageSize: 15 }}
                        />
                    </Card>
                </TabPane>

                <TabPane tab={<span><DollarOutlined />Cash Transactions</span>} key="6">
                    <Card
                        title="Cash Payments Today (Canteen)"
                        extra={
                            <Statistic
                                title="Total Cash Sales"
                                value={dailyStats.canteen?.cashCollected || 0}
                                precision={2}
                                prefix="SAR"
                                valueStyle={{ fontSize: 20, color: '#52c41a' }}
                            />
                        }
                    >
                        <Table
                            dataSource={dailyStats.canteen?.transactions?.filter(t => t.cashAmount > 0) || []}
                            columns={[
                                {
                                    title: 'Time',
                                    dataIndex: 'timestamp',
                                    render: (time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                    width: 100
                                },
                                { title: 'Student ID', dataIndex: 'studentId', width: 120 },
                                { title: 'Name', dataIndex: 'studentName' },
                                { title: 'Grade', dataIndex: 'grade', width: 100 },
                                {
                                    title: 'Total Purchase',
                                    dataIndex: 'amount',
                                    render: (amt) => `${parseFloat(amt).toFixed(2)} SAR`,
                                    width: 130
                                },
                                {
                                    title: 'Cash Paid',
                                    dataIndex: 'cashAmount',
                                    render: (amt) => <Tag color="green">{parseFloat(amt).toFixed(2)} SAR</Tag>,
                                    width: 120
                                }
                            ]}
                            rowKey="id"
                            pagination={{ pageSize: 15 }}
                        />
                    </Card>
                </TabPane>
            </Tabs>

            <Modal
                title="Student QR Code"
                open={qrModalVisible}
                onCancel={() => setQrModalVisible(false)}
                footer={[
                    <Button key="print" type="primary" onClick={printQr}>Print Sticker</Button>
                ]}
            >
                {selectedStudent && (
                    <div style={{ textAlign: 'center' }}>
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(selectedStudent.qrData)}&t=${Date.now()}`}
                            alt="QR Code"
                            style={{ border: '1px solid #ddd', padding: 10 }}
                        />
                        <h3 style={{ marginTop: 10 }}>{selectedStudent.fullName}</h3>
                        <p>{selectedStudent.studentId}</p>
                    </div>
                )}
            </Modal>

            <Modal
                title="Withdraw Cash from System"
                open={withdrawModalVisible}
                onCancel={() => setWithdrawModalVisible(false)}
                footer={null}
            >
                <Form
                    layout="vertical"
                    onFinish={async (values) => {
                        try {
                            await transactionService.withdraw(values.amount, values.passkey);
                            message.success('Cash Withdrawn Successfully');
                            setWithdrawModalVisible(false);
                            fetchDailyStats();
                        } catch (err) {
                            message.error(err.response?.data?.message || 'Withdrawal Failed');
                        }
                    }}
                >
                    <Form.Item name="amount" label="Amount (SAR)" rules={[{ required: true }]}>
                        <InputNumber style={{ width: '100%' }} min={1} />
                    </Form.Item>
                    <Form.Item name="passkey" label="Admin PIN" rules={[{ required: true, message: 'Please enter admin PIN' }]}>
                        <Input.Password maxLength={4} placeholder="Enter PIN (1234)" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block>Confirm Withdrawal</Button>
                </Form>
            </Modal>
        </div>
    );
};

export default AdminDashboard;
