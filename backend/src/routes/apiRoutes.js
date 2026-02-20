const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const studentController = require('../controllers/studentController');

// Transaction Routes
router.post('/topup', transactionController.topUp);
router.post('/purchase', transactionController.purchase);
router.get('/transactions', transactionController.getTransactions);
router.get('/stats/daily', transactionController.getDailyStats);
router.get('/stats/weekly', transactionController.getWeeklyStats);
router.post('/withdraw', transactionController.withdraw);

// Student Routes
router.post('/student', studentController.createStudent);
router.get('/students', studentController.getAllStudents);
router.get('/student/:studentId', studentController.getStudent);
router.delete('/student/:studentId', studentController.deleteStudent);
router.post('/verify-passkey', studentController.verifyPasskey);
router.post('/student/update-passkey', studentController.updatePasskey);

module.exports = router;
