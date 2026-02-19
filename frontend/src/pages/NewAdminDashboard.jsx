import React, { useState, useEffect } from 'react';
import { Tabs, Form, Input, Button, Table, Card, message, Modal, InputNumber, Tag, Row, Col, Typography, Statistic, Space } from 'antd';
import { UserOutlined, QrcodeOutlined, DollarOutlined, FileTextOutlined, LockOutlined, ReloadOutlined, LogoutOutlined } from '@ant-design/icons';
import { studentService, transactionService } from '../services/api';
import { io } from 'socket.io-client';
import QRCode from 'qrcode'; // Use local library for better control

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const AdminDashboard = ({ onLogout }) => {
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
        canteen: { totalSales: 0, cashCollected: 0, totalCredit: 0 },
        system: { totalCashOnHand: 0, todayTopups: 0, todayWithdrawals: 0 }
    });

    useEffect(() => {
        fetchStudents();
        fetchDailyStats();

        const socket = io('https://fugen-backend.onrender.com'); // Updated Backend URL
        socket.on('balanceUpdate', () => { fetchStudents(); fetchDailyStats(); });
        socket.on('studentCreated', () => fetchStudents());
        return () => socket.disconnect();
    }, []);

    const fetchStudents = async () => {
        setLoading(true);
        try {
            const res = await studentService.getAllStudents();
            const allStudents = res.data.data;
            setStudents(allStudents);
            setTotalBalance(allStudents.reduce((acc, curr) => acc + (parseFloat(curr.balance) || 0), 0));

            const negative = allStudents.filter(s => parseFloat(s.balance) < 0);
            setCreditedStudents(negative);
            setTotalCredit(negative.reduce((acc, curr) => acc + Math.abs(parseFloat(curr.balance)), 0));
        } catch (err) { message.error('Failed to fetch students'); } finally { setLoading(false); }
    };

    const fetchDailyStats = async () => {
        try {
            const res = await transactionService.getDailyStats(null, true); // Changed to fit API update
            if (res.data.status === 'success') setDailyStats(res.data.data);
        } catch (err) { console.error('Failed to fetch stats'); }
    };

    const [form] = Form.useForm();
    const handleCreateStudent = async (values) => {
        try {
            // Auto-generate passkey from LRN if needed or use input
            // Keeping original logic structure
            await studentService.createStudent(values);
            message.success('Student Created Successfully');
            form.resetFields(); fetchStudents();
        } catch (err) { message.error(err.response?.data?.message || 'Failed'); }
    };

    const showQrModal = (student) => { setSelectedStudent(student); setQrModalVisible(true); };

    // Enhanced QR Download with Student ID
    const downloadQRWithID = () => {
        const canvas = document.getElementById('qr-canvas');
        if (!canvas || !selectedStudent) return;
        const size = canvas.width;
        const newCanvas = document.createElement('canvas'); newCanvas.width = size; newCanvas.height = size + 60;
        const ctx = newCanvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
        ctx.drawImage(canvas, 0, 0);
        ctx.fillStyle = '#000000'; ctx.font = 'bold 24px Arial'; ctx.textAlign = 'center';
        ctx.fillText(selectedStudent.studentId, size / 2, size + 40);
        const link = document.createElement('a'); link.download = `${selectedStudent.studentId}_QR.png`; link.href = newCanvas.toDataURL('image/png'); link.click();
    };

    const studentColumns = [
        { title: 'ID', dataIndex: 'studentId' },
        { title: 'Name', dataIndex: 'fullName' },
        { title: 'Grade', dataIndex: 'grade' },
        { title: 'Balance', dataIndex: 'balance', render: b => <Tag color={b < 0 ? 'red' : 'green'}>{parseFloat(b).toFixed(2)} SAR</Tag> },
        { title: 'Action', render: (_, r) => <Button icon={<QrcodeOutlined />} onClick={() => showQrModal(r)}>QR Code</Button> }
    ];

    // TOP UP LOGIC
    const [topUpForm] = Form.useForm();
    const [searchQuery, setSearchQuery] = useState('');
    const [foundStudent, setFoundStudent] = useState(null);

    const handleSearchStudent = () => {
        const s = students.find(s => s.studentId === searchQuery.toUpperCase() || s.fullName.toLowerCase().includes(searchQuery.toLowerCase()));
        if (s) setFoundStudent(s); else { message.warning('Not found'); setFoundStudent(null); }
    };

    const handleTopUp = async (values) => {
        try {
            await studentService.verifyPasskey(foundStudent.studentId, values.passkey);
            await transactionService.topUp(foundStudent.studentId, values.amount);
            message.success(`Added ${values.amount} SAR`);
            topUpForm.resetFields(); setFoundStudent(null); setSearchQuery(''); fetchStudents();
        } catch (err) { message.error('Transaction Failed'); }
    };

    return (
        <div className="admin-dashboard" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <Title level={3}>FUGEN Admin Dashboard</Title>
                <Button type="primary" danger icon={<LogoutOutlined />} onClick={onLogout}>Logout</Button>
            </div>

            <Row gutter={16} style={{ marginBottom: 24 }}>
                <Col span={8}><Card><Statistic title="Total System Balance" value={totalBalance} precision={2} prefix="SAR" /></Card></Col>
                <Col span={8}><Card><Statistic title="Total Students" value={students.length} prefix={<UserOutlined />} /></Card></Col>
                <Col span={8}><Card><Statistic title="Total Pending Credit" value={totalCredit} precision={2} prefix="SAR" valueStyle={{ color: '#cf1322' }} /></Card></Col>
            </Row>

            <Tabs defaultActiveKey="1">
                <TabPane tab={<span><UserOutlined />System</span>} key="1">
                    <Row gutter={24}>
                        <Col span={12}>
                            <Card title="System Overview">
                                <Statistic title="Total Cash (System)" value={dailyStats.system?.totalCashOnHand || 0} precision={2} prefix="SAR" valueStyle={{ color: '#3f8600' }} />
                                <Statistic title="Total Debt" value={totalCredit} precision={2} prefix="SAR" valueStyle={{ color: '#cf1322', marginTop: 20 }} />
                            </Card>
                        </Col>
                        <Col span={12}>
                            <Card title="Add New Student">
                                <Form form={form} layout="vertical" onFinish={handleCreateStudent}>
                                    <Form.Item name="fullName" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
                                    <Form.Item name="grade" label="Grade" rules={[{ required: true }]}><Input /></Form.Item>
                                    <Form.Item name="passkey" label="Passkey" rules={[{ required: true, len: 4 }]}><Input.Password maxLength={4} /></Form.Item>
                                    <Button type="primary" htmlType="submit" block>Create</Button>
                                </Form>
                            </Card>
                        </Col>
                    </Row>
                    <Row style={{ marginTop: 20 }}><Col span={24}><Table dataSource={students} columns={studentColumns} rowKey="studentId" pagination={{ pageSize: 6 }} /></Col></Row>
                </TabPane>

                <TabPane tab={<span><DollarOutlined />Top Up</span>} key="2">
                    <Card title="Load Account">
                        <Row gutter={16}>
                            <Col span={12}>
                                <Input.Search placeholder="Search ID/Name" enterButton="Find" size="large" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onSearch={handleSearchStudent} />
                                {foundStudent && <Card style={{ marginTop: 20 }}><Title level={4}>{foundStudent.fullName}</Title><Text>ID: {foundStudent.studentId}</Text><br /><Text strong style={{ color: foundStudent.balance < 0 ? 'red' : 'green', fontSize: 18 }}>SAR {parseFloat(foundStudent.balance).toFixed(2)}</Text></Card>}
                            </Col>
                            <Col span={12}>
                                <Form form={topUpForm} layout="vertical" onFinish={handleTopUp} disabled={!foundStudent}>
                                    <Form.Item name="amount" label="Amount" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} min={1} /></Form.Item>
                                    <Form.Item name="passkey" label="Passkey" rules={[{ required: true }]}><Input.Password /></Form.Item>
                                    <Button type="primary" htmlType="submit" block>Confirm</Button>
                                </Form>
                            </Col>
                        </Row>
                    </Card>
                </TabPane>

                <TabPane tab={<span><ReloadOutlined />Reports</span>} key="4">
                    <Card title="Today's Canteen Transactions">
                        <Row gutter={16} style={{ marginBottom: 20 }}>
                            <Col span={8}><Statistic title="Total Sales" value={dailyStats.canteen?.totalSales || 0} precision={2} prefix="SAR" valueStyle={{ color: '#1890ff' }} /></Col>
                            <Col span={8}><Statistic title="Cash Collected" value={dailyStats.canteen?.cashCollected || 0} precision={2} prefix="SAR" valueStyle={{ color: '#52c41a' }} /></Col>
                        </Row>
                        <Table dataSource={dailyStats.canteen?.transactions || []} columns={[
                            { title: 'Time', dataIndex: 'timestamp', render: t => new Date(t).toLocaleTimeString() },
                            { title: 'Student', dataIndex: 'studentName' },
                            { title: 'Amount', dataIndex: 'amount', render: a => <Tag color="blue">{parseFloat(a).toFixed(2)} SAR</Tag> },
                            { title: 'Type', dataIndex: 'type' }
                        ]} rowKey="id" pagination={{ pageSize: 10 }} />
                    </Card>
                </TabPane>
            </Tabs>

            <Modal title="QR Code" open={qrModalVisible} onCancel={() => setQrModalVisible(false)} footer={null}>
                {selectedStudent && (
                    <div style={{ textAlign: 'center' }}>
                        <Title level={4}>{selectedStudent.fullName}</Title>
                        <canvas id="qr-canvas" ref={c => { if (c && selectedStudent) QRCode.toCanvas(c, `FUGEN:${selectedStudent.studentId}`, { width: 250 }); }} />
                        <br />
                        <Button type="primary" onClick={downloadQRWithID} style={{ marginTop: 10 }}>Download with ID</Button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default AdminDashboard;
