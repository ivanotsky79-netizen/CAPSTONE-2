const { db } = require('../config/firebase');
const bcrypt = require('bcryptjs');

console.log("[STUDENT_CONTROLLER] Loaded successfully with bcryptjs");

const SALT_ROUNDS = 4;
// Limit for negative balance (debt)
const MAX_DEBT_LIMIT = 500.00;

exports.createStudent = async (req, res) => {
    try {
        console.log("[CREATE_STUDENT] Received request:", req.body);
        const { fullName, grade, section, gradeSection, passkey, lrn } = req.body;

        if (!fullName || !passkey) {
            return res.status(400).json({ status: 'error', message: 'Name and Passkey are required' });
        }

        // Generate Student ID: S-(Year)-(Random 4 digits)
        const studentId = `S${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Hash Passkey
        const passkeyHash = await bcrypt.hash(passkey, SALT_ROUNDS);

        const studentData = {
            studentId,
            fullName,
            grade: grade || '',
            section: section || '',
            gradeSection: gradeSection || `${grade || ''} ${section || ''}`.trim(),
            lrn: lrn || '',
            balance: 0.00,
            passkeyHash,
            qrData: `FUGEN:${studentId}`,
            accountLocked: false,
            failedAttempts: 0,
            createdAt: new Date().toISOString()
        };

        await db.collection('students').doc(studentId).set(studentData);
        console.log(`[CREATE_STUDENT] Success: Created ${fullName} (${studentId})`);

        /** @type {import('socket.io').Server} */
        const io = req.app.get('io');
        if (io) {
            io.emit('studentCreated', { studentId, fullName });
        }

        res.status(201).json({ status: 'success', message: 'Student created', data: { studentId, fullName, qrData: studentData.qrData } });
    } catch (error) {
        console.error("[CREATE_STUDENT] Error:", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.verifyPasskey = async (req, res) => {
    const startTime = Date.now();
    try {
        const { studentId: rawStudentId, passkey } = req.body;
        const studentId = rawStudentId?.trim()?.toUpperCase();
        console.log(`[VERIFY] PIN check starting for: "${studentId}"`);

        let studentDoc;
        studentDoc = await db.collection('students').doc(studentId).get();

        if (!studentDoc.exists) {
            const querySnapshot = await db.collection('students').where('studentId', '==', studentId).limit(1).get();
            if (!querySnapshot.empty) {
                studentDoc = querySnapshot.docs[0];
            }
        }

        if (!studentDoc?.exists) {
            console.warn(`[VERIFY] Student ID "${studentId}" not found.`);
            const allDocs = await db.collection('students').get();
            console.log(`[DIAGNOSTIC] IDs available:`, allDocs.docs.map(d => `"${d.id}"`).join(', '));
            return res.status(404).json({ status: 'error', message: 'Student not found in database' });
        }

        const student = studentDoc.data();
        const studentRef = studentDoc.ref; // Get accurate reference for updates

        if (student.accountLocked) {
            return res.status(403).json({ status: 'error', message: 'Account locked' });
        }

        const hashStart = Date.now();
        console.log(`[VERIFY] Comparing "${passkey}" against hash starting with: ${student.passkeyHash?.substring(0, 10)}...`);
        const match = await bcrypt.compare(passkey, student.passkeyHash);

        if (match) {
            // Speed up response: don't await the reset of failed attempts
            if (student.failedAttempts > 0) {
                studentRef.update({ failedAttempts: 0 }).catch(err => console.error("Update failed:", err));
            }

            console.log(`[VERIFY] SUCCESS TOTAL TIME: ${Date.now() - startTime}ms`);
            return res.status(200).json({ status: 'success', message: 'Verified', student });
        } else {
            // Increment failed attempts
            const newFailedAttempts = (student.failedAttempts || 0) + 1;
            let updateData = { failedAttempts: newFailedAttempts };

            if (newFailedAttempts >= 5) {
                updateData.accountLocked = true;
            }

            await studentRef.update(updateData);

            return res.status(401).json({
                status: 'error',
                message: 'Invalid Passkey',
                attemptsLeft: 5 - newFailedAttempts
            });
        }
    } catch (error) {
        console.error("[VERIFY] Error:", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.getAllStudents = async (req, res) => {
    try {
        const snapshot = await db.collection('students').get();
        const students = [];
        snapshot.forEach(doc => students.push(doc.data()));
        res.status(200).json({ status: 'success', data: students });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.getStudent = async (req, res) => {
    try {
        const studentId = req.params.studentId?.trim()?.toUpperCase();
        console.log(`[GET_STUDENT] Fetching studentId: "${studentId}"`);

        let doc = await db.collection('students').doc(studentId).get();
        if (!doc.exists) {
            const querySnapshot = await db.collection('students').where('studentId', '==', studentId).limit(1).get();
            if (!querySnapshot.empty) {
                doc = querySnapshot.docs[0];
            }
        }

        if (!doc?.exists) {
            console.warn(`[GET_STUDENT] NOT FOUND: "${studentId}"`);
            const allDocs = await db.collection('students').get();
            const existingIds = allDocs.docs.map(d => `"${d.id}"`).join(', ');
            console.log(`[DIAGNOSTIC] Existing IDs in DB: ${existingIds}`);
            return res.status(404).json({ status: 'error', message: 'Student not found in database' });
        }

        const student = doc.data();
        delete student.passkeyHash; // Security: Never send hash to client

        // Add credit information
        student.creditLimit = 500.00;
        student.availableCredit = 500.00 + (parseFloat(student.balance) || 0);

        res.status(200).json({ status: 'success', data: student });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.deleteStudent = async (req, res) => {
    try {
        const { studentId } = req.params;
        console.log(`[DELETE_STUDENT] Attempting to delete: ${studentId}`);

        const studentRef = db.collection('students').doc(studentId);
        const doc = await studentRef.get();

        if (!doc.exists) {
            return res.status(404).json({ status: 'error', message: 'Student not found' });
        }

        await studentRef.delete();
        console.log(`[DELETE_STUDENT] Successfully deleted: ${studentId}`);

        /** @type {import('socket.io').Server} */
        const io = req.app.get('io');
        if (io) {
            io.emit('studentDeleted', { studentId });
        }

        res.status(200).json({ status: 'success', message: 'Student deleted successfully' });
    } catch (error) {
        console.error("[DELETE_STUDENT] Error:", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
