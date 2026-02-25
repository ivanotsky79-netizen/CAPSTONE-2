const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const studentController = require('../controllers/studentController');

// Transaction Routes
router.post('/topup', transactionController.topUp);
router.post('/deduct', transactionController.deduct);
router.post('/purchase', transactionController.purchase);
router.get('/transactions', transactionController.getTransactions);
router.get('/stats/daily', transactionController.getDailyStats);
router.get('/stats/weekly', transactionController.getWeeklyStats);
router.post('/withdraw', transactionController.withdraw);
router.post('/cash-adjustment', transactionController.setCashAdjustment);
router.get('/cash-adjustment', transactionController.getCashAdjustment);

// Topup Requests
router.post('/request-topup', transactionController.requestTopup);
router.get('/topup-requests', transactionController.getTopupRequests);
router.put('/topup-requests/:id/resolve', transactionController.resolveTopupRequest);
router.put('/topup-requests/:id/approve', transactionController.approveTopupRequest);
router.put('/topup-requests/:id/reject', transactionController.rejectTopupRequest);
router.put('/topup-requests/:id/reschedule', transactionController.rescheduleTopupRequest);
router.put('/topup-requests/:id/undo', transactionController.undoTopupRequest);

// Student Routes
router.post('/student', studentController.createStudent);
router.get('/students', studentController.getAllStudents);
router.get('/student/:studentId', studentController.getStudent);
router.delete('/student/:studentId', studentController.deleteStudent);
router.put('/student/:studentId', studentController.updateStudent);
router.post('/verify-passkey', studentController.verifyPasskey);
router.post('/student/update-passkey', studentController.updatePasskey);

// Notifications
router.get('/student/:studentId/notifications', studentController.getUserNotifications);
router.put('/notifications/:id/read', studentController.markNotificationRead);

module.exports = router;
