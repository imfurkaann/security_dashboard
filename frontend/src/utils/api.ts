/**
 * API Client Configuration
 * Axios instance with security features and interceptors
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL, API_TIMEOUT, STORAGE_KEYS } from '../constants';

// Constants
const MAX_REQUEST_SIZE = 50000; // 50KB
const TOKEN_MIN_LENGTH = 10;
const TOKEN_MAX_LENGTH = 1000;

// HTTP Status Codes
const HTTP_STATUS = {
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    TOO_MANY_REQUESTS: 429,
} as const;

// Create axios instance
const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: API_TIMEOUT,
    withCredentials: false,
});

/**
 * Gets the appropriate token based on current path
 */
const getToken = (): string | null => {
    const isAdminPath = window.location.pathname.startsWith('/admin');
    if (isAdminPath) {
        return localStorage.getItem('adminToken') || localStorage.getItem(STORAGE_KEYS.TOKEN);
    }
    return localStorage.getItem(STORAGE_KEYS.TOKEN);
};

const getSelectedGate = (): string | null => {
    const isAdminPath = window.location.pathname.startsWith('/admin');
    if (isAdminPath) return null;

    const gate = localStorage.getItem(STORAGE_KEYS.SELECTED_GATE);
    if (gate && gate.trim().length > 0 && gate.length <= 64) {
        return gate;
    }

    return null;
};

/**
 * Validates token format
 */
const isValidToken = (token: string | null): token is string => {
    return !!token && token.length > TOKEN_MIN_LENGTH && token.length < TOKEN_MAX_LENGTH;
};

/**
 * Request interceptor - Token injection and security checks
 */
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = getToken();

        // Add token if valid
        if (isValidToken(token)) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        const gate = getSelectedGate();
        if (gate) {
            config.headers['X-Selected-Gate'] = gate;
        }

        // Request body size validation (client-side DoS prevention)
        if (config.data) {
            const dataSize = JSON.stringify(config.data).length;
            if (dataSize > MAX_REQUEST_SIZE) {
                console.error('[API] İstek boyutu çok büyük:', dataSize);
                return Promise.reject(new Error('İstek boyutu çok büyük'));
            }
        }

        return config;
    },
    (error) => Promise.reject(error)
);

/**
 * Response interceptor - Error handling
 */
api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        const status = error.response?.status;

        switch (status) {
            case HTTP_STATUS.UNAUTHORIZED:
                // Otomatik çıkış devre dışı - Sadece hata göster
                console.warn('[API] 401 Unauthorized - Token geçersiz veya süresi dolmuş');
                // NOT: Kullanıcı manuel olarak çıkış yapmalı
                break;

            case HTTP_STATUS.TOO_MANY_REQUESTS:
                console.warn('[API] Çok fazla istek - rate limit aşıldı');
                break;

            case HTTP_STATUS.FORBIDDEN:
                console.warn('[API] Yetkisiz işlem');
                break;

            default:
                if (!error.response) {
                    console.error('[API] Sunucuya bağlanılamadı');
                }
        }

        return Promise.reject(error);
    }
);

/**
 * Safe GET request wrapper
 */
export async function safeGet<T>(url: string): Promise<T | null> {
    try {
        const response = await api.get<T>(url);
        return response.data;
    } catch (error) {
        console.error(`[API] GET ${url} hatası:`, error);
        return null;
    }
}

/**
 * Safe POST request wrapper
 */
export async function safePost<T>(url: string, data: unknown): Promise<T | null> {
    try {
        const response = await api.post<T>(url, data);
        return response.data;
    } catch (error) {
        console.error(`[API] POST ${url} hatası:`, error);
        return null;
    }
}

/**
 * Safe PUT request wrapper
 */
export async function safePut<T>(url: string, data: unknown): Promise<T | null> {
    try {
        const response = await api.put<T>(url, data);
        return response.data;
    } catch (error) {
        console.error(`[API] PUT ${url} hatası:`, error);
        return null;
    }
}

/**
 * Safe DELETE request wrapper
 */
export async function safeDelete<T>(url: string): Promise<T | null> {
    try {
        const response = await api.delete<T>(url);
        return response.data;
    } catch (error) {
        console.error(`[API] DELETE ${url} hatası:`, error);
        return null;
    }
}

export default api;
