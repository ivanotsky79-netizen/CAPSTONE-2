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
    const [diagnostics, setDiagnostics] = useState({ orphanRequests: [], collisionIds: [], nameMismatches: [] });
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');

    // Activity Tab (merged History + Logs)
    const [activityFilter, setActivityFilter] = useState('all'); // all, purchases, topups, system
    const [activitySearch, setActivitySearch] = useState('');

    // Selection for Delete
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [selectedRequestIds, setSelectedRequestIds] = useState(new Set());

    // Stats
    const [totalBal, setTotalBal] = useState(0);
    const [totalCredit, setTotalCredit] = useState(0);
    const [topupRequests, setTopupRequests] = useState([]);
    const [requestSearch, setRequestSearch] = useState('');
    const [reqFilterDate, setReqFilterDate] = useState(new Date().toISOString().split('T')[0]);
    const [reqFilterSlot, setReqFilterSlot] = useState('ALL');
    const [sortOrder, setSortOrder] = useState('newest'); // 'newest' (Last Joined) or 'oldest' (First Joined)
    const [showRequestHistory, setShowRequestHistory] = useState(false);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [showQrModal, setShowQrModal] = useState(false);
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showDeductModal, setShowDeductModal] = useState(false);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({ fullName: '', gradeSection: '', lrn: '', studentId: '' });
    const [rescheduleForm, setRescheduleForm] = useState({ date: '', timeSlot: 'HRO' });
    const [rescheduleId, setRescheduleId] = useState(null);

    // Import/Export State
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

    const [selectedStudent, setSelectedStudent] = useState(null);
    const [userTransactions, setUserTransactions] = useState([]);
    const [profileTab, setProfileTab] = useState('transactions');

    // Forms
    const [addForm, setAddForm] = useState({ fullName: '', gradeSection: '', lrn: '' });
    const [generatedPasskey, setGeneratedPasskey] = useState('');
    const [topUpForm, setTopUpForm] = useState({ amount: '', passkey: '' });
    const [withdrawForm, setWithdrawForm] = useState({ amount: '', passkey: '' });
    const [deductForm, setDeductForm] = useState({ amount: '', adminPin: '' });

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
        setLogData(null); // Clear old data when switching dates
        fetchLogs();
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

            // Sync logic: Total Cash = Sum of positive balances. Total Debt = Sum of negative balances.
            setTotalBal(allStudents.filter(s => parseFloat(s.balance) > 0).reduce((a, c) => a + (parseFloat(c.balance) || 0), 0));
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

    const handleUndoRequest = async (id, status) => {
        const action = status === 'RESOLVED' ? 'undo this collection (and subtract points)' : 'revert this reservation back to Pending';
        if (!confirm(`Are you sure you want to ${action}?`)) return;
        try {
            await transactionService.undoTopupRequest(id);
            message.success('Request reverted');
            addAuditLog('UNDO_REQUEST', `Undid top-up request ${id} (Previous status: ${status})`);
            fetchRequests();
            loadData(); // To sync balance if points were subtracted
        } catch (e) {
            console.error('Undo error:', e);
            message.error(e.response?.data?.message || 'Failed to undo');
        }
    };

    const handleApproveRequest = async (id) => {
        try {
            await transactionService.approveTopupRequest(id);
            message.success('Reservation Accepted and User Notified');
            addAuditLog('APPROVE_REQUEST', `Approved top-up reservation ${id}`);
            fetchRequests();
        } catch (e) { message.error('Failed to approve'); }
    };

    const handleRejectRequest = async (id) => {
        if (!confirm('Reject this top-up reservation? The student will be notified.')) return;
        try {
            await transactionService.rejectTopupRequest(id);
            message.success('Reservation Rejected');
            addAuditLog('REJECT_REQUEST', `Rejected top-up reservation ${id}`);
            fetchRequests();
        } catch (e) {
            console.error('Rejection failure:', e);
            const errorMsg = e.response?.data?.message || e.message || 'Failed to reject';
            message.error(`Failed to reject: ${errorMsg}`);
        }
    };

    const handleToggleSelectRequest = (id) => {
        const newSet = new Set(selectedRequestIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedRequestIds(newSet);
    };

    const handleBulkAcceptRequests = async () => {
        if (selectedRequestIds.size === 0) return;
        const toProcess = topupRequests.filter(r => selectedRequestIds.has(r.id) && r.status === 'PENDING');
        if (toProcess.length === 0) { message.warning('No Pending requests selected'); return; }
        if (!confirm(`Accept ${toProcess.length} reservations?`)) return;

        let ok = 0;
        for (const r of toProcess) {
            try {
                await transactionService.approveTopupRequest(r.id);
                ok++;
            } catch (e) { }
        }
        message.success(`Accepted ${ok} reservations`);
        addAuditLog('BULK_APPROVE', `Bulk accepted ${ok} reservations`);
        setSelectedRequestIds(new Set());
        fetchRequests();
    };

    const handleBulkResolveRequests = async () => {
        if (selectedRequestIds.size === 0) return;
        const toProcess = topupRequests.filter(r => selectedRequestIds.has(r.id) && r.status === 'ACCEPTED');
        if (toProcess.length === 0) { message.warning('No Accepted requests selected'); return; }
        if (!confirm(`Mark ${toProcess.length} requests as Collected?`)) return;

        let ok = 0;
        for (const r of toProcess) {
            try {
                await transactionService.resolveTopupRequest(r.id);
                ok++;
            } catch (e) { }
        }
        message.success(`Marked ${ok} as Collected`);
        addAuditLog('BULK_RESOLVE', `Bulk resolved ${ok} top-up collections`);
        setSelectedRequestIds(new Set());
        fetchRequests();
        loadData();
    };

    const runDiagnostics = () => {
        const orphans = topupRequests.filter(req => !students.find(s => s.studentId === req.studentId));

        const idMap = {};
        const collisions = [];
        students.forEach(s => {
            if (idMap[s.studentId]) {
                collisions.push(s.studentId);
            }
            idMap[s.studentId] = true;
        });

        // Detect Name Mismatches (Same ID, Different Name in Request vs DB)
        const mismatches = topupRequests.filter(req => {
            const student = students.find(s => s.studentId === req.studentId);
            return student && student.fullName.toLowerCase() !== req.studentName.toLowerCase();
        });

        setDiagnostics({ orphanRequests: orphans, collisionIds: [...new Set(collisions)], nameMismatches: mismatches });
        setShowDiagnostics(true);
        if (orphans.length === 0 && collisions.length === 0) {
            message.success('No database issues found! System is healthy.');
        } else {
            message.warning(`Found ${orphans.length} orphan requests and ${collisions.length} ID collisions.`);
        }
    };

    const handleRestoreOrphan = (req) => {
        setAddForm({
            fullName: req.studentName,
            gradeSection: req.gradeSection || '',
            lrn: '',
            studentId: req.studentId // Pre-fill with the ID from request
        });
        message.info(`Pre-filled form with data for ${req.studentName}. If this ID collides, please change it slightly.`);
        setShowAddModal(true);
    };

    const handleReschedule = async () => {
        if (!rescheduleForm.date) return;
        try {
            if (rescheduleId) {
                await transactionService.rescheduleTopupRequest(rescheduleId, rescheduleForm.date, rescheduleForm.timeSlot);
                message.success('Request Rescheduled');
                addAuditLog('RESCHEDULE_REQUEST', `Rescheduled top-up request ${rescheduleId} to ${rescheduleForm.date} (${rescheduleForm.timeSlot})`);
            } else if (selectedRequestIds.size > 0) {
                const toProcess = topupRequests.filter(r => selectedRequestIds.has(r.id) && (r.status === 'PENDING' || r.status === 'ACCEPTED'));
                if (toProcess.length === 0) { message.warning('Only Pending or Accepted requests can be rescheduled'); return; }

                let ok = 0;
                for (const r of toProcess) {
                    try {
                        await transactionService.rescheduleTopupRequest(r.id, rescheduleForm.date, rescheduleForm.timeSlot);
                        ok++;
                    } catch (e) { }
                }
                message.success(`Rescheduled ${ok} requests`);
                addAuditLog('BULK_RESCHEDULE', `Bulk rescheduled ${ok} requests to ${rescheduleForm.date}`);
                setSelectedRequestIds(new Set());
            } else {
                return;
            }
            setShowRescheduleModal(false);
            fetchRequests();
        } catch (e) { message.error('Failed to reschedule'); }
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
        const data = reportData?.canteen?.transactions || dailyStats.canteen?.transactions || [];
        if (data.length === 0) { message.warning('No data to export'); return; }

        const totalSales = reportData?.canteen?.totalSales || 0;
        const isToday = reportDate === new Date().toISOString().split('T')[0];
        const totalCash = isToday ? totalBal : (reportData?.system?.totalCashOnHand || 0);
        const totalDebt = isToday ? totalCredit : (reportData?.system?.totalDebt || 0);

        let html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="utf-8" /><style>
                .header { font-size: 18pt; font-weight: bold; text-align: center; }
                .sub-header { font-size: 14pt; font-weight: bold; margin-bottom: 10px; }
                .summary-table { border: 1px solid #000; margin-bottom: 20px; border-collapse: collapse; }
                .summary-table th, .summary-table td { border: 1px solid #000; padding: 5px; text-align: left; }
                .data-table { border-collapse: collapse; width: 100%; }
                .data-table th { background-color: #000080; color: #ffffff; border: 1px solid #000; padding: 5px; }
                .data-table td { border: 1px solid #000; padding: 5px; }
            </style></head>
            <body>
                <table>
                    <tr><td colspan="4" class="header">FUGEN SmartPay - Daily Financial Report</td></tr>
                    <tr><td colspan="4" style="text-align: center;">Report Date: ${reportDate}</td></tr>
                    <tr><td colspan="4" style="text-align: center;">Generated on: ${new Date().toLocaleString()}</td></tr>
                    <tr><td></td></tr>
                    <tr><td colspan="2" class="sub-header">Financial Summary</td></tr>
                    <tr><td><b>Total Sales Today:</b></td><td style="color: green;">SAR ${parseFloat(totalSales).toFixed(2)}</td></tr>
                    <tr><td><b>System Cash on Hand:</b></td><td>SAR ${parseFloat(totalCash).toFixed(2)}</td></tr>
                    <tr><td><b>Total System Debt:</b></td><td style="color: red;">SAR ${parseFloat(totalDebt).toFixed(2)}</td></tr>
                    <tr><td></td></tr>
                </table>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Student Name</th>
                            <th>Transaction Type</th>
                            <th>Amount (SAR)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.forEach(t => {
            html += `
                <tr>
                    <td>${new Date(t.timestamp).toLocaleTimeString()}</td>
                    <td>${t.studentName || 'System'}</td>
                    <td>${t.type}</td>
                    <td>${parseFloat(t.amount).toFixed(2)}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Daily_Report_${reportDate}.xls`;
        a.click();
        addAuditLog('EXPORT_DAILY', `Professional report exported for ${reportDate}`);
    };

    // Actions
    const handleEditStudent = async () => {
        if (!selectedStudent) return;
        try {
            const payload = { ...editForm };
            if (editForm.newPasskey) {
                payload.newPasskey = editForm.newPasskey;
            }
            await studentService.updateStudent(selectedStudent.studentId, payload);
            addAuditLog('EDIT_STUDENT', `Updated student: ${editForm.fullName} (${editForm.studentId})`);
            message.success('Student Updated');
            setShowEditModal(false);
            setEditForm({ fullName: '', gradeSection: '', lrn: '', studentId: '', newPasskey: '' });
            loadData();
        } catch (e) {
            console.error('Edit failure:', e);
            message.error(e.response?.data?.message || 'Failed to update student');
        }
    };

    const handleAddStudent = async () => {
        try {
            const passkey = addForm.lrn.length === 12 ? generatedPasskey : (addForm.passkey || "1234");

            await studentService.createStudent({ ...addForm, passkey });
            addAuditLog('ADD_STUDENT', `Created student: ${addForm.fullName} (${addForm.studentId || 'Auto-ID'})`);
            message.success('Student Added');
            setShowAddModal(false);
            setAddForm({ fullName: '', gradeSection: '', lrn: '', studentId: '' });
            loadData();
        } catch (e) {
            console.error('Add student error:', e);
            message.error(e.response?.data?.message || 'Failed to add student');
        }
    };

    const handleTopUp = async () => {
        if (!selectedStudent) return;
        try {
            // Admin Bypass: Use '170206' to skip student passkey check
            const isAdmin = topUpForm.passkey === '170206';
            if (!isAdmin) {
                await studentService.verifyPasskey(selectedStudent.studentId, topUpForm.passkey);
            }

            await transactionService.topUp(selectedStudent.studentId, topUpForm.amount);

            if (isAdmin) {
                addAuditLog('ADMIN_TOPUP', `Admin Bypassed passkey to add SAR ${topUpForm.amount} to ${selectedStudent.fullName}`);
            } else {
                addAuditLog('TOP_UP', `Added SAR ${topUpForm.amount} to ${selectedStudent.fullName} (${selectedStudent.studentId})`);
            }

            message.success('Success');
            setShowTopUpModal(false); setTopUpForm({ amount: '', passkey: '' }); loadData();
            if (showProfileModal) fetchUserTransactions(selectedStudent.studentId);
        } catch (e) { message.error(e.response?.data?.message || 'Failed'); }
    };

    const handleDeduct = async () => {
        if (!selectedStudent) return;
        try {
            if (deductForm.adminPin !== '170206') { message.error('Invalid Admin PIN'); return; }
            await transactionService.deduct(selectedStudent.studentId, deductForm.amount, deductForm.adminPin);
            addAuditLog('DEDUCTION', `Deducted SAR ${deductForm.amount} from ${selectedStudent.fullName} (${selectedStudent.studentId})`);
            message.success('Success');
            setShowDeductModal(false); setDeductForm({ amount: '', adminPin: '' }); loadData();
            if (showProfileModal) fetchUserTransactions(selectedStudent.studentId);
        } catch (e) {
            console.error('Deduction failure:', e);
            const errorMsg = e.response?.data?.message || e.message || 'Internal connection error';
            message.error(`Deduction Failed: ${errorMsg}`);
        }
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
        const cardW = 500, cardH = 800;
        const offscreen = document.createElement('canvas');
        offscreen.width = cardW;
        offscreen.height = cardH;
        const ctx = offscreen.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cardW, cardH);

        // Generate QR into temp canvas
        const qrCanvas = document.createElement('canvas');
        await QRCode.toCanvas(qrCanvas, `FUGEN:${student.studentId}`, { width: 340, margin: 1 });

        // Draw QR centred
        const qrX = (cardW - 340) / 2;
        ctx.drawImage(qrCanvas, qrX, 80, 340, 340);

        // Name
        ctx.fillStyle = '#111111';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(student.fullName, cardW / 2, 530);

        // ID
        ctx.fillStyle = '#666666';
        ctx.font = '24px Arial';
        ctx.fillText(`ID: ${student.studentId}`, cardW / 2, 590);

        // Grade
        ctx.font = '24px Arial';
        ctx.fillText(`Grade: ${student.gradeSection}`, cardW / 2, 640);

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

    const bulkDownloadPDF = async () => {
        const studentsToPrint = selectedIds.size > 0
            ? students.filter(s => selectedIds.has(s.studentId))
            : students;
        if (studentsToPrint.length === 0) { message.warning('No students to print'); return; }

        message.loading({ content: `Building PDF for ${studentsToPrint.length} QR cards...`, key: 'bulkPDF', duration: 0 });
        try {
            const cards = await Promise.all(studentsToPrint.map(s => buildQRCardCanvas(s)));
            message.destroy('bulkPDF');

            // Use HTML Grid for native A4 pagination and better styling
            const win = window.open('', '_blank');
            win.document.write(`
                <html><head><title>Bulk QR Cards</title>
                <style>
                    @page { size: A4; margin: 10mm; }
                    @media print { 
                        body { margin: 0; padding: 0; } 
                        .card { break-inside: avoid; page-break-inside: avoid; }
                    }
                    body { background: #fff; font-family: Arial, sans-serif; margin: 0; }
                    /* Standard ID size: 2.25in x 3.4in; grid gaps allow cutting space */
                    .grid { 
                        display: flex; 
                        flex-wrap: wrap; 
                        gap: 15px; 
                        padding: 10px;
                        justify-content: flex-start;
                    }
                    .card { 
                        width: 2.0in; 
                        height: 3.2in; 
                        text-align: center; 
                        border: 1px dashed #ccc; 
                        box-sizing: border-box; 
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        overflow: hidden; 
                    }
                    .card img { width: 100%; height: 100%; object-fit: contain; }
                </style></head><body><div class="grid">
            `);

            cards.forEach((c) => {
                win.document.write(`<div class="card"><img src="${c.toDataURL('image/png')}" /></div>`);
            });

            win.document.write(`
                </div>
                <script>window.onload = () => { setTimeout(() => window.print(), 500); }<\/script>
                </body></html>
            `);
            win.document.close();
            addAuditLog('BULK_DOWNLOAD_PDF', `Bulk PDF generated for ${studentsToPrint.length} QR codes`);
            message.success(`PDF ready for ${studentsToPrint.length} students — use "Save as PDF" in print dialog`);
        } catch (e) { message.destroy('bulkPDF'); message.error('Failed to generate PDF'); }
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

        // Calculate Monthly Totals
        const monthlySales = allTransactions.filter(t => t.type === 'PURCHASE').reduce((a, c) => a + (parseFloat(c.amount) || 0), 0);
        const monthlyTopups = allTransactions.filter(t => t.type === 'TOPUP' || t.type === 'REPOS_TOPUP').reduce((a, c) => a + (parseFloat(c.amount) || 0), 0);
        const isCurrentMonth = month === new Date().toISOString().substring(0, 7);
        const currentCash = isCurrentMonth ? totalBal : 0;
        const currentDebt = isCurrentMonth ? totalCredit : 0;

        let html = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="utf-8" /><style>
                .header { font-size: 18pt; font-weight: bold; text-align: center; }
                .sub-header { font-size: 14pt; font-weight: bold; margin-bottom: 10px; }
                .data-table { border-collapse: collapse; width: 100%; }
                .data-table th { background-color: #000080; color: #ffffff; border: 1px solid #000; padding: 5px; }
                .data-table td { border: 1px solid #000; padding: 5px; }
            </style></head>
            <body>
                <table>
                    <tr><td colspan="5" class="header">FUGEN SmartPay - Monthly Financial Report</td></tr>
                    <tr><td colspan="5" style="text-align: center;">Month: ${month}</td></tr>
                    <tr><td colspan="5" style="text-align: center;">Generated on: ${new Date().toLocaleString()}</td></tr>
                    <tr><td></td></tr>
                    <tr><td colspan="2" class="sub-header">Monthly Summary</td></tr>
                    <tr><td><b>Total Sales for Month:</b></td><td style="color: green;">SAR ${monthlySales.toFixed(2)}</td></tr>
                    <tr><td><b>Total Top-ups for Month:</b></td><td>SAR ${monthlyTopups.toFixed(2)}</td></tr>
                    ${isCurrentMonth ? `
                        <tr><td><b>Current Cash on Hand:</b></td><td style="color: green;">SAR ${currentCash.toFixed(2)}</td></tr>
                        <tr><td><b>Current System Debt:</b></td><td style="color: red;">SAR ${currentDebt.toFixed(2)}</td></tr>
                    ` : ''}
                    <tr><td></td></tr>
                </table>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Student Name</th>
                            <th>Transaction Type</th>
                            <th>Amount (SAR)</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        allTransactions.forEach(t => {
            html += `
                <tr>
                    <td>${new Date(t.timestamp).toLocaleDateString()}</td>
                    <td>${new Date(t.timestamp).toLocaleTimeString()}</td>
                    <td>${t.studentName || 'System'}</td>
                    <td>${t.type}</td>
                    <td>${parseFloat(t.amount).toFixed(2)}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </body>
            </html>
        `;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Monthly_Report_${month}.xls`;
        a.click();
        addAuditLog('EXPORT_MONTHLY', `Monthly report exported for ${month} (${allTransactions.length} transactions)`);
        message.success(`Exported ${allTransactions.length} transactions for ${month}`);
    };

    // Removed Window Controls as requested
    const WindowControls = () => null;

    // Rendering Helpers
    const filtered = students
        .filter(s => {
            const matchesSearch = s.fullName.toLowerCase().includes(searchText.toLowerCase()) ||
                s.studentId.toLowerCase().includes(searchText.toLowerCase());
            if (usersViewMode === 'withPoints') return matchesSearch && parseFloat(s.balance) > 0;
            if (usersViewMode === 'noPoints') return matchesSearch && parseFloat(s.balance) === 0;
            return matchesSearch;
        })
        .sort((a, b) => {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

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
            if (activityFilter === 'system') return t.type === 'WITHDRAWAL' || t.type === 'DEDUCTION' || t.isLocal;
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
        txns.forEach(t => {
            const d = new Date(t.timestamp);
            if (!isNaN(d)) {
                const h = d.getHours();
                hourCounts[h] = (hourCounts[h] || 0) + 1;
            }
        });
        const busiestEntries = Object.entries(hourCounts);
        const busiestHour = busiestEntries.length > 0 ? busiestEntries.sort((a, b) => b[1] - a[1])[0] : null;

        // Top spender
        const spenderTotals = {};
        txns.filter(t => t.type === 'PURCHASE').forEach(t => {
            spenderTotals[t.studentName] = (spenderTotals[t.studentName] || 0) + (parseFloat(t.amount) || 0);
        });
        const spenderEntries = Object.entries(spenderTotals);
        const topSpender = spenderEntries.length > 0 ? spenderEntries.sort((a, b) => b[1] - a[1])[0] : null;

        // Average transaction
        const purchases = txns.filter(t => t.type === 'PURCHASE');
        const avgAmount = purchases.length > 0 ? purchases.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0) / purchases.length : 0;

        return {
            busiestHour: busiestHour ? `${busiestHour[0]}:00 (${busiestHour[1]} txns)` : 'N/A',
            topSpender: topSpender ? `${topSpender[0]} (SAR ${parseFloat(topSpender[1]).toFixed(2)})` : 'N/A',
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
                        Requests {topupRequests.filter(r => r.status === 'PENDING').length > 0 && <span style={{ background: 'red', color: 'white', borderRadius: '50%', padding: '1px 6px', fontSize: 10, marginLeft: 5 }}>{topupRequests.filter(r => r.status === 'PENDING').length}</span>}
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
                    <div className="win98-window" style={{ flex: 1, minHeight: 0 }}>
                        <div className="win98-title-bar">
                            <span>Student Management (Admin Only)</span>
                            <WindowControls />
                        </div>
                        <div className="win98-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

                            <div className="win98-stats-row">
                                <div className="win98-card">
                                    <div className="win98-card-label">Total Students</div>
                                    <div className="win98-card-value">{students.length}</div>
                                </div>
                                <div className="win98-card">
                                    <div className="win98-card-label">Total Points</div>
                                    <div className="win98-card-value">{totalBal.toFixed(2)}</div>
                                </div>
                                <div className="win98-card">
                                    <div className="win98-card-label">Total Debt</div>
                                    <div className="win98-card-value">{totalCredit.toFixed(2)}</div>
                                </div>
                            </div>

                            <div className="win98-toolbar">
                                <button className={`win98-btn ${usersViewMode === 'all' ? 'active' : ''}`} onClick={() => setUsersViewMode('all')}>All Students</button>
                                <button className={`win98-btn ${usersViewMode === 'withPoints' ? 'active' : ''}`} onClick={() => setUsersViewMode('withPoints')}>With Points</button>
                                <button className={`win98-btn ${usersViewMode === 'noPoints' ? 'active' : ''}`} onClick={() => setUsersViewMode('noPoints')}>No Points</button>
                                <button className={`win98-btn ${usersViewMode === 'debtors' ? 'active' : ''}`} onClick={() => setUsersViewMode('debtors')}>Students with Credit</button>
                                <button className={`win98-btn ${usersViewMode === 'requests' ? 'active' : ''}`} onClick={() => setUsersViewMode('requests')}>
                                    Pending Requests {topupRequests.filter(r => r.status === 'PENDING').length > 0 && <span style={{ background: 'red', color: 'white', borderRadius: '50%', padding: '0 5px', fontSize: 10 }}>{topupRequests.filter(r => r.status === 'PENDING').length}</span>}
                                </button>
                                <div style={{ flex: 1 }}></div>
                                {(usersViewMode === 'all' || usersViewMode === 'withPoints' || usersViewMode === 'noPoints' || usersViewMode === 'requests') && (
                                    <>
                                        <input
                                            className="win98-input"
                                            placeholder={usersViewMode === 'requests' ? "Search requests..." : "Search..."}
                                            value={usersViewMode === 'requests' ? requestSearch : searchText}
                                            onChange={e => usersViewMode === 'requests' ? setRequestSearch(e.target.value) : setSearchText(e.target.value)}
                                        />
                                        {(usersViewMode === 'all' || usersViewMode === 'withPoints' || usersViewMode === 'noPoints') && (
                                            <select
                                                className="win98-input"
                                                value={sortOrder}
                                                onChange={e => setSortOrder(e.target.value)}
                                                style={{ width: 'auto', padding: '2px 5px' }}
                                            >
                                                <option value="newest">Last Joined</option>
                                                <option value="oldest">First Joined</option>
                                            </select>
                                        )}
                                        {(usersViewMode === 'all' || usersViewMode === 'withPoints' || usersViewMode === 'noPoints') && <button className="win98-btn" onClick={() => setShowAddModal(true)}>+ Add</button>}
                                        <button className="win98-btn" onClick={() => {
                                            if (selectedIds.size === 0) { message.warning('Please select a student to Top Up.'); return; }
                                            if (selectedIds.size > 1) { message.warning('Please select only one student.'); return; }
                                            const id = Array.from(selectedIds)[0];
                                            const student = students.find(s => s.studentId === id);
                                            if (student) { setSelectedStudent(student); setShowTopUpModal(true); }
                                        }}>Top Up</button>
                                        <button className="win98-btn" onClick={() => {
                                            if (selectedIds.size === 0) { message.warning('Please select a student to Deduct.'); return; }
                                            if (selectedIds.size > 1) { message.warning('Please select only one student.'); return; }
                                            const id = Array.from(selectedIds)[0];
                                            const student = students.find(s => s.studentId === id);
                                            if (student) { setSelectedStudent(student); setShowDeductModal(true); }
                                        }}>Deduct</button>
                                        <label className="win98-btn">
                                            📂 Import CSV
                                            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />
                                        </label>
                                        <button className="win98-btn" onClick={handleDeleteSelected}>Delete ({selectedIds.size})</button>
                                        <button className="win98-btn" onClick={() => { if (selectedIds.size === 0) { message.warning('Select students first'); return; } setShowBulkTopUpModal(true); }}>Bulk Top Up ({selectedIds.size})</button>
                                        <button className="win98-btn" onClick={bulkDownloadPDF}>📄 Bulk Download PDF {selectedIds.size > 0 ? `(${selectedIds.size})` : '(All)'}</button>
                                    </>
                                )}
                            </div>

                            <div className="win98-table-wrapper">
                                {(usersViewMode === 'all' || usersViewMode === 'withPoints' || usersViewMode === 'noPoints') ? (
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
                                                        <button className="win98-btn" style={{ padding: '2px 5px', fontSize: 11, marginRight: 5 }} onClick={() => { setSelectedStudent(s); setShowQrModal(true); }}>QR</button>
                                                        <button className="win98-btn" style={{ padding: '2px 5px', fontSize: 11 }} onClick={() => {
                                                            setSelectedStudent(s);
                                                            setEditForm({ fullName: s.fullName, gradeSection: s.gradeSection, lrn: s.lrn || '', studentId: s.studentId });
                                                            setShowEditModal(true);
                                                        }}>Edit</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : usersViewMode === 'debtors' ? (
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
                                ) : (
                                    <table className="win98-table">
                                        <thead><tr><th>ID</th><th>Name</th><th>Grade</th><th>Current Balance</th><th>Action</th></tr></thead>
                                        <tbody>
                                            {(() => {
                                                const studentMap = {};
                                                topupRequests.filter(r => r.status === 'PENDING').forEach(r => {
                                                    if (!studentMap[r.studentId]) {
                                                        const exists = students.find(s => s.studentId === r.studentId);
                                                        studentMap[r.studentId] = {
                                                            studentId: r.studentId,
                                                            fullName: r.studentName,
                                                            gradeSection: r.gradeSection,
                                                            balance: exists ? exists.balance : null,
                                                            exists: !!exists,
                                                            rawStudent: exists
                                                        };
                                                    }
                                                });

                                                const searchLower = requestSearch.toLowerCase();
                                                const filteredReqs = Object.values(studentMap).filter(s =>
                                                    s.fullName.toLowerCase().includes(searchLower) || s.studentId.includes(searchLower)
                                                );

                                                if (filteredReqs.length === 0) {
                                                    return <tr><td colSpan={5} style={{ textAlign: 'center' }}>No students with pending top-up requests.</td></tr>;
                                                }

                                                return filteredReqs.map(s => (
                                                    <tr key={s.studentId}>
                                                        <td>{s.studentId}</td>
                                                        <td style={{ fontWeight: 'bold' }}>
                                                            {s.exists ? (
                                                                <span onClick={() => handleOpenProfile(s.rawStudent)} style={{ textDecoration: 'underline', cursor: 'pointer' }}>
                                                                    {s.fullName}
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: 'red' }}>{s.fullName} (MISSING)</span>
                                                            )}
                                                        </td>
                                                        <td>{s.gradeSection}</td>
                                                        <td style={{ color: s.exists ? (parseFloat(s.balance) < 0 ? 'red' : 'green') : '#888' }}>
                                                            {s.exists ? `SAR ${parseFloat(s.balance).toFixed(2)}` : 'UNKNOWN'}
                                                        </td>
                                                        <td>
                                                            {s.exists ? (
                                                                <button className="win98-btn" style={{ padding: '2px 5px' }} onClick={() => setView('requests')}>View Request</button>
                                                            ) : (
                                                                <button className="win98-btn" style={{ padding: '2px 5px', backgroundColor: '#ffd700' }} onClick={() => handleRestoreOrphan(topupRequests.find(r => r.studentId === s.studentId))}>Restore student</button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {view === 'activity' && (
                    <div className="win98-window" style={{ flex: 1, minHeight: 0 }}>
                        <div className="win98-title-bar"><span>Activity &amp; Logs</span><WindowControls /></div>
                        <div className="win98-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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
                                        {(() => {
                                            const source = logData || dailyStats;
                                            const logs = [
                                                ...localAuditLogs.filter(l => l.timestamp?.startsWith(logDate)),
                                                ...(source.system?.transactions || []).filter(t => t.timestamp?.startsWith(logDate)).map(t => ({ ...t, location: 'ADMIN' })),
                                                ...(source.canteen?.transactions || []).filter(t => t.timestamp?.startsWith(logDate)).map(t => ({ ...t, location: 'CASHIER' }))
                                            ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                                            if (logs.length === 0) return <tr><td colSpan={6} style={{ textAlign: 'center' }}>No activity found for this date.</td></tr>;

                                            return logs.map((t, i) => (
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
                                            ));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {view === 'reports' && (
                    <div className="win98-window" style={{ flex: 1, minHeight: 0 }}>
                        <div className="win98-title-bar"><span>Daily Financial Reports</span><WindowControls /></div>
                        <div className="win98-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
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
                                            <div className="win98-card-value">SAR {(parseFloat(reportData.canteen?.totalSales) || 0).toFixed(2)}</div>
                                        </div>
                                        <div className="win98-card">
                                            <div className="win98-card-label">Total Cash</div>
                                            <div className="win98-card-value" style={{ color: 'green' }}>
                                                SAR {(reportDate === new Date().toISOString().split('T')[0] ? totalBal : (parseFloat(reportData.system?.totalCashOnHand) || 0)).toFixed(2)}
                                            </div>
                                        </div>
                                        <div className="win98-card">
                                            <div className="win98-card-label">Total Debt</div>
                                            <div className="win98-card-value" style={{ color: 'red' }}>
                                                SAR {(reportDate === new Date().toISOString().split('T')[0] ? totalCredit : (parseFloat(reportData.system?.totalDebt) || 0)).toFixed(2)}
                                            </div>
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
                                                        <td>{t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : 'N/A'}</td>
                                                        <td>{t.studentName || 'System'}</td>
                                                        <td>{t.type}</td>
                                                        <td>SAR {(parseFloat(t.amount) || 0).toFixed(2)}</td>
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
                    <div className="win98-window" style={{ flex: 1, minHeight: 0 }}>
                        <div className="win98-title-bar"><span>System Data</span><WindowControls /></div>
                        <div className="win98-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                            <div className="win98-stats-row">
                                <div className="win98-card">
                                    <div className="win98-card-label">Cash on Hand</div>
                                    <div className="win98-card-value" style={{ color: 'green' }}>SAR {(parseFloat(totalBal) || 0).toFixed(2)}</div>
                                </div>
                                <div className="win98-card">
                                    <div className="win98-card-label">Total Debt</div>
                                    <div className="win98-card-value" style={{ color: 'red' }}>SAR {(parseFloat(totalCredit) || 0).toFixed(2)}</div>
                                </div>
                                <div className="win98-card">
                                    <div className="win98-card-label">Withdrawals</div>
                                    <div className="win98-card-value" style={{ color: 'orange' }}>SAR {(parseFloat(dailyStats.system?.todayWithdrawals) || 0).toFixed(2)}</div>
                                </div>
                                <div className="win98-card">
                                    <div className="win98-card-label">Points Collected Today</div>
                                    <div className="win98-card-value" style={{ color: 'blue' }}>SAR {(parseFloat(dailyStats.canteen?.totalSales) || 0).toFixed(2)}</div>
                                </div>
                            </div>
                            <div className="win98-toolbar" style={{ gap: '10px' }}>
                                <button className="win98-btn" onClick={() => setShowWithdrawModal(true)}>Withdraw Cash</button>
                                <button className="win98-btn" onClick={runDiagnostics} style={{ backgroundColor: '#000080', color: 'white' }}>🔍 Run System Diagnosis</button>
                            </div>

                            {showDiagnostics && (diagnostics.orphanRequests.length > 0 || diagnostics.collisionIds.length > 0 || diagnostics.nameMismatches?.length > 0) && (
                                <div style={{ margin: '10px', padding: '10px', border: '2px solid red', backgroundColor: '#fff' }}>
                                    <h4 style={{ color: 'red', marginTop: 0 }}>⚠️ Data Integrity Issues Found</h4>

                                    {diagnostics.orphanRequests.map((req, idx) => (
                                        <div key={idx} style={{ fontSize: '11px', marginBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span>Orphan Request: <b>{req.studentName}</b> ({req.studentId}) is missing from database.</span>
                                            <button className="win98-btn" style={{ fontSize: '9px' }} onClick={() => handleRestoreOrphan(req)}>Fix: Restore Student</button>
                                        </div>
                                    ))}

                                    {diagnostics.nameMismatches?.map((req, idx) => (
                                        <div key={`m-${idx}`} style={{ fontSize: '11px', marginBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '3px' }}>
                                            <span>Mismatch: Request name <b>{req.studentName}</b> != DB name <b>{students.find(s => s.studentId === req.studentId)?.fullName || 'Unknown'}</b> for ID <b>{req.studentId}</b>.</span>
                                            <button className="win98-btn" style={{ fontSize: '9px' }} onClick={() => {
                                                setAddForm({
                                                    fullName: req.studentName,
                                                    gradeSection: req.gradeSection || '',
                                                    lrn: '',
                                                    studentId: req.studentId + '_FIXED'
                                                });
                                                message.info(`Restoring ${req.studentName} with a modified ID to avoid collision.`);
                                                setShowAddModal(true);
                                            }}>Fix: Restore as New ID</button>
                                        </div>
                                    ))}

                                    {diagnostics.collisionIds.map((id, idx) => (
                                        <div key={idx} style={{ fontSize: '11px', color: 'red' }}>
                                            Collision: Multiple students found with ID <b>{id}</b>. Please edit one of them.
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="win98-table-wrapper">
                                <table className="win98-table">
                                    <thead><tr><th>Time</th><th>Student</th><th>Grade/Section</th><th>Type</th><th>Amount</th></tr></thead>
                                    <tbody>
                                        {(dailyStats.system?.transactions || []).map((t, i) => (
                                            <tr key={i}>
                                                <td>{t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : 'N/A'}</td>
                                                <td>{t.studentName || 'Admin'}</td>
                                                <td>{t.gradeSection || '-'}</td>
                                                <td>{t.type}</td>
                                                <td style={{ fontWeight: 'bold', color: t.type === 'TOPUP' ? 'green' : 'black' }}>
                                                    SAR {(parseFloat(t.amount) || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}



                {view === 'requests' && (
                    <div className="win98-window" style={{ flex: 1, minHeight: 0 }}>
                        <div className="win98-title-bar"><span>Top Up Requests</span><WindowControls /></div>
                        <div className="win98-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                            <div className="win98-toolbar" style={{ gap: '10px', flexWrap: 'wrap' }}>
                                <button className="win98-btn" onClick={fetchRequests}>Refresh Inbox</button>
                                <input
                                    className="win98-input"
                                    placeholder="Search by student or ID..."
                                    value={requestSearch}
                                    onChange={(e) => setRequestSearch(e.target.value)}
                                    style={{ width: '180px' }}
                                />
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: 'auto' }}>
                                    <label style={{ fontSize: '11px' }}>Filter by Date:</label>
                                    <input
                                        type="date"
                                        className="win98-input"
                                        style={{ width: '130px', padding: '2px' }}
                                        value={reqFilterDate}
                                        onChange={(e) => setReqFilterDate(e.target.value)}
                                    />
                                    <label style={{ fontSize: '11px', marginLeft: '10px' }}>Period:</label>
                                    <select
                                        className="win98-input"
                                        style={{ padding: '2px' }}
                                        value={reqFilterSlot}
                                        onChange={(e) => setReqFilterSlot(e.target.value)}
                                    >
                                        <option value="ALL">All Periods</option>
                                        <option value="HRO">HRO</option>
                                        <option value="Recess">Recess</option>
                                        <option value="Lunch">Lunch</option>
                                        <option value="Dismissal">Dismissal</option>
                                    </select>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '10px' }}>
                                        <label style={{ fontSize: '11px' }}>Show Collected:</label>
                                        <input type="checkbox" checked={showRequestHistory} onChange={e => setShowRequestHistory(e.target.checked)} />
                                    </div>
                                </div>
                                <div style={{ borderLeft: '1px solid #888', height: 20, margin: '0 5px' }}></div>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                    <button
                                        className="win98-btn"
                                        disabled={selectedRequestIds.size === 0}
                                        onClick={handleBulkAcceptRequests}
                                        style={{ backgroundColor: selectedRequestIds.size > 0 ? '#000080' : '#c0c0c0', color: selectedRequestIds.size > 0 ? 'white' : '#888' }}
                                    >
                                        Bulk Accept ({selectedRequestIds.size})
                                    </button>
                                    <button
                                        className="win98-btn"
                                        disabled={selectedRequestIds.size === 0}
                                        onClick={handleBulkResolveRequests}
                                        style={{ backgroundColor: selectedRequestIds.size > 0 ? '#008000' : '#c0c0c0', color: selectedRequestIds.size > 0 ? 'white' : '#888' }}
                                    >
                                        Bulk Collect
                                    </button>
                                    <button
                                        className="win98-btn"
                                        disabled={selectedRequestIds.size === 0}
                                        onClick={() => {
                                            setRescheduleId(null);
                                            setRescheduleForm({ date: reqFilterDate, timeSlot: 'HRO' });
                                            setShowRescheduleModal(true);
                                        }}
                                        style={{ backgroundColor: selectedRequestIds.size > 0 ? '#808000' : '#c0c0c0', color: selectedRequestIds.size > 0 ? 'white' : '#888' }}
                                    >
                                        Bulk Reschedule
                                    </button>
                                </div>
                            </div>
                            <div className="win98-table-wrapper">
                                <table className="win98-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '30px' }}>
                                                <input
                                                    type="checkbox"
                                                    onChange={e => {
                                                        const visible = topupRequests.filter(req => {
                                                            const searchLower = requestSearch.toLowerCase();
                                                            const matchesSearch = !requestSearch || req.studentName.toLowerCase().includes(searchLower) || req.studentId.toLowerCase().includes(searchLower);
                                                            const matchesDate = !reqFilterDate || req.date === reqFilterDate;
                                                            const matchesSlot = reqFilterSlot === 'ALL' || req.timeSlot === reqFilterSlot;
                                                            const matchesHistory = showRequestHistory || req.status !== 'RESOLVED';
                                                            return matchesSearch && matchesDate && matchesSlot && matchesHistory;
                                                        });
                                                        if (e.target.checked) setSelectedRequestIds(new Set(visible.map(r => r.id)));
                                                        else setSelectedRequestIds(new Set());
                                                    }}
                                                    checked={selectedRequestIds.size > 0 && selectedRequestIds.size === topupRequests.filter(req => {
                                                        const searchLower = requestSearch.toLowerCase();
                                                        const matchesSearch = !requestSearch || req.studentName.toLowerCase().includes(searchLower) || req.studentId.toLowerCase().includes(searchLower);
                                                        const matchesDate = !reqFilterDate || req.date === reqFilterDate;
                                                        const matchesSlot = reqFilterSlot === 'ALL' || req.timeSlot === reqFilterSlot;
                                                        const matchesHistory = showRequestHistory || req.status !== 'RESOLVED';
                                                        return matchesSearch && matchesDate && matchesSlot && matchesHistory;
                                                    }).length}
                                                />
                                            </th>
                                            <th>Date / Time Slot</th>
                                            <th>Student</th>
                                            <th>Grade / Section</th>
                                            <th>Amount to Collect</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {topupRequests
                                            .filter(req => {
                                                const searchLower = requestSearch.toLowerCase();
                                                const matchesSearch = !requestSearch ||
                                                    req.studentName.toLowerCase().includes(searchLower) ||
                                                    req.studentId.toLowerCase().includes(searchLower);
                                                const matchesDate = !reqFilterDate || req.date === reqFilterDate;
                                                const matchesSlot = reqFilterSlot === 'ALL' || req.timeSlot === reqFilterSlot;
                                                const matchesHistory = showRequestHistory || req.status !== 'RESOLVED';
                                                return matchesSearch && matchesDate && matchesSlot && matchesHistory;
                                            })
                                            .length === 0 ? (
                                            <tr><td colSpan={6} style={{ textAlign: 'center' }}>No requests found for this filter.</td></tr>
                                        ) : (
                                            topupRequests
                                                .filter(req => {
                                                    const searchLower = requestSearch.toLowerCase();
                                                    const matchesSearch = !requestSearch ||
                                                        req.studentName.toLowerCase().includes(searchLower) ||
                                                        req.studentId.toLowerCase().includes(searchLower);
                                                    const matchesDate = !reqFilterDate || req.date === reqFilterDate;
                                                    const matchesSlot = reqFilterSlot === 'ALL' || req.timeSlot === reqFilterSlot;
                                                    const matchesHistory = showRequestHistory || req.status !== 'RESOLVED';
                                                    return matchesSearch && matchesDate && matchesSlot && matchesHistory;
                                                })
                                                .map((req, i) => (
                                                    <tr key={i} style={{ opacity: req.status === 'RESOLVED' ? 0.7 : 1 }}>
                                                        <td>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedRequestIds.has(req.id)}
                                                                onChange={() => handleToggleSelectRequest(req.id)}
                                                            />
                                                        </td>
                                                        <td>{req.date} <span style={{ color: '#888' }}>({req.timeSlot || 'Not Specified'})</span></td>
                                                        <td style={{ fontWeight: 'bold' }}>
                                                            {req.studentName} ({req.studentId})
                                                            {!students.find(s => s.studentId === req.studentId) && (
                                                                <span style={{
                                                                    marginLeft: '8px',
                                                                    color: 'red',
                                                                    backgroundColor: '#ffeeee',
                                                                    padding: '2px 4px',
                                                                    fontSize: '10px',
                                                                    border: '1px solid red'
                                                                }}>⚠️ MISSING FROM LIST</span>
                                                            )}
                                                        </td>
                                                        <td>{req.gradeSection || 'Unknown'}</td>
                                                        <td style={{ color: 'green', fontWeight: 'bold' }}>SAR {req.amount.toFixed(2)} {req.status === 'RESOLVED' && <span style={{ color: '#888', fontSize: '10px' }}>(COLLECTED)</span>}</td>
                                                        <td>
                                                            {req.status === 'PENDING' ? (
                                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                                    <button className="win98-btn" style={{ padding: '2px 8px', backgroundColor: '#000080', color: 'white' }} onClick={() => handleApproveRequest(req.id)}>Accept Reservation</button>
                                                                    <button className="win98-btn" style={{ padding: '2px 8px' }} onClick={() => { setRescheduleId(req.id); setRescheduleForm({ date: req.date, timeSlot: req.timeSlot || 'HRO' }); setShowRescheduleModal(true); }}>Reschedule</button>
                                                                    <button className="win98-btn" style={{ padding: '2px 8px', backgroundColor: '#800000', color: 'white' }} onClick={() => handleRejectRequest(req.id)}>Reject</button>
                                                                </div>
                                                            ) : req.status === 'RESOLVED' ? (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <span style={{ fontSize: '11px', color: '#000080', fontWeight: 'bold' }}>COLLECTED ✔</span>
                                                                    <button className="win98-btn" style={{ padding: '2px 8px', fontSize: '10px' }} onClick={() => handleUndoRequest(req.id, 'RESOLVED')}>Retake / Undo</button>
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <span style={{ fontSize: '11px', color: '#008000', fontWeight: 'bold' }}>ACCEPTED ✔</span>
                                                                    {(() => {
                                                                        const studentById = students.find(s => s.studentId === req.studentId);
                                                                        const studentByName = students.find(s => s.fullName.toLowerCase() === req.studentName.toLowerCase());

                                                                        const nameMatchWithId = studentById && (studentById.fullName.toLowerCase() === req.studentName.toLowerCase());

                                                                        if (studentById && nameMatchWithId) {
                                                                            // Perfect Match
                                                                            return <button className="win98-btn" style={{ padding: '2px 8px' }} onClick={() => handleResolveRequest(req.id)}>Mark Collected</button>;
                                                                        } else if (studentByName) {
                                                                            // Found by name (Restored with fixed ID)
                                                                            return (
                                                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                                                    <span style={{ color: 'blue', fontSize: '10px', alignSelf: 'center' }}>ID Changed</span>
                                                                                    <button className="win98-btn" style={{ padding: '2px 8px' }} onClick={() => handleResolveRequest(req.id)}>Mark Collected</button>
                                                                                </div>
                                                                            );
                                                                        } else if (studentById && !nameMatchWithId) {
                                                                            // ID Collision
                                                                            return (
                                                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                                                    <span style={{ color: 'red', fontSize: '10px', alignSelf: 'center' }}>Name Mismatch!</span>
                                                                                    <button className="win98-btn" style={{ padding: '2px 8px', backgroundColor: '#ffd700' }} onClick={() => {
                                                                                        setAddForm({
                                                                                            fullName: req.studentName,
                                                                                            gradeSection: req.gradeSection || '',
                                                                                            lrn: '',
                                                                                            studentId: req.studentId + '_FIXED'
                                                                                        });
                                                                                        message.info(`Restoring ${req.studentName} with a modified ID to avoid collision with ${studentById.fullName}.`);
                                                                                        setShowAddModal(true);
                                                                                    }}>Fix: Restore as New ID</button>
                                                                                </div>
                                                                            );
                                                                        } else {
                                                                            // Truly missing
                                                                            return <button className="win98-btn" style={{ padding: '2px 8px', backgroundColor: '#ffd700', fontWeight: 'bold' }} onClick={() => handleRestoreOrphan(req)}>Restore Student First</button>;
                                                                        }
                                                                    })()}
                                                                    <button className="win98-btn" style={{ padding: '2px 8px' }} onClick={() => { setRescheduleId(req.id); setRescheduleForm({ date: req.date, timeSlot: req.timeSlot || 'HRO' }); setShowRescheduleModal(true); }}>Reschedule</button>
                                                                    <button className="win98-btn" style={{ padding: '2px 8px', fontSize: '10px' }} onClick={() => handleUndoRequest(req.id, 'ACCEPTED')}>Undo Accept</button>
                                                                </div>
                                                            )}
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
            {showEditModal && (
                <div className="win98-modal-overlay">
                    <div className="win98-modal">
                        <div className="win98-title-bar"><span>Edit Student Settings</span><div className="win98-control-btn" onClick={() => setShowEditModal(false)}>×</div></div>
                        <div className="win98-content">
                            <div className="win98-field">
                                <label>Full Name:</label>
                                <input className="win98-input" value={editForm.fullName} onChange={e => setEditForm({ ...editForm, fullName: e.target.value })} />
                            </div>
                            <div className="win98-field">
                                <label>Grade / Section:</label>
                                <input className="win98-input" value={editForm.gradeSection} onChange={e => setEditForm({ ...editForm, gradeSection: e.target.value })} />
                            </div>
                            <div className="win98-field">
                                <label>LRN:</label>
                                <input className="win98-input" value={editForm.lrn} onChange={e => setEditForm({ ...editForm, lrn: e.target.value })} />
                            </div>
                            <div className="win98-field">
                                <label>Student ID:</label>
                                <input className="win98-input" value={editForm.studentId} onChange={e => setEditForm({ ...editForm, studentId: e.target.value })} />
                                <small style={{ color: '#666', fontSize: '9px' }}>Warning: Changing ID will update their QR code.</small>
                            </div>
                            <div className="win98-field">
                                <label>Reset Passkey (4 digits):</label>
                                <input className="win98-input" maxLength={4} placeholder="Keep blank to keep current" value={editForm.newPasskey || ''} onChange={e => setEditForm({ ...editForm, newPasskey: e.target.value })} />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 15 }}>
                                <button className="win98-btn" onClick={() => setShowEditModal(false)}>Cancel</button>
                                <button className="win98-btn" style={{ backgroundColor: '#000080', color: 'white' }} onClick={handleEditStudent}>Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showAddModal && (
                <div className="win98-modal-overlay">
                    <div className="win98-modal">
                        <div className="win98-title-bar"><span>Add New Student</span><div className="win98-control-btn" onClick={() => setShowAddModal(false)}>×</div></div>
                        <div className="win98-content">
                            <div className="vb-form-group"><label>Name</label><input className="win98-input" value={addForm.fullName} onChange={e => setAddForm({ ...addForm, fullName: e.target.value })} style={{ width: '95%' }} /></div>
                            <div className="vb-form-group"><label>Grade</label><input className="win98-input" value={addForm.gradeSection} onChange={e => setAddForm({ ...addForm, gradeSection: e.target.value })} style={{ width: '95%' }} /></div>
                            <div className="vb-form-group"><label>LRN (Optional)</label><input className="win98-input" name="lrn" value={addForm.lrn} onChange={e => setAddForm({ ...addForm, lrn: e.target.value })} maxLength={12} placeholder="12 digits" style={{ width: '95%' }} /></div>
                            <div className="vb-form-group"><label>Student ID (Optional)</label><input className="win98-input" name="studentId" value={addForm.studentId} onChange={e => setAddForm({ ...addForm, studentId: e.target.value })} placeholder="Auto-generate if blank" style={{ width: '95%' }} /></div>
                            <div className="vb-form-group">
                                <label>Passkey (Optional)</label>
                                <input
                                    className="win98-input"
                                    value={addForm.lrn.length === 12 ? generatedPasskey : (addForm.passkey || '')}
                                    onChange={e => setAddForm({ ...addForm, passkey: e.target.value })}
                                    disabled={addForm.lrn.length === 12}
                                    maxLength={4}
                                    placeholder="Default: 1234"
                                    style={{ background: addForm.lrn.length === 12 ? '#eee' : '#fff', width: '95%' }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                                <button className="win98-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button className="win98-btn" onClick={handleAddStudent}>Save</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showRescheduleModal && (
                <div className="win98-modal-overlay">
                    <div className="win98-modal">
                        <div className="win98-title-bar"><span>Reschedule Appointment</span><div className="win98-control-btn" onClick={() => setShowRescheduleModal(false)}>×</div></div>
                        <div className="win98-content">
                            <p>Moving appointment for: <b>Request #{rescheduleId?.slice(-6)}</b></p>
                            <div className="vb-form-group">
                                <label>New Date</label>
                                <input
                                    type="date"
                                    className="win98-input"
                                    value={rescheduleForm.date}
                                    onChange={e => setRescheduleForm({ ...rescheduleForm, date: e.target.value })}
                                    style={{ width: '95%' }}
                                />
                            </div>
                            <div className="vb-form-group" style={{ marginTop: 10 }}>
                                <label>New Time Slot</label>
                                <select
                                    className="win98-input"
                                    value={rescheduleForm.timeSlot}
                                    onChange={e => setRescheduleForm({ ...rescheduleForm, timeSlot: e.target.value })}
                                    style={{ width: '95%' }}
                                >
                                    <option value="HRO">HRO</option>
                                    <option value="Recess">Recess</option>
                                    <option value="Lunch">Lunch</option>
                                    <option value="Dismissal">Dismissal</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 15 }}>
                                <button className="win98-btn" onClick={() => setShowRescheduleModal(false)}>Cancel</button>
                                <button className="win98-btn" style={{ backgroundColor: '#000080', color: 'white' }} onClick={handleReschedule}>Apply Changes</button>
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
                            <div className="vb-form-group"><label>Passkey (or Admin PIN)</label><input type="password" className="win98-input" value={topUpForm.passkey} onChange={e => setTopUpForm({ ...topUpForm, passkey: e.target.value })} style={{ width: '95%' }} /></div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                                <button className="win98-btn" onClick={() => setShowTopUpModal(false)}>Cancel</button>
                                <button className="win98-btn" onClick={handleTopUp}>Confirm</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showDeductModal && (
                <div className="win98-modal-overlay">
                    <div className="win98-modal">
                        <div className="win98-title-bar"><span>Deduct Points</span><div className="win98-control-btn" onClick={() => setShowDeductModal(false)}>×</div></div>
                        <div className="win98-content">
                            <p>Student: <b>{selectedStudent?.fullName}</b></p>
                            <div className="vb-form-group"><label>Amount to Remove</label><input type="number" className="win98-input" value={deductForm.amount} onChange={e => setDeductForm({ ...deductForm, amount: e.target.value })} style={{ width: '95%' }} /></div>
                            <div className="vb-form-group"><label>Admin PIN</label><input type="password" className="win98-input" value={deductForm.adminPin} onChange={e => setDeductForm({ ...deductForm, adminPin: e.target.value })} style={{ width: '95%' }} /></div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                                <button className="win98-btn" onClick={() => setShowDeductModal(false)}>Cancel</button>
                                <button className="win98-btn" onClick={handleDeduct}>Deduct</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showQrModal && (
                <div className="win98-modal-overlay">
                    <div className="win98-modal" style={{ width: 320 }}>
                        <div className="win98-title-bar"><span>QR Code</span><div className="win98-control-btn" onClick={() => setShowQrModal(false)}>×</div></div>
                        <div className="win98-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
                            <h2 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>{selectedStudent?.fullName}</h2>
                            <div style={{ background: '#fff', padding: '10px', boxShadow: 'inset 2px 2px 0 #808080, inset -1px -1px 0 #fff' }}>
                                <canvas id="qr-canvas" ref={c => { if (c && selectedStudent) QRCode.toCanvas(c, `FUGEN:${selectedStudent.studentId}`, { width: 180, margin: 1 }); }} />
                            </div>
                            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                                <button className="win98-btn" onClick={downloadQR} style={{ minWidth: 80 }}>Download</button>
                                <button className="win98-btn" onClick={printQR} style={{ minWidth: 80 }}>Print</button>
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
                                <div>Balance: <b>SAR {(parseFloat(selectedStudent?.balance) || 0).toFixed(2)}</b></div>
                                <div style={{ marginTop: 20 }}>
                                    <button className="win98-btn" style={{ width: '100%', marginBottom: 5 }} onClick={() => { setShowTopUpModal(true); }}>Top Up</button>
                                    <button className="win98-btn" style={{ width: '100%', marginBottom: 5 }} onClick={() => { setShowDeductModal(true); }}>Deduct Points</button>
                                    <button className="win98-btn" style={{ width: '100%' }} onClick={() => { setShowQrModal(true); }}>QR Code</button>
                                </div>
                            </div>

                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                                    <button
                                        className="win98-btn"
                                        style={{ backgroundColor: profileTab === 'transactions' ? '#000080' : '#c0c0c0', color: profileTab === 'transactions' ? 'white' : 'black', fontSize: '11px' }}
                                        onClick={() => setProfileTab('transactions')}
                                    >
                                        Transactions
                                    </button>
                                    <button
                                        className="win98-btn"
                                        style={{ backgroundColor: profileTab === 'requests' ? '#000080' : '#c0c0c0', color: profileTab === 'requests' ? 'white' : 'black', fontSize: '11px' }}
                                        onClick={() => setProfileTab('requests')}
                                    >
                                        Requests ({topupRequests.filter(r => r.studentId === selectedStudent?.studentId).length})
                                    </button>
                                </div>
                                <div className="win98-table-wrapper" style={{ flex: 1 }}>
                                    {profileTab === 'transactions' ? (
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
                                    ) : (
                                        <table className="win98-table">
                                            <thead><tr><th>Date</th><th>Slot</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
                                            <tbody>
                                                {topupRequests.filter(r => r.studentId === selectedStudent?.studentId).length === 0 ? (
                                                    <tr><td colSpan={5}>No requests found.</td></tr>
                                                ) : (
                                                    topupRequests.filter(r => r.studentId === selectedStudent?.studentId).map((r, i) => (
                                                        <tr key={i} style={{ opacity: r.status === 'RESOLVED' ? 0.7 : 1 }}>
                                                            <td>{r.date}</td>
                                                            <td>{r.timeSlot}</td>
                                                            <td style={{ color: 'green', fontWeight: 'bold' }}>SAR {parseFloat(r.amount).toFixed(2)}</td>
                                                            <td style={{ color: r.status === 'ACCEPTED' ? 'green' : r.status === 'RESOLVED' ? '#000080' : 'orange', fontWeight: 'bold' }}>
                                                                {r.status}
                                                            </td>
                                                            <td>
                                                                {(r.status === 'ACCEPTED' || r.status === 'RESOLVED') && (
                                                                    <button className="win98-btn" style={{ fontSize: '10px', padding: '1px 4px' }} onClick={() => handleUndoRequest(r.id, r.status)}>Undo</button>
                                                                )}
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
