import ExcelJS from 'exceljs';
import archiver from 'archiver';
import { Response } from 'express';
import pool from '../config/database';
import * as fs from 'fs';

// Türkçe ay isimleri
const TURKISH_MONTHS = [
    '01-Ocak', '02-Şubat', '03-Mart', '04-Nisan', '05-Mayıs', '06-Haziran',
    '07-Temmuz', '08-Ağustos', '09-Eylül', '10-Ekim', '11-Kasım', '12-Aralık'
];

// Vardiya saatleri
const SHIFTS = [
    { name: '08-16', startHour: 8, endHour: 16 },
    { name: '16-24', startHour: 16, endHour: 24 },
    { name: '00-08', startHour: 0, endHour: 8 }
];

interface ExportOptions {
    startDate: string;
    endDate: string;
    reports: {
        managers: boolean;
        vehicles: boolean;
        visitors: boolean;
        fireAlarms: boolean;
        incidents: boolean;
    };
}

interface RecordCounts {
    managers: number;
    vehicles: number;
    visitors: number;
    fireAlarms: number;
    incidents: number;
}

interface WrittenCounts {
    managers: number;
    vehicles: number;
    visitors: number;
    fireAlarms: number;
    incidents: number;
}

// Tarih formatlama fonksiyonları
function formatDate(date: Date | string | null): string {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(date: Date | string | null): string {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(date: Date | string | null): string {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return `${formatDate(d)} ${formatTime(d)}`;
}

// Excel stil tanımları
function getHeaderStyle(): Partial<ExcelJS.Style> {
    return {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
        border: {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        }
    };
}

function getDataStyle(): Partial<ExcelJS.Style> {
    return {
        alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
        border: {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        }
    };
}

// Kayıt sayılarını getir
export async function getRecordCounts(startDate: string, endDate: string): Promise<RecordCounts> {
    const client = await pool.connect();

    try {
        // READ ONLY transaction - veri bütünlüğü için
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');

        const [managersResult, vehiclesResult, visitorsResult, fireAlarmsResult, incidentsResult] = await Promise.all([
            client.query(
                `SELECT COUNT(*) as count FROM managers_records 
                 WHERE entry_date >= $1::date AND entry_date <= $2::date
                   AND deleted_at IS NULL`,
                [startDate, endDate]
            ),
            client.query(
                `SELECT COUNT(*) as count FROM vehicle_records 
                 WHERE given_date >= $1::date AND given_date <= $2::date
                   AND deleted_at IS NULL`,
                [startDate, endDate]
            ),
            client.query(
                `SELECT COUNT(*) as count FROM visitor_records 
                 WHERE entry_date >= $1::date AND entry_date <= $2::date
                   AND deleted_at IS NULL`,
                [startDate, endDate]
            ),
            client.query(
                `SELECT COUNT(*) as count FROM fire_alarms 
                 WHERE alarm_time::date >= $1::date AND alarm_time::date <= $2::date
                   AND deleted_at IS NULL`,
                [startDate, endDate]
            ),
            client.query(
                `SELECT COUNT(*) as count FROM incidents 
                 WHERE report_date >= $1::date AND report_date <= $2::date`,
                [startDate, endDate]
            )
        ]);

        await client.query('COMMIT');

        return {
            managers: parseInt(managersResult.rows[0].count),
            vehicles: parseInt(vehiclesResult.rows[0].count),
            visitors: parseInt(visitorsResult.rows[0].count),
            fireAlarms: parseInt(fireAlarmsResult.rows[0].count),
            incidents: parseInt(incidentsResult.rows[0].count)
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

// Müdür kayıtlarını Excel'e yaz
async function createManagersExcel(records: any[], date: string): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Güvenlik Dashboard';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Müdür Kayıtları');

    // Başlık satırı
    worksheet.columns = [
        { header: 'İsim Soyisim', key: 'name', width: 25 },
        { header: 'Ünvan', key: 'title', width: 20 },
        { header: 'Giriş Tarihi', key: 'entryDate', width: 15 },
        { header: 'Giriş Saati', key: 'entryTime', width: 12 },
        { header: 'Çıkış Tarihi', key: 'exitDate', width: 15 },
        { header: 'Çıkış Saati', key: 'exitTime', width: 12 },
        { header: 'Açıklama', key: 'description', width: 30 },
        { header: 'Giriş Kaydını Yapan', key: 'entryPersonnel', width: 20 },
        { header: 'Çıkış Kaydını Yapan', key: 'exitPersonnel', width: 20 }
    ];

    // Başlık stili
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
        Object.assign(cell, { style: getHeaderStyle() });
    });
    headerRow.height = 25;

    // Verileri saate göre sırala
    records.sort((a, b) => {
        const dateA = new Date(`${a.entry_date}T${a.entry_time || '00:00:00'}`);
        const dateB = new Date(`${b.entry_date}T${b.entry_time || '00:00:00'}`);
        return dateA.getTime() - dateB.getTime();
    });

    // Veri satırları
    records.forEach((record) => {
        const row = worksheet.addRow({
            name: `${record.manager_first_name || ''} ${record.manager_last_name || ''}`.trim() || record.manager_name || '-',
            title: record.manager_title || '-',
            entryDate: formatDate(record.entry_date),
            entryTime: record.entry_time ? record.entry_time.substring(0, 5) : '-',
            exitDate: formatDate(record.exit_date),
            exitTime: record.exit_time ? record.exit_time.substring(0, 5) : '-',
            description: record.notes || '-',
            entryPersonnel: record.entry_personnel_name || record.entry_by_name || '-',
            exitPersonnel: record.exit_personnel_name || record.exit_by_name || '-'
        });
        row.eachCell((cell) => {
            Object.assign(cell, { style: getDataStyle() });
        });
    });

    // Alt bilgi
    const footerRow = worksheet.addRow([]);
    worksheet.addRow([`Toplam Kayıt: ${records.length}`, '', '', '', '', '', '', `Oluşturulma: ${formatDateTime(new Date())}`]);

    return workbook;
}

// Araç kayıtlarını Excel'e yaz
async function createVehiclesExcel(records: any[], date: string): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Güvenlik Dashboard';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Araç Kayıtları');

    worksheet.columns = [
        { header: 'Araç Marka', key: 'brand', width: 15 },
        { header: 'Plaka', key: 'plate', width: 15 },
        { header: 'Aracı Alan Kişi', key: 'driver', width: 20 },
        { header: 'Konum', key: 'destination', width: 20 },
        { header: 'Teslim Tarihi', key: 'givenDate', width: 15 },
        { header: 'Teslim Saati', key: 'givenTime', width: 12 },
        { header: 'Teslim Alma Tarihi', key: 'returnDate', width: 15 },
        { header: 'Teslim Alma Saati', key: 'returnTime', width: 12 },
        { header: 'Açıklama', key: 'description', width: 30 },
        { header: 'Teslim Eden', key: 'givenPersonnel', width: 20 },
        { header: 'Teslim Alan', key: 'returnPersonnel', width: 20 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
        Object.assign(cell, { style: getHeaderStyle() });
    });
    headerRow.height = 25;

    records.sort((a, b) => {
        const dateA = new Date(`${a.given_date}T${a.given_time || '00:00:00'}`);
        const dateB = new Date(`${b.given_date}T${b.given_time || '00:00:00'}`);
        return dateA.getTime() - dateB.getTime();
    });

    records.forEach((record) => {
        const row = worksheet.addRow({
            brand: record.vehicle_brand || '-',
            plate: record.vehicle_plate || '-',
            driver: record.manager_name || '-',
            destination: record.destination || '-',
            givenDate: formatDate(record.given_date),
            givenTime: record.given_time ? record.given_time.substring(0, 5) : '-',
            returnDate: formatDate(record.return_date),
            returnTime: record.return_time ? record.return_time.substring(0, 5) : '-',
            description: record.notes || '-',
            givenPersonnel: record.given_personnel_name || record.given_by_name || '-',
            returnPersonnel: record.returned_personnel_name || record.returned_by_name || '-'
        });
        row.eachCell((cell) => {
            Object.assign(cell, { style: getDataStyle() });
        });
    });

    worksheet.addRow([]);
    worksheet.addRow([`Toplam Kayıt: ${records.length}`, '', '', '', '', '', '', '', '', `Oluşturulma: ${formatDateTime(new Date())}`]);

    return workbook;
}

// Ziyaretçi kayıtlarını Excel'e yaz
async function createVisitorsExcel(records: any[], date: string): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Güvenlik Dashboard';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Ziyaretçi Kayıtları');

    worksheet.columns = [
        { header: 'Plaka', key: 'plate', width: 15 },
        { header: 'İsim Soyisim', key: 'name', width: 25 },
        { header: 'Firma', key: 'company', width: 20 },
        { header: 'Ziyaret Edilen', key: 'visitedPerson', width: 20 },
        { header: 'Kişi Sayısı', key: 'personCount', width: 12 },
        { header: 'Telefon No', key: 'phone', width: 15 },
        { header: 'Giriş Tarihi', key: 'entryDate', width: 15 },
        { header: 'Giriş Saati', key: 'entryTime', width: 12 },
        { header: 'Çıkış Tarihi', key: 'exitDate', width: 15 },
        { header: 'Çıkış Saati', key: 'exitTime', width: 12 },
        { header: 'Açıklama', key: 'description', width: 25 },
        { header: 'Elektrik İstasyonu', key: 'isElectric', width: 15 },
        { header: 'Taşeron İşçi', key: 'isContractor', width: 12 },
        { header: 'Giriş Kaydı Yapan', key: 'entryPersonnel', width: 20 },
        { header: 'Çıkış Kaydı Yapan', key: 'exitPersonnel', width: 20 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
        Object.assign(cell, { style: getHeaderStyle() });
    });
    headerRow.height = 25;

    records.sort((a, b) => {
        const dateA = new Date(`${a.entry_date}T${a.entry_time || '00:00:00'}`);
        const dateB = new Date(`${b.entry_date}T${b.entry_time || '00:00:00'}`);
        return dateA.getTime() - dateB.getTime();
    });

    records.forEach((record) => {
        const row = worksheet.addRow({
            plate: record.vehicle_plate || '-',
            name: record.full_name || '-',
            company: record.company_name || '-',
            visitedPerson: record.visiting_person || record.destination_manager_name || '-',
            personCount: record.person_count || 1,
            phone: record.phone || '-',
            entryDate: formatDate(record.entry_date),
            entryTime: record.entry_time ? record.entry_time.substring(0, 5) : '-',
            exitDate: formatDate(record.exit_date),
            exitTime: record.exit_time ? record.exit_time.substring(0, 5) : '-',
            description: record.notes || '-',
            isElectric: record.for_electric_station ? 'Evet' : 'Hayır',
            isContractor: record.subcontractor_worker ? 'Evet' : 'Hayır',
            entryPersonnel: record.entry_personnel_name || record.entry_by_name || '-',
            exitPersonnel: record.exit_personnel_name || record.exit_by_name || '-'
        });
        row.eachCell((cell) => {
            Object.assign(cell, { style: getDataStyle() });
        });
    });

    worksheet.addRow([]);
    worksheet.addRow([`Toplam Kayıt: ${records.length}`, '', '', '', '', '', '', '', '', '', '', '', '', `Oluşturulma: ${formatDateTime(new Date())}`]);

    return workbook;
}

// Yangın alarmları Excel'e yaz
async function createFireAlarmsExcel(records: any[], date: string): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Güvenlik Dashboard';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Yangın Alarm Kayıtları');

    worksheet.columns = [
        { header: 'Alarm No', key: 'alarmNo', width: 12 },
        { header: 'Konum', key: 'location', width: 25 },
        { header: 'Alarm Tarihi', key: 'alarmDate', width: 15 },
        { header: 'Alarm Saati', key: 'alarmTime', width: 12 },
        { header: 'Çözüm Tarihi', key: 'resolveDate', width: 15 },
        { header: 'Çözüm Saati', key: 'resolveTime', width: 12 },
        { header: 'Açıklama', key: 'description', width: 35 },
        { header: 'Kaydı Açan', key: 'openedBy', width: 20 },
        { header: 'Kaydı Kapatan', key: 'closedBy', width: 20 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
        Object.assign(cell, { style: getHeaderStyle() });
    });
    headerRow.height = 25;

    records.sort((a, b) => new Date(a.alarm_time).getTime() - new Date(b.alarm_time).getTime());

    records.forEach((record) => {
        const row = worksheet.addRow({
            alarmNo: record.alarm_number || '-',
            location: record.location || '-',
            alarmDate: formatDate(record.alarm_time),
            alarmTime: formatTime(record.alarm_time),
            resolveDate: formatDate(record.reset_time),
            resolveTime: formatTime(record.reset_time),
            description: record.description || '-',
            openedBy: record.entry_personnel_name || record.personnel_name || '-',
            closedBy: record.exit_personnel_name || '-'
        });
        row.eachCell((cell) => {
            Object.assign(cell, { style: getDataStyle() });
        });
    });

    worksheet.addRow([]);
    worksheet.addRow([`Toplam Kayıt: ${records.length}`, '', '', '', '', '', '', `Oluşturulma: ${formatDateTime(new Date())}`]);

    return workbook;
}

// Olay kayıtlarını vardiyaya göre Excel'e yaz
async function createIncidentsExcel(records: any[], date: string, shift: typeof SHIFTS[0]): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Güvenlik Dashboard';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(`${shift.name}`);

    worksheet.columns = [
        { header: 'Saat', key: 'time', width: 12 },
        { header: 'Olay Türü', key: 'type', width: 20 },
        { header: 'Açıklama', key: 'description', width: 50 },
        { header: 'Personel', key: 'personnel', width: 20 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
        Object.assign(cell, { style: getHeaderStyle() });
    });
    headerRow.height = 25;

    // Vardiyadaki kayıtları filtrele
    const shiftRecords = records.filter(record => {
        const hour = new Date(record.created_at || record.report_date).getHours();
        if (shift.startHour < shift.endHour) {
            return hour >= shift.startHour && hour < shift.endHour;
        } else {
            // Gece vardiyası (00-08)
            return hour >= shift.startHour || hour < shift.endHour;
        }
    });

    shiftRecords.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    shiftRecords.forEach((record) => {
        const row = worksheet.addRow({
            time: formatTime(record.created_at),
            type: record.incident_type || record.shift_label || 'Genel',
            description: record.report_content || record.description || '-',
            personnel: record.personnel_name || '-'
        });
        row.eachCell((cell) => {
            Object.assign(cell, { style: getDataStyle() });
        });
    });

    worksheet.addRow([]);
    worksheet.addRow([`Toplam Kayıt: ${shiftRecords.length}`, '', `Oluşturulma: ${formatDateTime(new Date())}`]);

    return workbook;
}

// ÖZET RAPOR oluştur
async function createSummaryReport(
    expectedCounts: RecordCounts,
    writtenCounts: WrittenCounts,
    options: ExportOptions,
    adminName: string,
    ipAddress: string
): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Güvenlik Dashboard';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Özet Rapor');

    worksheet.columns = [
        { header: 'Tablo Adı', key: 'table', width: 25 },
        { header: 'Beklenen Kayıt', key: 'expected', width: 18 },
        { header: 'Yazılan Kayıt', key: 'written', width: 18 },
        { header: 'Durum', key: 'status', width: 15 }
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
        Object.assign(cell, { style: getHeaderStyle() });
    });
    headerRow.height = 25;

    const tables = [
        { name: 'Müdür Kayıtları', key: 'managers' as keyof RecordCounts },
        { name: 'Araç Kayıtları', key: 'vehicles' as keyof RecordCounts },
        { name: 'Ziyaretçi Kayıtları', key: 'visitors' as keyof RecordCounts },
        { name: 'Yangın Alarm Kayıtları', key: 'fireAlarms' as keyof RecordCounts },
        { name: 'Olay Kayıtları', key: 'incidents' as keyof RecordCounts }
    ];

    let totalExpected = 0;
    let totalWritten = 0;

    tables.forEach((table) => {
        if ((options.reports as any)[table.key]) {
            const expected = expectedCounts[table.key];
            const written = writtenCounts[table.key];
            totalExpected += expected;
            totalWritten += written;

            const row = worksheet.addRow({
                table: table.name,
                expected: expected,
                written: written,
                status: expected === written ? '✅ Başarılı' : '❌ Hatalı'
            });
            row.eachCell((cell) => {
                Object.assign(cell, { style: getDataStyle() });
            });
        }
    });

    // Toplam satırı
    worksheet.addRow([]);
    const totalRow = worksheet.addRow({
        table: 'TOPLAM',
        expected: totalExpected,
        written: totalWritten,
        status: totalExpected === totalWritten ? '✅ Başarılı' : '❌ Hatalı'
    });
    totalRow.eachCell((cell) => {
        cell.font = { bold: true };
    });

    // Rapor bilgileri
    worksheet.addRow([]);
    worksheet.addRow([]);
    worksheet.addRow(['RAPOR BİLGİLERİ']);
    worksheet.addRow(['Tarih Aralığı:', `${options.startDate} - ${options.endDate}`]);
    worksheet.addRow(['İndiren:', adminName]);
    worksheet.addRow(['İndirme Tarihi:', formatDateTime(new Date())]);
    worksheet.addRow(['IP Adresi:', ipAddress]);

    return workbook;
}

// Ana export fonksiyonu
export async function generateExportZip(
    res: Response,
    options: ExportOptions,
    adminId: string,
    adminName: string,
    ipAddress: string
): Promise<void> {
    const client = await pool.connect();
    const writtenCounts: WrittenCounts = {
        managers: 0,
        vehicles: 0,
        visitors: 0,
        fireAlarms: 0,
        incidents: 0
    };

    try {
        // READ ONLY transaction başlat
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');

        // Önce kayıt sayılarını al
        const expectedCounts = await getRecordCounts(options.startDate, options.endDate);

        // ZIP dosyası oluştur
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });

        // Hata yönetimi
        archive.on('error', (err) => {
            throw err;
        });

        archive.on('warning', (err) => {
            if (err.code !== 'ENOENT') {
                console.warn('Archive warning:', err);
            }
        });

        // Response headers
        const fileName = `Guvenlik_Kayitlari_${options.startDate}_${options.endDate}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Pipe to response
        archive.pipe(res);

        // Tarihleri döngüle
        const startDate = new Date(options.startDate + 'T00:00:00');
        const endDate = new Date(options.endDate + 'T23:59:59');

        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const year = date.getFullYear();
            const month = TURKISH_MONTHS[date.getMonth()];
            const day = String(date.getDate()).padStart(2, '0');
            const monthNum = String(date.getMonth() + 1).padStart(2, '0');
            const dateStr = `${year}-${monthNum}-${day}`; // For SQL queries YYYY-MM-DD
            const fileDateStr = `${day}-${monthNum}-${year}`; // For file names DD-MM-YYYY

            const folderPath = `${year}/${month}/${day}`;

            console.log(`Processing date: ${dateStr}, folder: ${folderPath}`);

            // Müdür kayıtları
            if (options.reports.managers) {
                const result = await client.query(
                    `SELECT mr.*, 
                            m.first_name as manager_first_name, 
                            m.last_name as manager_last_name,
                            m.title as manager_title,
                            COALESCE(mr.entry_by_name, p1.first_name || ' ' || p1.last_name) as entry_personnel_name,
                            COALESCE(mr.exit_by_name, p2.first_name || ' ' || p2.last_name) as exit_personnel_name
                     FROM managers_records mr
                     LEFT JOIN managers m ON mr.manager_id = m.id
                     LEFT JOIN personnel p1 ON mr.entry_by = p1.id
                     LEFT JOIN personnel p2 ON mr.exit_by = p2.id
                     WHERE mr.entry_date = $1::date
                       AND mr.deleted_at IS NULL
                     ORDER BY mr.entry_date ASC, mr.entry_time ASC`,
                    [dateStr]
                );

                console.log(`Managers for ${dateStr}: ${result.rows.length} records`);

                if (result.rows.length > 0) {
                    const workbook = await createManagersExcel(result.rows, dateStr);
                    const buffer = await workbook.xlsx.writeBuffer();
                    archive.append(Buffer.from(buffer), { name: `${folderPath}/Mudur_Kayitlari_${fileDateStr}.xlsx` });
                    writtenCounts.managers += result.rows.length;
                }
            }

            // Araç kayıtları
            if (options.reports.vehicles) {
                const result = await client.query(
                    `SELECT vr.*,
                            v.brand as vehicle_brand,
                            v.plate as vehicle_plate,
                            COALESCE(vr.given_by_name, p1.first_name || ' ' || p1.last_name) as given_personnel_name,
                            COALESCE(vr.returned_by_name, p2.first_name || ' ' || p2.last_name) as returned_personnel_name
                     FROM vehicle_records vr
                     LEFT JOIN vehicles v ON vr.vehicle_id = v.id
                     LEFT JOIN personnel p1 ON vr.given_by = p1.id
                     LEFT JOIN personnel p2 ON vr.returned_by = p2.id
                     WHERE vr.given_date = $1::date
                       AND vr.deleted_at IS NULL
                     ORDER BY vr.given_date ASC, vr.given_time ASC`,
                    [dateStr]
                );

                if (result.rows.length > 0) {
                    const workbook = await createVehiclesExcel(result.rows, dateStr);
                    const buffer = await workbook.xlsx.writeBuffer();
                    archive.append(Buffer.from(buffer), { name: `${folderPath}/Arac_Kayitlari_${fileDateStr}.xlsx` });
                    writtenCounts.vehicles += result.rows.length;
                }
            }

            // Ziyaretçi kayıtları
            if (options.reports.visitors) {
                const result = await client.query(
                    `SELECT vr.*,
                            COALESCE(vr.entry_by_name, p1.first_name || ' ' || p1.last_name) as entry_personnel_name,
                            COALESCE(vr.exit_by_name, p2.first_name || ' ' || p2.last_name) as exit_personnel_name
                     FROM visitor_records vr
                     LEFT JOIN personnel p1 ON vr.entry_by = p1.id
                     LEFT JOIN personnel p2 ON vr.exit_by = p2.id
                     WHERE vr.entry_date = $1::date
                       AND vr.deleted_at IS NULL
                     ORDER BY vr.entry_date ASC, vr.entry_time ASC`,
                    [dateStr]
                );

                if (result.rows.length > 0) {
                    const workbook = await createVisitorsExcel(result.rows, dateStr);
                    const buffer = await workbook.xlsx.writeBuffer();
                    archive.append(Buffer.from(buffer), { name: `${folderPath}/Ziyaretci_Kayitlari_${fileDateStr}.xlsx` });
                    writtenCounts.visitors += result.rows.length;
                }
            }

            // Yangın alarm kayıtları
            if (options.reports.fireAlarms) {
                const result = await client.query(
                    `SELECT fa.*,
                            COALESCE(fa.recorded_by_name, p1.first_name || ' ' || p1.last_name) as entry_personnel_name,
                            COALESCE(fa.resolved_by_name, p2.first_name || ' ' || p2.last_name) as exit_personnel_name
                     FROM fire_alarms fa
                     LEFT JOIN personnel p1 ON fa.recorded_by = p1.id
                     LEFT JOIN personnel p2 ON fa.resolved_by = p2.id
                     WHERE fa.alarm_time::date = $1::date
                       AND fa.deleted_at IS NULL
                     ORDER BY fa.alarm_time ASC`,
                    [dateStr]
                );

                if (result.rows.length > 0) {
                    const workbook = await createFireAlarmsExcel(result.rows, dateStr);
                    const buffer = await workbook.xlsx.writeBuffer();
                    archive.append(Buffer.from(buffer), { name: `${folderPath}/Yangin_Alarm_Kayitlari_${fileDateStr}.xlsx` });
                    writtenCounts.fireAlarms += result.rows.length;
                }
            }

            // Olay kayıtları (Vardiya raporları) - Word dosyalarını ekle
            if (options.reports.incidents) {
                const result = await client.query(
                    `SELECT i.*, i.report_file_path,
                            p.first_name || ' ' || p.last_name as personnel_name
                     FROM incidents i
                     LEFT JOIN personnel p ON i.recorded_by = p.id
                     WHERE i.report_date = $1::date
                       AND i.deleted_at IS NULL
                     ORDER BY i.created_at ASC`,
                    [dateStr]
                );

                if (result.rows.length > 0) {
                    // Her vardiya raporu için Word dosyasını ekle
                    for (const record of result.rows) {
                        if (record.report_file_path) {
                            const wordFilePath = record.report_file_path;

                            if (fs.existsSync(wordFilePath)) {
                                // Vardiya bilgisini al ve dosya adı oluştur
                                const shiftLabel = record.shift_label ? record.shift_label.replace(/:/g, '-') : '00-08';
                                const fileName = `${shiftLabel}_${fileDateStr}.docx`;

                                // Word dosyasını ZIP'e ekle
                                archive.file(wordFilePath, {
                                    name: `${folderPath}/Vardiya_Raporlari/${fileName}`
                                });
                                writtenCounts.incidents += 1;
                            } else {
                                console.warn(`Word dosyası bulunamadı: ${wordFilePath}`);
                            }
                        }
                    }
                }
            }
        }

        await client.query('COMMIT');

        // Özet rapor oluştur
        const summaryWorkbook = await createSummaryReport(
            expectedCounts,
            writtenCounts,
            options,
            adminName,
            ipAddress
        );
        const summaryBuffer = await summaryWorkbook.xlsx.writeBuffer();
        archive.append(Buffer.from(summaryBuffer), { name: 'OZET_RAPOR.xlsx' });

        // Veri doğrulama
        const totalExpected = Object.values(expectedCounts).reduce((a, b) => a + b, 0);
        const totalWritten = Object.values(writtenCounts).reduce((a, b) => a + b, 0);

        if (totalExpected !== totalWritten) {
            console.warn(`Veri uyumsuzluğu: Beklenen ${totalExpected}, Yazılan ${totalWritten}`);
        }

        // Audit log kaydı - record_id olarak tarih aralığını kullan
        const exportRecordId = `export_${options.startDate}_${options.endDate}`;
        // adminId'nin geçerli UUID olup olmadığını kontrol et
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validAdminId = uuidRegex.test(adminId) ? adminId : null;

        await pool.query(
            `INSERT INTO audit_log (action, table_name, record_id, changed_by, ip_address, old_values, new_values)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                'UPDATE',  // Mevcut constraint içindeki bir değer kullan
                'export',
                exportRecordId,
                validAdminId,
                ipAddress,
                null,
                JSON.stringify({
                    operation: 'EXPORT_DATA',
                    startDate: options.startDate,
                    endDate: options.endDate,
                    reports: options.reports,
                    expectedCounts,
                    writtenCounts,
                    adminName,
                    status: totalExpected === totalWritten ? 'success' : 'partial'
                })
            ]
        );

        // ZIP'i tamamla
        await archive.finalize();

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Export error:', error);
        throw error;
    } finally {
        client.release();
    }
}
