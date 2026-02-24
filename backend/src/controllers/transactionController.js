const { db } = require('../config/firebase');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/**
 * Helper to find a student doc by ID (case-insensitive)
 */
async function findStudentDoc(studentId) {
    if (!studentId) return null;
    const cleanId = studentId.trim().toUpperCase();

    // Try Doc ID lookup (Uppercase)
    let docRef = db.collection('students').doc(cleanId);
    let doc = await docRef.get();
    if (doc.exists) return { doc, ref: docRef };

    // Try Doc ID lookup (Original Case)
    docRef = db.collection('students').doc(studentId.trim());
    doc = await docRef.get();
    if (doc.exists) return { doc, ref: docRef };

    // Try studentId field search
    let snapshot = await db.collection('students').where('studentId', '==', cleanId).limit(1).get();
    if (!snapshot.empty) return { doc: snapshot.docs[0], ref: snapshot.docs[0].ref };

    return null;
}

exports.topUp = async (req, res) => {
    const { studentId: rawStudentId, amount, location } = req.body;
    const topUpAmount = parseFloat(amount);

    if (topUpAmount <= 0) {
        return res.status(400).json({ status: 'error', message: 'Amount must be positive' });
    }

    try {
        await db.runTransaction(async (t) => {
            const result = await findStudentDoc(rawStudentId);
            if (!result) throw new Error('Student not found');

            const studentDocActual = result.doc;
            const studentRefActual = result.ref;
            const student = studentDocActual.data();
            const studentId = student.studentId; // Use normalized ID

            const currentBalance = parseFloat(student.balance || 0);
            const newBalance = Number((currentBalance + topUpAmount).toFixed(2));

            const transaction = {
                id: uuidv4(),
                studentId,
                studentName: student.fullName,
                grade: student.grade,
                section: student.section,
                type: 'TOPUP',
                amount: topUpAmount,
                previousBalance: currentBalance,
                newBalance: newBalance,
                location: location || 'ADMIN',
                timestamp: new Date().toISOString()
            };

            t.update(studentRefActual, { balance: newBalance });
            const transRef = db.collection('transactions').doc(transaction.id);
            t.set(transRef, transaction);
        });

        const io = req.app.get('io');
        if (io) io.emit('balanceUpdate', { studentId: rawStudentId?.toUpperCase(), type: 'TOPUP' });

        res.status(200).json({ status: 'success', message: 'Topup successful' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.deduct = async (req, res) => {
    try {
        const { studentId: rawStudentId, amount, location, adminPin } = req.body;
        const deductAmount = parseFloat(amount);

        if (adminPin !== '170206') {
            return res.status(401).json({ status: 'error', message: 'Invalid Admin PIN' });
        }

        if (isNaN(deductAmount) || deductAmount <= 0) {
            return res.status(400).json({ status: 'error', message: 'Enter a valid positive amount' });
        }

        await db.runTransaction(async (t) => {
            const result = await findStudentDoc(rawStudentId);
            if (!result) throw new Error('Student not found');

            const studentDocActual = result.doc;
            const studentRefActual = result.ref;
            const student = studentDocActual.data();

            const currentBalance = parseFloat(student.balance || 0);
            const newBalance = Number((currentBalance - deductAmount).toFixed(2));

            const transaction = {
                id: uuidv4(),
                studentId: student.studentId,
                studentName: student.fullName,
                grade: student.grade || '',
                section: student.section || '',
                type: 'DEDUCTION',
                amount: deductAmount,
                previousBalance: currentBalance,
                newBalance: newBalance,
                location: location || 'ADMIN',
                timestamp: new Date().toISOString()
            };

            t.update(studentRefActual, { balance: newBalance });
            const transRef = db.collection('transactions').doc(transaction.id);
            t.set(transRef, transaction);
        });

        const io = req.app.get('io');
        if (io) io.emit('balanceUpdate', { studentId: rawStudentId?.toUpperCase(), type: 'DEDUCTION' });

        res.status(200).json({ status: 'success', message: 'Points successfully removed' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.purchase = async (req, res) => {
    const { studentId: rawStudentId, amount, passkey } = req.body;
    const purchaseAmount = parseFloat(amount);

    try {
        await db.runTransaction(async (t) => {
            const result = await findStudentDoc(rawStudentId);
            if (!result) throw new Error('Student not found');

            const studentDocActual = result.doc;
            const studentRefActual = result.ref;
            const student = studentDocActual.data();

            if (student.accountLocked) throw new Error('Account locked');

            if (!req.body.bypassPasskey) {
                const match = await bcrypt.compare(passkey, student.passkeyHash);
                if (!match) throw new Error('Invalid Passkey');
            }

            const currentBalance = parseFloat(student.balance || 0);
            const newBalance = Number((currentBalance - purchaseAmount).toFixed(2));

            if (newBalance < -500) throw new Error('Credit limit exceeded (Max debt: SAR 500)');

            const transaction = {
                id: uuidv4(),
                studentId: student.studentId,
                studentName: student.fullName,
                grade: student.grade,
                section: student.section,
                type: 'PURCHASE',
                amount: purchaseAmount,
                previousBalance: currentBalance,
                newBalance: newBalance,
                location: 'CANTEEN',
                timestamp: new Date().toISOString()
            };

            t.update(studentRefActual, { balance: newBalance });
            t.set(db.collection('transactions').doc(transaction.id), transaction);
        });

        const io = req.app.get('io');
        if (io) io.emit('balanceUpdate', { studentId: rawStudentId?.toUpperCase(), type: 'PURCHASE' });

        res.status(200).json({ status: 'success', message: 'Purchase successful' });
    } catch (error) {
        res.status(400).json({ status: 'error', message: error.message });
    }
};

exports.getTransactions = async (req, res) => {
    try {
        const { studentId } = req.query;
        let transactions = [];

        if (studentId) {
            const snapshot = await db.collection('transactions').where('studentId', '==', studentId).get();
            snapshot.forEach(doc => transactions.push(doc.data()));
            transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            transactions = transactions.slice(0, 50);
        } else {
            const snapshot = await db.collection('transactions').orderBy('timestamp', 'desc').limit(50).get();
            snapshot.forEach(doc => transactions.push(doc.data()));
        }

        res.status(200).json({ status: 'success', data: transactions });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.withdraw = async (req, res) => {
    try {
        const { amount, passkey } = req.body;
        if (passkey !== '170206') return res.status(401).json({ status: 'error', message: 'Invalid Admin PIN' });

        const transaction = {
            id: uuidv4(),
            type: 'WITHDRAWAL',
            amount: parseFloat(amount),
            location: 'ADMIN',
            timestamp: new Date().toISOString(),
            description: 'System Cash Withdrawal'
        };

        await db.collection('transactions').doc(transaction.id).set(transaction);
        res.status(200).json({ status: 'success', message: 'Withdrawal successful' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.getDailyStats = async (req, res) => {
    try {
        const { date, location } = req.query;
        let startOfDay, endOfDay;

        if (date) {
            const [year, month, day] = date.split('-').map(Number);
            startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
            endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
        } else {
            const now = new Date();
            startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
            endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
        }

        const snapshot = await db.collection('transactions')
            .where('timestamp', '>=', startOfDay.toISOString())
            .where('timestamp', '<=', endOfDay.toISOString())
            .get();

        let canteenStats = { totalSales: 0, cashCollected: 0, totalCredit: 0, transactions: [] };
        let systemStats = { topups: 0, withdrawals: 0, transactions: [] };

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.type === 'PURCHASE') {
                if (location && location !== 'CANTEEN') return;
                const amt = parseFloat(data.amount || 0);
                const prev = parseFloat(data.previousBalance || 0);
                let creditPart = prev <= 0 ? amt : (prev < amt ? amt - prev : 0);
                let cashPart = amt - creditPart;

                canteenStats.totalSales += amt;
                canteenStats.cashCollected += cashPart;
                canteenStats.totalCredit += creditPart;
                canteenStats.transactions.push({ ...data, id: doc.id, creditAmount: creditPart, cashAmount: cashPart });
            } else {
                if (data.type === 'TOPUP') systemStats.topups += parseFloat(data.amount || 0);
                if (data.type === 'WITHDRAWAL') systemStats.withdrawals += parseFloat(data.amount || 0);
                systemStats.transactions.push({ ...data, id: doc.id });
            }
        });

        let totalSystemCash = 0, globalTotalCredit = 0;
        const allStudents = await db.collection('students').get();
        allStudents.forEach(doc => {
            const b = parseFloat(doc.data().balance || 0);
            if (b > 0) totalSystemCash += b; else if (b < 0) globalTotalCredit += Math.abs(b);
        });

        if (location === 'CANTEEN') {
            res.status(200).json({
                status: 'success',
                data: {
                    totalSales: canteenStats.totalSales, totalCash: canteenStats.cashCollected, totalCredit: globalTotalCredit, todayCreditSales: canteenStats.totalCredit,
                    transactions: canteenStats.transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                }
            });
        } else {
            res.status(200).json({
                status: 'success',
                data: {
                    canteen: canteenStats,
                    system: { todayTopups: systemStats.topups, todayWithdrawals: systemStats.withdrawals, totalCashOnHand: totalSystemCash, totalDebt: globalTotalCredit, transactions: systemStats.transactions }
                }
            });
        }
    } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
};

exports.requestTopup = async (req, res) => {
    try {
        const { studentId, amount, date, timeSlot } = req.body;
        const result = await findStudentDoc(studentId);
        const name = result ? result.doc.data().fullName : 'Unknown';
        const gs = result ? result.doc.data().gradeSection : 'Unknown';

        const doc = { studentId, studentName: name, gradeSection: gs, amount: parseFloat(amount), date, timeSlot, status: 'PENDING', timestamp: new Date().toISOString() };
        const ref = await db.collection('topUpRequests').add(doc);
        res.status(200).json({ status: 'success', data: { id: ref.id, ...doc } });
    } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
};

exports.getTopupRequests = async (req, res) => {
    try {
        const { studentId } = req.query;
        let q = db.collection('topUpRequests').where('status', 'in', ['PENDING', 'ACCEPTED', 'RESOLVED']);
        if (studentId) q = q.where('studentId', '==', studentId);
        const s = await q.get();
        let r = []; s.forEach(d => r.push({ id: d.id, ...d.data() }));
        r.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.status(200).json({ status: 'success', data: r });
    } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
};

exports.approveTopupRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const d = await db.collection('topUpRequests').doc(id).get();
        if (!d.exists) return res.status(404).json({ status: 'error', message: 'Not found' });
        const data = d.data();
        await db.collection('topUpRequests').doc(id).update({ status: 'ACCEPTED', approvedAt: new Date().toISOString() });
        await db.collection('notifications').add({ studentId: data.studentId, title: 'Reservation Accepted', message: `Top-up of SAR ${data.amount} accepted.`, read: false, timestamp: new Date().toISOString() });
        const io = req.app.get('io'); if (io) io.emit('balanceUpdate', { studentId: data.studentId, type: 'NOTIFICATION' });
        res.status(200).json({ status: 'success' });
    } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
};

exports.rejectTopupRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const d = await db.collection('topUpRequests').doc(id).get();
        if (!d.exists) return res.status(404).json({ status: 'error', message: 'Not found' });
        const data = d.data();
        await db.collection('topUpRequests').doc(id).update({ status: 'REJECTED', rejectedAt: new Date().toISOString() });
        await db.collection('notifications').add({ studentId: data.studentId, title: 'Reservation Rejected', message: `Top-up of SAR ${data.amount} rejected.`, read: false, timestamp: new Date().toISOString() });
        const io = req.app.get('io'); if (io) io.emit('balanceUpdate', { studentId: data.studentId, type: 'NOTIFICATION' });
        res.status(200).json({ status: 'success' });
    } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
};

exports.resolveTopupRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const rDoc = await db.collection('topUpRequests').doc(id).get();
        if (!rDoc.exists) return res.status(404).json({ status: 'error', message: 'Not found' });
        const data = rDoc.data();
        const result = await findStudentDoc(data.studentId);
        if (!result) return res.status(404).json({ status: 'error', message: 'Student not found' });

        const student = result.doc.data();
        const newBal = Number((parseFloat(student.balance || 0) + parseFloat(data.amount)).toFixed(2));
        await result.ref.update({ balance: newBal });
        await db.collection('transactions').add({ studentId: data.studentId, type: 'TOPUP', amount: parseFloat(data.amount), balanceAfter: newBal, timestamp: new Date().toISOString(), description: 'From request' });
        await db.collection('topUpRequests').doc(id).update({ status: 'RESOLVED', resolvedAt: new Date().toISOString() });
        const io = req.app.get('io'); if (io) io.emit('balanceUpdate', { studentId: data.studentId, type: 'BALANCE_UPDATE' });
        res.status(200).json({ status: 'success' });
    } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
};

exports.getWeeklyStats = async (req, res) => {
    try {
        let s = new Date(); s.setDate(s.getDate() - 6); s.setHours(0, 0, 0, 0);
        const snap = await db.collection('transactions').where('timestamp', '>=', s.toISOString()).get();
        const daily = {}; for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); daily[d.toISOString().split('T')[0]] = 0; }
        snap.forEach(doc => { if (doc.data().type === 'PURCHASE') { const dt = doc.data().timestamp.split('T')[0]; if (daily[dt] !== undefined) daily[dt] += parseFloat(doc.data().amount || 0); } });
        const chart = Object.keys(daily).sort().map(dt => ({ name: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(dt).getDay()], date: dt, sales: daily[dt] }));
        res.status(200).json({ status: 'success', data: chart });
    } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
};

exports.undoTopupRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const rDoc = await db.collection('topUpRequests').doc(id).get();
        if (!rDoc.exists) return res.status(404).json({ status: 'error', message: 'Not found' });
        const data = rDoc.data();
        if (data.status === 'RESOLVED') {
            const result = await findStudentDoc(data.studentId);
            if (result) {
                const b = Number((parseFloat(result.doc.data().balance || 0) - parseFloat(data.amount)).toFixed(2));
                await result.ref.update({ balance: b });
                const io = req.app.get('io'); if (io) io.emit('balanceUpdate', { studentId: data.studentId, type: 'BALANCE_UPDATE' });
            }
        }
        await db.collection('topUpRequests').doc(id).update({ status: 'PENDING', undoneAt: new Date().toISOString() });
        res.status(200).json({ status: 'success' });
    } catch (error) { res.status(500).json({ status: 'error', message: error.message }); }
};
