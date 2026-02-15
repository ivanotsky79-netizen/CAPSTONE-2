const { db } = require('../config/firebase');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 4;

async function seedData() {
    console.log("Starting seed process...");

    try {
        const students = [
            {
                fullName: "Maria Santos",
                grade: "10",
                section: "Rizal",
                passkey: "1234",
                balance: 50.00
            },
            {
                fullName: "Ahmed Al-Farsi",
                grade: "11",
                section: "Ibn Sina",
                passkey: "1111",
                balance: -10.00
            },
            {
                fullName: "Sophia Garcia",
                grade: "9",
                section: "Aquino",
                passkey: "2222",
                balance: 15.75
            }
        ];

        for (const s of students) {
            const studentId = `S2026-${Math.floor(1000 + Math.random() * 9000)}`;
            const passkeyHash = await bcrypt.hash(s.passkey, SALT_ROUNDS);

            const studentData = {
                studentId,
                fullName: s.fullName,
                grade: s.grade,
                section: s.section,
                balance: s.balance,
                passkeyHash,
                qrData: `FUGEN:${studentId}`,
                accountLocked: false,
                failedAttempts: 0,
                createdAt: new Date().toISOString()
            };

            await db.collection('students').doc(studentId).set(studentData);
            console.log(`Seeded student: ${s.fullName} (${studentId})`);
        }

        console.log("Seed process completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Error seeding data:", error);
        process.exit(1);
    }
}

seedData();
