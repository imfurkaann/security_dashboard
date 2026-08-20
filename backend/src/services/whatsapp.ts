const cleanMessageValue = (value: unknown): string => {
    return String(value ?? '')
        .normalize('NFC')
        .replace(/[\u0000-\u001F\u007F]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
};

const formatDate = (value: unknown): string => {
    const normalized = cleanMessageValue(value);
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);
    if (isoMatch) return `${isoMatch[3]}.${isoMatch[2]}.${isoMatch[1]}`;

    const date = new Date(normalized);
    return Number.isNaN(date.getTime())
        ? normalized
        : date.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' });
};

const addOptionalLine = (lines: string[], label: string, value: unknown): void => {
    const normalized = cleanMessageValue(value);
    if (normalized) lines.push(`${label}: ${normalized}`);
};

type VisitorMessageData = {
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
};

const addVisitorDetails = (lines: string[], data: VisitorMessageData): void => {
    addOptionalLine(lines, 'Ad Soyad', data.fullName);
    addOptionalLine(lines, 'Firma', data.companyName);
    addOptionalLine(lines, 'Ziyaret Edilen', data.visitingPerson);
    addOptionalLine(lines, 'Araç Plakası', data.vehiclePlate);
    addOptionalLine(lines, 'Kapı', data.gate);
    if (data.personCount && data.personCount > 1) lines.push(`Kişi Sayısı: ${data.personCount}`);
    if (data.childrenCount && data.childrenCount > 0) lines.push(`Çocuk Sayısı: ${data.childrenCount}`);
    addOptionalLine(lines, 'Telefon', data.phone);

    const tags: string[] = [];
    if (data.subcontractorWorker) tags.push('Taşeron İşçi');
    if (data.forElectricStation) tags.push('Şarj İstasyonu');
    if (data.dailyGuest) tags.push('Günübirlik Misafir');
    if (data.meeting) tags.push('Görüşme');
    if (data.delivery) tags.push('Teslimat');
    if (tags.length > 0) lines.push(`Etiket: ${tags.join(', ')}`);
};

export const createVehicleRecordMessage = (data: {
    vehiclePlate: string;
    managerName: string;
    givenDate: string;
    givenTime: string;
    destination?: string;
    notes?: string;
}): string => {
    const lines = ['🔑 ARAÇ TESLİM BİLDİRİMİ', ''];
    addOptionalLine(lines, 'Araç', data.vehiclePlate);
    addOptionalLine(lines, 'Kişi', data.managerName);
    addOptionalLine(lines, 'Konum', data.destination);
    addOptionalLine(lines, 'Açıklama', data.notes);
    lines.push(`Tarih: ${formatDate(data.givenDate)}`);
    addOptionalLine(lines, 'Saat', data.givenTime);
    lines.push('', 'Araç teslim edilmiştir.');
    return lines.join('\n');
};

export const createVehicleReturnMessage = (data: {
    vehiclePlate: string;
    managerName: string;
    returnDate: string;
    returnTime: string;
    destination?: string;
    driveDuration?: string;
    notes?: string;
}): string => {
    const lines = ['🚗 ARAÇ TESLİM ALMA BİLDİRİMİ', ''];
    addOptionalLine(lines, 'Araç', data.vehiclePlate);
    addOptionalLine(lines, 'Kişi', data.managerName);
    addOptionalLine(lines, 'Konum', data.destination);
    addOptionalLine(lines, 'Sürüş Süresi', data.driveDuration);
    addOptionalLine(lines, 'Açıklama', data.notes);
    lines.push(`Tarih: ${formatDate(data.returnDate)}`);
    addOptionalLine(lines, 'Saat', data.returnTime);
    lines.push('', 'Araç teslim alınmıştır.');
    return lines.join('\n');
};

export const createVisitorRecordMessage = (data: VisitorMessageData & {
    entryDate: string;
    entryTime: string;
}): string => {
    const lines: string[] = ['🟢 ZİYARETÇİ GİRİŞ BİLDİRİMİ', ''];
    addVisitorDetails(lines, data);
    lines.push(`Tarih: ${formatDate(data.entryDate)}`);
    addOptionalLine(lines, 'Saat', data.entryTime);
    addOptionalLine(lines, 'Not', data.notes);
    return lines.join('\n');
};

export const createVisitorExitMessage = (data: VisitorMessageData & {
    exitDate: string;
    exitTime: string;
}): string => {
    const lines: string[] = ['🔴 ZİYARETÇİ ÇIKIŞ BİLDİRİMİ', ''];
    addVisitorDetails(lines, data);
    lines.push(`Tarih: ${formatDate(data.exitDate)}`);
    addOptionalLine(lines, 'Saat', data.exitTime);
    addOptionalLine(lines, 'Not', data.notes);
    return lines.join('\n');
};

export const createFireAlarmMessage = (data: {
    alarmNumber: string;
    location: string;
    alarmDate: string;
    alarmTime: string;
    notes?: string;
}): string => {
    const lines = ['🔥 YANGIN ALARMI BİLDİRİMİ', ''];
    addOptionalLine(lines, 'Alarm Numarası', data.alarmNumber);
    addOptionalLine(lines, 'Konum', data.location);
    lines.push(`Tarih: ${formatDate(data.alarmDate)}`);
    addOptionalLine(lines, 'Saat', data.alarmTime);
    addOptionalLine(lines, 'Not', data.notes);
    return lines.join('\n');
};

export const createFireAlarmResolveMessage = (data: {
    alarmNumber: string;
    location: string;
    alarmTime?: string;
    resolutionDate: string;
    resolutionTime: string;
    resolutionNotes?: string;
    falseAlarm: boolean;
}): string => {
    const lines = [
        data.falseAlarm ? '⚠️ YANLIŞ ALARM' : '🆗 ALARM KONTROL EDİLDİ',
        '',
    ];
    addOptionalLine(lines, 'Alarm Numarası', data.alarmNumber);
    addOptionalLine(lines, 'Konum', data.location);
    addOptionalLine(lines, 'Alarm Saati', data.alarmTime);
    lines.push(`Çözüm Tarihi: ${formatDate(data.resolutionDate)}`);
    addOptionalLine(lines, 'Çözüm Saati', data.resolutionTime);
    addOptionalLine(lines, 'Çözüm Açıklaması', data.resolutionNotes);
    return lines.join('\n');
};
