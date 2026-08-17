/**
 * API Client Configuration
 * Axios instance with security features and interceptors
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_URL, API_TIMEOUT, STORAGE_KEYS } from '../constants';
import { getRealtimeClientId } from '../realtime/clientId';

// Constants
const MAX_REQUEST_SIZE = 50000; // 50KB

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
    withCredentials: true,
});

const getCookieValue = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const prefix = `${encodeURIComponent(name)}=`;
    const cookie = document.cookie.split('; ').find((item) => item.startsWith(prefix));
    if (!cookie) return null;
    try {
        return decodeURIComponent(cookie.slice(prefix.length));
    } catch {
        return null;
    }
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

const clearExpiredSessionState = (): void => {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
    localStorage.removeItem(STORAGE_KEYS.SELECTED_GATE);
    localStorage.removeItem(STORAGE_KEYS.WEEKLY_RANKING_CELEBRATION);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOP_PERFORMERS_POPUP);

    // Sunucu bir oturumu iptal ettiğinde açık sayfadaki kişisel kayıtların
    // React belleğinde görünmeye devam etmesini engelle.
    if (window.location.pathname !== '/login') {
        window.location.replace('/login');
    }
};

/**
 * Request interceptor - CSRF protection and security checks
 */
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const isFormDataRequest = typeof FormData !== 'undefined' && config.data instanceof FormData;

        // Global JSON başlığı FormData içeriğini boş JSON nesnesine dönüştürmemeli.
        // Başlığı kaldırınca tarayıcı doğru multipart boundary değerini kendisi ekler.
        if (isFormDataRequest) {
            config.headers.delete('Content-Type');
        }

        const csrfToken = getCookieValue('security_csrf');
        if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
        }

        const gate = getSelectedGate();
        if (gate) {
            config.headers['X-Selected-Gate'] = gate;
        }

        config.headers['X-Realtime-Client-Id'] = getRealtimeClientId();

        // Request body size validation (client-side DoS prevention)
        if (config.data && !isFormDataRequest) {
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
                console.warn('[API] 401 Unauthorized - Token geçersiz veya süresi dolmuş');
                clearExpiredSessionState();
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
