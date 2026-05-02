import ExcelJS from 'exceljs';
import archiver from 'archiver';
import { Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../config/database';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

interface VehicleExportRow {
    id: string;
    return_date?: string | null;
    return_time?: string | null;
    status?: string | null;
    returned_by?: string | null;
    returned_by_name?: string | null;
    returned_personnel_name?: string | null;
    [key: string]: any;
}

interface ManagerExportRow {
    id: string;
    exit_date?: string | null;
    exit_time?: string | null;
    exit_by?: string | null;
    exit_by_name?: string | null;
    exit_personnel_name?: string | null;
    [key: string]: any;
}

interface VisitorExportRow {
    id: string;
    exit_date?: string | null;
    exit_time?: string | null;
    status?: string | null;
    exit_by?: string | null;
    exit_by_name?: string | null;
    exit_personnel_name?: string | null;
    [key: string]: any;
}

const LOGOUT_EXPORT_BASE_DIR_ENV = 'DAILY_EXPORT_BASE_DIR';

const getLogoutExportBaseDir = (): string => {
    const configuredDir = process.env[LOGOUT_EXPORT_BASE_DIR_ENV]?.trim();
    if (configuredDir) {
        return configuredDir;
    }

    // Docker kurulumunda compose volume bu yolu host masaüstüne mapler.
    const dockerExportRoot = '/app/daily_exports';
    if (fs.existsSync(dockerExportRoot)) {
        return dockerExportRoot;
    }

    if (process.platform === 'win32') {
        return path.join(os.homedir(), 'Desktop', 'Guvenlik_Kayitlari');
    }

    return path.resolve(process.cwd(), 'daily_exports');
};

interface FireAlarmExportRow {
    id: string;
    resolution_time?: string | null;
    status?: string | null;
    resolved_by?: string | null;
    resolved_by_name?: string | null;
    exit_personnel_name?: string | null;
    [key: string]: any;
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

function mergeVehicleRowsWithSafeBackfill(rows: VehicleExportRow[]): VehicleExportRow[] {
    const byId = new Map<string, VehicleExportRow>();

    for (const row of rows) {
        const existing = byId.get(row.id);
        if (!existing) {
            byId.set(row.id, { ...row });
            continue;
        }

        // Sadece acik/eksik kayitlari backfill et, dolu teslim alma alanlarini asla override etme.
        const existingHasReturnDate = Boolean(existing.return_date);
        if (!existingHasReturnDate && row.return_date) {
            existing.return_date = row.return_date;
            if (!existing.return_time && row.return_time) existing.return_time = row.return_time;
            if (!existing.returned_by && row.returned_by) existing.returned_by = row.returned_by;
            if (!existing.returned_by_name && row.returned_by_name) existing.returned_by_name = row.returned_by_name;
            if (!existing.returned_personnel_name && row.returned_personnel_name) {
                existing.returned_personnel_name = row.returned_personnel_name;
            }
            if ((!existing.status || existing.status === 'in_use') && row.status === 'returned') {
                existing.status = row.status;
            }
        }
    }

    return Array.from(byId.values());
}

function mergeManagerRowsWithSafeBackfill(rows: ManagerExportRow[]): ManagerExportRow[] {
    const byId = new Map<string, ManagerExportRow>();

    for (const row of rows) {
        const existing = byId.get(row.id);
        if (!existing) {
            byId.set(row.id, { ...row });
            continue;
        }

        const existingHasExitDate = Boolean(existing.exit_date);
        if (!existingHasExitDate && row.exit_date) {
            existing.exit_date = row.exit_date;
            if (!existing.exit_time && row.exit_time) existing.exit_time = row.exit_time;
            if (!existing.exit_by && row.exit_by) existing.exit_by = row.exit_by;
            if (!existing.exit_by_name && row.exit_by_name) existing.exit_by_name = row.exit_by_name;
            if (!existing.exit_personnel_name && row.exit_personnel_name) {
                existing.exit_personnel_name = row.exit_personnel_name;
            }
        }
    }

    return Array.from(byId.values());
}

function mergeVisitorRowsWithSafeBackfill(rows: VisitorExportRow[]): VisitorExportRow[] {
    const byId = new Map<string, VisitorExportRow>();

    for (const row of rows) {
        const existing = byId.get(row.id);
        if (!existing) {
            byId.set(row.id, { ...row });
            continue;
        }

        const existingHasExitDate = Boolean(existing.exit_date);
        if (!existingHasExitDate && row.exit_date) {
            existing.exit_date = row.exit_date;
            if (!existing.exit_time && row.exit_time) existing.exit_time = row.exit_time;
            if (!existing.exit_by && row.exit_by) existing.exit_by = row.exit_by;
            if (!existing.exit_by_name && row.exit_by_name) existing.exit_by_name = row.exit_by_name;
            if (!existing.exit_personnel_name && row.exit_personnel_name) {
                existing.exit_personnel_name = row.exit_personnel_name;
            }
            if ((!existing.status || existing.status === 'inside') && row.status === 'exited') {
                existing.status = row.status;
            }
        }
    }

    return Array.from(byId.values());
}

function mergeFireAlarmRowsWithSafeBackfill(rows: FireAlarmExportRow[]): FireAlarmExportRow[] {
    const byId = new Map<string, FireAlarmExportRow>();

    for (const row of rows) {
        const existing = byId.get(row.id);
        if (!existing) {
            byId.set(row.id, { ...row });
            continue;
        }

        const existingHasResetTime = Boolean(existing.resolution_time);
        if (!existingHasResetTime && row.resolution_time) {
            existing.resolution_time = row.resolution_time;
            if (!existing.resolved_by && row.resolved_by) existing.resolved_by = row.resolved_by;
            if (!existing.resolved_by_name && row.resolved_by_name) existing.resolved_by_name = row.resolved_by_name;
            if (!existing.exit_personnel_name && row.exit_personnel_name) {
                existing.exit_personnel_name = row.exit_personnel_name;
            }
            if ((!existing.status || existing.status === 'active') && row.status) {
                existing.status = row.status;
            }
        }
    }

    return Array.from(byId.values());
}

async function getManagerRecordsForExport(client: PoolClient, dateStr: string): Promise<ManagerExportRow[]> {
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
         WHERE mr.deleted_at IS NULL
           AND (
                mr.entry_date = $1::date
                OR (
                    mr.exit_date = $1::date
                    AND mr.entry_date < $1::date
                )
           )
         ORDER BY mr.entry_date ASC, mr.entry_time ASC`,
        [dateStr]
    );

    return mergeManagerRowsWithSafeBackfill(result.rows as ManagerExportRow[]);
}

async function getVehicleRecordsForExport(client: PoolClient, dateStr: string): Promise<VehicleExportRow[]> {
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
         WHERE vr.deleted_at IS NULL
           AND (
                vr.given_date = $1::date
                OR (
                    vr.return_date = $1::date
                    AND vr.given_date < $1::date
                )
           )
         ORDER BY vr.given_date ASC, vr.given_time ASC`,
        [dateStr]
    );

    return mergeVehicleRowsWithSafeBackfill(result.rows as VehicleExportRow[]);
}

async function getVisitorRecordsForExport(client: PoolClient, dateStr: string): Promise<VisitorExportRow[]> {
    const result = await client.query(
        `SELECT vr.*,
                COALESCE(vr.entry_by_name, p1.first_name || ' ' || p1.last_name) as entry_personnel_name,
                COALESCE(vr.exit_by_name, p2.first_name || ' ' || p2.last_name) as exit_personnel_name
         FROM visitor_records vr
         LEFT JOIN personnel p1 ON vr.entry_by = p1.id
         LEFT JOIN personnel p2 ON vr.exit_by = p2.id
         WHERE vr.deleted_at IS NULL
           AND (
                vr.entry_date = $1::date
                OR (
                    vr.exit_date = $1::date
                    AND vr.entry_date < $1::date
                )
           )
         ORDER BY vr.entry_date ASC, vr.entry_time ASC`,
        [dateStr]
    );

    return mergeVisitorRowsWithSafeBackfill(result.rows as VisitorExportRow[]);
}

async function getFireAlarmRecordsForExport(client: PoolClient, dateStr: string): Promise<FireAlarmExportRow[]> {
    const result = await client.query(
        `SELECT fa.*,
                COALESCE(fa.recorded_by_name, p1.first_name || ' ' || p1.last_name) as entry_personnel_name,
                COALESCE(fa.resolved_by_name, p2.first_name || ' ' || p2.last_name) as exit_personnel_name
         FROM fire_alarms fa
         LEFT JOIN personnel p1 ON fa.recorded_by = p1.id
         LEFT JOIN personnel p2 ON fa.resolved_by = p2.id
         WHERE fa.deleted_at IS NULL
           AND (
                fa.alarm_time::date = $1::date
                OR (
                    fa.resolution_time IS NOT NULL
                    AND fa.resolution_time::date = $1::date
                    AND fa.alarm_time::date < $1::date
                )
           )
         ORDER BY fa.alarm_time ASC`,
        [dateStr]
    );

    return mergeFireAlarmRowsWithSafeBackfill(result.rows as FireAlarmExportRow[]);
}

// Kayıt sayılarını getir
export async function getRecordCounts(startDate: string, endDate: string): Promise<RecordCounts> {
    const client = await pool.connect();

    try {
        // READ ONLY transaction - veri bütünlüğü için
        await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');

        const [managersResult, vehiclesResult, visitorsResult, fireAlarmsResult, incidentsResult] = await Promise.all([
            client.query(
                                `SELECT (
                                        (SELECT COUNT(*) FROM managers_records
                                         WHERE entry_date >= $1::date AND entry_date <= $2::date
                                             AND deleted_at IS NULL)
                                        +
                                        (SELECT COUNT(*) FROM managers_records
                                         WHERE exit_date >= $1::date AND exit_date <= $2::date
                                             AND entry_date < exit_date
                                             AND deleted_at IS NULL)
                                ) as count`,
                [startDate, endDate]
            ),
            client.query(
                                `SELECT (
                                        (SELECT COUNT(*) FROM vehicle_records
                                         WHERE given_date >= $1::date AND given_date <= $2::date
                                             AND deleted_at IS NULL)
                                        +
                                        (SELECT COUNT(*) FROM vehicle_records
                                         WHERE return_date >= $1::date AND return_date <= $2::date
                                             AND given_date < return_date
                                             AND deleted_at IS NULL)
                                ) as count`,
                [startDate, endDate]
            ),
            client.query(
                                `SELECT (
                                        (SELECT COUNT(*) FROM visitor_records
                                         WHERE entry_date >= $1::date AND entry_date <= $2::date
                                             AND deleted_at IS NULL)
                                        +
                                        (SELECT COUNT(*) FROM visitor_records
                                         WHERE exit_date >= $1::date AND exit_date <= $2::date
                                             AND entry_date < exit_date
                                             AND deleted_at IS NULL)
                                ) as count`,
                [startDate, endDate]
            ),
            client.query(
                                `SELECT (
                                        (SELECT COUNT(*) FROM fire_alarms
                                         WHERE alarm_time::date >= $1::date AND alarm_time::date <= $2::date
                                             AND deleted_at IS NULL)
                                        +
                                        (SELECT COUNT(*) FROM fire_alarms
                                         WHERE resolution_time IS NOT NULL
                                             AND resolution_time::date >= $1::date AND resolution_time::date <= $2::date
                                             AND alarm_time::date < resolution_time::date
                                             AND deleted_at IS NULL)
                                ) as count`,
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

// ============== ÇIKIŞ YAPARKEN OTOMATİK EXPORT ==============

/**
 * Kullanıcı çıkış yaparken günün kayıtlarını masaüstüne export eder
 * Aynı gün birden fazla çıkış yapılırsa dosyaları günceller (üzerine yazar)
 * Klasör yapısı: Yıl/Ay/Gün şeklinde (Admin panel ile aynı)
 */
export async function generateLogoutExport(userId: string): Promise<{ success: boolean; exportPath?: string; error?: string }> {
    const client = await pool.connect();
    const today = new Date();
    const year = today.getFullYear();
    const month = TURKISH_MONTHS[today.getMonth()];
    const day = String(today.getDate()).padStart(2, '0');
    const monthNum = String(today.getMonth() + 1).padStart(2, '0');
    const dateStr = `${year}-${monthNum}-${day}`;
    const fileDateStr = `${day}-${monthNum}-${year}`;

    const exportBaseDir = getLogoutExportBaseDir();
    // Klasör yapısı: {base}/Yıl/Ay/Gün/
    const exportDir = path.join(exportBaseDir, String(year), month, day);
    const vardiyaDir = path.join(exportDir, 'Vardiya_Raporlari');

    try {
        // Klasörleri oluştur (yoksa)
        fs.mkdirSync(exportDir, { recursive: true });
        fs.mkdirSync(vardiyaDir, { recursive: true });

        console.log(`[Logout Export] Kullanıcı ${userId} çıkış yapıyor, kayıtlar ${exportDir} klasörüne kaydedilecek`);

        // Müdür kayıtları
        const managerRows = await getManagerRecordsForExport(client, dateStr);

        if (managerRows.length > 0) {
            const workbook = await createManagersExcel(managerRows, dateStr);
            const filePath = path.join(exportDir, `Mudur_Kayitlari_${fileDateStr}.xlsx`);
            await workbook.xlsx.writeFile(filePath);
            console.log(`[Logout Export] Müdür kayıtları: ${managerRows.length} kayıt`);
        }

        // Araç kayıtları
        const vehicleRows = await getVehicleRecordsForExport(client, dateStr);

        if (vehicleRows.length > 0) {
            const workbook = await createVehiclesExcel(vehicleRows, dateStr);
            const filePath = path.join(exportDir, `Arac_Kayitlari_${fileDateStr}.xlsx`);
            await workbook.xlsx.writeFile(filePath);
            console.log(`[Logout Export] Araç kayıtları: ${vehicleRows.length} kayıt`);
        }

        // Ziyaretçi kayıtları
        const visitorRows = await getVisitorRecordsForExport(client, dateStr);

        if (visitorRows.length > 0) {
            const workbook = await createVisitorsExcel(visitorRows, dateStr);
            const filePath = path.join(exportDir, `Ziyaretci_Kayitlari_${fileDateStr}.xlsx`);
            await workbook.xlsx.writeFile(filePath);
            console.log(`[Logout Export] Ziyaretçi kayıtları: ${visitorRows.length} kayıt`);
        }

        // Yangın alarm kayıtları
        const fireAlarmRows = await getFireAlarmRecordsForExport(client, dateStr);

        if (fireAlarmRows.length > 0) {
            const workbook = await createFireAlarmsExcel(fireAlarmRows, dateStr);
            const filePath = path.join(exportDir, `Yangin_Alarm_Kayitlari_${fileDateStr}.xlsx`);
            await workbook.xlsx.writeFile(filePath);
            console.log(`[Logout Export] Yangın alarm kayıtları: ${fireAlarmRows.length} kayıt`);
        }

        // Vardiya Raporları (Word dosyaları)
        const incidentsResult = await client.query(
            `SELECT i.*, i.report_file_path,
                    p.first_name || ' ' || p.last_name as personnel_name
             FROM incidents i
             LEFT JOIN personnel p ON i.recorded_by = p.id
             WHERE i.report_date = $1::date
               AND i.deleted_at IS NULL
             ORDER BY i.created_at ASC`,
            [dateStr]
        );

        let vardiyaCount = 0;
        if (incidentsResult.rows.length > 0) {
            for (const record of incidentsResult.rows) {
                if (record.report_file_path && fs.existsSync(record.report_file_path)) {
                    const shiftLabel = record.shift_label ? record.shift_label.replace(/:/g, '-') : '00-08';
                    const destPath = path.join(vardiyaDir, `${shiftLabel}_${fileDateStr}.docx`);
                    fs.copyFileSync(record.report_file_path, destPath);
                    vardiyaCount++;
                }
            }
            console.log(`[Logout Export] Vardiya raporları: ${vardiyaCount} dosya`);
        }

        const totalRecords = managerRows.length + vehicleRows.length +
            visitorRows.length + fireAlarmRows.length + vardiyaCount;

        console.log(`[Logout Export] Toplam ${totalRecords} kayıt ${exportDir} klasörüne kaydedildi`);

        return { success: true, exportPath: exportDir };

    } catch (error) {
        console.error('[Logout Export] Export hatası:', error);
        return { success: false, error: String(error) };
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
        { header: 'Çocuk Sayısı', key: 'childrenCount', width: 12 },
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
            childrenCount: record.children_count ?? 0,
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
            resolveDate: formatDate(record.resolution_time),
            resolveTime: formatTime(record.resolution_time),
            description: record.resolution_notes || '-',
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
                const managerRows = await getManagerRecordsForExport(client, dateStr);

                console.log(`Managers for ${dateStr}: ${managerRows.length} records`);

                if (managerRows.length > 0) {
                    const workbook = await createManagersExcel(managerRows, dateStr);
                    const buffer = await workbook.xlsx.writeBuffer();
                    archive.append(Buffer.from(buffer), { name: `${folderPath}/Mudur_Kayitlari_${fileDateStr}.xlsx` });
                    writtenCounts.managers += managerRows.length;
                }
            }

            // Araç kayıtları
            if (options.reports.vehicles) {
                const vehicleRows = await getVehicleRecordsForExport(client, dateStr);

                if (vehicleRows.length > 0) {
                    const workbook = await createVehiclesExcel(vehicleRows, dateStr);
                    const buffer = await workbook.xlsx.writeBuffer();
                    archive.append(Buffer.from(buffer), { name: `${folderPath}/Arac_Kayitlari_${fileDateStr}.xlsx` });
                    writtenCounts.vehicles += vehicleRows.length;
                }
            }

            // Ziyaretçi kayıtları
            if (options.reports.visitors) {
                const visitorRows = await getVisitorRecordsForExport(client, dateStr);

                if (visitorRows.length > 0) {
                    const workbook = await createVisitorsExcel(visitorRows, dateStr);
                    const buffer = await workbook.xlsx.writeBuffer();
                    archive.append(Buffer.from(buffer), { name: `${folderPath}/Ziyaretci_Kayitlari_${fileDateStr}.xlsx` });
                    writtenCounts.visitors += visitorRows.length;
                }
            }

            // Yangın alarm kayıtları
            if (options.reports.fireAlarms) {
                const fireAlarmRows = await getFireAlarmRecordsForExport(client, dateStr);

                if (fireAlarmRows.length > 0) {
                    const workbook = await createFireAlarmsExcel(fireAlarmRows, dateStr);
                    const buffer = await workbook.xlsx.writeBuffer();
                    archive.append(Buffer.from(buffer), { name: `${folderPath}/Yangin_Alarm_Kayitlari_${fileDateStr}.xlsx` });
                    writtenCounts.fireAlarms += fireAlarmRows.length;
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
