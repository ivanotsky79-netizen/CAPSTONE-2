import axios from 'axios';

// Local: 'http://localhost:5000/api'
// Cloud: 'https://your-backend.onrender.com/api'
const API_BASE_URL = 'https://fugen-backend.onrender.com/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const studentService = {
    // Passkey Verification
    verifyPasskey: (studentId, passkey) => api.post('/verify-passkey', { studentId, passkey }),
    updatePasskey: (studentId, currentPasskey, newPasskey) => api.post('/student/update-passkey', { studentId, currentPasskey, newPasskey }),

    // Student Management
    getAllStudents: () => api.get('/students'),
    getStudent: (studentId) => api.get(`/student/${studentId}`),
    getCreditStatus: (studentId) => api.get(`/student/${studentId}`),
    createStudent: (data) => api.post('/student', data),
    deleteStudent: (studentId) => api.delete(`/student/${studentId}`),
};

export const transactionService = {
    topUp: (studentId, amount) => api.post('/topup', { studentId, amount, location: 'ADMIN' }),
    deduct: (studentId, amount, adminPin) => api.post('/deduct', { studentId, amount, adminPin, location: 'ADMIN' }),
    purchase: (studentId, amount, passkey) => api.post('/purchase', { studentId, amount, passkey }),
    getTransactions: (studentId) => api.get('/transactions', { params: { studentId } }),
    getDailyStats: (date, includeGlobal = false) => api.get('/stats/daily', { params: { date, includeGlobal } }),
    getWeeklyStats: () => api.get('/stats/weekly'),
    withdraw: (amount, passkey) => api.post('/withdraw', { amount, passkey }),
    requestTopup: (studentId, amount, date, timeSlot) => api.post('/request-topup', { studentId, amount, date, timeSlot }),
    getTopupRequests: (studentId) => api.get('/topup-requests', { params: { studentId } }),
    resolveTopupRequest: (id) => api.put(`/topup-requests/${id}/resolve`),
    approveTopupRequest: (id) => api.put(`/topup-requests/${id}/approve`),
    getNotifications: (studentId) => api.get(`/student/${studentId}/notifications`),
    markNotificationRead: (id) => api.put(`/notifications/${id}/read`)
};

export default api;
