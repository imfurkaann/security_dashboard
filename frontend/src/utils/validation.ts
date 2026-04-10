/**
 * Frontend Input Validation Utilities
 * Kullanıcı girdilerini doğrulama ve temizleme fonksiyonları
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
 * Opsiyonel alan - boş olabilir
 * Girilmişse sadece uzunluk kontrolü yapılır
 */
export const isValidPhone = (phone: string | null | undefined): boolean => {
    if (!phone || phone.trim() === '') return true; // Boş geçilebilir
    const cleanPhone = phone.replace(/[\s\-()]/g, '');
    // En az 7, en fazla 20 karakter (uluslararası numaralar için)
    return cleanPhone.length >= 7 && cleanPhone.length <= 20;
};

/**
 * Araç plakası doğrulama (Uluslararası)
 * Opsiyonel alan - boş olabilir
 * Girilmişse sadece uzunluk kontrolü yapılır - her ülke plakası kabul edilir
 */
export const isValidPlate = (plate: string | null | undefined): boolean => {
    if (!plate || plate.trim() === '') return true; // Boş geçilebilir
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

    // HTML escape yerine sadece trim ve length check
    // Backend zaten escape yapıyor, frontend'de double-escape olmasın
    return sanitized;
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
    // Sadece rakamlar, + işaretini koru
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

/**
 * Ziyaretçi form validasyonu
 */
export const validateVisitorForm = (data: {
    vehicle_plate?: string;
    full_name?: string;
    company_name?: string;
    visiting_person?: string;
    person_count?: string | number;
    children_count?: string | number;
    phone?: string;
    notes?: string;
}): ValidationResult => {
    const validations = [
        // Plaka validasyonu (opsiyonel ama girilmişse geçerli olmalı)
        {
            condition: !data.vehicle_plate || isValidPlate(data.vehicle_plate),
            message: 'Araç plakası 2-20 karakter arasında olmalıdır'
        },
        // Uzunluk kontrolleri
        {
            condition: isValidLength(data.vehicle_plate, 0, 20),
            message: 'Araç plakası en fazla 20 karakter olabilir'
        },
        {
            condition: isValidLength(data.full_name, 0, 100),
            message: 'Ad Soyad en fazla 100 karakter olabilir'
        },
        {
            condition: isValidLength(data.company_name, 0, 100),
            message: 'Firma adı en fazla 100 karakter olabilir'
        },
        {
            condition: isValidLength(data.visiting_person, 0, 100),
            message: 'Ziyaret edilen en fazla 100 karakter olabilir'
        },
        {
            condition: isValidLength(data.phone, 0, 20),
            message: 'Telefon numarası en fazla 20 karakter olabilir'
        },
        {
            condition: isValidLength(data.notes, 0, 1000),
            message: 'Açıklama en fazla 1000 karakter olabilir'
        },
        // Telefon formatı (opsiyonel ama girilmişse geçerli olmalı)
        {
            condition: !data.phone || isValidPhone(data.phone),
            message: 'Telefon numarası 7-20 karakter arasında olmalıdır'
        },
        // Kişi sayısı (opsiyonel ama girilmişse geçerli olmalı)
        {
            condition: !data.person_count || data.person_count === '' || isValidNumber(data.person_count, { min: 1, max: 999, integer: true }),
            message: 'Kişi sayısı 1-999 arasında bir tam sayı olmalıdır'
        },
        // Çocuk sayısı (opsiyonel ama girilmişse geçerli olmalı)
        {
            condition: data.children_count === undefined || data.children_count === '' || isValidNumber(data.children_count, { min: 0, max: 999, integer: true }),
            message: 'Çocuk sayısı 0-999 arasında bir tam sayı olmalıdır'
        }
    ];

    return validateFields(validations);
};

/**
 * Araç form validasyonu
 */
export const validateVehicleForm = (data: {
    plate?: string;
    driver_name?: string;
    company?: string;
    phone?: string;
    notes?: string;
}): ValidationResult => {
    const validations = [
        // Plaka zorunlu ve geçerli olmalı
        {
            condition: !!data.plate && !isEmptyOrWhitespace(data.plate),
            message: 'Araç plakası zorunludur'
        },
        {
            condition: isValidPlate(data.plate),
            message: 'Araç plakası 2-20 karakter arasında olmalıdır'
        },
        // Uzunluk kontrolleri
        {
            condition: isValidLength(data.plate, 0, 20),
            message: 'Araç plakası en fazla 20 karakter olabilir'
        },
        {
            condition: isValidLength(data.driver_name, 0, 100),
            message: 'Sürücü adı en fazla 100 karakter olabilir'
        },
        {
            condition: isValidLength(data.company, 0, 100),
            message: 'Firma adı en fazla 100 karakter olabilir'
        },
        {
            condition: isValidLength(data.phone, 0, 20),
            message: 'Telefon numarası en fazla 20 karakter olabilir'
        },
        {
            condition: isValidLength(data.notes, 0, 1000),
            message: 'Açıklama en fazla 1000 karakter olabilir'
        },
        // Telefon formatı (opsiyonel ama girilmişse geçerli olmalı)
        {
            condition: !data.phone || isValidPhone(data.phone),
            message: 'Telefon numarası 7-20 karakter arasında olmalıdır'
        }
    ];

    return validateFields(validations);
};

/**
 * Müdür form validasyonu
 */
export const validateManagerForm = (data: {
    name?: string;
    position?: string;
    phone?: string;
    email?: string;
    notes?: string;
}): ValidationResult => {
    const validations = [
        // İsim zorunlu
        {
            condition: !!data.name && !isEmptyOrWhitespace(data.name),
            message: 'Müdür adı zorunludur'
        },
        // Uzunluk kontrolleri
        {
            condition: isValidLength(data.name, 1, 100),
            message: 'Müdür adı 1-100 karakter arasında olmalıdır'
        },
        {
            condition: isValidLength(data.position, 0, 100),
            message: 'Pozisyon en fazla 100 karakter olabilir'
        },
        {
            condition: isValidLength(data.phone, 0, 20),
            message: 'Telefon numarası en fazla 20 karakter olabilir'
        },
        {
            condition: isValidLength(data.email, 0, 255),
            message: 'Email en fazla 255 karakter olabilir'
        },
        {
            condition: isValidLength(data.notes, 0, 1000),
            message: 'Açıklama en fazla 1000 karakter olabilir'
        },
        // Telefon formatı (opsiyonel ama girilmişse geçerli olmalı)
        {
            condition: !data.phone || isValidPhone(data.phone),
            message: 'Telefon numarası 7-20 karakter arasında olmalıdır'
        },
        // Email formatı (opsiyonel ama girilmişse geçerli olmalı)
        {
            condition: !data.email || isValidEmail(data.email),
            message: 'Geçersiz email formatı'
        }
    ];

    return validateFields(validations);
};

/**
 * Yangın alarmı form validasyonu
 */
export const validateFireAlarmForm = (data: {
    alarm_number?: string;
    location?: string;
    alarm_date?: string;
    alarm_hour?: string;
    alarm_minute?: string;
}): ValidationResult => {
    const validations = [
        // Alarm numarası opsiyonel ama girilmişse uzunluk kontrolü
        {
            condition: isValidLength(data.alarm_number, 0, 50),
            message: 'Alarm numarası en fazla 50 karakter olabilir'
        },
        // Konum zorunlu
        {
            condition: !!data.location && !isEmptyOrWhitespace(data.location),
            message: 'Konum zorunludur'
        },
        {
            condition: isValidLength(data.location, 1, 200),
            message: 'Konum 1-200 karakter arasında olmalıdır'
        },
        // Tarih zorunlu
        {
            condition: !!data.alarm_date,
            message: 'Alarm tarihi zorunludur'
        },
        {
            condition: !data.alarm_date || isValidDate(data.alarm_date),
            message: 'Geçersiz tarih formatı'
        },
        // Saat ve dakika zorunlu
        {
            condition: data.alarm_hour !== undefined && data.alarm_hour !== '',
            message: 'Alarm saati zorunludur'
        },
        {
            condition: data.alarm_minute !== undefined && data.alarm_minute !== '',
            message: 'Alarm dakikası zorunludur'
        },
        {
            condition: !data.alarm_hour || (Number(data.alarm_hour) >= 0 && Number(data.alarm_hour) <= 23),
            message: 'Saat 0-23 arasında olmalıdır'
        },
        {
            condition: !data.alarm_minute || (Number(data.alarm_minute) >= 0 && Number(data.alarm_minute) <= 59),
            message: 'Dakika 0-59 arasında olmalıdır'
        }
    ];

    return validateFields(validations);
};

export default {
    isValidUUID,
    isValidPhone,
    isValidPlate,
    isValidEmail,
    escapeHtml,
    sanitizeInput,
    isValidNumber,
    isValidDate,
    isValidLength,
    isEmptyOrWhitespace,
    normalizePlate,
    normalizePhone,
    validateFields,
    validateVisitorForm,
    validateVehicleForm,
    validateManagerForm,
    validateFireAlarmForm
};
