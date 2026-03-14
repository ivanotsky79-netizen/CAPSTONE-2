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

import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to attach the JWT token
api.interceptors.request.use(async (config) => {
    config.metadata = { startTime: new Date() };
    try {
        const token = await AsyncStorage.getItem('fugen_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (e) {
        console.error('Error fetching token from storage', e);
    }
    return config;
});

api.interceptors.response.use(
    (response) => {
        const duration = new Date() - response.config.metadata.startTime;
        console.log(`[API SUCCESS] ${response.config.url} took ${duration}ms`);
        return response;
    },
    async (error) => {
        const duration = new Date() - error.config.metadata.startTime;
        console.log(`[API ERROR] ${error.config.url} failed after ${duration}ms`);
        
        if (error.response && error.response.status === 401) {
            // Handle unauthorized - clear token and maybe trigger some global event/navigation
            await AsyncStorage.removeItem('fugen_token');
            await AsyncStorage.removeItem('fugen_user');
        }
        
        return Promise.reject(error);
    }
);

export const authService = {
    login: async (username, password) => {
        const response = await api.post('/login', { username, password });
        if (response.data.token) {
            await AsyncStorage.setItem('fugen_token', response.data.token);
            await AsyncStorage.setItem('fugen_user', JSON.stringify(response.data.user));
        }
        return response.data;
    },
    logout: async () => {
        await AsyncStorage.removeItem('fugen_token');
        await AsyncStorage.removeItem('fugen_user');
    },
    getCurrentUser: async () => {
        const user = await AsyncStorage.getItem('fugen_user');
        return user ? JSON.parse(user) : null;
    }
};

export const studentService = {
    getStudent: (studentId) => api.get(`/student/${studentId}`),
    getAllStudents: () => api.get('/students'),
    verifyPasskey: (studentId, passkey) => api.post('/verify-passkey', { studentId, passkey }),
};

export const transactionService = {
    purchase: (studentId, amount, passkey, bypassPasskey = false) => api.post('/purchase', {
        studentId,
        amount,
        passkey,
        bypassPasskey,
        location: 'CANTEEN'
    }),
    getDailyStats: (location = 'CANTEEN', date = null) => api.get(`/stats/daily`, { params: { location, date } }),
    getTransactions: (studentId) => api.get('/transactions', { params: { studentId } }),
};

export default api;
