import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import { studentService, transactionService } from '../services/api';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Windows98Dashboard.css';

// Admin Dashboard - Windows 98 Style Recreation
export default function AdminDashboard({ onLogout }) {
    const [view, setView] = useState('users');
    const [systemViewMode, setSystemViewMode] = useState('logs');
    const [usersViewMode, setUsersViewMode] = useState('all');
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');

    // Activity Tab (merged History + Logs)
    const [activityFilter, setActivityFilter] = useState('all'); // all, purchases, topups, system
    const [activitySearch, setActivitySearch] = useState('');

    // Selection for Delete
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Stats
    const [totalBal, setTotalBal] = useState(0);
    const [totalCredit, setTotalCredit] = useState(0);
    const [topupRequests, setTopupRequests] = useState([]);

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

    // Logs Filter
    const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
    const [logData, setLogData] = useState(null);

    // Online/Offline Status
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    // Bulk Top-Up
    const [showBulkTopUpModal, setShowBulkTopUpModal] = useState(false);
    const [bulkTopUpAmount, setBulkTopUpAmount] = useState('');

    useEffect(() => {
        loadData();
        loadLocalLogs();
        fetchRequests(); // load count for badge
        const socket = io('https://fugen-backend.onrender.com');
        socket.on('balanceUpdate', loadData);
        socket.on('studentCreated', loadData);
        socket.on('studentDeleted', loadData);
        return () => socket.disconnect();
    }, []);

    // Online/Offline listener
    useEffect(() => {
        const goOnline = () => setIsOnline(true);
        const goOffline = () => setIsOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => { window.removeEventListener('online', goOnline); window.removeEventListener('offline', goOffline); };
    }, []);

    // Auto-refresh Activity tab every 30s
    useEffect(() => {
        if (view !== 'activity') return;
        const interval = setInterval(() => fetchLogs(), 30000);
        return () => clearInterval(interval);
    }, [view, logDate]);

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
            }

            try {
                const wRes = await transactionService.getWeeklyStats();
                if (wRes.data.status === 'success') {
                    setGraphData(wRes.data.data);
                }
            } catch (err) {
                console.log('Weekly stats not available yet server-side, computing via dailies fallback...');
                try {
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    const promises = [];
                    for (let i = 0; i < 7; i++) {
                        const d = new Date();
                        d.setDate(d.getDate() - i);
                        const dateStr = d.toISOString().split('T')[0];
                        promises.push(transactionService.getDailyStats(dateStr, true).then(r => ({ dateStr, dayName: days[d.getDay()], data: r.data })));
                    }
                    const results = await Promise.all(promises);

                    const fallbackData = results.map(r => {
                        let totalSales = 0;
                        if (r.data && r.data.status === 'success' && r.data.data.canteen) {
                            totalSales = r.data.data.canteen.totalSales || 0;
                        }
                        return { name: r.dayName, date: r.dateStr, sales: totalSales };
                    }).sort((a, b) => a.date.localeCompare(b.date));

                    setGraphData(fallbackData);
                } catch (e2) {
                    console.log('Error computing fallback graph data:', e2.message);
                }
            }

        } catch (e) { console.error('Error loading main data:', e); } finally { setLoading(false); }
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

    const fetchRequests = async () => {
        try {
            const res = await transactionService.getTopupRequests();
            if (res.data && res.data.data) {
                setTopupRequests(res.data.data);
            }
        } catch (e) { }
    };

    const handleResolveRequest = async (id) => {
        try {
            await transactionService.resolveTopupRequest(id);
            message.success('Request Resolved');
            addAuditLog('RESOLVE_REQUEST', `Resolved top-up request ${id}`);
            fetchRequests();
        } catch (e) { message.error('Failed to resolve'); }
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
            if (!confirm(`Withdraw SAR ${withdrawForm.amount} from the system?`)) return;
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

    // Generates a styled composite image: QR + name + ID + grade
    const buildQRCardCanvas = async (student) => {
        const cardW = 500, cardH = 650;
        const offscreen = document.createElement('canvas');
        offscreen.width = cardW;
        offscreen.height = cardH;
        const ctx = offscreen.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cardW, cardH);

        // Generate QR into temp canvas
        const qrCanvas = document.createElement('canvas');
        await QRCode.toCanvas(qrCanvas, `FUGEN:${student.studentId}`, { width: 300, margin: 1 });

        // Draw QR centred
        const qrX = (cardW - 300) / 2;
        ctx.drawImage(qrCanvas, qrX, 60, 300, 300);

        // Name
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(student.fullName, cardW / 2, 420);

        // ID
        ctx.fillStyle = '#666666';
        ctx.font = '22px Arial';
        ctx.fillText(`ID: ${student.studentId}`, cardW / 2, 470);

        // Grade
        ctx.fillText(`Grade: ${student.gradeSection}`, cardW / 2, 515);

        return offscreen;
    };

    const downloadQR = async () => {
        if (!selectedStudent) return;
        try {
            const card = await buildQRCardCanvas(selectedStudent);
            addAuditLog('DOWNLOAD_QR', `Downloaded QR Code for ${selectedStudent.studentId}`);
            const link = document.createElement('a');
            link.download = `QR_${selectedStudent.studentId}_${selectedStudent.fullName}.png`;
            link.href = card.toDataURL('image/png');
            link.click();
        } catch (e) { message.error('Failed to generate QR image'); }
    };

    const printQR = async () => {
        if (!selectedStudent) return;
        try {
            const card = await buildQRCardCanvas(selectedStudent);
            const dataUrl = card.toDataURL('image/png');
            const win = window.open('', '_blank');
            win.document.write(`
                <html><head><title>QR - ${selectedStudent.fullName}</title>
                <style>
                    @media print { body { margin: 0; } }
                    body { background: #fff; display: flex; justify-content: center; padding: 30px; font-family: Arial; }
                    img { max-width: 100%; }
                </style></head>
                <body><img src="${dataUrl}" /></body></html>
            `);
            win.document.close();
            setTimeout(() => win.print(), 400);
        } catch (e) { message.error('Failed to print QR'); }
    };

    const massPrintQR = async () => {
        const studentsToPrint = selectedIds.size > 0
            ? students.filter(s => selectedIds.has(s.studentId))
            : students;
        if (studentsToPrint.length === 0) { message.warning('No students to print'); return; }

        message.loading({ content: `Generating ${studentsToPrint.length} QR cards...`, key: 'massPrint', duration: 0 });
        try {
            const cards = await Promise.all(studentsToPrint.map(s => buildQRCardCanvas(s)));
            message.destroy('massPrint');

            const win = window.open('', '_blank');
            win.document.write(`
                <html><head><title>Mass QR Print</title>
                <style>
                    @page { size: A4; margin: 10mm; }
                    @media print { body { margin: 0; } .card { break-inside: avoid; } }
                    body { background: #fff; font-family: Arial; margin: 0; padding: 10px; }
                    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                    .card { text-align: center; padding: 10px; border: 1px solid #eee; border-radius: 8px; }
                    .card img { width: 100%; max-width: 220px; }
                </style></head><body><div class="grid">
            `);
            cards.forEach((c, i) => {
                win.document.write(`<div class="card"><img src="${c.toDataURL('image/png')}" /></div>`);
            });
            win.document.write('</div></body></html>');
            win.document.close();
            setTimeout(() => win.print(), 600);
            addAuditLog('MASS_PRINT_QR', `Mass printed ${studentsToPrint.length} QR codes`);
        } catch (e) { message.destroy('massPrint'); message.error('Failed to generate mass print'); }
    };


    const handleBulkTopUp = async () => {
        if (selectedIds.size === 0) { message.warning('No students selected'); return; }
        const amt = parseFloat(bulkTopUpAmount);
        if (!amt || amt <= 0) { message.error('Enter a valid amount'); return; }
        if (!confirm(`Top up SAR ${amt} to ${selectedIds.size} students?`)) return;

        let success = 0;
        for (const id of selectedIds) {
            try {
                await transactionService.topUp(id, amt);
                success++;
            } catch (e) { console.error('Bulk topup failed for', id); }
        }
        addAuditLog('BULK_TOPUP', `Bulk top-up SAR ${amt} to ${success}/${selectedIds.size} students`);
        message.success(`Topped up ${success} of ${selectedIds.size} students`);
        setShowBulkTopUpModal(false);
        setBulkTopUpAmount('');
        setSelectedIds(new Set());
        loadData();
    };

    const handleMonthlyExport = async () => {
        const month = reportDate.substring(0, 7); // e.g. '2026-02'
        const [year, mon] = month.split('-').map(Number);
        const daysInMonth = new Date(year, mon, 0).getDate();

        message.loading({ content: 'Generating monthly report...', key: 'monthExport', duration: 0 });

        let allTransactions = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            try {
                const res = await transactionService.getDailyStats(dateStr);
                if (res.data.status === 'success' && res.data.data.canteen?.transactions) {
                    allTransactions.push(...res.data.data.canteen.transactions);
                }
            } catch (e) { /* skip */ }
        }

        message.destroy('monthExport');

        if (allTransactions.length === 0) { message.warning('No transactions found for this month'); return; }

        let csv = 'Date,Time,Student,Type,Amount\n';
        allTransactions.forEach(t => {
            csv += `${new Date(t.timestamp).toLocaleDateString()},${new Date(t.timestamp).toLocaleTimeString()},"${t.studentName}",${t.type},${t.amount}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Monthly_Report_${month}.csv`;
        a.click();
        addAuditLog('EXPORT_MONTHLY', `Exported monthly report for ${month} (${allTransactions.length} transactions)`);
        message.success(`Exported ${allTransactions.length} transactions for ${month}`);
    };

    // Removed Window Controls as requested
    const WindowControls = () => null;

    // Rendering Helpers
    const filtered = students.filter(s => s.fullName.toLowerCase().includes(searchText.toLowerCase()) || s.studentId.includes(searchText));

    const fetchLogs = async (dateStr) => {
        try {
            const res = await transactionService.getDailyStats(dateStr || logDate);
            if (res.data.status === 'success') {
                setLogData(res.data.data);
            }
        } catch (e) { console.error('Failed to load logs:', e); }
    };

    // Combine Logs: Server Transactions + Local Audit Logs
    const logSource = logData || dailyStats;
    const combinedLogs = [
        ...localAuditLogs.filter(l => {
            if (!l.timestamp) return true;
            return l.timestamp.startsWith(logDate);
        }).map(l => ({ ...l, isLocal: true })),
        ...(logSource.system?.transactions || []).map(t => ({ ...t, location: 'ADMIN' })),
        ...(logSource.canteen?.transactions || []).map(t => ({ ...t, location: 'CASHIER' }))
    ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
        .filter(t => {
            if (activityFilter === 'purchases') return t.type === 'PURCHASE';
            if (activityFilter === 'topups') return t.type === 'TOPUP';
            if (activityFilter === 'system') return t.type === 'WITHDRAWAL' || t.isLocal;
            return true;
        })
        .filter(t => {
            if (!activitySearch) return true;
            const s = activitySearch.toLowerCase();
            return (t.studentName || '').toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s) || (t.type || '').toLowerCase().includes(s);
        });

    // Report Insights
    const reportInsights = (() => {
        if (!reportData?.canteen?.transactions?.length) return null;
        const txns = reportData.canteen.transactions;
        // Busiest hour
        const hourCounts = {};
        txns.forEach(t => { const h = new Date(t.timestamp).getHours(); hourCounts[h] = (hourCounts[h] || 0) + 1; });
        const busiestHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
        // Top spender
        const spenderTotals = {};
        txns.filter(t => t.type === 'PURCHASE').forEach(t => { spenderTotals[t.studentName] = (spenderTotals[t.studentName] || 0) + parseFloat(t.amount); });
        const topSpender = Object.entries(spenderTotals).sort((a, b) => b[1] - a[1])[0];
        // Average transaction
        const purchases = txns.filter(t => t.type === 'PURCHASE');
        const avgAmount = purchases.length > 0 ? purchases.reduce((s, t) => s + parseFloat(t.amount), 0) / purchases.length : 0;
        return {
            busiestHour: busiestHour ? `${busiestHour[0]}:00 (${busiestHour[1]} txns)` : 'N/A',
            topSpender: topSpender ? `${topSpender[0]} (SAR ${topSpender[1].toFixed(2)})` : 'N/A',
            avgTransaction: `SAR ${avgAmount.toFixed(2)}`
        };
    })();

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
                    <div className={`win98-menu-item ${view === 'activity' ? 'active' : ''}`} onClick={() => { setView('activity'); fetchLogs(); }}>
                        Activity
                    </div>
                    <div className={`win98-menu-item ${view === 'reports' ? 'active' : ''}`} onClick={() => { setView('reports'); fetchReport(); }}>
                        Reports
                    </div>
                    <div className={`win98-menu-item ${view === 'system' ? 'active' : ''}`} onClick={() => setView('system')}>
                        System
                    </div>
                    <div className={`win98-menu-item ${view === 'requests' ? 'active' : ''}`} onClick={() => { setView('requests'); fetchRequests(); }} style={{ position: 'relative' }}>
                        Requests {topupRequests.length > 0 && <span style={{ background: 'red', color: 'white', borderRadius: '50%', padding: '1px 6px', fontSize: 10, marginLeft: 5 }}>{topupRequests.length}</span>}
                    </div>
                </div>
                <div className="win98-menu-item" onClick={onLogout} style={{ marginTop: 'auto' }}>
                    Logout
                </div>
            </div>

            {/* Main Content (Desktop) */}
            <div className="win98-main">

                {/* Offline Banner */}
                {!isOnline && (
                    <div style={{ background: '#c0392b', color: 'white', padding: '8px 15px', textAlign: 'center', fontSize: 13, fontWeight: 'bold' }}>
                        ⚠ You are offline. Data may be stale.
                    </div>
                )}

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
                                        <button className="win98-btn" onClick={() => { if (selectedIds.size === 0) { message.warning('Select students first'); return; } setShowBulkTopUpModal(true); }}>Bulk Top Up ({selectedIds.size})</button>
                                        <button className="win98-btn" onClick={massPrintQR}>🖨️ Mass Print QR {selectedIds.size > 0 ? `(${selectedIds.size})` : '(All)'}</button>
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

                {view === 'activity' && (
                    <div className="win98-window" style={{ flex: 1 }}>
                        <div className="win98-title-bar"><span>Activity &amp; Logs</span><WindowControls /></div>
                        <div className="win98-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div className="win98-toolbar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <input type="date" className="win98-input" value={logDate} onChange={e => setLogDate(e.target.value)} />
                                <button className="win98-btn" onClick={() => fetchLogs()}>Load</button>
                                <div style={{ borderLeft: '1px solid #888', height: 20 }}></div>
                                <button className={`win98-btn ${activityFilter === 'all' ? 'active' : ''}`} onClick={() => setActivityFilter('all')}>All</button>
                                <button className={`win98-btn ${activityFilter === 'purchases' ? 'active' : ''}`} onClick={() => setActivityFilter('purchases')}>Purchases</button>
                                <button className={`win98-btn ${activityFilter === 'topups' ? 'active' : ''}`} onClick={() => setActivityFilter('topups')}>Top-ups</button>
                                <button className={`win98-btn ${activityFilter === 'system' ? 'active' : ''}`} onClick={() => setActivityFilter('system')}>System</button>
                                <div style={{ flex: 1 }}></div>
                                <input className="win98-input" placeholder="Search student..." value={activitySearch} onChange={e => setActivitySearch(e.target.value)} style={{ width: 150 }} />
                            </div>
                            <div className="win98-table-wrapper">
                                <table className="win98-table">
                                    <thead><tr><th>Time</th><th>Role</th><th>Type</th><th>Student</th><th>Amount</th><th>Details</th></tr></thead>
                                    <tbody>
                                        {combinedLogs.length === 0 ? (
                                            <tr><td colSpan={6} style={{ textAlign: 'center' }}>No activity found for this date.</td></tr>
                                        ) : (
                                            combinedLogs.map((t, i) => (
                                                <tr key={i}>
                                                    <td>{new Date(t.timestamp).toLocaleString()}</td>
                                                    <td style={{ fontWeight: 'bold', color: t.location === 'ADMIN' || t.isLocal ? 'blue' : 'green' }}>
                                                        {t.isLocal ? 'Admin' : (t.location === 'ADMIN' ? 'Admin' : 'Cashier')}
                                                    </td>
                                                    <td>{t.type}</td>
                                                    <td>{t.studentName || '-'}</td>
                                                    <td>{t.amount ? `SAR ${parseFloat(t.amount).toFixed(2)}` : '-'}</td>
                                                    <td>{t.description || (t.cashAmount > 0 && t.creditAmount > 0 ? 'Mixed' : t.cashAmount > 0 ? 'Cash' : t.creditAmount > 0 ? 'Credit' : '')}</td>
                                                </tr>
                                            ))
                                        )}
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
                                <button className="win98-btn" onClick={handleExportData}>Export Day</button>
                                <button className="win98-btn" onClick={handleMonthlyExport}>Export Month</button>
                            </div>

                            {/* Weekly Sales Graph */}
                            {graphData && graphData.length > 0 && (
                                <div style={{ marginBottom: '20px', padding: '10px', background: 'white', border: '2px solid', borderColor: '#dfdfdf #000 #000 #dfdfdf' }}>
                                    <h4 style={{ marginTop: 0, marginBottom: '10px', fontSize: '14px' }}>Weekly Sales Overview</h4>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={graphData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.5} />
                                            <XAxis dataKey="name" fontSize={12} />
                                            <YAxis fontSize={12} />
                                            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.1)' }} />
                                            <Bar dataKey="sales" fill="#000080" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

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
                                    {reportInsights && (
                                        <div className="win98-stats-row" style={{ marginTop: 10 }}>
                                            <div className="win98-card">
                                                <div className="win98-card-label">Busiest Hour</div>
                                                <div className="win98-card-value" style={{ fontSize: 13 }}>{reportInsights.busiestHour}</div>
                                            </div>
                                            <div className="win98-card">
                                                <div className="win98-card-label">Top Spender</div>
                                                <div className="win98-card-value" style={{ fontSize: 13 }}>{reportInsights.topSpender}</div>
                                            </div>
                                            <div className="win98-card">
                                                <div className="win98-card-label">Avg Transaction</div>
                                                <div className="win98-card-value" style={{ fontSize: 13 }}>{reportInsights.avgTransaction}</div>
                                            </div>
                                        </div>
                                    )}
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



                {view === 'requests' && (
                    <div className="win98-window" style={{ flex: 1 }}>
                        <div className="win98-title-bar"><span>Top Up Requests</span><WindowControls /></div>
                        <div className="win98-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div className="win98-toolbar">
                                <button className="win98-btn" onClick={fetchRequests}>Refresh Inbox</button>
                            </div>
                            <div className="win98-table-wrapper">
                                <table className="win98-table">
                                    <thead><tr><th>Date Request</th><th>Student</th><th>Amount to Collect</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {topupRequests.length === 0 ? (
                                            <tr><td colSpan={4} style={{ textAlign: 'center' }}>No pending top-up requests.</td></tr>
                                        ) : (
                                            topupRequests.map((req, i) => (
                                                <tr key={i}>
                                                    <td>{req.date}</td>
                                                    <td style={{ fontWeight: 'bold' }}>{req.studentName} ({req.studentId})</td>
                                                    <td style={{ color: 'green', fontWeight: 'bold' }}>SAR {req.amount.toFixed(2)}</td>
                                                    <td>
                                                        <button className="win98-btn" style={{ padding: '2px 5px' }} onClick={() => handleResolveRequest(req.id)}>Mark Collected</button>
                                                    </td>
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
                            <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginTop: 10 }}>
                                <button className="win98-btn" onClick={downloadQR}>Download</button>
                                <button className="win98-btn" onClick={printQR}>Print</button>
                            </div>
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

            {showBulkTopUpModal && (
                <div className="win98-modal-overlay">
                    <div className="win98-modal">
                        <div className="win98-title-bar"><span>Bulk Top Up</span><div className="win98-control-btn" onClick={() => setShowBulkTopUpModal(false)}>×</div></div>
                        <div className="win98-content">
                            <p>Top up <b>{selectedIds.size}</b> selected students:</p>
                            <div className="vb-form-group"><label>Amount per student</label><input type="number" className="win98-input" value={bulkTopUpAmount} onChange={e => setBulkTopUpAmount(e.target.value)} style={{ width: '95%' }} /></div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                                <button className="win98-btn" onClick={() => setShowBulkTopUpModal(false)}>Cancel</button>
                                <button className="win98-btn" onClick={handleBulkTopUp}>Confirm</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
