const { db } = require('../config/firebase');
const bcrypt = require('bcryptjs');

console.log("[STUDENT_CONTROLLER] Loaded successfully with bcryptjs");

const SALT_ROUNDS = 4;
// Limit for negative balance (debt)
const MAX_DEBT_LIMIT = 500.00;

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

    // Try LRN fallback
    snapshot = await db.collection('students').where('lrn', '==', studentId.trim()).limit(1).get();
    if (!snapshot.empty) return { doc: snapshot.docs[0], ref: snapshot.docs[0].ref };

    return null;
}

exports.createStudent = async (req, res) => {
    try {
        console.log("[CREATE_STUDENT] Received request:", req.body);
        const { fullName, grade, section, gradeSection, passkey, lrn } = req.body;

        if (!fullName) {
            return res.status(400).json({ status: 'error', message: 'Name is required' });
        }

        // Use provided studentId or generate a unique one: S-(Year)-(Random 6 digits)
        let studentId = req.body.studentId?.trim()?.toUpperCase();
        let isUnique = false;
        let attempts = 0;

        if (studentId) {
            // Check if provided ID is unique
            const existing = await findStudentDoc(studentId);
            if (!existing) {
                isUnique = true;
            } else {
                return res.status(400).json({ status: 'error', message: `Student ID "${studentId}" is already in use.` });
            }
        } else {
            while (!isUnique && attempts < 10) {
                studentId = `S${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
                const existing = await findStudentDoc(studentId);
                if (!existing) {
                    isUnique = true;
                }
                attempts++;
            }
        }

        if (!isUnique) {
            throw new Error('Failed to generate a unique Student ID after multiple attempts.');
        }

        // Hash Passkey (Defaults to 1234 if missing)
        const finalPasskey = passkey || "1234";
        const passkeyHash = await bcrypt.hash(finalPasskey, SALT_ROUNDS);

        const studentData = {
            fullName,
            grade: grade || '',
            section: section || '',
            gradeSection: gradeSection || `${grade} - ${section}`,
            studentId,
            lrn: lrn || '',
            passkeyHash,
            balance: 0.00,
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
        const { studentId, passkey } = req.body;
        console.log(`[VERIFY] PIN check starting for: "${studentId}"`);

        const result = await findStudentDoc(studentId);

        if (!result) {
            console.warn(`[VERIFY] Student ID "${studentId}" not found.`);
            return res.status(404).json({ status: 'error', message: 'Student not found in database' });
        }

        const student = result.doc.data();
        const studentRef = result.ref;

        if (student.accountLocked) {
            return res.status(403).json({ status: 'error', message: 'Account locked' });
        }

        const match = await bcrypt.compare(passkey, student.passkeyHash);

        if (match) {
            if (student.failedAttempts > 0) {
                studentRef.update({ failedAttempts: 0 }).catch(err => console.error("Update failed:", err));
            }

            console.log(`[VERIFY] SUCCESS TOTAL TIME: ${Date.now() - startTime}ms`);
            return res.status(200).json({ status: 'success', message: 'Verified', student });
        } else {
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
        const { studentId } = req.params;
        const result = await findStudentDoc(studentId);

        if (!result) {
            return res.status(404).json({ status: 'error', message: 'Student not found' });
        }

        const student = result.doc.data();
        delete student.passkeyHash;

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
        const result = await findStudentDoc(studentId);

        if (!result) {
            return res.status(404).json({ status: 'error', message: 'Student not found' });
        }

        await result.ref.delete();

        const io = req.app.get('io');
        if (io) {
            io.emit('studentDeleted', { studentId });
        }

        res.status(200).json({ status: 'success', message: 'Student deleted' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.updatePasskey = async (req, res) => {
    try {
        const { studentId, currentPasskey, newPasskey } = req.body;

        if (!newPasskey || newPasskey.length !== 4 || isNaN(newPasskey)) {
            return res.status(400).json({ status: 'error', message: 'New Passkey must be 4 digits.' });
        }

        const result = await findStudentDoc(studentId);
        if (!result) return res.status(404).json({ status: 'error', message: 'Student not found' });

        const student = result.doc.data();
        const match = await bcrypt.compare(currentPasskey, student.passkeyHash);
        if (!match) return res.status(401).json({ status: 'error', message: 'Current Passkey incorrect' });

        const newHash = await bcrypt.hash(newPasskey, SALT_ROUNDS);
        await result.ref.update({ passkeyHash: newHash });

        res.status(200).json({ status: 'success', message: 'Passkey updated' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.getUserNotifications = async (req, res) => {
    try {
        const { studentId } = req.params;
        const snapshot = await db.collection('notifications').where('studentId', '==', studentId).get();
        const notifications = [];
        snapshot.forEach(doc => notifications.push({ id: doc.id, ...doc.data() }));
        notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.status(200).json({ status: 'success', data: notifications });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        await db.collection('notifications').doc(id).update({ read: true });
        res.status(200).json({ status: 'success', message: 'Read' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.updateStudent = async (req, res) => {
    try {
        const { studentId: oldStudentId } = req.params;
        const { fullName, gradeSection, studentId: rawNewId, lrn, newPasskey } = req.body;
        const newStudentId = rawNewId?.trim()?.toUpperCase();

        console.log(`[UPDATE_STUDENT] Attempting update for ${oldStudentId}`);
        const result = await findStudentDoc(oldStudentId);

        if (!result) {
            console.error(`[UPDATE_STUDENT] Student ${oldStudentId} not found`);
            return res.status(404).json({ status: 'error', message: 'Student not found in database' });
        }

        const currentData = result.doc.data();
        const currentIdInFields = currentData.studentId;
        const finalId = newStudentId || currentIdInFields || result.ref.id;

        // Parse grade/section
        let grade = currentData.grade || '';
        let section = currentData.section || '';
        if (gradeSection && gradeSection.includes('-')) {
            const parts = gradeSection.split('-');
            grade = parts[0].trim();
            section = parts[1].trim();
        }

        const updates = {
            fullName: fullName || currentData.fullName,
            gradeSection: gradeSection || currentData.gradeSection,
            grade: grade,
            section: section,
            lrn: lrn || currentData.lrn || '',
            studentId: finalId,
            qrData: `FUGEN:${finalId}`
        };

        if (newPasskey) {
            updates.passkeyHash = await bcrypt.hash(newPasskey, SALT_ROUNDS);
        }

        // If ID changed or forced move to uppercase doc ID
        const targetDocId = finalId;
        const currentDocId = result.ref.id;

        if (targetDocId !== currentDocId) {
            // Check clash
            const clash = await db.collection('students').doc(targetDocId).get();
            if (clash.exists) {
                return res.status(400).json({ status: 'error', message: 'The new Student ID is already in use.' });
            }

            const newData = { ...currentData, ...updates };
            await db.collection('students').doc(targetDocId).set(newData);
            await result.ref.delete();
            console.log(`[UPDATE_STUDENT] Moved student ${currentDocId} to ${targetDocId}`);
        } else {
            await result.ref.update(updates);
            console.log(`[UPDATE_STUDENT] Updated student ${targetDocId}`);
        }

        const io = req.app.get('io');
        if (io) {
            io.emit('balanceUpdate', { studentId: finalId, type: 'PROFILE_UPDATE' });
            if (targetDocId !== currentDocId) {
                io.emit('studentDeleted', { studentId: currentDocId });
                io.emit('studentCreated', { studentId: targetDocId });
            }
        }

        return res.status(200).json({ status: 'success', message: 'Student information updated' });

    } catch (error) {
        console.error("[UPDATE_STUDENT] Error:", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
