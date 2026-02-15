import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Statistic, Row, Col, Typography, message, Table, ConfigProvider } from 'antd';
import { UserOutlined, ClockCircleOutlined, CreditCardOutlined } from '@ant-design/icons';
import { studentService } from '../services/api';
import { io } from 'socket.io-client';

const { Title } = Typography;

const StudentDashboard = () => {
    const [studentId, setStudentId] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!data || !data.studentId) return;

        const socket = io('https://0028afc3-f39b-496c-a4a7-0daee7c3afcc-00-28bvg4oui5u20.pike.replit.dev');

        socket.on('balanceUpdate', (updateData) => {
            if (updateData.studentId === data.studentId) {
                console.log('Real-time balance update for current student');
                fetchStatus();
                message.info('Your balance has been updated!');
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [data?.studentId]);

    const fetchStatus = async () => {
        try {
            setLoading(true);
            const res = await studentService.getCreditStatus(studentId);
            setData(res.data.data);
        } catch (err) {
            console.error(err);
            if (err.response?.status === 404) {
                message.error('Student Not Found');
            } else {
                message.error('Server connection error. Please try again later.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-container">
            {!data ? (
                <Card className="glass-card" style={{ maxWidth: 400, margin: '100px auto', textAlign: 'center' }}>
                    <Title level={3}>Student Portal</Title>
                    <Input
                        prefix={<UserOutlined />}
                        placeholder="Enter Student ID"
                        value={studentId}
                        onChange={e => setStudentId(e.target.value)}
                        style={{ marginBottom: 16 }}
                    />
                    <Button type="primary" block onClick={fetchStatus} loading={loading}>
                        Access Dashboard
                    </Button>
                </Card>
            ) : (
                <div className="animate-fade-in">
                    <Button onClick={() => setData(null)} style={{ marginBottom: 16 }}>Log Out</Button>
                    <Row gutter={[16, 16]}>
                        <Col xs={24} md={8}>
                            <Card className="glass-card">
                                <Statistic
                                    title="Current Balance"
                                    value={data.balance}
                                    precision={2}
                                    prefix="SAR"
                                    valueStyle={{ color: data.balance < 0 ? '#ff4d4f' : '#3f8600' }}
                                />
                            </Card>
                        </Col>
                        <Col xs={24} md={8}>
                            <Card className="glass-card">
                                <Statistic
                                    title="Credit Available"
                                    value={data.availableCredit}
                                    precision={2}
                                    prefix="SAR"
                                    prefixStyle={{ color: '#1890ff' }}
                                />
                            </Card>
                        </Col>
                        <Col xs={24} md={8}>
                            <Card className="glass-card">
                                <Statistic
                                    title="Credit Limit"
                                    value={data.creditLimit}
                                    precision={2}
                                    prefix="SAR"
                                />
                            </Card>
                        </Col>
                    </Row>
                    <Card className="glass-card" style={{ marginTop: 24 }}>
                        <Title level={4}>Transaction History</Title>
                        <Table
                            dataSource={[]} // TODO: Fetch transactions
                            columns={[
                                { title: 'Date', dataIndex: 'date' },
                                { title: 'Type', dataIndex: 'type' },
                                { title: 'Amount', dataIndex: 'amount' },
                            ]}
                            locale={{ emptyText: 'No recent transactions' }}
                        />
                    </Card>
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;
