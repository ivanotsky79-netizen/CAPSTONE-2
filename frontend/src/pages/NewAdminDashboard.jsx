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

    // Selection for Delete
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Stats
    const [totalBal, setTotalBal] = useState(0);
    const [totalCredit, setTotalCredit] = useState(0);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);

    const [selectedStudent, setSelectedStudent] = useState(null);
    const [userTransactions, setUserTransactions] = useState([]);

    // Forms
    const [addForm, setAddForm] = useState({ fullName: '', gradeSection: '', lrn: '' });
    const [generatedPasskey, setGeneratedPasskey] = useState('');
    const [topUpForm, setTopUpForm] = useState({ amount: '', passkey: '' });
    const [withdrawForm, setWithdrawForm] = useState({ amount: '', passkey: '' });

    // Reports Data
    const [dailyStats, setDailyStats] = useState({});
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);

    // Graph Data
    const [graphData, setGraphData] = useState([]);

    useEffect(() => {
        loadData();
        const socket = io('https://fugen-backend.onrender.com');
        socket.on('balanceUpdate', loadData);
        socket.on('studentCreated', loadData);
        socket.on('studentDeleted', loadData);
        return () => socket.disconnect();
    }, []);

    useEffect(() => {
        if (addForm.lrn.length === 12) {
            const p = addForm.lrn[2] + addForm.lrn[5] + addForm.lrn[8] + addForm.lrn[11];
            setGeneratedPasskey(p);
        } else {
            setGeneratedPasskey('');
        }
    }, [addForm.lrn]);

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

            if (dRes.data.status === 'success') {
                setDailyStats(dRes.data.data);
                generateGraph(dRes.data.data.canteen?.transactions || []);
            }

        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const generateGraph = (txns) => {
        const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16]; // School hours
        const data = hours.map(h => {
            const total = txns.filter(t => new Date(t.timestamp).getHours() === h).reduce((a, c) => a + parseFloat(c.amount), 0);
            return { hour: h, total };
        });
        setGraphData(data);
    };

    const fetchReport = async () => {
        if (!reportDate) return;
        try {
            const res = await transactionService.getDailyStats(reportDate);
            if (res.data.status === 'success') setReportData(res.data.data);
            else message.warning('No data for this date');
        } catch (e) { message.error('Failed to load report'); }
    };

    const fetchUserTransactions = async (id) => {
        try {
            const res = await transactionService.getTransactions(id); // Ensure this API call exists or mock it
            // Fallback: filter from dailyStats if full history not available, but ideally we fetch from backend
            if (res.data && res.data.data) {
                setUserTransactions(res.data.data);
            } else {
                // If endpoint doesn't return list, fallback empty
                setUserTransactions([]);
            }
        } catch (e) {
            // Mock data for demo if API fails
            setUserTransactions([]);
        }
    };

    // Actions
    const handleAddStudent = async () => {
        try {
            if (!generatedPasskey) { message.error('Invalid LRN'); return; }
            await studentService.createStudent({ ...addForm, passkey: generatedPasskey });
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
            // Refresh profile if open
            if (showProfileModal) fetchUserTransactions(selectedStudent.studentId);
        } catch (e) { message.error('Failed'); }
    };

    const handleWithdraw = async () => {
        try {
            if (withdrawForm.passkey !== '170206') { message.error('Invalid Admin PIN'); return; }
            await transactionService.withdraw(withdrawForm.amount, withdrawForm.passkey);
            message.success('Cash Withdrawn');
            setShowWithdrawModal(false); setWithdrawForm({ amount: '', passkey: '' }); loadData();
        } catch (e) { message.error('Failed'); }
    };

    const handleToggleSelect = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) setSelectedIds(new Set(students.map(s => s.studentId)));
        else setSelectedIds(new Set());
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`Delete ${selectedIds.size} students?`)) return;
        try {
            for (let id of selectedIds) {
                await studentService.deleteStudent(id);
            }
            message.success('Deleted');
            setSelectedIds(new Set());
            loadData();
        } catch (e) { message.error('Failed to delete some items'); }
    };

    const handleOpenProfile = (student) => {
        setSelectedStudent(student);
        setUserTransactions([]); // Reset
        fetchUserTransactions(student.studentId);
        setShowProfileModal(true);
    };

    const downloadQR = () => {
        const canvas = document.getElementById('qr-canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = `QR_${selectedStudent?.studentId}.png`;
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
                    <div className={`vb-menu-item ${view === 'reports' ? 'active' : ''}`} onClick={() => { setView('reports'); fetchReport(); }}>
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

                        <div className="vb-toolbar">
                            <input className="vb-search" placeholder="Search by name, ID, or grade..." value={searchText} onChange={e => setSearchText(e.target.value)} />
                            <button className="vb-btn vb-btn-blue" onClick={() => setShowAddModal(true)}>+ Add Student</button>
                            <button className="vb-btn vb-btn-grey" onClick={handleDeleteSelected}>Remove Selected ({selectedIds.size})</button>
                        </div>

                        <div className="vb-table-container">
                            <table className="vb-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: 30 }}><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.size === students.length && students.length > 0} /></th>
                                        <th>Student ID</th>
                                        <th>Full Name</th>
                                        <th>Grade & Section</th>
                                        <th>Balance</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(s => (
                                        <tr key={s.studentId} style={{ backgroundColor: selectedIds.has(s.studentId) ? '#e6f7ff' : 'white' }}>
                                            <td><input type="checkbox" checked={selectedIds.has(s.studentId)} onChange={() => handleToggleSelect(s.studentId)} /></td>
                                            <td>{s.studentId}</td>
                                            <td>
                                                <span
                                                    onClick={() => handleOpenProfile(s)}
                                                    style={{ color: '#000080', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}
                                                >
                                                    {s.fullName}
                                                </span>
                                            </td>
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
                        <div style={{ background: '#f0f0f0', padding: 20, marginBottom: 20, border: '1px solid #ccc', borderRadius: 10 }}>
                            <h3 style={{ marginTop: 0, color: '#333' }}>Hourly Sales Trend (Today)</h3>
                            <div style={{ display: 'flex', alignItems: 'flex-end', height: 150, gap: 10, paddingBottom: 20, borderBottom: '1px solid #999' }}>
                                {graphData.map(d => (
                                    <div key={d.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                                        <div style={{ width: '60%', background: '#000080', height: `${Math.min(d.total * 2, 120)}px`, minHeight: d.total > 0 ? 2 : 0, transition: 'height 0.3s' }}></div>
                                        <div style={{ fontSize: 10, marginTop: 5 }}>{d.hour}:00</div>
                                    </div>
                                ))}
                            </div>
                        </div>
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

                {view === 'reports' && (
                    <>
                        <div className="vb-page-title">Daily Financial Reports</div>
                        <div className="vb-toolbar">
                            <input type="date" className="vb-search" value={reportDate} onChange={e => setReportDate(e.target.value)} />
                            <button className="vb-btn vb-btn-blue" onClick={fetchReport}>Load Report</button>
                        </div>
                        {reportData && (
                            <>
                                <div className="vb-stats-row">
                                    <div className="vb-card">
                                        <div className="vb-card-label">Total Sales</div>
                                        <div className="vb-card-value" style={{ color: '#000080' }}>SAR {reportData.canteen?.totalSales?.toFixed(2)}</div>
                                    </div>
                                    <div className="vb-card">
                                        <div className="vb-card-label">Cash Collected</div>
                                        <div className="vb-card-value" style={{ color: 'green' }}>SAR {reportData.canteen?.cashCollected?.toFixed(2)}</div>
                                    </div>
                                    <div className="vb-card">
                                        <div className="vb-card-label">Credit Issued</div>
                                        <div className="vb-card-value" style={{ color: 'orange' }}>SAR {reportData.canteen?.totalCredit?.toFixed(2)}</div>
                                    </div>
                                </div>
                                <div className="vb-table-container">
                                    <table className="vb-table">
                                        <thead><tr><th>Time</th><th>Student</th><th>Type</th><th>Amount</th></tr></thead>
                                        <tbody>
                                            {(reportData.canteen?.transactions || []).map((t, i) => (
                                                <tr key={i}>
                                                    <td>{new Date(t.timestamp).toLocaleTimeString()}</td>
                                                    <td>{t.studentName}</td>
                                                    <td>{t.type}</td>
                                                    <td>SAR {parseFloat(t.amount).toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </>
                )}

                {view === 'system' && (
                    <>
                        <div className="vb-page-title">System Overview</div>
                        <div className="vb-stats-row">
                            <div className="vb-card">
                                <div className="vb-card-label">System Cash on Hand</div>
                                <div className="vb-card-value" style={{ color: 'green' }}>SAR {dailyStats.system?.totalCashOnHand?.toFixed(2)}</div>
                            </div>
                            <div className="vb-card">
                                <div className="vb-card-label">Total Debt (Pending)</div>
                                <div className="vb-card-value" style={{ color: 'red' }}>SAR {totalCredit.toFixed(2)}</div>
                            </div>
                            <div className="vb-card">
                                <div className="vb-card-label">Today's Withdrawals</div>
                                <div className="vb-card-value" style={{ color: 'orange' }}>SAR {dailyStats.system?.todayWithdrawals?.toFixed(2)}</div>
                            </div>
                        </div>
                        <div className="vb-toolbar">
                            <button className="vb-btn vb-btn-blue" onClick={() => setShowWithdrawModal(true)}>Withdraw Cash</button>
                        </div>
                        <div className="vb-table-container">
                            <table className="vb-table">
                                <thead><tr><th>Time</th><th>Type</th><th>Amount</th></tr></thead>
                                <tbody>
                                    {(dailyStats.system?.transactions || []).map((t, i) => (
                                        <tr key={i}>
                                            <td>{new Date(t.timestamp).toLocaleTimeString()}</td>
                                            <td>{t.type}</td>
                                            <td>SAR {parseFloat(t.amount).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Modals */}
            {showAddModal && (
                <div className="vb-modal-overlay">
                    <div className="vb-modal">
                        <div className="vb-modal-header">Add New Student</div>
                        <div className="vb-form-group"><label>Name</label><input value={addForm.fullName} onChange={e => setAddForm({ ...addForm, fullName: e.target.value })} /></div>
                        <div className="vb-form-group"><label>Grade (e.g. 10 - Newton)</label><input value={addForm.gradeSection} onChange={e => setAddForm({ ...addForm, gradeSection: e.target.value })} /></div>
                        <div className="vb-form-group"><label>LRN (12 Digits)</label><input value={addForm.lrn} onChange={e => setAddForm({ ...addForm, lrn: e.target.value })} maxLength={12} placeholder="xxxxxxxxxxxx" /></div>
                        <div className="vb-form-group"><label>Auto-Generated Passkey</label><input value={generatedPasskey} disabled style={{ background: '#eee', color: '#000080', fontWeight: 'bold' }} /></div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="vb-btn vb-btn-grey" onClick={() => setShowAddModal(false)}>Cancel</button>
                            <button className="vb-btn vb-btn-blue" onClick={handleAddStudent}>Save Student</button>
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

            {showWithdrawModal && (
                <div className="vb-modal-overlay">
                    <div className="vb-modal">
                        <div className="vb-modal-header">System Withdrawal</div>
                        <div className="vb-form-group"><label>Amount (SAR)</label><input type="number" value={withdrawForm.amount} onChange={e => setWithdrawForm({ ...withdrawForm, amount: e.target.value })} /></div>
                        <div className="vb-form-group"><label>Admin PIN (170206)</label><input type="password" value={withdrawForm.passkey} onChange={e => setWithdrawForm({ ...withdrawForm, passkey: e.target.value })} /></div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="vb-btn vb-btn-grey" onClick={() => setShowWithdrawModal(false)}>Cancel</button>
                            <button className="vb-btn vb-btn-blue" onClick={handleWithdraw}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {showProfileModal && (
                <div className="vb-modal-overlay">
                    <div className="vb-modal" style={{ width: '900px', maxWidth: '95%', height: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div className="vb-modal-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Student Profile</span>
                            <button onClick={() => setShowProfileModal(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
                        </div>
                        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 20 }}>
                            {/* Left Panel: Info */}
                            <div style={{ width: '300px', background: '#f5f5f5', padding: 20, borderRadius: 10, border: '1px solid #ccc' }}>

                                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                                    <div style={{ width: 100, height: 100, background: '#e0e0e0', borderRadius: '50%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: '#999' }}>👤</div>
                                    <h3>{selectedStudent?.fullName}</h3>
                                    <div style={{ color: '#666' }}>{selectedStudent?.studentId}</div>
                                </div>

                                <div className="vb-form-group">
                                    <label>Grade & Section</label>
                                    <div style={{ padding: 8, background: '#fff', border: '1px solid #ccc' }}>{selectedStudent?.gradeSection}</div>
                                </div>
                                <div className="vb-form-group">
                                    <label>Current Balance</label>
                                    <div style={{ padding: 8, background: '#fff', border: '1px solid #ccc', color: selectedStudent?.balance < 0 ? 'red' : 'green', fontWeight: 'bold' }}>
                                        SAR {parseFloat(selectedStudent?.balance || 0).toFixed(2)}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
                                    <button className="vb-btn vb-btn-blue" onClick={() => { setShowTopUpModal(true); }}>Top Up / Withdraw</button>
                                    <button className="vb-btn vb-btn-blue" onClick={() => { setShowQrModal(true); }}>View QR Code</button>
                                </div>
                            </div>

                            {/* Right Panel: History */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <h4>Transaction History</h4>
                                <div className="vb-table-container" style={{ flex: 1, overflowY: 'auto' }}>
                                    <table className="vb-table">
                                        <thead><tr><th>Time</th><th>Type</th><th>Amount</th></tr></thead>
                                        <tbody>
                                            {userTransactions.length === 0 ? (
                                                <tr><td colSpan={3} style={{ textAlign: 'center', padding: 20 }}>No transactions found.</td></tr>
                                            ) : (
                                                userTransactions.map((t, i) => (
                                                    <tr key={i}>
                                                        <td>{new Date(t.timestamp).toLocaleString()}</td>
                                                        <td>{t.type}</td>
                                                        <td style={{ fontWeight: 'bold' }}>SAR {parseFloat(t.amount).toFixed(2)}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
