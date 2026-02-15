import AsyncStorage from '@react-native-async-storage/async-storage';
import { transactionService } from './api';

/**
 * Daily Report Auto-Save Service
 * Saves daily statistics at 3:30 PM automatically
 */

class DailyReportService {
    constructor() {
        this.checkInterval = null;
        this.lastSavedDate = null;
    }

    /**
     * Start the auto-save service
     * Checks every minute if it's 3:30 PM
     */
    start() {
        console.log('[REPORT SERVICE] Starting auto-save service...');

        // Check immediately on start
        this.checkAndSave();

        // Then check every minute
        this.checkInterval = setInterval(() => {
            this.checkAndSave();
        }, 60000); // Check every 60 seconds
    }

    /**
     * Stop the auto-save service
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            console.log('[REPORT SERVICE] Auto-save service stopped');
        }
    }

    /**
     * Check if it's 3:30 PM and save if needed
     */
    async checkAndSave() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const today = now.toDateString();

        // Check if it's 3:30 PM (15:30)
        if (hours === 15 && minutes === 30) {
            // Prevent saving multiple times in the same minute
            if (this.lastSavedDate === today) {
                return;
            }

            console.log('[REPORT SERVICE] It\'s 3:30 PM - Auto-saving daily report...');
            await this.saveDailyReport();
            this.lastSavedDate = today;
        }
    }

    /**
     * Manually save the current day's report
     */
    async saveDailyReport() {
        try {
            // Fetch comprehensive stats (location=ADMIN or omit)
            const response = await transactionService.getDailyStats('ADMIN');

            if (response.data.status === 'success') {
                const data = response.data.data; // { canteen: {...}, system: {...} }
                const now = new Date();
                const year = now.getFullYear();
                const month = now.toLocaleString('default', { month: 'long' });
                const day = now.getDate();

                // Construct a structured report object
                const reportData = {
                    canteen: {
                        totalSales: data.canteen?.totalSales || 0,
                        totalCash: data.canteen?.cashCollected || 0,
                        creditSales: data.canteen?.totalCredit || 0,
                        transactions: data.canteen?.transactions || []
                    },
                    system: {
                        topups: data.system?.todayTopups || 0,
                        withdrawals: data.system?.todayWithdrawals || 0,
                        cashOnHand: data.system?.totalCashOnHand || 0,
                        outstandingCredit: data.system?.totalDebt || 0,
                        transactions: data.system?.transactions || []
                    },
                    savedAt: now.toISOString()
                };

                const dateKey = `report_${year}_${month}_${day}`;
                await AsyncStorage.setItem(dateKey, JSON.stringify(reportData));

                console.log(`[REPORT SERVICE] ✅ Saved report for ${month} ${day}, ${year}`);
                console.log(`[REPORT SERVICE] Sales: ${reportData.totalSales}, Cash: ${reportData.totalCash}, Credit: ${reportData.totalCredit}`);

                return true;
            }
        } catch (error) {
            console.error('[REPORT SERVICE] Error saving daily report:', error);
            return false;
        }
    }

    /**
     * Get all saved report dates
     */
    async getSavedReportDates() {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const reportKeys = keys.filter(key => key.startsWith('report_'));

            return reportKeys.map(key => {
                const parts = key.replace('report_', '').split('_');
                return {
                    year: parts[0],
                    month: parts[1],
                    day: parts[2],
                    key: key
                };
            });
        } catch (error) {
            console.error('[REPORT SERVICE] Error getting saved dates:', error);
            return [];
        }
    }
}

// Export singleton instance
export default new DailyReportService();
