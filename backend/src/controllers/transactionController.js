const { db } = require('../config/firebase');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

exports.topUp = async (req, res) => {
    const { studentId: rawStudentId, amount, location } = req.body;
    const studentId = rawStudentId?.trim()?.toUpperCase();
    const topUpAmount = parseFloat(amount);

    if (topUpAmount <= 0) {
        return res.status(400).json({ status: 'error', message: 'Amount must be positive' });
    }

    try {
        await db.runTransaction(async (t) => {
            const studentRef = db.collection('students').doc(studentId);
            const studentDoc = await t.get(studentRef);

            let studentDocActual = studentDoc;
            let studentRefActual = studentRef;

            if (!studentDoc.exists) {
                // Fallback: search by studentId field
                const querySnapshot = await t.get(db.collection('students').where('studentId', '==', studentId).limit(1));
                if (querySnapshot.empty) {
                    throw new Error('Student not found');
                }
                studentDocActual = querySnapshot.docs[0];
                studentRefActual = studentDocActual.ref;
            }

            const student = studentDocActual.data();
            const currentBalance = parseFloat(student.balance || 0);

            console.log(`[TOPUP] Student: ${studentId}, Current: ${currentBalance}, Adding: ${topUpAmount}`);

            // Explicitly ensure we are doing math, not string concatenation
            const newBalance = Number((currentBalance + topUpAmount).toFixed(2));
            console.log(`[TOPUP] New Balance Calculation: ${currentBalance} + ${topUpAmount} = ${newBalance}`);

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

        /** @type {import('socket.io').Server} */
        const io = req.app.get('io');
        if (io) {
            io.emit('balanceUpdate', { studentId, type: 'TOPUP' });
        }

        res.status(200).json({ status: 'success', message: 'Topup successful' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.purchase = async (req, res) => {
    const { studentId: rawStudentId, amount, passkey } = req.body;
    const studentId = rawStudentId?.trim()?.toUpperCase();
    const purchaseAmount = parseFloat(amount);

    try {
        await db.runTransaction(async (t) => {
            const studentRef = db.collection('students').doc(studentId);
            const studentDoc = await t.get(studentRef);

            let studentDocActual = studentDoc;
            let studentRefActual = studentRef;

            if (!studentDoc.exists) {
                // Fallback: search by studentId field
                const querySnapshot = await t.get(db.collection('students').where('studentId', '==', studentId).limit(1));
                if (querySnapshot.empty) {
                    throw new Error('Student not found');
                }
                studentDocActual = querySnapshot.docs[0];
                studentRefActual = studentDocActual.ref;
            }

            const student = studentDocActual.data();

            if (student.accountLocked) {
                throw new Error('Account locked');
            }

            // Verify Passkey
            const match = await bcrypt.compare(passkey, student.passkeyHash);
            if (!match) {
                throw new Error('Invalid Passkey');
            }

            const currentBalance = parseFloat(student.balance || 0);
            const newBalance = Number((currentBalance - purchaseAmount).toFixed(2));

            console.log(`[PURCHASE] Student: ${studentId}, Current: ${currentBalance}, Deducting: ${purchaseAmount}, Result: ${newBalance}`);

            // Hard credit limit check (-500 SAR)
            if (newBalance < -500) {
                throw new Error('Credit limit exceeded (Max debt: SAR 500)');
            }

            const transaction = {
                id: uuidv4(),
                studentId,
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
            const transRef = db.collection('transactions').doc(transaction.id);
            t.set(transRef, transaction);
        });

        /** @type {import('socket.io').Server} */
        const io = req.app.get('io');
        if (io) {
            io.emit('balanceUpdate', { studentId, type: 'PURCHASE' });
        }

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
            // Fetch all transactions for this student
            // We do NOT use orderBy here to avoid Indexing errors on Cloud Firestore
            const snapshot = await db.collection('transactions')
                .where('studentId', '==', studentId)
                .get();

            snapshot.forEach(doc => transactions.push(doc.data()));

            // Sort in memory (Newest first)
            transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Limit to 50 most recent
            transactions = transactions.slice(0, 50);
        } else {
            // Global fetch (no filter), so single-field orderBy works fine
            const snapshot = await db.collection('transactions')
                .orderBy('timestamp', 'desc')
                .limit(50)
                .get();

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
        const withdrawAmount = parseFloat(amount);

        // Hardcoded limit check or passkey check (Admin Pin 170206)
        if (passkey !== '170206') {
            return res.status(401).json({ status: 'error', message: 'Invalid Admin PIN' });
        }

        if (withdrawAmount <= 0) {
            return res.status(400).json({ status: 'error', message: 'Amount must be positive' });
        }

        const transaction = {
            id: uuidv4(),
            type: 'WITHDRAWAL',
            amount: withdrawAmount,
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
        if (!db) {
            throw new Error("Database not initialized. Check your serviceAccountKey.json");
        }

        const { date, location } = req.query;
        let startOfDay, endOfDay;

        if (date) {
            // Parse date string as UTC to avoid timezone shifts
            const [year, month, day] = date.split('-').map(Number);
            startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
            endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
        } else {
            // Today in UTC
            const now = new Date();
            startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
            endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
        }

        // Fetch transactions for the DAY
        const snapshot = await db.collection('transactions')
            .where('timestamp', '>=', startOfDay.toISOString())
            .where('timestamp', '<=', endOfDay.toISOString())
            .get();

        // Initialize Stats
        let canteenStats = {
            totalSales: 0,
            cashCollected: 0,
            totalCredit: 0, // Sales on credit TODAY
            transactions: []
        };

        let systemStats = {
            topups: 0, // Cash IN from users
            withdrawals: 0, // Cash OUT to canteen
            transactions: []
        };

        // Process Today's Transactions
        snapshot.forEach(doc => {
            const data = doc.data();
            const transactionRecord = { id: doc.id, ...data };

            if (data.type === 'PURCHASE') {
                if (location && location !== 'CANTEEN') return; // If filtered for something else

                const amount = parseFloat(data.amount || 0);
                const prev = parseFloat(data.previousBalance || 0);
                let creditPart = 0;
                let cashPart = 0;

                if (prev <= 0) {
                    creditPart = amount;
                } else if (prev < amount) {
                    cashPart = prev;
                    creditPart = amount - prev;
                } else {
                    cashPart = amount;
                }

                canteenStats.totalSales += amount;
                canteenStats.cashCollected += cashPart;
                canteenStats.totalCredit += creditPart;

                transactionRecord.creditAmount = creditPart;
                transactionRecord.cashAmount = cashPart;
                canteenStats.transactions.push(transactionRecord);

            } else if (data.type === 'TOPUP') {
                if (location && location === 'CANTEEN') return; // POS doesn't care about Topups

                const amount = parseFloat(data.amount || 0);
                systemStats.topups += amount;
                systemStats.transactions.push(transactionRecord);

            } else if (data.type === 'WITHDRAWAL') {
                if (location && location === 'CANTEEN') return; // POS doesn't see withdrawals

                const amount = parseFloat(data.amount || 0);
                systemStats.withdrawals += amount;
                systemStats.transactions.push(transactionRecord);
            }
        });

        // Global System Debt (Outstanding Credit - Always needed for System Data Screen)
        let globalTotalCredit = 0;
        let totalSystemCash = 0;

        // Always calculate Global Debt
        const studentsSnapshot = await db.collection('students').where('balance', '<', 0).get();
        studentsSnapshot.forEach(doc => {
            const bal = parseFloat(doc.data().balance || 0);
            if (bal < 0) {
                globalTotalCredit += Math.abs(bal);
            }
        });

        // Only calculate Total System Cash if we need it (Admin or System Data)
        // Or if location is not specified
        if (!location || location === 'ADMIN') {
            const allTopups = await db.collection('transactions').where('type', '==', 'TOPUP').get();
            let allTimeTopups = 0;
            allTopups.forEach(d => allTimeTopups += parseFloat(d.data().amount || 0));

            const allWithdrawals = await db.collection('transactions').where('type', '==', 'WITHDRAWAL').get();
            let allTimeWithdrawals = 0;
            allWithdrawals.forEach(d => allTimeWithdrawals += parseFloat(d.data().amount || 0));

            totalSystemCash = allTimeTopups - allTimeWithdrawals;
        }

        // Return structured data
        // For backwards compatibility with mobile app (which expects flat structure), we can map canteenStats to top level if location=CANTEEN
        if (location === 'CANTEEN') {
            res.status(200).json({
                status: 'success',
                data: {
                    totalSales: canteenStats.totalSales,
                    totalCash: canteenStats.cashCollected, // POS Cash
                    totalCredit: globalTotalCredit, // User asked for "Outstanding Credits" in System Data, but maybe wants Today's Credit Sales?
                    // Actually, for "in the mobile scanner, the value for the total credits is zero even though there is a 15 sr credit from a user"
                    // If they mean "Today's Credit Sales", we should send canteenStats.totalCredit.
                    // If they mean "Global Debt", we send globalTotalCredit (but filter might skip it above).
                    // Let's ensure Global Debt is sent even if location=CANTEEN because the "SystemDataScreen" asks for "TOTAL SYSTEM DEBT"
                    todayCreditSales: canteenStats.totalCredit,
                    transactions: canteenStats.transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
                    cashList: canteenStats.transactions.filter(t => t.cashAmount > 0),
                    creditList: canteenStats.transactions.filter(t => t.creditAmount > 0)
                }
            });
        } else {
            // Admin Response
            res.status(200).json({
                status: 'success',
                data: {
                    canteen: {
                        ...canteenStats,
                        transactions: canteenStats.transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    },
                    system: {
                        todayTopups: Math.max(0, systemStats.topups - systemStats.withdrawals),
                        todayWithdrawals: systemStats.withdrawals,
                        totalCashOnHand: totalSystemCash, // The "System Cash"
                        totalDebt: globalTotalCredit,     // The "Outstanding Credits"
                        transactions: systemStats.transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    }
                }
            });
        }

    } catch (error) {
        console.error('❌ Stats Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.requestTopup = async (req, res) => {
    try {
        const { studentId, amount, date, timeSlot } = req.body;

        // Fetch student name real quick to store in request
        const studentRef = db.collection('students').doc(studentId);
        const studentDoc = await studentRef.get();
        let studentName = 'Unknown';
        let gradeSection = 'Unknown';

        if (studentDoc.exists) {
            studentName = studentDoc.data().fullName || 'Unknown';
            gradeSection = studentDoc.data().gradeSection || 'Unknown';
        } else {
            // Check studentId field fallback
            const querySnapshot = await db.collection('students').where('studentId', '==', studentId).limit(1).get();
            if (!querySnapshot.empty) {
                studentName = querySnapshot.docs[0].data().fullName || 'Unknown';
                gradeSection = querySnapshot.docs[0].data().gradeSection || 'Unknown';
            }
        }

        const requestDoc = {
            studentId,
            studentName,
            gradeSection,
            amount: parseFloat(amount),
            date, // e.g., '2026-02-23'
            timeSlot: timeSlot || 'Not Specified',
            status: 'PENDING',
            timestamp: new Date().toISOString()
        };

        const docRef = await db.collection('topUpRequests').add(requestDoc);
        res.status(200).json({ status: 'success', data: { id: docRef.id, ...requestDoc } });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.getTopupRequests = async (req, res) => {
    try {
        const snapshot = await db.collection('topUpRequests')
            .where('status', 'in', ['PENDING', 'ACCEPTED'])
            .get();

        let requests = [];
        snapshot.forEach(doc => {
            requests.push({ id: doc.id, ...doc.data() });
        });

        requests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.status(200).json({ status: 'success', data: requests });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.approveTopupRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const reqDoc = await db.collection('topUpRequests').doc(id).get();

        if (!reqDoc.exists) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }

        const data = reqDoc.data();

        if (data.status !== 'PENDING') {
            return res.status(400).json({ status: 'error', message: 'Request is not in pending state' });
        }

        // 1. Update status to ACCEPTED
        await db.collection('topUpRequests').doc(id).update({
            status: 'ACCEPTED',
            approvedAt: new Date().toISOString()
        });

        // 2. Send "Reservation Accepted" notification
        await db.collection('notifications').add({
            studentId: data.studentId,
            title: 'Reservation Accepted',
            message: `Your top-up reservation of SAR ${parseFloat(data.amount).toFixed(2)} has been reviewed and accepted. Please proceed to the office to complete your payment.`,
            read: false,
            timestamp: new Date().toISOString()
        });

        // 3. Emit socket event to refresh dashboard in real-time
        const io = req.app.get('io');
        if (io) {
            io.emit('balanceUpdate', { studentId: data.studentId, type: 'NOTIFICATION' });
        }

        res.status(200).json({ status: 'success', message: 'Reservation accepted and user notified' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.resolveTopupRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const reqDoc = await db.collection('topUpRequests').doc(id).get();

        if (!reqDoc.exists) {
            return res.status(404).json({ status: 'error', message: 'Request not found' });
        }

        const data = reqDoc.data();

        if (data.status === 'RESOLVED') {
            return res.status(400).json({ status: 'error', message: 'Already resolved' });
        }

        const studentRef = db.collection('students').doc(data.studentId);
        const studentDoc = await studentRef.get();

        if (studentDoc.exists) {
            const currentBal = parseFloat(studentDoc.data().balance) || 0;
            const newBal = currentBal + parseFloat(data.amount);

            // 1. Update Student Balance
            await studentRef.update({ balance: newBal });

            // 2. Log Transaction
            await db.collection('transactions').add({
                studentId: data.studentId,
                studentName: data.studentName,
                gradeSection: data.gradeSection,
                type: 'TOPUP',
                amount: parseFloat(data.amount),
                balanceAfter: newBal,
                timestamp: new Date().toISOString(),
                description: 'Top-up from request'
            });

            // 3. Send Notification to user's inbox
            await db.collection('notifications').add({
                studentId: data.studentId,
                title: 'Top-Up Completed',
                message: `Payment received! SAR ${parseFloat(data.amount).toFixed(2)} has been successfully added to your points balance.`,
                read: false,
                timestamp: new Date().toISOString()
            });

            // 4. Update request status
            await db.collection('topUpRequests').doc(id).update({
                status: 'RESOLVED',
                resolvedAt: new Date().toISOString()
            });

            // 5. Emit socket event
            const io = req.app.get('io');
            if (io) {
                io.emit('balanceUpdate', { studentId: data.studentId, newBalance: newBal, type: 'BALANCE_UPDATE' });
            }
        } else {
            // Just resolve it if student doesn't exist anymore
            await db.collection('topUpRequests').doc(id).update({
                status: 'RESOLVED',
                resolvedAt: new Date().toISOString()
            });
        }

        res.status(200).json({ status: 'success', message: 'Request resolved and balance updated' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.getWeeklyStats = async (req, res) => {
    try {
        if (!db) throw new Error("Database not initialized.");

        // Get date 7 days ago
        let startOfPeriod = new Date();
        startOfPeriod.setDate(startOfPeriod.getDate() - 6);
        startOfPeriod.setHours(0, 0, 0, 0);

        const snapshot = await db.collection('transactions')
            .where('timestamp', '>=', startOfPeriod.toISOString())
            .get();

        // Group by day (YYYY-MM-DD)
        const dailyData = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            dailyData[dateStr] = 0;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.type === 'PURCHASE') {
                const dateStr = data.timestamp.split('T')[0];
                if (dailyData[dateStr] !== undefined) {
                    dailyData[dateStr] += parseFloat(data.amount || 0);
                }
            }
        });

        // Convert to array format for Recharts
        const chartData = Object.keys(dailyData).sort().map(dateStr => {
            const d = new Date(dateStr);
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            return {
                name: days[d.getDay()],
                date: dateStr,
                sales: dailyData[dateStr]
            };
        });

        res.status(200).json({ status: 'success', data: chartData });
    } catch (error) {
        console.error('❌ Weekly Stats Error:', error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
