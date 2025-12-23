/**
 * Tarih ve Saat Utility Fonksiyonları
 * Türkiye saat dilimi (Europe/Istanbul) için
 */

// Türkiye saat dilimi offset'i (UTC+3)
const TURKEY_OFFSET = 3 * 60 * 60 * 1000; // 3 saat milisaniye cinsinden

/**
 * Şu anki Türkiye tarihini YYYY-MM-DD formatında döndürür
 */
export const getTurkeyDateString = (): string => {
    const now = new Date();
    const turkeyTime = new Date(now.getTime() + TURKEY_OFFSET);
    return turkeyTime.toISOString().split('T')[0];
};

/**
 * Şu anki Türkiye saatini HH:MM:SS formatında döndürür
 */
export const getTurkeyTimeString = (): string => {
    const now = new Date();
    const turkeyTime = new Date(now.getTime() + TURKEY_OFFSET);
    return turkeyTime.toISOString().split('T')[1].substring(0, 8);
};

/**
 * Şu anki Türkiye tarih ve saatini ISO formatında döndürür
 */
export const getTurkeyDateTime = (): Date => {
    return new Date();
};

/**
 * Verilen tarihi Türkiye saat dilimine çevirir
 */
export const toTurkeyDate = (date: Date | string): Date => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Date(d.getTime() + TURKEY_OFFSET);
};

/**
 * Tarihi DD/MM/YYYY formatına çevirir
 */
export const formatDateTR = (date: Date | string | null): string => {
    if (!date) return '-';
    try {
        const d = typeof date === 'string' ? new Date(date) : date;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch {
        return '-';
    }
};

/**
 * Saati HH:MM formatına çevirir
 */
export const formatTimeTR = (time: string | null): string => {
    if (!time) return '-';
    try {
        // Eğer sadece saat formatı ise (HH:MM:SS)
        if (time.includes(':') && !time.includes('T')) {
            return time.substring(0, 5);
        }
        const d = new Date(time);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    } catch {
        return '-';
    }
};

/**
 * PostgreSQL için timezone-aware timestamp döndürür
 */
export const getNowForDB = (): string => {
    return 'NOW() AT TIME ZONE \'Europe/Istanbul\'';
};

/**
 * PostgreSQL sorgusu için bugünün tarihini döndürür
 */
export const getTodayForDB = (): string => {
    return `(NOW() AT TIME ZONE 'Europe/Istanbul')::DATE`;
};
