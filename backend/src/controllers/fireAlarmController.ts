import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizePlainText } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { createFireAlarmMessage, createFireAlarmResolveMessage } from '../services/whatsapp';
import { sendWhatsAppTextMessage } from '../services/whatsappBaileys';
import { getResolvedGateFromRequest } from '../utils/gate';

const MAX_PAGE_SIZE = 500;
const MAX_EXPORT_ROWS = 50_000;
const MAX_FILTER_LENGTH = 120;
const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isRequestBodyObject = (body: unknown): body is Record<string, unknown> =>
    body !== null && typeof body === 'object' && !Array.isArray(body);

const isValidIsoDate = (value: string): boolean => {
    if (!ISO_DATE_PATTERN.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const parsePaginationValue = (value: unknown, fallback: number, min: number, max: number): number | null => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
};

const isValidOptionalText = (value: unknown, maxLength: number): boolean =>
    value === undefined || value === null || (typeof value === 'string' && value.length <= maxLength);

const isValidOptionalBoolean = (value: unknown): boolean =>
    value === undefined || typeof value === 'boolean';

const sanitizeAlarmText = (value: string, maxLength: number): string | null =>
    sanitizePlainText(value, maxLength);

// Tüm yangın alarm kayıtlarını getir
export const getFireAlarms = async (req: Request, res: Response) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const includeDeleted = req.query.includeDeleted === 'true';
        const unlimited = req.query.unlimited === 'true';

        const page = parsePaginationValue(req.query.page, 1, 1, 1_000_000);
        const requestedLimit = parsePaginationValue(req.query.limit, 200, 1, MAX_PAGE_SIZE);
        const requestedOffset = parsePaginationValue(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
        if (page === null || requestedLimit === null || requestedOffset === null) {
            res.status(400).json({ success: false, message: 'Geçersiz sayfalama parametresi' });
            return;
        }

        const alarm_number = typeof req.query.alarm_number === 'string' ? req.query.alarm_number.trim() : '';
        const location = typeof req.query.location === 'string' ? req.query.location.trim() : '';
        const gate = typeof req.query.gate === 'string' ? req.query.gate.trim() : '';
        const false_alarm = typeof req.query.false_alarm === 'string' ? req.query.false_alarm.trim() : 'all';
        const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'all';
        const recorded_by = typeof req.query.recorded_by === 'string' ? req.query.recorded_by.trim() : '';
        const resolved_by = typeof req.query.resolved_by === 'string' ? req.query.resolved_by.trim() : '';

        const alarmDateStart = typeof req.query.alarmDateStart === 'string' ? req.query.alarmDateStart : '';
        const alarmDateEnd = typeof req.query.alarmDateEnd === 'string' ? req.query.alarmDateEnd : '';
        const resolutionDateStart = typeof req.query.resolutionDateStart === 'string' ? req.query.resolutionDateStart : '';
        const resolutionDateEnd = typeof req.query.resolutionDateEnd === 'string' ? req.query.resolutionDateEnd : '';

        const textFilters = [alarm_number, location, gate, recorded_by, resolved_by];
        if (textFilters.some((value) => value.length > MAX_FILTER_LENGTH)
            || !['all', 'active', 'resolved', 'deleted'].includes(status)
            || !['all', 'true', 'false'].includes(false_alarm)
            || [alarmDateStart, alarmDateEnd, resolutionDateStart, resolutionDateEnd]
                .some((value) => value !== '' && !isValidIsoDate(value))) {
            res.status(400).json({ success: false, message: 'Geçersiz filtre parametresi' });
            return;
        }

        const hasDateRange = Boolean(alarmDateStart || alarmDateEnd || resolutionDateStart || resolutionDateEnd);
        if (unlimited && !hasDateRange) {
            res.status(400).json({ success: false, message: 'Sınırsız indirme için tarih aralığı gereklidir' });
            return;
        }

        const whereClauses: string[] = [];
        const queryParams: any[] = [];
        let paramCounter = 1;

        if (status === 'deleted') {
            whereClauses.push(`fa.deleted_at IS NOT NULL`);
        } else if (status === 'active') {
            whereClauses.push(`fa.resolved = false`);
            whereClauses.push(`fa.deleted_at IS NULL`);
        } else if (status === 'resolved') {
            whereClauses.push(`fa.resolved = true`);
            whereClauses.push(`fa.deleted_at IS NULL`);
        } else {
            if (!includeDeleted) {
                whereClauses.push(`fa.deleted_at IS NULL`);
            }
        }

        if (alarm_number) {
            whereClauses.push(`LOWER(translate(fa.alarm_number, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramCounter++}, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`);
            queryParams.push(`%${alarm_number}%`);
        }

        if (location) {
            whereClauses.push(`LOWER(translate(fa.location, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramCounter++}, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`);
            queryParams.push(`%${location}%`);
        }

        if (recorded_by) {
            whereClauses.push(`LOWER(translate(COALESCE(NULLIF(CONCAT_WS(' ', pr.first_name, pr.last_name), ''), fa.recorded_by_name, ''), 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramCounter++}, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`);
            queryParams.push(`%${recorded_by}%`);
        }

        if (resolved_by) {
            whereClauses.push(`LOWER(translate(COALESCE(NULLIF(CONCAT_WS(' ', ps.first_name, ps.last_name), ''), fa.resolved_by_name, ''), 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramCounter++}, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`);
            queryParams.push(`%${resolved_by}%`);
        }

        if (gate && gate !== 'all') {
            whereClauses.push(`fa.gate = $${paramCounter++}`);
            queryParams.push(gate);
        }

        if (false_alarm === 'true') {
            whereClauses.push(`fa.false_alarm = true`);
        } else if (false_alarm === 'false') {
            whereClauses.push(`fa.false_alarm = false`);
        }

        if (alarmDateStart) {
            whereClauses.push(`fa.alarm_time >= $${paramCounter++}::timestamp`);
            queryParams.push(`${alarmDateStart} 00:00:00`);
        }
        if (alarmDateEnd) {
            whereClauses.push(`fa.alarm_time <= $${paramCounter++}::timestamp`);
            queryParams.push(`${alarmDateEnd} 23:59:59.999`);
        }

        if (resolutionDateStart) {
            whereClauses.push(`fa.resolution_time >= $${paramCounter++}::timestamp`);
            queryParams.push(`${resolutionDateStart} 00:00:00`);
        }
        if (resolutionDateEnd) {
            whereClauses.push(`fa.resolution_time <= $${paramCounter++}::timestamp`);
            queryParams.push(`${resolutionDateEnd} 23:59:59.999`);
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        let paginationString = `LIMIT ${MAX_EXPORT_ROWS + 1}`;
        if (!unlimited) {
            const offset = req.query.offset === undefined
                ? (page - 1) * requestedLimit
                : requestedOffset;
            paginationString = `LIMIT $${paramCounter++} OFFSET $${paramCounter++}`;
            queryParams.push(requestedLimit, offset);
        }

        const query = `
            SELECT 
                COUNT(*) OVER()::int AS total_count,
                fa.id,
                fa.alarm_number,
                fa.location,
                fa.gate,
                fa.alarm_time,
                fa.resolved,
                fa.resolution_time,
                fa.resolution_notes,
                fa.false_alarm,
                fa.created_at,
                fa.deleted_at,
                COALESCE(NULLIF(CONCAT_WS(' ', pr.first_name, pr.last_name), ''), fa.recorded_by_name) as recorded_by_name,
                COALESCE(NULLIF(CONCAT_WS(' ', ps.first_name, ps.last_name), ''), fa.resolved_by_name) as resolved_by_name
            FROM fire_alarms fa
            LEFT JOIN personnel pr ON fa.recorded_by = pr.id
            LEFT JOIN personnel ps ON fa.resolved_by = ps.id
            ${whereString}
            ORDER BY fa.alarm_time DESC, fa.id DESC
            ${paginationString}
        `;

        const result = await pool.query(query, queryParams);
        if (unlimited && result.rows.length > MAX_EXPORT_ROWS) {
            res.status(413).json({ success: false, message: 'İndirme sonucu çok büyük; lütfen tarih aralığını daraltın' });
            return;
        }
        const total = Number(result.rows[0]?.total_count ?? 0);
        const data = result.rows.map(({ total_count: _totalCount, ...row }) => row);
        res.setHeader('X-Total-Count', String(total));
        res.json({ success: true, data, total });
    } catch (error) {
        console.error('Get fire alarms error:', error);
        res.status(500).json({ success: false, message: 'Yangın alarm kayıtları alınamadı' });
    }
};

// Yeni yangın alarm kaydı oluştur
export const createFireAlarm = async (req: Request, res: Response) => {
    try {
        if (!isRequestBodyObject(req.body)) {
            res.status(400).json({ success: false, message: 'Geçersiz istek gövdesi' });
            return;
        }
        const { alarm_number, location, alarm_time, false_alarm, resolution_notes } = req.body;
        const userId = req.user?.userId;
        const clientIp = getClientIp(req);
        const gate = await getResolvedGateFromRequest(req);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
        }

        if (typeof location !== 'string' || !location.trim()) {
            return res.status(400).json({ success: false, message: 'Konum gereklidir' });
        }

        if (!isValidOptionalText(alarm_number, 50)
            || !isValidOptionalText(resolution_notes, 1000)
            || !isValidOptionalBoolean(false_alarm)
            || (alarm_time !== undefined && alarm_time !== null && (typeof alarm_time !== 'string' || !TIME_PATTERN.test(alarm_time)))) {
            return res.status(400).json({ success: false, message: 'Alarm saati HH:MM formatında olmalıdır' });
        }

        const sanitizedAlarmNumber = typeof alarm_number === 'string' ? sanitizeAlarmText(alarm_number, 50) : null;
        const sanitizedLocation = sanitizeAlarmText(location, 255);
        const sanitizedNotes = typeof resolution_notes === 'string' ? sanitizeAlarmText(resolution_notes, 1000) : null;

        if (!sanitizedLocation) {
            return res.status(400).json({ success: false, message: 'Geçersiz konum' });
        }

        const id = uuidv4();

        const result = await pool.query(
            `INSERT INTO fire_alarms (
                id, alarm_number, location, alarm_time, false_alarm, 
                resolution_notes, recorded_by, gate
            ) VALUES ($1, $2, $3, 
                CURRENT_DATE + COALESCE($4::time, CURRENT_TIME), 
                $5, $6, $7, $8) 
            RETURNING *`,
            [id, sanitizedAlarmNumber, sanitizedLocation, alarm_time || null, false_alarm === true, sanitizedNotes, userId, gate]
        );

        await logDataChange(
            'fire_alarms',
            id,
            'INSERT',
            null,
            { alarm_number: sanitizedAlarmNumber, location: sanitizedLocation, alarm_time },
            userId,
            clientIp
        );

        // WhatsApp mesaj şablonu oluştur
        let whatsappMessage = '';
        try {
            const alarmDateTime = result.rows[0].alarm_time;
            const timeString = new Date(alarmDateTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            whatsappMessage = createFireAlarmMessage({
                alarmNumber: sanitizedAlarmNumber || 'Belirtilmemiş',
                location: sanitizedLocation,
                alarmTime: timeString,
                notes: sanitizedNotes || undefined
            });
        } catch (error) {
            console.error('WhatsApp mesaj oluşturma hatası:', error);
        }

        res.status(201).json({ success: true, data: result.rows[0], whatsappMessage });

    } catch (error) {
        console.error('Create fire alarm error:', error);
        res.status(500).json({ success: false, message: 'Yangın alarm kaydı oluşturulamadı' });
    }
};

// Yangın alarm kaydını güncelle
export const updateFireAlarm = async (req: Request, res: Response) => {
    try {
        if (!isRequestBodyObject(req.body)) {
            res.status(400).json({ success: false, message: 'Geçersiz istek gövdesi' });
            return;
        }
        const { id } = req.params;
        const { alarm_number, location, alarm_time, false_alarm, resolution_notes, resolution_time } = req.body;
        const userId = req.user?.userId;
        const clientIp = getClientIp(req);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
        }

        if (!isValidUUID(id)) {
            return res.status(400).json({ success: false, message: 'Geçersiz ID' });
        }

        if (!isValidOptionalText(alarm_number, 50)
            || !isValidOptionalText(location, 255)
            || !isValidOptionalText(resolution_notes, 1000)
            || !isValidOptionalBoolean(false_alarm)
            || (alarm_time !== undefined && alarm_time !== null && (typeof alarm_time !== 'string' || !TIME_PATTERN.test(alarm_time)))
            || (resolution_time !== undefined && resolution_time !== null && (typeof resolution_time !== 'string' || !TIME_PATTERN.test(resolution_time)))) {
            return res.status(400).json({ success: false, message: 'Geçersiz alarm kaydı alanı' });
        }

        // Mevcut kaydı al
        const existing = await pool.query(
            'SELECT * FROM fire_alarms WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
        }

        const sanitizedAlarmNumber = alarm_number === undefined
            ? existing.rows[0].alarm_number
            : (typeof alarm_number === 'string' ? sanitizeAlarmText(alarm_number, 50) : null);
        const sanitizedLocation = location === undefined
            ? existing.rows[0].location
            : sanitizeAlarmText(location as string, 255);
        const sanitizedNotes = resolution_notes === undefined
            ? existing.rows[0].resolution_notes
            : (typeof resolution_notes === 'string' ? sanitizeAlarmText(resolution_notes, 1000) : null);

        if (!sanitizedLocation) {
            res.status(400).json({ success: false, message: 'Konum gereklidir' });
            return;
        }

        const result = await pool.query(
            `UPDATE fire_alarms 
             SET alarm_number = $1,
                 location = $2,
                 alarm_time = CASE 
                     WHEN $3::time IS NOT NULL THEN (alarm_time::date) + $3::time
                     ELSE alarm_time
                 END,
                 resolution_time = CASE 
                     WHEN $4::time IS NOT NULL THEN (COALESCE(resolution_time::date, CURRENT_DATE)) + $4::time
                     ELSE resolution_time
                 END,
                 false_alarm = $5,
                 resolution_notes = $6,
                 updated_at = NOW()
             WHERE id = $7 AND deleted_at IS NULL
             RETURNING *`,
            [
                sanitizedAlarmNumber,
                sanitizedLocation,
                alarm_time || null,
                resolution_time || null,
                false_alarm === undefined ? existing.rows[0].false_alarm : false_alarm,
                sanitizedNotes,
                id
            ]
        );

        if (result.rows.length === 0) {
            res.status(409).json({ success: false, message: 'Kayıt işlem sırasında değiştirildi' });
            return;
        }

        await logDataChange(
            'fire_alarms',
            id,
            'UPDATE',
            existing.rows[0],
            result.rows[0],
            userId,
            clientIp
        );

        res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        console.error('Update fire alarm error:', error);
        res.status(500).json({ success: false, message: 'Yangın alarm kaydı güncellenemedi' });
    }
};

// Yangın alarmını çözümle
export const resolveFireAlarm = async (req: Request, res: Response) => {
    try {
        if (!isRequestBodyObject(req.body)) {
            res.status(400).json({ success: false, message: 'Geçersiz istek gövdesi' });
            return;
        }
        const { id } = req.params;
        const { resolution_notes, false_alarm } = req.body;
        const userId = req.user?.userId;
        const clientIp = getClientIp(req);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
        }

        if (!isValidUUID(id)) {
            return res.status(400).json({ success: false, message: 'Geçersiz ID' });
        }

        if (!isValidOptionalText(resolution_notes, 1000) || !isValidOptionalBoolean(false_alarm)) {
            res.status(400).json({ success: false, message: 'Geçersiz çözüm bilgisi' });
            return;
        }

        // Mevcut kaydı al
        const existing = await pool.query(
            'SELECT * FROM fire_alarms WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
        }

        if (existing.rows[0].resolved) {
            return res.status(409).json({ success: false, message: 'Alarm zaten çözümlenmiş' });
        }

        const sanitizedNotes = typeof resolution_notes === 'string' ? sanitizeAlarmText(resolution_notes, 1000) : null;

        const result = await pool.query(
            `UPDATE fire_alarms 
             SET resolved = true,
                 resolution_time = NOW(),
                 resolution_notes = $1,
                 false_alarm = $2,
                 resolved_by = $4,
                 updated_at = NOW()
             WHERE id = $3 AND resolved = false AND deleted_at IS NULL
             RETURNING *`,
            [sanitizedNotes, false_alarm === true, id, userId]
        );

        if (result.rows.length === 0) {
            res.status(409).json({ success: false, message: 'Alarm işlem sırasında çözümlendi veya silindi' });
            return;
        }

        await logDataChange(
            'fire_alarms',
            id,
            'UPDATE',
            existing.rows[0],
            { resolved: true, resolution_time: new Date(), resolution_notes: sanitizedNotes },
            userId,
            clientIp
        );

        // WhatsApp mesaj şablonu oluştur
        let whatsappMessage = '';
        try {
            const resolutionDate = new Date(result.rows[0].resolution_time);
            const resolutionTimeString = resolutionDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

            // Orijinal alarm saatini de al
            const alarmDateTime = existing.rows[0].alarm_time;
            const alarmTimeString = alarmDateTime
                ? new Date(alarmDateTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                : undefined;

            whatsappMessage = createFireAlarmResolveMessage({
                alarmNumber: result.rows[0].alarm_number || 'Belirtilmemiş',
                location: result.rows[0].location,
                alarmTime: alarmTimeString,
                resolutionTime: resolutionTimeString,
                resolutionNotes: sanitizedNotes || undefined,
                falseAlarm: !!false_alarm
            });
        } catch (error) {
            console.error('WhatsApp mesaj oluşturma hatası:', error);
        }

        res.json({ success: true, data: result.rows[0], whatsappMessage });

    } catch (error) {
        console.error('Resolve fire alarm error:', error);
        res.status(500).json({ success: false, message: 'Yangın alarm çözümlenemedi' });
    }
};

// Çözümleme işlemini geri al (alarmı tekrar aktif yap)
export const undoResolveFireAlarm = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const clientIp = getClientIp(req);

        if (!userId) {
            res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
            return;
        }

        if (!isValidUUID(id)) {
            return res.status(400).json({ success: false, message: 'Geçersiz ID' });
        }

        const existing = await pool.query(
            'SELECT * FROM fire_alarms WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
        }

        if (!existing.rows[0].resolved) {
            return res.status(400).json({ success: false, message: 'Sadece çözülen alarmlar geri alınabilir' });
        }

        const result = await pool.query(
            `UPDATE fire_alarms
             SET resolved = false,
                 resolution_time = NULL,
                 resolution_notes = NULL,
             false_alarm = false,
                 resolved_by = NULL,
                 resolved_by_name = NULL,
                 updated_at = NOW()
             WHERE id = $1 AND resolved = true AND deleted_at IS NULL
             RETURNING *`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(409).json({ success: false, message: 'Kayıt işlem sırasında değiştirildi' });
        }

        await logDataChange(
            'fire_alarms',
            id,
            'UPDATE',
            existing.rows[0],
            { resolved: false, resolution_time: null, resolution_notes: null },
            userId,
            clientIp
        );

        res.status(200).json({ success: true, data: result.rows[0], message: 'Alarm tekrar aktif hale getirildi' });

    } catch (error) {
        console.error('Undo resolve fire alarm error:', error);
        return res.status(500).json({ success: false, message: 'Çözümleme geri alınırken hata oluştu' });
    }
};

// Yangın alarm kaydını soft-delete yap
export const deleteFireAlarm = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const clientIp = getClientIp(req);

        if (!userId) {
            res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
            return;
        }

        if (!isValidUUID(id)) {
            return res.status(400).json({ success: false, message: 'Geçersiz ID' });
        }

        const existing = await pool.query('SELECT id, deleted_at FROM fire_alarms WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
        }

        if (existing.rows[0].deleted_at) {
            return res.status(400).json({ success: false, message: 'Kayıt zaten silinmiş' });
        }

        const deletionResult = await pool.query(
            `UPDATE fire_alarms
             SET deleted_at = CURRENT_TIMESTAMP,
                 updated_at = NOW()
             WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        );

        if (deletionResult.rowCount !== 1) {
            return res.status(409).json({ success: false, message: 'Kayıt işlem sırasında değiştirildi' });
        }

        await logDataChange(
            'fire_alarms',
            id,
            'SOFT_DELETE',
            { deleted_at: null },
            { deleted_at: 'CURRENT_TIMESTAMP' },
            userId,
            clientIp
        );

        return res.status(200).json({ success: true, message: 'Kayıt silindi' });
    } catch (error) {
        console.error('Delete fire alarm error:', error);
        return res.status(500).json({ success: false, message: 'Kayıt silinirken hata oluştu' });
    }
};

// Yangın alarm kaydını geri al
export const restoreFireAlarm = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId;
        const clientIp = getClientIp(req);

        if (!userId) {
            res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
            return;
        }

        if (!isValidUUID(id)) {
            return res.status(400).json({ success: false, message: 'Geçersiz ID' });
        }

        const existing = await pool.query('SELECT id, deleted_at FROM fire_alarms WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
        }

        if (!existing.rows[0].deleted_at) {
            return res.status(400).json({ success: false, message: 'Kayıt zaten aktif' });
        }

        const restoreResult = await pool.query(
            `UPDATE fire_alarms
             SET deleted_at = NULL,
                 updated_at = NOW()
             WHERE id = $1 AND deleted_at IS NOT NULL`,
            [id]
        );

        if (restoreResult.rowCount !== 1) {
            return res.status(409).json({ success: false, message: 'Kayıt işlem sırasında değiştirildi' });
        }

        await logDataChange(
            'fire_alarms',
            id,
            'UPDATE',
            { deleted_at: 'TIMESTAMP' },
            { deleted_at: null },
            userId,
            clientIp
        );

        return res.status(200).json({ success: true, message: 'Kayıt geri alındı' });
    } catch (error) {
        console.error('Restore fire alarm error:', error);
        return res.status(500).json({ success: false, message: 'Kayıt geri alınırken hata oluştu' });
    }
};

// WhatsApp mesajını otomatik gönder (modal tetiklemeli)
export const sendFireAlarmWhatsAppMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!isRequestBodyObject(req.body)) {
            res.status(400).json({ success: false, message: 'Geçersiz istek gövdesi' });
            return;
        }
        const { message } = req.body;

        if (!message || typeof message !== 'string' || !message.trim() || message.length > 4_000) {
            res.status(400).json({
                success: false,
                message: 'Mesaj içeriği gereklidir.',
            });
            return;
        }

        const result = await sendWhatsAppTextMessage(message.trim());
        res.status(200).json(result);
    } catch (error) {
        console.error('Send fire alarm WhatsApp message error:', error);
        res.status(500).json({
            success: false,
            message: 'WhatsApp mesajı gönderilirken hata oluştu.',
        });
    }
};
