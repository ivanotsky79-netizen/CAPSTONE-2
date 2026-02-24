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

        if (!fullName) {
            return res.status(400).json({ status: 'error', message: 'Name is required' });
        }

        // Use provided studentId or generate a unique one: S-(Year)-(Random 6 digits)
        let studentId = req.body.studentId?.trim()?.toUpperCase();
        let isUnique = false;
        let attempts = 0;

        if (studentId) {
            // Check if provided ID is unique
            const existingDoc = await db.collection('students').doc(studentId).get();
            if (!existingDoc.exists) {
                isUnique = true;
            } else {
                return res.status(400).json({ status: 'error', message: `Student ID "${studentId}" is already in use.` });
            }
        } else {
            while (!isUnique && attempts < 10) {
                studentId = `S${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
                const existingDoc = await db.collection('students').doc(studentId).get();
                if (!existingDoc.exists) {
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
        const { studentId: rawStudentId, passkey } = req.body;
        const studentId = rawStudentId?.trim()?.toUpperCase();
        console.log(`[VERIFY] PIN check starting for: "${studentId}"`);

        let studentDoc;
        studentDoc = await db.collection('students').doc(studentId).get();

        if (!studentDoc.exists) {
            // Fallback 1: Search by 'studentId' field
            let querySnapshot = await db.collection('students').where('studentId', '==', studentId).limit(1).get();

            // Fallback 2: Search by 'lrn' field
            if (querySnapshot.empty) {
                console.log(`[VERIFY] ID not found in studentId field, trying LRN fallback for: "${studentId}"`);
                querySnapshot = await db.collection('students').where('lrn', '==', studentId).limit(1).get();
            }

            if (!querySnapshot.empty) {
                studentDoc = querySnapshot.docs[0];
            }
        }

        if (!studentDoc?.exists) {
            console.warn(`[VERIFY] Student ID "${studentId}" not found.`);
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
            // Fallback 1: Search by 'studentId' field
            let querySnapshot = await db.collection('students').where('studentId', '==', studentId).limit(1).get();

            // Fallback 2: Search by 'lrn' field
            if (querySnapshot.empty) {
                console.log(`[GET_STUDENT] ID not found in studentId field, trying LRN fallback for: "${studentId}"`);
                querySnapshot = await db.collection('students').where('lrn', '==', studentId).limit(1).get();
            }

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

        let studentRef = db.collection('students').doc(studentId);
        let doc = await studentRef.get();

        if (!doc.exists) {
            const querySnapshot = await db.collection('students').where('studentId', '==', studentId).limit(1).get();
            if (!querySnapshot.empty) {
                doc = querySnapshot.docs[0];
                studentRef = doc.ref;
            }
        }

        if (!doc?.exists) {
            return res.status(404).json({ status: 'error', message: 'Student not found' });
        }

        await studentRef.delete();
        console.log(`[DELETE_STUDENT] Successfully deleted actual ID: ${studentRef.id}`);

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

exports.updatePasskey = async (req, res) => {
    try {
        const { studentId, currentPasskey, newPasskey } = req.body;

        // Basic Validation
        if (!newPasskey || newPasskey.length !== 4 || isNaN(newPasskey)) {
            return res.status(400).json({ status: 'error', message: 'New Passkey must be exactly 4 digits.' });
        }

        let studentRef = db.collection('students').doc(studentId);
        let doc = await studentRef.get();

        if (!doc.exists) {
            const querySnapshot = await db.collection('students').where('studentId', '==', studentId).limit(1).get();
            if (!querySnapshot.empty) {
                doc = querySnapshot.docs[0];
                studentRef = doc.ref;
            }
        }

        if (!doc?.exists) {
            return res.status(404).json({ status: 'error', message: 'Student not found' });
        }

        const student = doc.data();

        // Verify Current Passkey
        const match = await bcrypt.compare(currentPasskey, student.passkeyHash);
        if (!match) {
            return res.status(401).json({ status: 'error', message: 'Current Passkey is incorrect' });
        }

        // Hash New Passkey (Cost 4)
        const newHash = await bcrypt.hash(newPasskey, 4);

        await studentRef.update({ passkeyHash: newHash });

        console.log(`[UPDATE_PASSKEY] Success for student: ${studentId}`);
        res.status(200).json({ status: 'success', message: 'Passkey updated successfully' });

    } catch (error) {
        console.error("[UPDATE_PASSKEY] Error:", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
exports.getUserNotifications = async (req, res) => {
    try {
        const { studentId } = req.params;
        const snapshot = await db.collection('notifications')
            .where('studentId', '==', studentId)
            .get();

        const notifications = [];
        snapshot.forEach(doc => {
            notifications.push({ id: doc.id, ...doc.data() });
        });

        notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.status(200).json({ status: 'success', data: notifications });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;
        await db.collection('notifications').doc(id).update({
            read: true
        });
        res.status(200).json({ status: 'success', message: 'Notification marked as read' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

exports.updateStudent = async (req, res) => {
    try {
        const { studentId: rawOldId } = req.params;
        const oldStudentId = rawOldId?.trim()?.toUpperCase();
        const { fullName, gradeSection, studentId: rawNewId, lrn, newPasskey } = req.body;
        const newStudentId = rawNewId?.trim()?.toUpperCase();

        let studentRef = db.collection('students').doc(oldStudentId);
        let doc = await studentRef.get();

        if (!doc.exists) {
            const querySnapshot = await db.collection('students').where('studentId', '==', oldStudentId).limit(1).get();
            if (!querySnapshot.empty) {
                doc = querySnapshot.docs[0];
                studentRef = doc.ref;
            }
        }

        if (!doc?.exists) {
            return res.status(404).json({ status: 'error', message: 'Student not found in database' });
        }

        const currentData = doc.data();
        const finalId = newStudentId || currentData.studentId || oldStudentId;

        // Sync grade/section if gradeSection is provided
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
            qrData: `FUGEN:${finalId}` // Ensure QR updates if ID changes
        };

        if (newPasskey) {
            updates.passkeyHash = await bcrypt.hash(newPasskey, SALT_ROUNDS);
        }

        // If studentId changed, move the document
        if (finalId !== currentData.studentId) {
            const clash = await db.collection('students').doc(finalId).get();
            if (clash.exists) {
                return res.status(400).json({ status: 'error', message: 'The new Student ID is already in use.' });
            }

            const newData = { ...currentData, ...updates };
            await db.collection('students').doc(finalId).set(newData);
            await studentRef.delete();
            console.log(`[UPDATE_STUDENT] Moved student ${oldStudentId} to ${finalId}`);
        } else {
            await studentRef.update(updates);
            console.log(`[UPDATE_STUDENT] Updated student ${finalId}`);
        }

        /** @type {import('socket.io').Server} */
        const io = req.app.get('io');
        if (io) {
            // Emit a balanceUpdate to force refresh across the system
            io.emit('balanceUpdate', { studentId: finalId, type: 'PROFILE_UPDATE' });
            if (finalId !== oldStudentId) {
                io.emit('studentDeleted', { studentId: oldStudentId });
                io.emit('studentCreated', { studentId: finalId });
            }
        }

        return res.status(200).json({ status: 'success', message: 'Student information updated' });

    } catch (error) {
        console.error("[UPDATE_STUDENT] Error:", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
