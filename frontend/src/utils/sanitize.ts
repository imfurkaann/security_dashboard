/**
 * Frontend XSS Koruması - Input Sanitization Utilities
 * Güvenlik kayıt platformu için kritik öneme sahip
 */

/**
 * HTML karakterlerini escape eder - XSS saldırılarını önler
 */
export const escapeHtml = (unsafe: string | null | undefined): string => {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

/**
 * Script taglerini ve tehlikeli içeriği temizler
 */
export const sanitizeInput = (input: string | null | undefined): string => {
    if (!input) return '';
    return String(input)
        // Script taglerini kaldır
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        // Event handler'ları kaldır (onclick, onerror, etc.)
        .replace(/\bon\w+\s*=/gi, '')
        // javascript: protokolünü kaldır
        .replace(/javascript:/gi, '')
        // data: protokolünü kaldır (base64 injection)
        .replace(/data:/gi, '')
        // vbscript: protokolünü kaldır
        .replace(/vbscript:/gi, '')
        .trim();
};

/**
 * Sadece alfanumerik ve belirli karakterlere izin verir
 * Plaka, telefon gibi alanlar için
 */
export const sanitizeAlphanumeric = (input: string | null | undefined, allowedChars: string = ' -'): string => {
    if (!input) return '';
    const regex = new RegExp(`[^a-zA-Z0-9${allowedChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`, 'g');
    return String(input).replace(regex, '').trim();
};

/**
 * Telefon numarası formatı için
 */
export const sanitizePhone = (input: string | null | undefined): string => {
    if (!input) return '';
    return String(input).replace(/[^0-9+\-\s()]/g, '').trim();
};

/**
 * Plaka formatı için (Türkiye)
 */
export const sanitizePlate = (input: string | null | undefined): string => {
    if (!input) return '';
    return String(input)
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .trim();
};

/**
 * URL doğrulama
 */
export const isValidUrl = (url: string): boolean => {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
};

/**
 * UUID formatı doğrulama
 */
export const isValidUUID = (uuid: string | null | undefined): boolean => {
    if (!uuid) return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
};

/**
 * Güvenli JSON parse - hata durumunda null döner
 */
export const safeJsonParse = <T>(json: string | null, fallback: T): T => {
    if (!json) return fallback;
    try {
        return JSON.parse(json) as T;
    } catch {
        return fallback;
    }
};

/**
 * localStorage'dan güvenli veri okuma
 */
export const safeGetItem = <T>(key: string, fallback: T): T => {
    try {
        const item = localStorage.getItem(key);
        if (!item) return fallback;
        return JSON.parse(item) as T;
    } catch {
        return fallback;
    }
};

/**
 * Maksimum uzunluk kontrolü
 */
export const truncate = (input: string | null | undefined, maxLength: number): string => {
    if (!input) return '';
    const str = String(input);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + '...';
};
