import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizeInput, isValidLength } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { createFireAlarmMessage, createFireAlarmResolveMessage } from '../services/whatsapp';

// Tüm yangın alarm kayıtlarını getir
export const getFireAlarms = async (_req: Request, res: Response) => {
    try {
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
                p.first_name || ' ' || p.last_name as recorded_by_name
            FROM fire_alarms fa
            LEFT JOIN personnel p ON fa.recorded_by = p.id
            WHERE fa.deleted_at IS NULL 
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
        const alarmTime = alarm_time || new Date();

        const result = await pool.query(
            `INSERT INTO fire_alarms (
                id, alarm_number, location, alarm_time, false_alarm, 
                resolution_notes, recorded_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
            RETURNING *`,
            [id, sanitizedAlarmNumber, sanitizedLocation, alarmTime, !!false_alarm, sanitizedNotes, userId]
        );

        await logDataChange(
            'fire_alarms',
            id,
            'INSERT',
            null,
            { alarm_number: sanitizedAlarmNumber, location: sanitizedLocation, alarm_time: alarmTime },
            userId,
            clientIp
        );

        // WhatsApp mesaj şablonu oluştur
        let whatsappMessage = '';
        try {
            const alarmDate = new Date(alarmTime);
            const timeString = alarmDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
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
        const { alarm_number, location, false_alarm, resolution_notes } = req.body;
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

        // Input sanitizasyonu
        const sanitizedAlarmNumber = alarm_number !== undefined ? (alarm_number ? sanitizeInput(alarm_number, 50) : null) : existing.rows[0].alarm_number;
        const sanitizedLocation = location ? sanitizeInput(location, 255) : existing.rows[0].location;
        const sanitizedNotes = resolution_notes ? sanitizeInput(resolution_notes, 1000) : existing.rows[0].resolution_notes;

        const result = await pool.query(
            `UPDATE fire_alarms 
             SET alarm_number = $1,
                 location = $2, 
                 false_alarm = $3,
                 resolution_notes = $4,
                 updated_at = NOW()
             WHERE id = $5 
             RETURNING *`,
            [sanitizedAlarmNumber, sanitizedLocation, !!false_alarm, sanitizedNotes, id]
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
                 updated_at = NOW()
             WHERE id = $3 
             RETURNING *`,
            [sanitizedNotes, !!false_alarm, id]
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
