const { db } = require('./src/config/firebase');

async function check() {
    console.log("--- DATABASE CHECK ---");
    try {
        const snapshot = await db.collection('students').get();
        console.log(`Found ${snapshot.size} students in collection 'students'.`);
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`- DOC_ID: "${doc.id}" | FIELD_ID: "${data.studentId}" | NAME: "${data.fullName}"`);
        });
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

check();
