import axios from 'axios';

// Local: 'http://localhost:5000/api'
// Cloud: 'https://your-backend.onrender.com/api'
const API_BASE_URL = 'https://0028afc3-f39b-496c-a4a7-0daee7c3afcc-00-28bvg4oui5u20.pike.replit.dev/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const studentService = {
    // Passkey Verification
    verifyPasskey: (studentId, passkey) => api.post('/verify-passkey', { studentId, passkey }),

    // Student Management
    getAllStudents: () => api.get('/students'),
    getStudent: (studentId) => api.get(`/student/${studentId}`),
    getCreditStatus: (studentId) => api.get(`/student/${studentId}`),
    createStudent: (data) => api.post('/student', data),
    deleteStudent: (studentId) => api.delete(`/student/${studentId}`),
};

export const transactionService = {
    topUp: (studentId, amount) => api.post('/topup', { studentId, amount, location: 'ADMIN' }),
    purchase: (studentId, amount, passkey) => api.post('/purchase', { studentId, amount, passkey }),
    getTransactions: (studentId) => api.get('/transactions', { params: { studentId } }),
    getDailyStats: (date, includeGlobal = false) => api.get('/stats/daily', { params: { date, includeGlobal } }),
    withdraw: (amount, passkey) => api.post('/withdraw', { amount, passkey }),
};

export default api;
