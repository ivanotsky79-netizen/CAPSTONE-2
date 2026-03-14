const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const studentController = require('../controllers/studentController');
const authController = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Auth Routes
router.post('/login', authController.login);
router.get('/auth/verify', protect, authController.verifyToken);

// Transaction Routes
router.post('/topup', protect, authorize('admin'), transactionController.topUp);
router.post('/deduct', protect, authorize('admin'), transactionController.deduct);
router.post('/purchase', protect, authorize('admin', 'canteen'), transactionController.purchase);
router.get('/transactions', protect, transactionController.getTransactions);
router.get('/stats/daily', protect, transactionController.getDailyStats);
router.get('/stats/weekly', protect, authorize('admin'), transactionController.getWeeklyStats);
router.post('/withdraw', protect, authorize('admin'), transactionController.withdraw);
router.post('/cash-adjustment', protect, authorize('admin'), transactionController.setCashAdjustment);
router.get('/cash-adjustment', protect, transactionController.getCashAdjustment);

// Topup Requests
router.post('/request-topup', transactionController.requestTopup); // Public for students
router.get('/topup-requests', protect, transactionController.getTopupRequests);
router.put('/topup-requests/:id/resolve', protect, authorize('admin'), transactionController.resolveTopupRequest);
router.put('/topup-requests/:id/approve', protect, authorize('admin'), transactionController.approveTopupRequest);
router.put('/topup-requests/:id/reject', protect, authorize('admin'), transactionController.rejectTopupRequest);
router.put('/topup-requests/:id/reschedule', protect, authorize('admin'), transactionController.rescheduleTopupRequest);
router.put('/topup-requests/:id/undo', protect, authorize('admin'), transactionController.undoTopupRequest);

// Student Routes
router.post('/student', protect, authorize('admin'), studentController.createStudent);
router.get('/students', protect, authorize('admin'), studentController.getAllStudents);
router.get('/student/:studentId', protect, studentController.getStudent);
router.delete('/student/:studentId', protect, authorize('admin'), studentController.deleteStudent);
router.put('/student/:studentId', protect, authorize('admin'), studentController.updateStudent);
router.post('/verify-passkey', studentController.verifyPasskey); // Public for verification
router.post('/student/update-passkey', protect, studentController.updatePasskey); 

// Notifications
router.get('/student/:studentId/notifications', protect, studentController.getUserNotifications);
router.put('/notifications/:id/read', protect, studentController.markNotificationRead);

module.exports = router;
