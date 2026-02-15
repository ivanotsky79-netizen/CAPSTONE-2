const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

// Common mistake: serviceAccountKey.json.json
const possiblePaths = [
    path.join(__dirname, '../../serviceAccountKey.json'),
    path.join(__dirname, '../../serviceAccountKey.json.json')
];

let initialized = false;

try {
    const activePath = possiblePaths.find(p => fs.existsSync(p));

    if (activePath) {
        const serviceAccount = require(activePath);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log(`✅ Firebase initialized using ${path.basename(activePath)}`);
        initialized = true;
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Firebase initialized using FIREBASE_SERVICE_ACCOUNT env var");
        initialized = true;
    } else {
        console.error("❌ CRITICAL ERROR: Firebase credentials NOT found!");
        console.error("Please ensure you have downloaded your Service Account Key and placed it in:");
        console.error("C:\\Users\\melma\\OneDrive\\Desktop\\CAPSTONE 2\\backend\\serviceAccountKey.json");
    }
} catch (error) {
    console.error("❌ Firebase initialization error:", error);
}

if (!initialized) {
    console.warn("⚠️ Warning: App is running without a database connection. Real-time features will fail.");
}

// Ensure we only export db if initialized to avoid the crash you saw
const db = initialized ? admin.firestore() : null;

module.exports = { admin, db };
