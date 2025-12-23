/**
 * Date & Time Utility Functions
 * Tarih ve saat formatlama fonksiyonları
 * Türkiye saat dilimi (Europe/Istanbul) kullanır
 */
import dayjs from './dayjsConfig';

/**
 * Tarihi DD/MM/YYYY formatına çevirir (Türkiye saat dilimi)
 */
export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';

    try {
        const date = dayjs(dateString);
        if (!date.isValid()) return '-';
        return date.format('DD/MM/YYYY');
    } catch {
        return '-';
    }
};

/**
 * Saati HH:MM formatına çevirir
 * TIME (HH:MM:SS) veya TIMESTAMP formatlarını destekler
 */
export const formatTime = (timeString: string | null | undefined): string => {
    if (!timeString) return '-';

    try {
        // Eğer sadece saat formatı ise (HH:MM:SS veya HH:MM:SS.xxx)
        if (timeString.includes(':') && !timeString.includes('T') && !timeString.includes(' ')) {
            // "HH:MM:SS" veya "HH:MM:SS.xxx" formatından "HH:MM" al
            return timeString.split('.')[0].substring(0, 5);
        }

        // Timestamp ise dayjs kullan
        const date = dayjs(timeString);
        if (!date.isValid()) return '-';
        return date.format('HH:mm');
    } catch {
        return '-';
    }
};

/**
 * Verilen tarihin bugün olup olmadığını kontrol eder (Türkiye saat dilimi)
 */
export const isToday = (dateString: string | null | undefined): boolean => {
    if (!dateString) return false;

    try {
        const date = dayjs(dateString);
        const today = dayjs();
        return date.format('YYYY-MM-DD') === today.format('YYYY-MM-DD');
    } catch {
        return false;
    }
};

/**
 * ISO tarih string'i oluşturur (YYYY-MM-DD) - Türkiye saat dilimi
 */
export const toISODateString = (date?: Date | string): string => {
    return dayjs(date).format('YYYY-MM-DD');
};

/**
 * İki tarih arasındaki gün farkını hesaplar
 */
export const daysBetween = (start: Date | string, end: Date | string): number => {
    return Math.abs(dayjs(end).diff(dayjs(start), 'day'));
};

/**
 * Relative time string döndürür (ör: "5 dakika önce")
 */
export const getRelativeTime = (dateString: string): string => {
    return dayjs(dateString).fromNow();
};
