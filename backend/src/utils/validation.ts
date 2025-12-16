/**
 * Input validation and sanitization utilities
 * GÜVENLİK: Bu modül tüm kullanıcı girdilerini doğrular ve temizler
 */

// UUID v4 formatı doğrulama
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Türk telefon formatı (0532 XXX XX XX veya +90 532 XXX XX XX)
const PHONE_REGEX = /^(\+90|0)?[5][0-9]{9}$/;

// Türk plaka formatı (34 ABC 1234 veya 34ABC1234)
const PLATE_REGEX = /^(0[1-9]|[1-7][0-9]|8[01])\s?[A-Z]{1,3}\s?[0-9]{2,4}$/i;

// Email formatı
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * UUID v4 doğrulama
 */
export const isValidUUID = (id: string | null | undefined): boolean => {
    if (!id || typeof id !== 'string') return false;
    return UUID_REGEX.test(id);
};

/**
 * Telefon numarası doğrulama (Uluslararası)
 * Sadece uzunluk ve karakter kontrolü yapar
 */
export const isValidPhone = (phone: string | null | undefined): boolean => {
    if (!phone || typeof phone !== 'string') return false;
    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    // En az 7, en fazla 20 karakter (uluslararası numaralar için)
    return cleanPhone.length >= 7 && cleanPhone.length <= 20;
};

/**
 * Araç plakası doğrulama (Uluslararası)
 * Sadece uzunluk kontrolü yapar - her ülke plakası kabul edilir
 */
export const isValidPlate = (plate: string | null | undefined): boolean => {
    if (!plate || typeof plate !== 'string') return false;
    const cleanPlate = plate.replace(/\s/g, '').toUpperCase();
    // En az 2, en fazla 20 karakter (uluslararası plakalar için)
    return cleanPlate.length >= 2 && cleanPlate.length <= 20;
};

/**
 * Email doğrulama
 */
export const isValidEmail = (email: string | null | undefined): boolean => {
    if (!email || typeof email !== 'string') return false;
    return EMAIL_REGEX.test(email) && email.length <= 255;
};

/**
 * XSS saldırılarına karşı HTML escape
 * GÜVENLİK: Kullanıcı girdilerindeki HTML karakterlerini encode eder
 */
export const escapeHtml = (input: string | null | undefined): string | null => {
    if (!input) return null;
    return String(input)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

/**
 * SQL Injection tehlikeli karakterleri temizle
 * NOT: Parameterized query kullanıldığında gerekli değil ama ekstra güvenlik katmanı
 */
export const sanitizeSqlInput = (input: string | null | undefined): string | null => {
    if (!input) return null;
    return String(input)
        .replace(/'/g, "''")  // Tek tırnak escape
        .replace(/;/g, '')    // Noktalı virgül kaldır
        .replace(/--/g, '')   // SQL yorum satırı kaldır
        .replace(/\/\*/g, '') // SQL çoklu satır yorum başlangıcı
        .replace(/\*\//g, '') // SQL çoklu satır yorum bitişi
        .trim();
};

/**
 * Genel input sanitization - XSS + trim + length check
 */
export const sanitizeInput = (
    input: string | null | undefined,
    maxLength: number = 1000
): string | null => {
    if (!input) return null;

    let sanitized = String(input).trim();

    // Maksimum uzunluk kontrolü
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    // XSS koruması
    return escapeHtml(sanitized);
};

/**
 * Sayısal değer doğrulama
 */
export const isValidNumber = (
    value: unknown,
    options: { min?: number; max?: number; integer?: boolean } = {}
): boolean => {
    const num = Number(value);

    if (isNaN(num)) return false;
    if (options.integer && !Number.isInteger(num)) return false;
    if (options.min !== undefined && num < options.min) return false;
    if (options.max !== undefined && num > options.max) return false;

    return true;
};

/**
 * Tarih doğrulama (ISO 8601 formatı)
 */
export const isValidDate = (date: string | null | undefined): boolean => {
    if (!date || typeof date !== 'string') return false;
    const parsed = Date.parse(date);
    return !isNaN(parsed);
};

/**
 * Enum değer doğrulama
 */
export const isValidEnum = <T extends string>(
    value: string | null | undefined,
    allowedValues: readonly T[]
): value is T => {
    if (!value) return false;
    return allowedValues.includes(value as T);
};

/**
 * String uzunluk doğrulama
 */
export const isValidLength = (
    value: string | null | undefined,
    min: number = 0,
    max: number = 1000
): boolean => {
    if (!value) return min === 0;
    const len = String(value).trim().length;
    return len >= min && len <= max;
};

/**
 * Boş veya sadece whitespace kontrolü
 */
export const isEmptyOrWhitespace = (value: string | null | undefined): boolean => {
    if (!value) return true;
    return String(value).trim().length === 0;
};

/**
 * Güvenli parseInt - NaN durumunda varsayılan değer döner
 */
export const safeParseInt = (value: unknown, defaultValue: number = 0): number => {
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Plaka normalizasyonu - Büyük harf ve boşluk temizleme
 */
export const normalizePlate = (plate: string | null | undefined): string | null => {
    if (!plate) return null;
    return String(plate).replace(/\s/g, '').toUpperCase();
};

/**
 * Telefon normalizasyonu - Boşluk ve özel karakterleri temizler
 * Uluslararası numaralar için + işaretini korur
 */
export const normalizePhone = (phone: string | null | undefined): string | null => {
    if (!phone) return null;
    // Sadece rakamlar, + ve parantez içindeki kodları koru
    // Boşluk, tire ve parantezleri kaldır
    return String(phone).replace(/[\s\-()]/g, '').trim();
};

/**
 * Validation sonucu tipi
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

/**
 * Çoklu alan validasyonu
 */
export const validateFields = (
    validations: Array<{ condition: boolean; message: string }>
): ValidationResult => {
    const errors: string[] = [];

    for (const { condition, message } of validations) {
        if (!condition) {
            errors.push(message);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

export default {
    isValidUUID,
    isValidPhone,
    isValidPlate,
    isValidEmail,
    escapeHtml,
    sanitizeSqlInput,
    sanitizeInput,
    isValidNumber,
    isValidDate,
    isValidEnum,
    isValidLength,
    isEmptyOrWhitespace,
    safeParseInt,
    normalizePlate,
    normalizePhone,
    validateFields
};
