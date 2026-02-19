import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { studentService, transactionService } from '../services/api';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import './VisualBasicDashboard.css';

// Admin Dashboard - Visual Basic Look Recreation
export default function AdminDashboard({ onLogout }) {
    const [view, setView] = useState('users'); // users, transactions, reports, system
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');

    // Stats
    const [totalBal, setTotalBal] = useState(0);
    const [totalCredit, setTotalCredit] = useState(0);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);

    // Forms
    const [addForm, setAddForm] = useState({ fullName: '', gradeSection: '', lrn: '' });
    const [topUpForm, setTopUpForm] = useState({ amount: '', passkey: '' });

    // Reports Data
    const [dailyStats, setDailyStats] = useState({});

    useEffect(() => {
        loadData();
        const socket = io('https://fugen-backend.onrender.com');
        socket.on('balanceUpdate', loadData);
        socket.on('studentCreated', loadData);
        return () => socket.disconnect();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [sRes, dRes] = await Promise.all([
                studentService.getAllStudents(),
                transactionService.getDailyStats(null, true)
            ]);

            const allStudents = sRes.data.data;
            setStudents(allStudents);
            setTotalBal(allStudents.reduce((a, c) => a + (parseFloat(c.balance) || 0), 0));
            setTotalCredit(allStudents.filter(s => parseFloat(s.balance) < 0).reduce((a, c) => a + Math.abs(parseFloat(c.balance)), 0));

            if (dRes.data.status === 'success') setDailyStats(dRes.data.data);

        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    // Actions
    const handleAddStudent = async () => {
        try {
            const passkey = addForm.lrn[2] + addForm.lrn[5] + addForm.lrn[8] + addForm.lrn[11];
            await studentService.createStudent({ ...addForm, passkey });
            message.success('Student Added');
            setShowAddModal(false); setAddForm({ fullName: '', gradeSection: '', lrn: '' }); loadData();
        } catch (e) { message.error('Failed'); }
    };

    const handleTopUp = async () => {
        if (!selectedStudent) return;
        try {
            await studentService.verifyPasskey(selectedStudent.studentId, topUpForm.passkey);
            await transactionService.topUp(selectedStudent.studentId, topUpForm.amount);
            message.success('Success');
            setShowTopUpModal(false); setTopUpForm({ amount: '', passkey: '' }); loadData();
        } catch (e) { message.error('Failed'); }
    };

    const downloadQR = () => {
        const canvas = document.getElementById('qr-canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = 'QR.png';
            link.href = canvas.toDataURL();
            link.click();
        }
    };

    // Rendering Helpers
    const filtered = students.filter(s => s.fullName.toLowerCase().includes(searchText.toLowerCase()) || s.studentId.includes(searchText));

    return (
        <div className="vb-container">
            {/* Sidebar */}
            <div className="vb-sidebar">
                <div className="vb-logo-area">
                    <div className="vb-logo-text">FUGEN<br />SmartPay</div>
                </div>
                <div className="vb-menu">
                    <div className={`vb-menu-item ${view === 'users' ? 'active' : ''}`} onClick={() => setView('users')}>
                        <span>👤</span> Users
                    </div>
                    <div className={`vb-menu-item ${view === 'transactions' ? 'active' : ''}`} onClick={() => setView('transactions')}>
                        <span>🕒</span> Transaction History
                    </div>
                    <div className={`vb-menu-item ${view === 'reports' ? 'active' : ''}`} onClick={() => setView('reports')}>
                        <span>📄</span> Reports
                    </div>
                    <div className={`vb-menu-item ${view === 'system' ? 'active' : ''}`} onClick={() => setView('system')}>
                        <span>⚙️</span> System Data
                    </div>
                </div>
                <div className="vb-menu-item" onClick={onLogout} style={{ marginTop: 'auto', borderTop: '1px solid #ffffff55' }}>
                    <span>🚪</span> Logout
                </div>
            </div>

            {/* Main Content */}
            <div className="vb-main">
                <div className="vb-header">
                    <div className="vb-header-title">Admin Dashboard</div>
                    <div className="vb-date">{new Date().toLocaleDateString()}</div>
                </div>

                {view === 'users' && (
                    <>
                        <div className="vb-page-title">Student Management</div>

                        {/* Stats Cards Row */}
                        <div className="vb-stats-row">
                            <div className="vb-card">
                                <div className="vb-card-label">Total Students</div>
                                <div className="vb-card-value">{students.length}</div>
                            </div>
                            <div className="vb-card">
                                <div className="vb-card-label">Total Balance</div>
                                <div className="vb-card-value">SAR {totalBal.toFixed(2)}</div>
                            </div>
                            <div className="vb-card">
                                <div className="vb-card-label">Total Credit (Debt)</div>
                                <div className="vb-card-value">SAR {totalCredit.toFixed(2)}</div>
                            </div>
                        </div>

                        {/* Toolbar */}
                        <div className="vb-toolbar">
                            <input className="vb-search" placeholder="Search by name, ID, or grade..." value={searchText} onChange={e => setSearchText(e.target.value)} />
                            <button className="vb-btn vb-btn-blue" onClick={() => setShowAddModal(true)}>+ Add Student</button>
                            <button className="vb-btn vb-btn-grey">Remove Selected (0)</button>
                        </div>

                        {/* Table */}
                        <div className="vb-table-container">
                            <table className="vb-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 30 }}><input type="checkbox" /></th>
                                        <th>Student ID</th>
                                        <th>Full Name</th>
                                        <th>Grade & Section</th>
                                        <th>Balance</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(s => (
                                        <tr key={s.studentId}>
                                            <td><input type="checkbox" /></td>
                                            <td>{s.studentId}</td>
                                            <td>{s.fullName}</td>
                                            <td>{s.gradeSection}</td>
                                            <td style={{ color: parseFloat(s.balance) < 0 ? 'red' : 'green', fontWeight: 'bold' }}>SAR {parseFloat(s.balance).toFixed(2)}</td>
                                            <td>
                                                <button className="vb-action-btn" onClick={() => { setSelectedStudent(s); setShowQrModal(true); }}>QR Code</button>
                                                <button className="vb-action-btn" onClick={() => { setSelectedStudent(s); setShowTopUpModal(true); }}>Top Up</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {view === 'transactions' && (
                    <>
                        <div className="vb-page-title">Transaction History</div>
                        <div className="vb-table-container">
                            <table className="vb-table">
                                <thead><tr><th>Time</th><th>Student</th><th>Type</th><th>Amount</th><th>Method</th></tr></thead>
                                <tbody>
                                    {(dailyStats.canteen?.transactions || []).map((t, i) => (
                                        <tr key={i}>
                                            <td>{new Date(t.timestamp).toLocaleTimeString()}</td>
                                            <td>{t.studentName}</td>
                                            <td>{t.type}</td>
                                            <td>SAR {parseFloat(t.amount).toFixed(2)}</td>
                                            <td>{t.cashAmount > 0 ? 'Cash' : ''}{t.creditAmount > 0 ? 'Credit' : ''}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* Simplified View for Reports/System for now */}
                {(view === 'reports' || view === 'system') && (
                    <div style={{ padding: 20, textAlign: 'center' }}>
                        <h2>Section Under Construction</h2>
                        <p>Using Visual Basic Design Template</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showAddModal && (
                <div className="vb-modal-overlay">
                    <div className="vb-modal">
                        <div className="vb-modal-header">Add New Student</div>
                        <div className="vb-form-group"><label>Name</label><input value={addForm.fullName} onChange={e => setAddForm({ ...addForm, fullName: e.target.value })} /></div>
                        <div className="vb-form-group"><label>Grade</label><input value={addForm.gradeSection} onChange={e => setAddForm({ ...addForm, gradeSection: e.target.value })} /></div>
                        <div className="vb-form-group"><label>LRN</label><input value={addForm.lrn} onChange={e => setAddForm({ ...addForm, lrn: e.target.value })} maxLength={12} /></div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="vb-btn vb-btn-grey" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="vb-btn vb-btn-blue" onClick={handleAddStudent}>Save</button>
                        </div>
                    </div>
                </div>
            )}

            {showTopUpModal && (
                <div className="vb-modal-overlay">
                    <div className="vb-modal">
                        <div className="vb-modal-header">Top Up / Withdraw</div>
                        <p>Student: {selectedStudent?.fullName}</p>
                        <div className="vb-form-group"><label>Amount (SAR)</label><input type="number" value={topUpForm.amount} onChange={e => setTopUpForm({ ...topUpForm, amount: e.target.value })} /></div>
                        <div className="vb-form-group"><label>Passkey</label><input type="password" value={topUpForm.passkey} onChange={e => setTopUpForm({ ...topUpForm, passkey: e.target.value })} /></div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="vb-btn vb-btn-grey" onClick={() => setShowTopUpModal(false)}>Cancel</button>
                            <button className="vb-btn vb-btn-blue" onClick={handleTopUp}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {showQrModal && (
                <div className="vb-modal-overlay">
                    <div className="vb-modal" style={{ textAlign: 'center' }}>
                        <div className="vb-modal-header">Student QR Code</div>
                        <h3>{selectedStudent?.fullName}</h3>
                        <canvas id="qr-canvas" ref={c => { if (c && selectedStudent) QRCode.toCanvas(c, `FUGEN:${selectedStudent.studentId}`, { width: 200 }); }} />
                        <br />
                        <button className="vb-btn vb-btn-blue" style={{ marginTop: 10 }} onClick={downloadQR}>Download</button>
                        <button className="vb-btn vb-btn-grey" style={{ marginTop: 10, marginLeft: 10 }} onClick={() => setShowQrModal(false)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
}
