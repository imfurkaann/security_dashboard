/**
 * Date & Time Utility Functions
 * Tarih ve saat formatlama fonksiyonları
 */

/**
 * Tarihi DD/MM/YYYY formatına çevirir
 */
export const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-';

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        return `${day}/${month}/${year}`;
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

        // Timestamp ise Date objesi kullan
        const date = new Date(timeString);
        if (isNaN(date.getTime())) return '-';

        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${hours}:${minutes}`;
    } catch {
        return '-';
    }
};

/**
 * Verilen tarihin bugün olup olmadığını kontrol eder
 */
export const isToday = (dateString: string | null | undefined): boolean => {
    if (!dateString) return false;

    try {
        const date = new Date(dateString);
        const today = new Date();

        return (
            date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()
        );
    } catch {
        return false;
    }
};

/**
 * ISO tarih string'i oluşturur (YYYY-MM-DD)
 */
export const toISODateString = (date: Date = new Date()): string => {
    return date.toISOString().split('T')[0];
};

/**
 * İki tarih arasındaki gün farkını hesaplar
 */
export const daysBetween = (start: Date, end: Date): number => {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((end.getTime() - start.getTime()) / oneDay));
};

/**
 * Relative time string döndürür (ör: "5 dakika önce")
 */
export const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Az önce';
    if (diffMins < 60) return `${diffMins} dakika önce`;
    if (diffHours < 24) return `${diffHours} saat önce`;
    if (diffDays < 7) return `${diffDays} gün önce`;

    return formatDate(dateString);
};
