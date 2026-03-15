const { db } = require('./src/config/firebase');

async function countTransactions() {
    if (!db) {
        console.error("Database not initialized");
        return;
    }

    const dates = ['2026-02-25', '2026-02-26'];
    // Time windows (Local AST +03:00)
    // 10:05 am - 10:35 am  -> UTC 07:05 - 07:35
    // 12:05 pm - 12:45 pm  -> UTC 09:05 - 09:45
    
    // We'll search using ISO strings. If the DB stores them in local time or UTC, we need to match that.
    // Based on transactionController.js, it uses new Date().toISOString()
    
    // AST 10:05 is UTC 07:05
    // AST 12:05 is UTC 09:05
    
    const windows = [
        { start: 'T07:05:00.000Z', end: 'T07:35:00.000Z', label: '10:05 am - 10:35 am' },
        { start: 'T09:05:00.000Z', end: 'T09:45:00.000Z', label: '12:05 pm - 12:45 pm' }
    ];

    console.log("--- Transaction Summary ---");

    for (const date of dates) {
        console.log(`\nDate: ${date}`);
        for (const window of windows) {
            const startTime = `${date}${window.start}`;
            const endTime = `${date}${window.end}`;

            try {
                const snapshot = await db.collection('transactions')
                    .where('timestamp', '>=', startTime)
                    .where('timestamp', '<=', endTime)
                    .get();
                
                console.log(`  ${window.label}: ${snapshot.size} transactions`);
            } catch (err) {
                console.error(`Error querying for ${date} ${window.label}:`, err.message);
            }
        }
    }
    process.exit(0);
}

countTransactions();
