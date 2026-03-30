import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizeInput, isValidLength } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { createFireAlarmMessage, createFireAlarmResolveMessage } from '../services/whatsapp';

// Tüm yangın alarm kayıtlarını getir
export const getFireAlarms = async (req: Request, res: Response) => {
    try {
        const includeDeleted = req.query.includeDeleted === 'true';
        const deletedAtSelect = includeDeleted ? 'fa.deleted_at,' : '';
        const deletedAtFilter = includeDeleted ? '' : 'WHERE fa.deleted_at IS NULL';

        const result = await pool.query(`
            SELECT 
                fa.id,
                fa.alarm_number,
                fa.location,
                fa.alarm_time,
                fa.resolved,
                fa.resolution_time,
                fa.resolution_notes,
                fa.false_alarm,
                fa.created_at,
                ${deletedAtSelect}
                pr.first_name || ' ' || pr.last_name as recorded_by_name,
                ps.first_name || ' ' || ps.last_name as resolved_by_name
            FROM fire_alarms fa
            LEFT JOIN personnel pr ON fa.recorded_by = pr.id
            LEFT JOIN personnel ps ON fa.resolved_by = ps.id
            ${deletedAtFilter}
            ORDER BY fa.created_at DESC
            LIMIT 1000
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Get fire alarms error:', error);
        res.status(500).json({ success: false, message: 'Yangın alarm kayıtları alınamadı' });
    }
};

// Yeni yangın alarm kaydı oluştur
export const createFireAlarm = async (req: Request, res: Response) => {
    try {
        const { alarm_number, location, alarm_time, false_alarm, resolution_notes } = req.body;
        const userId = req.user?.userId;
        const clientIp = getClientIp(req);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
        }

        if (!location) {
            return res.status(400).json({ success: false, message: 'Konum gereklidir' });
        }

        // Time validasyonu
        if (alarm_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(alarm_time)) {
            return res.status(400).json({ success: false, message: 'Alarm saati HH:MM formatında olmalıdır' });
        }

        // Input sanitizasyonu
        const sanitizedAlarmNumber = alarm_number ? sanitizeInput(alarm_number, 50) : null;
        const sanitizedLocation = sanitizeInput(location, 255);
        const sanitizedNotes = resolution_notes ? sanitizeInput(resolution_notes, 1000) : null;

        if (!sanitizedLocation) {
            return res.status(400).json({ success: false, message: 'Geçersiz konum' });
        }

        if (!isValidLength(sanitizedLocation, 1, 255)) {
            return res.status(400).json({ success: false, message: 'Konum 1-255 karakter arası olmalıdır' });
        }

        const id = uuidv4();

        const result = await pool.query(
            `INSERT INTO fire_alarms (
                id, alarm_number, location, alarm_time, false_alarm, 
                resolution_notes, recorded_by
            ) VALUES ($1, $2, $3, 
                CURRENT_DATE + COALESCE($4::time, CURRENT_TIME), 
                $5, $6, $7) 
            RETURNING *`,
            [id, sanitizedAlarmNumber, sanitizedLocation, alarm_time || null, !!false_alarm, sanitizedNotes, userId]
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

        // Time validasyonu
        if (alarm_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(alarm_time)) {
            return res.status(400).json({ success: false, message: 'Alarm saati HH:MM formatında olmalıdır' });
        }

        if (resolution_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(resolution_time)) {
            return res.status(400).json({ success: false, message: 'Çözüm saati HH:MM formatında olmalıdır' });
        }

        // Mevcut kaydı al
        const existing = await pool.query(
            'SELECT * FROM fire_alarms WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
        }

        // Input sanitizasyonu
        const sanitizedAlarmNumber = alarm_number !== undefined ? (alarm_number ? sanitizeInput(alarm_number, 50) : null) : existing.rows[0].alarm_number;
        const sanitizedLocation = location ? sanitizeInput(location, 255) : existing.rows[0].location;
        const sanitizedNotes = resolution_notes ? sanitizeInput(resolution_notes, 1000) : existing.rows[0].resolution_notes;

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
             WHERE id = $7 
             RETURNING *`,
            [sanitizedAlarmNumber, sanitizedLocation, alarm_time || null, resolution_time || null, !!false_alarm, sanitizedNotes, id]
        );

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

        // Mevcut kaydı al
        const existing = await pool.query(
            'SELECT * FROM fire_alarms WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
        }

        const sanitizedNotes = resolution_notes ? sanitizeInput(resolution_notes, 1000) : null;

        const result = await pool.query(
            `UPDATE fire_alarms 
             SET resolved = true,
                 resolution_time = NOW(),
                 resolution_notes = $1,
                 false_alarm = $2,
                 resolved_by = $4,
                 updated_at = NOW()
             WHERE id = $3 
             RETURNING *`,
            [sanitizedNotes, !!false_alarm, id, userId]
        );

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
            const timeString = resolutionDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            whatsappMessage = createFireAlarmResolveMessage({
                alarmNumber: result.rows[0].alarm_number || 'Belirtilmemiş',
                location: result.rows[0].location,
                resolutionTime: timeString,
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

// Yangın alarm kaydını soft-delete yap
export const deleteFireAlarm = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId || null;
        const clientIp = getClientIp(req);

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

        await pool.query(
            `UPDATE fire_alarms
             SET deleted_at = CURRENT_TIMESTAMP,
                 updated_at = NOW()
             WHERE id = $1`,
            [id]
        );

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
        const userId = req.user?.userId || null;
        const clientIp = getClientIp(req);

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

        await pool.query(
            `UPDATE fire_alarms
             SET deleted_at = NULL,
                 updated_at = NOW()
             WHERE id = $1`,
            [id]
        );

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
