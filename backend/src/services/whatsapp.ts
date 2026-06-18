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
    const aciklamaSatir = data.notes ? `A\u00e7\u0131klama: ${data.notes}\n` : '';

    return `\uD83D\uDD11 ARA\u00c7 TESL\u0130M B\u0130LD\u0130R\u0130M\u0130
Ara\u00e7: ${data.vehiclePlate}
Ki\u015fi: ${data.managerName}
Tarih: ${data.givenDate}
${konumSatir}${aciklamaSatir}Saat: ${data.givenTime}

Teslim edilmi\u015ftir.`;
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
    notes?: string;
}): string => {
    const locationLine = data.destination ? `Konum: ${data.destination}\n` : '';
    const durationLine = data.driveDuration ? `S\u00fcr\u00fc\u015f S\u00fcresi: ${data.driveDuration}\n` : '';
    const notesLine = data.notes ? `A\u00e7\u0131klama: ${data.notes}\n` : '';

    return `\uD83D\uDE97 ARA\u00c7 TESL\u0130M ALMA B\u0130LD\u0130R\u0130M\u0130
Ara\u00e7: ${data.vehiclePlate}
Ki\u015fi: ${data.managerName}
${locationLine}${durationLine}${notesLine}Saat: ${data.returnTime}

Teslim al\u0131nm\u0131\u015ft\u0131r.`;
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
    meeting?: boolean;
    delivery?: boolean;
    notes?: string;
}): string => {
    // Mesaj satırlarını dinamik olarak oluştur
    const lines: string[] = ['🟢 ZİYARETÇİ GİRİŞ BİLDİRİMİ', ''];

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
        specialTags.push('Şarj İstasyonu');
    }
    if (data.dailyGuest) {
        specialTags.push('Günübirlik Misafir');
    }
    if (data.meeting) {
        specialTags.push('Görüşme');
    }
    if (data.delivery) {
        specialTags.push('Teslimat');
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
    meeting?: boolean;
    delivery?: boolean;
    notes?: string;
    exitTime: string;
}): string => {
    const lines: string[] = ['🔴 ZİYARETÇİ ÇIKIŞ BİLDİRİMİ', ''];

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

    // \u00d6zel Durumlar
    const specialTags: string[] = [];
    if (data.subcontractorWorker) {
        specialTags.push('Ta\u015feron \u0130\u015f\u00e7i');
    }
    if (data.forElectricStation) {
        specialTags.push('\u015earj \u0130stasyonu');
    }
    if (data.dailyGuest) {
        specialTags.push('G\u00fcn\u00fcbirlik Misafir');
    }
    if (data.meeting) {
        specialTags.push('G\u00f6r\u00fc\u015fme');
    }
    if (data.delivery) {
        specialTags.push('Teslimat');
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

    return `🔥 YANGIN ALARMI BİLDİRİMİ

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
    alarmTime?: string;
    resolutionTime: string;
    resolutionNotes?: string;
    falseAlarm: boolean;
}): string => {
    const alarmType = data.falseAlarm
        ? '\u26a0\ufe0f YANLI\u015e ALARM \u26a0\ufe0f'
        : '\uD83C\uDD97 ALARM KONTROL ED\u0130LD\u0130 \uD83C\uDD97';
    const alarmTimeLine = data.alarmTime ? `\nAlarm Saati: ${data.alarmTime}` : '';
    const notesInfo = data.resolutionNotes ? `\n\u00c7\u00f6z\u00fcm A\u00e7\u0131klamas\u0131: ${data.resolutionNotes}` : '';

    return `${alarmType}\n\nAlarm Numaras\u0131: ${data.alarmNumber}\nKonum: ${data.location}${alarmTimeLine}\n\u00c7\u00f6z\u00fcm Saati: ${data.resolutionTime}${notesInfo}`;
};
