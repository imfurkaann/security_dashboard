/**
 * dayjs Türkiye Yapılandırması
 * Tüm tarih işlemlerinde Türkiye saat dilimi ve locale kullanılır
 */
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// Plugin'leri yükle
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);

// Varsayılan timezone ve locale ayarla
dayjs.tz.setDefault('Europe/Istanbul');
dayjs.locale('tr');

// Türkiye timezone'unda dayjs instance'ı döndür
export const dayjsTR = (date?: string | Date | dayjs.Dayjs) => {
    return dayjs(date).tz('Europe/Istanbul');
};

// Tarihi Türkiye formatında string'e çevir (DD/MM/YYYY)
export const formatDateTR = (date: string | Date | dayjs.Dayjs | null | undefined): string => {
    if (!date) return '-';
    try {
        return dayjsTR(date).format('DD/MM/YYYY');
    } catch {
        return '-';
    }
};

// Saati Türkiye formatında string'e çevir (HH:mm)
export const formatTimeTR = (time: string | Date | dayjs.Dayjs | null | undefined): string => {
    if (!time) return '-';
    try {
        // Eğer sadece saat formatı ise (HH:MM:SS)
        if (typeof time === 'string' && time.includes(':') && !time.includes('T') && !time.includes(' ')) {
            return time.substring(0, 5);
        }
        return dayjsTR(time).format('HH:mm');
    } catch {
        return '-';
    }
};

// Tarih ve saati birlikte formatla (DD/MM/YYYY HH:mm)
export const formatDateTimeTR = (dateTime: string | Date | dayjs.Dayjs | null | undefined): string => {
    if (!dateTime) return '-';
    try {
        return dayjsTR(dateTime).format('DD/MM/YYYY HH:mm');
    } catch {
        return '-';
    }
};

// ISO formatında tarih string'i döndür (YYYY-MM-DD)
export const toISODateTR = (date: string | Date | dayjs.Dayjs): string => {
    return dayjsTR(date).format('YYYY-MM-DD');
};

// Göreli zaman (örn: "2 saat önce")
export const fromNowTR = (date: string | Date | dayjs.Dayjs): string => {
    return dayjsTR(date).fromNow();
};

// Gün adını al (örn: "Pazartesi")
export const getDayNameTR = (date: string | Date | dayjs.Dayjs): string => {
    return dayjsTR(date).format('dddd');
};

// Ay adını al (örn: "Aralık")
export const getMonthNameTR = (date: string | Date | dayjs.Dayjs): string => {
    return dayjsTR(date).format('MMMM');
};

// Tam tarih formatı (örn: "23 Aralık 2025 Pazartesi")
export const getFullDateTR = (date: string | Date | dayjs.Dayjs): string => {
    return dayjsTR(date).format('DD MMMM YYYY dddd');
};

export default dayjs;
