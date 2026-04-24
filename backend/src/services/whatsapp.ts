/**
 * WhatsApp Message Template Service
 * WhatsApp deep link kullanarak mesaj şablonları oluşturur
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * WhatsApp grup numarasını al
 */
export const getWhatsAppGroupNumber = (): string | null => {
    return process.env.WHATSAPP_GROUP_NUMBER || null;
};

/**
 * Araç kaydı için WhatsApp mesaj şablonu oluştur
 */
export const createVehicleRecordMessage = (data: {
    vehiclePlate: string;
    managerName: string;
    givenDate: string;
    givenTime: string;
    destination?: string;
    notes?: string;
}): string => {
    const konumSatir = data.destination ? `Konum: ${data.destination}\n` : '';
    const aciklamaSatir = data.notes ? `Açıklama: ${data.notes}\n` : '';

    return `🔑 ARAÇ TESLİM BİLDİRİMİ 🔑
Araç: ${data.vehiclePlate}
Kişi: ${data.managerName}
${konumSatir}${aciklamaSatir}Saat: ${data.givenTime}

Teslim edilmiştir.`;
};

/**
 * Araç iade için WhatsApp mesaj şablonu oluştur
 */
export const createVehicleReturnMessage = (data: {
    vehiclePlate: string;
    managerName: string;
    returnTime: string;
    destination?: string;
    driveDuration?: string;
}): string => {
    const locationLine = data.destination ? `Konum: ${data.destination}\n` : '';
    const durationLine = data.driveDuration ? `Sürüş Süresi: ${data.driveDuration}\n` : '';

    return `🚗 ARAÇ TESLİM ALMA BİLDİRİMİ 🚗
Araç: ${data.vehiclePlate}
Kişi: ${data.managerName}
${locationLine}${durationLine}Saat: ${data.returnTime}

Teslim alınmıştır.`;
};

/**
 * Ziyaretçi kaydı için WhatsApp mesaj şablonu oluştur (dinamik)
 */
export const createVisitorRecordMessage = (data: {
    fullName?: string;
    companyName?: string;
    visitingPerson?: string;
    entryDate: string;
    entryTime: string;
    gate?: string;
    vehiclePlate?: string;
    personCount?: number;
    childrenCount?: number;
    phone?: string;
    subcontractorWorker?: boolean;
    forElectricStation?: boolean;
    dailyGuest?: boolean;
    notes?: string;
}): string => {
    // Mesaj satırlarını dinamik olarak oluştur
    const lines: string[] = ['🟢 ZİYARETÇİ GİRİŞ BİLDİRİMİ 🟢', ''];

    // Ad Soyad (zorunlu)
    if (data.fullName) {
        lines.push(`Ad Soyad: ${data.fullName}`);
    }

    // Firma
    if (data.companyName) {
        lines.push(`Firma: ${data.companyName}`);
    }

    // Ziyaret Edilen Kişi
    if (data.visitingPerson) {
        lines.push(`Ziyaret Edilen: ${data.visitingPerson}`);
    }

    // Araç Plakası
    if (data.vehiclePlate) {
        lines.push(`Araç Plakası: ${data.vehiclePlate}`);
    }

    // Kapı
    if (data.gate) {
        lines.push(`Kapı: ${data.gate}`);
    }

    // Kişi Sayısı
    if (data.personCount && data.personCount > 1) {
        lines.push(`Kişi Sayısı: ${data.personCount}`);
    }

    // Çocuk Sayısı
    if (data.childrenCount && data.childrenCount > 0) {
        lines.push(`Çocuk Sayısı: ${data.childrenCount}`);
    }

    // Telefon
    if (data.phone) {
        lines.push(`Telefon: ${data.phone}`);
    }

    // Özel Durumlar
    const specialTags: string[] = [];
    if (data.subcontractorWorker) {
        specialTags.push('Taşeron İşçi');
    }
    if (data.forElectricStation) {
        specialTags.push('Elektrik İstasyonu');
    }
    if (data.dailyGuest) {
        specialTags.push('Günübirlik Misafir');
    }
    if (specialTags.length > 0) {
        lines.push(`Etiket: ${specialTags.join(', ')}`);
    }

    // Saat
    lines.push(`Saat: ${data.entryTime}`);

    // Notlar
    if (data.notes) {
        lines.push(`Not: ${data.notes}`);
    }

    return lines.join('\n');
};

/**
 * Ziyaretçi çıkış için WhatsApp mesaj şablonu oluştur
 */
export const createVisitorExitMessage = (data: {
    fullName?: string;
    companyName?: string;
    visitingPerson?: string;
    gate?: string;
    vehiclePlate?: string;
    personCount?: number;
    childrenCount?: number;
    phone?: string;
    subcontractorWorker?: boolean;
    forElectricStation?: boolean;
    dailyGuest?: boolean;
    notes?: string;
    exitTime: string;
}): string => {
    const lines: string[] = ['🔴 ZİYARETÇİ ÇIKIŞ BİLDİRİMİ 🔴', ''];

    // Ad Soyad
    if (data.fullName) {
        lines.push(`Ad Soyad: ${data.fullName}`);
    }

    // Firma
    if (data.companyName) {
        lines.push(`Firma: ${data.companyName}`);
    }

    // Ziyaret Edilen Kişi
    if (data.visitingPerson) {
        lines.push(`Ziyaret Edilen: ${data.visitingPerson}`);
    }

    // Araç Plakası
    if (data.vehiclePlate) {
        lines.push(`Araç Plakası: ${data.vehiclePlate}`);
    }

    // Kapı
    if (data.gate) {
        lines.push(`Kapı: ${data.gate}`);
    }

    // Kişi Sayısı
    if (data.personCount && data.personCount > 1) {
        lines.push(`Kişi Sayısı: ${data.personCount}`);
    }

    // Çocuk Sayısı
    if (data.childrenCount && data.childrenCount > 0) {
        lines.push(`Çocuk Sayısı: ${data.childrenCount}`);
    }

    // Telefon
    if (data.phone) {
        lines.push(`Telefon: ${data.phone}`);
    }

    // Özel Durumlar
    const specialTags: string[] = [];
    if (data.subcontractorWorker) {
        specialTags.push('Taşeron İşçi');
    }
    if (data.forElectricStation) {
        specialTags.push('Elektrik İstasyonu');
    }
    if (data.dailyGuest) {
        specialTags.push('Günübirlik Misafir');
    }
    if (specialTags.length > 0) {
        lines.push(`Etiket: ${specialTags.join(', ')}`);
    }

    // Saat
    lines.push(`Saat: ${data.exitTime}`);

    // Notlar
    if (data.notes) {
        lines.push(`Not: ${data.notes}`);
    }

    return lines.join('\n');
};

/**
 * Yangın alarmı kaydı için WhatsApp mesaj şablonu oluştur
 */
export const createFireAlarmMessage = (data: {
    alarmNumber: string;
    location: string;
    alarmTime: string;
    notes?: string;
}): string => {
    const notesInfo = data.notes ? `\nNot: ${data.notes}` : "";

    return `🔥 YANGIN ALARMI BİLDİRİMİ 🔥

Alarm Numarası: ${data.alarmNumber}
Konum: ${data.location}
Saat: ${data.alarmTime}${notesInfo}`;
};

/**
 * Yangın alarmı çözümü için WhatsApp mesaj şablonu oluştur
 */
export const createFireAlarmResolveMessage = (data: {
    alarmNumber: string;
    location: string;
    resolutionTime: string;
    resolutionNotes?: string;
    falseAlarm: boolean;
}): string => {
    const alarmType = data.falseAlarm
        ? '⚠️ YANLIŞ ALARM ⚠️'
        : '🆗 ALARM KONTROL EDİLDİ 🆗';
    const notesInfo = data.resolutionNotes ? `\nÇözüm Açıklaması: ${data.resolutionNotes}` : "";

    return `${alarmType}

Alarm Numarası: ${data.alarmNumber}
Konum: ${data.location}
Çözüm Saati: ${data.resolutionTime}${notesInfo}`;
};
