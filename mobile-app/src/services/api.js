import axios from 'axios';
import { Platform } from 'react-native';

// Use 10.0.2.2 for Android Emulator, localhost for iOS simulator
const DEV_URL = Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api';

// 1. For Local Development (same WiFi), use: 'http://Amirivan.local:5000'
// 2. For Cloud (works anywhere), use your Render URL: 'https://fugen-backend.onrender.com'
export const BASE_URL = 'https://fugen-backend.onrender.com';
const API_BASE_URL = `${BASE_URL}/api`;

import { io } from 'socket.io-client';
export const socket = io(BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a simple request timer for debugging
api.interceptors.request.use((config) => {
    config.metadata = { startTime: new Date() };
    return config;
});

api.interceptors.response.use(
    (response) => {
        const duration = new Date() - response.config.metadata.startTime;
        console.log(`[API SUCCESS] ${response.config.url} took ${duration}ms`);
        return response;
    },
    (error) => {
        const duration = new Date() - error.config.metadata.startTime;
        console.log(`[API ERROR] ${error.config.url} failed after ${duration}ms`);
        return Promise.reject(error);
    }
);

export const studentService = {
    getStudent: (studentId) => api.get(`/student/${studentId}`),
    verifyPasskey: (studentId, passkey) => api.post('/verify-passkey', { studentId, passkey }),
};

export const transactionService = {
    purchase: (studentId, amount, passkey) => api.post('/purchase', {
        studentId,
        amount,
        passkey,
        location: 'CANTEEN'
    }),
    getDailyStats: (location = 'CANTEEN') => api.get(`/stats/daily`, { params: { location } }),
};

export default api;
