import axios from 'axios';

// Detect if we are running locally or in production (Vercel)
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocal 
    ? 'http://localhost:5000/api' 
    : 'https://fugen-backend.onrender.com/api'; // Explicit Render URL for Vercel

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to attach the JWT token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('fugen_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add a response interceptor to handle 401 errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Only redirect if we're not already on the login page
            if (!window.location.pathname.includes('/login')) {
                localStorage.removeItem('fugen_token');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export const authService = {
    login: async (username, password) => {
        const response = await api.post('/login', { username, password });
        if (response.data.token) {
            localStorage.setItem('fugen_token', response.data.token);
            localStorage.setItem('fugen_user', JSON.stringify(response.data.user));
        }
        return response.data;
    },
    logout: () => {
        localStorage.removeItem('fugen_token');
        localStorage.removeItem('fugen_user');
        window.location.href = '/login';
    },
    getCurrentUser: () => {
        const user = localStorage.getItem('fugen_user');
        return user ? JSON.parse(user) : null;
    }
};

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
    rejectTopupRequest: (id) => api.put(`/topup-requests/${id}/reject`),
    rescheduleTopupRequest: (id, date, timeSlot) => api.put(`/topup-requests/${id}/reschedule`, { date, timeSlot }),
    getNotifications: (studentId) => api.get(`/student/${studentId}/notifications`),
    markNotificationRead: (id) => api.put(`/notifications/${id}/read`),
    setCashAdjustment: (amount, adminPin, note) => api.post('/cash-adjustment', { amount, adminPin, note }),
    getCashAdjustment: () => api.get('/cash-adjustment'),
};

export default api;
