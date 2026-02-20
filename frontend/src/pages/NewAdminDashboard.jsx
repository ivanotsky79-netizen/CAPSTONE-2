import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { studentService, transactionService } from '../services/api';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import './Windows98Dashboard.css';

// Admin Dashboard - Windows 98 Style Recreation
export default function AdminDashboard({ onLogout }) {
    const [view, setView] = useState('users'); // users, transactions, reports, system, logs
    const [systemViewMode, setSystemViewMode] = useState('logs');
    const [usersViewMode, setUsersViewMode] = useState('all'); // 'all' or 'debtors'
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

    // Import/Export State
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

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

    // Local Audit Log Implementation
    const [localAuditLogs, setLocalAuditLogs] = useState([]);

    useEffect(() => {
        loadData();
        loadLocalLogs(); // Load audit logs from localStorage
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

    const loadLocalLogs = () => {
        const stored = localStorage.getItem('win98_admin_logs');
        if (stored) setLocalAuditLogs(JSON.parse(stored));
    };

    const addAuditLog = (action, details) => {
        const newLog = {
            timestamp: new Date().toISOString(),
            location: 'ADMIN',
            type: action,
            description: details,
            amount: 0 // System action, 0 value
        };
        const updated = [newLog, ...localAuditLogs];
        setLocalAuditLogs(updated);
        localStorage.setItem('win98_admin_logs', JSON.stringify(updated));
    };

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
            const res = await transactionService.getTransactions(id);
            if (res.data && res.data.data) {
                setUserTransactions(res.data.data);
            } else {
                setUserTransactions([]);
            }
        } catch (e) {
            setUserTransactions([]);
        }
    };

    // --- Bulk Import Logic ---
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target.result;
            const lines = text.split('\n');
            const data = [];
            // Skip header if present (Assuming: Name, Grade, LRN)
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',');
                if (cols.length >= 3) {
                    const name = cols[0].trim();
                    const grade = cols[1].trim();
                    const lrn = cols[2].trim();
                    if (name && lrn) data.push({ fullName: name, gradeSection: grade, lrn });
                }
            }

            if (data.length === 0) { message.error('No valid data found in CSV'); return; }
            if (!confirm(`Import ${data.length} students?`)) return;

            setIsImporting(true);
            setImportProgress({ current: 0, total: data.length });

            addAuditLog('IMPORT_START', `Started bulk import of ${data.length} records via CSV`);

            let successCount = 0;
            for (let i = 0; i < data.length; i++) {
                try {
                    const item = data[i];
                    // Auto-passkey logic
                    const passkey = item.lrn.length >= 12 ? (item.lrn[2] + item.lrn[5] + item.lrn[8] + item.lrn[11]) : '1234';
                    await studentService.createStudent({ ...item, passkey });
                    successCount++;
                } catch (err) { console.error('Failed to import', data[i], err); }
                setImportProgress({ current: i + 1, total: data.length });
            }

            setIsImporting(false);
            addAuditLog('IMPORT_COMPLETE', `Completed import. Success: ${successCount}. Fail: ${data.length - successCount}`);
            message.success(`Imported ${successCount} of ${data.length} students`);
            loadData();
        };
        reader.readAsText(file);
    };

    // --- Export Logic ---
    const handleExportData = () => {
        // Export current daily report or transactions
        const data = reportData?.canteen?.transactions || dailyStats.canteen?.transactions || [];
        if (data.length === 0) { message.warning('No data to export'); return; }

        addAuditLog('EXPORT_DATA', `User exported transaction history to Excel/CSV`);

        let csv = 'Date,Time,Student,Type,Amount\n';
        data.forEach(t => {
            csv += `${new Date(t.timestamp).toLocaleDateString()},${new Date(t.timestamp).toLocaleTimeString()},"${t.studentName}",${t.type},${t.amount}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Transactions_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    // Actions
    const handleAddStudent = async () => {
        try {
            if (!generatedPasskey) { message.error('Invalid LRN'); return; }
            await studentService.createStudent({ ...addForm, passkey: generatedPasskey });
            addAuditLog('ADD_STUDENT', `Created student: ${addForm.fullName} (${addForm.lrn})`);
            message.success('Student Added');
            setShowAddModal(false); setAddForm({ fullName: '', gradeSection: '', lrn: '' }); loadData();
        } catch (e) { message.error('Failed'); }
    };

    const handleTopUp = async () => {
        if (!selectedStudent) return;
        try {
            await studentService.verifyPasskey(selectedStudent.studentId, topUpForm.passkey);
            await transactionService.topUp(selectedStudent.studentId, topUpForm.amount);
            addAuditLog('TOP_UP', `Added SAR ${topUpForm.amount} to ${selectedStudent.fullName} (${selectedStudent.studentId})`);
            message.success('Success');
            setShowTopUpModal(false); setTopUpForm({ amount: '', passkey: '' }); loadData();
            if (showProfileModal) fetchUserTransactions(selectedStudent.studentId);
        } catch (e) { message.error('Failed'); }
    };

    const handleWithdraw = async () => {
        try {
            if (withdrawForm.passkey !== '170206') { message.error('Invalid Admin PIN'); return; }
            await transactionService.withdraw(withdrawForm.amount, withdrawForm.passkey);
            addAuditLog('WITHDRAW_CASH', `Admin withdrew SAR ${withdrawForm.amount} from system`);
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
            const count = selectedIds.size;
            addAuditLog('DELETE_STUDENT', `Deleted ${count} students. IDs: ${Array.from(selectedIds).join(', ')}`);
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
        setUserTransactions([]);
        fetchUserTransactions(student.studentId);
        setShowProfileModal(true);
    };

    const downloadQR = () => {
        const canvas = document.getElementById('qr-canvas');
        if (canvas) {
            addAuditLog('DOWNLOAD_QR', `Downloaded QR Code for ${selectedStudent?.studentId}`);
            const link = document.createElement('a');
            link.download = `QR_${selectedStudent?.studentId}.png`;
            link.href = canvas.toDataURL();
            link.click();
        }
    };

    // Removed Window Controls as requested
    const WindowControls = () => null;

    // Rendering Helpers
    const filtered = students.filter(s => s.fullName.toLowerCase().includes(searchText.toLowerCase()) || s.studentId.includes(searchText));

    // Combine Logs: Server Transactions + Local Audit Logs
    const combinedLogs = [
        ...localAuditLogs.map(l => ({ ...l, isLocal: true })),
        ...(dailyStats.system?.transactions || []).map(t => ({ ...t, location: 'ADMIN' })),
        ...(dailyStats.canteen?.transactions || []).map(t => ({ ...t, location: 'CASHIER' }))
    ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    return (
        <div className="win98-container">
            {/* Sidebar (Start Menu Style) */}
            <div className="win98-sidebar">
                <div className="win98-sidebar-header">
                    <span>Menu</span>
                </div>
                <div className="win98-menu">
                    <div className={`win98-menu-item ${view === 'users' ? 'active' : ''}`} onClick={() => setView('users')}>
                        Users
                    </div>
                    <div className={`win98-menu-item ${view === 'transactions' ? 'active' : ''}`} onClick={() => setView('transactions')}>
                        History
                    </div>
                    <div className={`win98-menu-item ${view === 'reports' ? 'active' : ''}`} onClick={() => { setView('reports'); fetchReport(); }}>
                        Reports
                    </div>
                    <div className={`win98-menu-item ${view === 'system' ? 'active' : ''}`} onClick={() => setView('system')}>
                        System
                    </div>
                    <div className={`win98-menu-item ${view === 'logs' ? 'active' : ''}`} onClick={() => setView('logs')}>
                        Logs
                    </div>
                </div>
                <div className="win98-menu-item" onClick={onLogout} style={{ marginTop: 'auto' }}>
                    Logout
                </div>
            </div>

            {/* Main Content (Desktop) */}
            <div className="win98-main">

                {view === 'users' && (
                    <div className="win98-window" style={{ flex: 1 }}>
                        <div className="win98-title-bar">
                            <span>Student Management (Admin Only)</span>
                            <WindowControls />
                        </div>
                        <div className="win98-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

                            <div className="win98-stats-row">
                                <div className="win98-card">
                                    <div className="win98-card-label">Total Students</div>
                                    <div className="win98-card-value">{students.length}</div>
                                </div>
                                <div className="win98-card">
                                    <div className="win98-card-label">Total Balance</div>
                                    <div className="win98-card-value">SAR {totalBal.toFixed(2)}</div>
                                </div>
                                <div className="win98-card">
                                    <div className="win98-card-label">Total Debt</div>
                                    <div className="win98-card-value">{totalCredit.toFixed(2)}</div>
                                </div>
                            </div>

                            <div className="win98-toolbar">
                                <button className={`win98-btn ${usersViewMode === 'all' ? 'active' : ''}`} onClick={() => setUsersViewMode('all')}>All Students</button>
                                <button className={`win98-btn ${usersViewMode === 'debtors' ? 'active' : ''}`} onClick={() => setUsersViewMode('debtors')}>Students with Credit</button>
                                <div style={{ flex: 1 }}></div>
                                {usersViewMode === 'all' && (
                                    <>
                                        <input className="win98-input" placeholder="Search..." value={searchText} onChange={e => setSearchText(e.target.value)} />
                                        <button className="win98-btn" onClick={() => setShowAddModal(true)}>+ Add</button>
                                        <button className="win98-btn" onClick={() => {
                                            if (selectedIds.size === 0) { message.warning('Please select a student to Top Up.'); return; }
                                            if (selectedIds.size > 1) { message.warning('Please select only one student.'); return; }
                                            const id = Array.from(selectedIds)[0];
                                            const student = students.find(s => s.studentId === id);
                                            if (student) { setSelectedStudent(student); setShowTopUpModal(true); }
                                        }}>Top Up</button>
                                        <label className="win98-btn">
                                            📂 Import CSV
                                            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />
                                        </label>
                                        <button className="win98-btn" onClick={handleDeleteSelected}>Delete ({selectedIds.size})</button>
                                    </>
                                )}
                            </div>

                            <div className="win98-table-wrapper">
                                {usersViewMode === 'all' ? (
                                    <table className="win98-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: 30 }}><input type="checkbox" onChange={handleSelectAll} checked={selectedIds.size === students.length && students.length > 0} /></th>
                                                <th>ID</th>
                                                <th>Name</th>
                                                <th>Grade</th>
                                                <th>Balance</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filtered.map(s => (
                                                <tr key={s.studentId}>
                                                    <td><input type="checkbox" checked={selectedIds.has(s.studentId)} onChange={() => handleToggleSelect(s.studentId)} /></td>
                                                    <td>{s.studentId}</td>
                                                    <td>
                                                        <span
                                                            onClick={() => handleOpenProfile(s)}
                                                            style={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}
                                                        >
                                                            {s.fullName}
                                                        </span>
                                                    </td>
                                                    <td>{s.gradeSection}</td>
                                                    <td style={{ color: parseFloat(s.balance) < 0 ? 'red' : 'green' }}>SAR {parseFloat(s.balance).toFixed(2)}</td>
                                                    <td>
                                                        <button className="win98-btn" style={{ padding: '2px 5px', fontSize: 11 }} onClick={() => { setSelectedStudent(s); setShowQrModal(true); }}>QR</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <table className="win98-table">
                                        <thead><tr><th>ID</th><th>Name</th><th>Grade</th><th>Debt Amount</th><th>Action</th></tr></thead>
                                        <tbody>
                                            {students.filter(s => parseFloat(s.balance) < 0).length === 0 ? (
                                                <tr><td colSpan={5} style={{ textAlign: 'center' }}>✅ No students with outstanding credit.</td></tr>
                                            ) : (
                                                students.filter(s => parseFloat(s.balance) < 0).map(s => (
                                                    <tr key={s.studentId}>
                                                        <td>{s.studentId}</td>
                                                        <td style={{ fontWeight: 'bold' }}>
                                                            <span onClick={() => handleOpenProfile(s)} style={{ textDecoration: 'underline', cursor: 'pointer' }}>
                                                                {s.fullName}
                                                            </span>
                                                        </td>
                                                        <td>{s.gradeSection}</td>
                                                        <td style={{ color: 'red', fontWeight: 'bold' }}>{Math.abs(parseFloat(s.balance)).toFixed(2)} Points</td>
                                                        <td>
                                                            <button className="win98-btn" style={{ padding: '2px 5px' }} onClick={() => { setSelectedStudent(s); setShowTopUpModal(true); }}>Pay Debt</button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {view === 'transactions' && (
                    <div className="win98-window" style={{ flex: 1 }}>
                        <div className="win98-title-bar"><span>Transaction History</span><WindowControls /></div>
                        <div className="win98-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

                            <div style={{ border: '2px inset #fff', background: '#ccc', padding: 5, marginBottom: 10 }}>
                                <h3 style={{ marginTop: 0, fontSize: 14 }} color="black">Hourly Sales</h3>
                                <div style={{ display: 'flex', alignItems: 'flex-end', height: 100, gap: 5 }}>
                                    {graphData.map(d => (
                                        <div key={d.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                                            <div className="win98-bar" style={{ width: '60%', height: `${Math.min(d.total * 2, 80)}px` }}></div>
                                            <div style={{ fontSize: 10 }}>{d.hour}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="win98-table-wrapper">
                                <table className="win98-table">
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
                        </div>
                    </div>
                )}

                {view === 'reports' && (
                    <div className="win98-window" style={{ flex: 1 }}>
                        <div className="win98-title-bar"><span>Daily Financial Reports</span><WindowControls /></div>
                        <div className="win98-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div className="win98-toolbar">
                                <input type="date" className="win98-input" value={reportDate} onChange={e => setReportDate(e.target.value)} />
                                <button className="win98-btn" onClick={fetchReport}>Load Report</button>
                                <button className="win98-btn" onClick={handleExportData}>Export Excel</button>
                            </div>
                            {reportData && (
                                <>
                                    <div className="win98-stats-row">
                                        <div className="win98-card">
                                            <div className="win98-card-label">Total Sales</div>
                                            <div className="win98-card-value">SAR {reportData.canteen?.totalSales?.toFixed(2)}</div>
                                        </div>
                                        <div className="win98-card">
                                            <div className="win98-card-label">Cash</div>
                                            <div className="win98-card-value">SAR {reportData.canteen?.cashCollected?.toFixed(2)}</div>
                                        </div>
                                        <div className="win98-card">
                                            <div className="win98-card-label">Credit</div>
                                            <div className="win98-card-value">SAR {reportData.canteen?.totalCredit?.toFixed(2)}</div>
                                        </div>
                                    </div>
                                    <div className="win98-table-wrapper">
                                        <table className="win98-table">
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
                        </div>
                    </div>
                )}

                {view === 'system' && (
                    <div className="win98-window" style={{ flex: 1 }}>
                        <div className="win98-title-bar"><span>System Data</span><WindowControls /></div>
                        <div className="win98-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div className="win98-stats-row">
                                <div className="win98-card">
                                    <div className="win98-card-label">Cash on Hand</div>
                                    <div className="win98-card-value" style={{ color: 'green' }}>SAR {dailyStats.system?.totalCashOnHand?.toFixed(2)}</div>
                                </div>
                                <div className="win98-card">
                                    <div className="win98-card-label">Total Debt</div>
                                    <div className="win98-card-value" style={{ color: 'red' }}>SAR {totalCredit.toFixed(2)}</div>
                                </div>
                                <div className="win98-card">
                                    <div className="win98-card-label">Withdrawals</div>
                                    <div className="win98-card-value" style={{ color: 'orange' }}>SAR {dailyStats.system?.todayWithdrawals?.toFixed(2)}</div>
                                </div>
                            </div>
                            <div className="win98-toolbar">
                                <button className="win98-btn" onClick={() => setShowWithdrawModal(true)}>Withdraw Cash</button>
                            </div>
                            <div className="win98-table-wrapper">
                                <table className="win98-table">
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
                        </div>
                    </div>
                )}

                {view === 'logs' && (
                    <div className="win98-window" style={{ flex: 1 }}>
                        <div className="win98-title-bar"><span>Security & Activity Logs</span><WindowControls /></div>
                        <div className="win98-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div className="win98-toolbar" style={{ display: 'block' }}>
                                <div><b>Roles:</b> <span style={{ color: 'blue' }}>Admin</span> (This Dashboard) vs <span style={{ color: 'green' }}>Cashier</span> (Mobile App)</div>
                                <div style={{ fontSize: 10, marginTop: 5 }}>System tracks: Purchases, TopUps, Withdrawals, Student Deletions.</div>
                            </div>
                            <div className="win98-table-wrapper">
                                <table className="win98-table">
                                    <thead><tr><th>Time</th><th>Role</th><th>Action</th><th>Description</th></tr></thead>
                                    <tbody>
                                        {combinedLogs.length === 0 ? (
                                            <tr><td colSpan={4}>No activity logs yet.</td></tr>
                                        ) : (
                                            combinedLogs.map((t, i) => (
                                                <tr key={i}>
                                                    <td>{new Date(t.timestamp).toLocaleString()}</td>
                                                    <td style={{ fontWeight: 'bold', color: t.location === 'ADMIN' || t.isLocal ? 'blue' : 'green' }}>
                                                        {t.isLocal ? 'Admin Use' : (t.location === 'ADMIN' ? 'Admin' : 'Cashier')}
                                                    </td>
                                                    <td>{t.type}</td>
                                                    <td>{t.description ? t.description : `Amount: ${parseFloat(t.amount).toFixed(2)}`}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showAddModal && (
                <div className="win98-modal-overlay">
                    <div className="win98-modal">
                        <div className="win98-title-bar"><span>Add New Student</span><div className="win98-control-btn" onClick={() => setShowAddModal(false)}>×</div></div>
                        <div className="win98-content">
                            <div className="vb-form-group"><label>Name</label><input className="win98-input" value={addForm.fullName} onChange={e => setAddForm({ ...addForm, fullName: e.target.value })} style={{ width: '95%' }} /></div>
                            <div className="vb-form-group"><label>Grade</label><input className="win98-input" value={addForm.gradeSection} onChange={e => setAddForm({ ...addForm, gradeSection: e.target.value })} style={{ width: '95%' }} /></div>
                            <div className="vb-form-group"><label>LRN</label><input className="win98-input" value={addForm.lrn} onChange={e => setAddForm({ ...addForm, lrn: e.target.value })} maxLength={12} placeholder="12 digits" style={{ width: '95%' }} /></div>
                            <div className="vb-form-group"><label>Passkey</label><input className="win98-input" value={generatedPasskey} disabled style={{ background: '#eee', width: '95%' }} /></div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                                <button className="win98-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button className="win98-btn" onClick={handleAddStudent}>Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showTopUpModal && (
                <div className="win98-modal-overlay">
                    <div className="win98-modal">
                        <div className="win98-title-bar"><span>Top Up / Withdraw</span><div className="win98-control-btn" onClick={() => setShowTopUpModal(false)}>×</div></div>
                        <div className="win98-content">
                            <p>Student: <b>{selectedStudent?.fullName}</b></p>
                            <div className="vb-form-group"><label>Amount</label><input type="number" className="win98-input" value={topUpForm.amount} onChange={e => setTopUpForm({ ...topUpForm, amount: e.target.value })} style={{ width: '95%' }} /></div>
                            <div className="vb-form-group"><label>Passkey</label><input type="password" className="win98-input" value={topUpForm.passkey} onChange={e => setTopUpForm({ ...topUpForm, passkey: e.target.value })} style={{ width: '95%' }} /></div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                                <button className="win98-btn" onClick={() => setShowTopUpModal(false)}>Cancel</button>
                                <button className="win98-btn" onClick={handleTopUp}>Confirm</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showQrModal && (
                <div className="win98-modal-overlay">
                    <div className="win98-modal" style={{ width: 300 }}>
                        <div className="win98-title-bar"><span>QR Code</span><div className="win98-control-btn" onClick={() => setShowQrModal(false)}>×</div></div>
                        <div className="win98-content" style={{ textAlign: 'center' }}>
                            <h3>{selectedStudent?.fullName}</h3>
                            <canvas id="qr-canvas" ref={c => { if (c && selectedStudent) QRCode.toCanvas(c, `FUGEN:${selectedStudent.studentId}`, { width: 150 }); }} />
                            <br />
                            <button className="win98-btn" style={{ marginTop: 10 }} onClick={downloadQR}>Download</button>
                        </div>
                    </div>
                </div>
            )}

            {showWithdrawModal && (
                <div className="win98-modal-overlay">
                    <div className="win98-modal">
                        <div className="win98-title-bar"><span>System Withdrawal</span><div className="win98-control-btn" onClick={() => setShowWithdrawModal(false)}>×</div></div>
                        <div className="win98-content">
                            <div className="vb-form-group"><label>Amount</label><input type="number" className="win98-input" value={withdrawForm.amount} onChange={e => setWithdrawForm({ ...withdrawForm, amount: e.target.value })} style={{ width: '95%' }} /></div>
                            <div className="vb-form-group"><label>PIN</label><input type="password" className="win98-input" value={withdrawForm.passkey} onChange={e => setWithdrawForm({ ...withdrawForm, passkey: e.target.value })} style={{ width: '95%' }} /></div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                                <button className="win98-btn" onClick={() => setShowWithdrawModal(false)}>Cancel</button>
                                <button className="win98-btn" onClick={handleWithdraw}>Confirm</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showProfileModal && (
                <div className="win98-modal-overlay">
                    <div className="win98-modal" style={{ width: '800px', height: '500px' }}>
                        <div className="win98-title-bar"><span>Student Profile</span><div className="win98-control-btn" onClick={() => setShowProfileModal(false)}>×</div></div>
                        <div className="win98-content" style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 10 }}>
                            <div style={{ width: '250px', background: '#fff', border: '2px inset #fff', padding: 10 }}>
                                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                                    <h2>{selectedStudent?.fullName}</h2>
                                    <div>{selectedStudent?.studentId}</div>
                                </div>
                                <hr />
                                <div>Balance: <b>SAR {parseFloat(selectedStudent?.balance || 0).toFixed(2)}</b></div>
                                <div style={{ marginTop: 20 }}>
                                    <button className="win98-btn" style={{ width: '100%', marginBottom: 5 }} onClick={() => { setShowTopUpModal(true); }}>Top Up</button>
                                    <button className="win98-btn" style={{ width: '100%' }} onClick={() => { setShowQrModal(true); }}>QR Code</button>
                                </div>
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div className="win98-table-wrapper" style={{ flex: 1 }}>
                                    <table className="win98-table">
                                        <thead><tr><th>Time</th><th>Type</th><th>Amount</th></tr></thead>
                                        <tbody>
                                            {userTransactions.length === 0 ? (
                                                <tr><td colSpan={3}>No transactions found.</td></tr>
                                            ) : (
                                                userTransactions.map((t, i) => (
                                                    <tr key={i}>
                                                        <td>{new Date(t.timestamp).toLocaleString()}</td>
                                                        <td>{t.type}</td>
                                                        <td>SAR {parseFloat(t.amount).toFixed(2)}</td>
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
