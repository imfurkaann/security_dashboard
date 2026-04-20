/**
 * Frontend Constants
 * Uygulama genelinde kullanılan sabitler
 */

// API Configuration
// Dinamik API URL - Tarayıcının eriştiği host'u kullanır
const getApiUrl = () => {
    // Build zamanında set edilen URL varsa kullan
    const envUrl = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_URL : undefined;
    if (envUrl) return envUrl;

    // Runtime'da dinamik URL oluştur
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        // Eğer localhost ise port 5000, değilse port 5000
        return `${protocol}//${hostname}:5000/api`;
    }

    // Fallback
    return 'http://localhost:5000/api';
};

export const API_URL = getApiUrl();
export const API_TIMEOUT = 30000; // 30 saniye

// Pagination
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 1000;

// Validation Patterns
export const PATTERNS = {
    PHONE: /^(05\d{9}|5\d{9}|\+90\s?5\d{2}\s?\d{3}\s?\d{2}\s?\d{2})$/,
    PLATE: /^(0[1-9]|[1-7]\d|8[01])\s?[A-Z]{1,3}\s?\d{2,4}$/i,
    UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const;

// Status Types
export const STATUS = {
    INSIDE: 'inside',
    EXITED: 'exited',
    IN_USE: 'in_use',
    RETURNED: 'returned',
    AVAILABLE: 'available',
    OPEN: 'open',
    CLOSED: 'closed',
} as const;

// User Roles
export const ROLES = {
    ADMIN: 'admin',
    MANAGER: 'manager',
    SECURITY: 'security',
} as const;

// Role Labels (Turkish)
export const ROLE_LABELS: Record<string, string> = {
    [ROLES.ADMIN]: 'YÖNETİCİ',
    [ROLES.MANAGER]: 'MÜDÜR',
    [ROLES.SECURITY]: 'GÜVENLİK',
};

// Status Labels (Turkish)
export const STATUS_LABELS: Record<string, string> = {
    [STATUS.INSIDE]: 'İçeride',
    [STATUS.EXITED]: 'Çıkış Yapıldı',
    [STATUS.IN_USE]: 'Kullanımda',
    [STATUS.RETURNED]: 'İade Edildi',
    [STATUS.AVAILABLE]: 'Müsait',
    [STATUS.OPEN]: 'Açık',
    [STATUS.CLOSED]: 'Kapatıldı',
};

// Shift Definitions
export const SHIFTS = [
    { id: 's1', start: 0, end: 8, label: '00:00 - 08:00 vardiyası' },
    { id: 's2', start: 8, end: 16, label: '08:00 - 16:00 vardiyası' },
    { id: 's3', start: 16, end: 24, label: '16:00 - 00:00 vardiyası' },
] as const;

// Local Storage Keys
export const STORAGE_KEYS = {
    TOKEN: 'token',
    USER: 'user',
    THEME: 'theme',
    ADMIN_TOKEN: 'adminToken',
    ADMIN_USER: 'adminUser',
    SELECTED_GATE: 'selectedGate',
    WEEKLY_RANKING_CELEBRATION: 'weeklyRankingCelebration',
    ADMIN_TOP_PERFORMERS_POPUP: 'adminTopPerformersPopup',
} as const;
