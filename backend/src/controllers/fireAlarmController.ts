import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizeInput, isValidLength } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { createFireAlarmMessage, createFireAlarmResolveMessage } from '../services/whatsapp';
import { sendWhatsAppTextMessage } from '../services/whatsappBaileys';
import { getResolvedGateFromRequest } from '../utils/gate';
import { emitApiMutation, resolveMutationTopics } from '../realtime/socket';

// Tüm yangın alarm kayıtlarını getir
export const getFireAlarms = async (req: Request, res: Response) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const includeDeleted = req.query.includeDeleted === 'true';
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limitQuery = req.query.limit;
        const offsetQuery = req.query.offset;
        const unlimited = req.query.unlimited === 'true';

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
            whereClauses.push(`translate(lower(fa.alarm_number), 'çğıöşüı', 'cgiosui') LIKE $${paramCounter++}`);
            queryParams.push(`%${alarm_number.toLowerCase()}%`);
        }

        if (location) {
            whereClauses.push(`translate(lower(fa.location), 'çğıöşüı', 'cgiosui') LIKE $${paramCounter++}`);
            queryParams.push(`%${location.toLowerCase()}%`);
        }

        if (recorded_by) {
            whereClauses.push(`translate(lower(pr.first_name || ' ' || pr.last_name), 'çğıöşüı', 'cgiosui') LIKE $${paramCounter++}`);
            queryParams.push(`%${recorded_by.toLowerCase()}%`);
        }

        if (resolved_by) {
            whereClauses.push(`translate(lower(ps.first_name || ' ' || ps.last_name), 'çğıöşüı', 'cgiosui') LIKE $${paramCounter++}`);
            queryParams.push(`%${resolved_by.toLowerCase()}%`);
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

        let paginationString = '';
        if (!unlimited) {
            const limit = Math.max(Number(limitQuery) || 200, 1);
            const offset = Math.max(Number(offsetQuery) || 0, 0);
            paginationString = `LIMIT $${paramCounter++} OFFSET $${paramCounter++}`;
            queryParams.push(limit, offset);
        }

        const query = `
            SELECT 
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
                pr.first_name || ' ' || pr.last_name as recorded_by_name,
                ps.first_name || ' ' || ps.last_name as resolved_by_name
            FROM fire_alarms fa
            LEFT JOIN personnel pr ON fa.recorded_by = pr.id
            LEFT JOIN personnel ps ON fa.resolved_by = ps.id
            ${whereString}
            ORDER BY fa.created_at DESC, fa.id DESC
            ${paginationString}
        `;

        const result = await pool.query(query, queryParams);
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
        const gate = await getResolvedGateFromRequest(req);

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
                resolution_notes, recorded_by, gate
            ) VALUES ($1, $2, $3, 
                CURRENT_DATE + COALESCE($4::time, CURRENT_TIME), 
                $5, $6, $7, $8) 
            RETURNING *`,
            [id, sanitizedAlarmNumber, sanitizedLocation, alarm_time || null, !!false_alarm, sanitizedNotes, userId, gate]
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

        emitApiMutation({
            method: 'POST',
            path: '/api/fire-alarms/records',
            statusCode: 201,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics('/api/fire-alarms/records'),
        });
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

        emitApiMutation({
            method: 'PUT',
            path: `/api/fire-alarms/records/${id}`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/fire-alarms/records/${id}`),
        });
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

        emitApiMutation({
            method: 'POST',
            path: `/api/fire-alarms/records/${id}/resolve`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/fire-alarms/records/${id}/resolve`),
        });
    } catch (error) {
        console.error('Resolve fire alarm error:', error);
        res.status(500).json({ success: false, message: 'Yangın alarm çözümlenemedi' });
    }
};

// Çözümleme işlemini geri al (alarmı tekrar aktif yap)
export const undoResolveFireAlarm = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId || null;
        const clientIp = getClientIp(req);

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
             WHERE id = $1
             RETURNING *`,
            [id]
        );

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

        emitApiMutation({
            method: 'POST',
            path: `/api/fire-alarms/records/${id}/undo-resolve`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/fire-alarms/records/${id}/undo-resolve`),
        });
    } catch (error) {
        console.error('Undo resolve fire alarm error:', error);
        return res.status(500).json({ success: false, message: 'Çözümleme geri alınırken hata oluştu' });
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

        emitApiMutation({
            method: 'DELETE',
            path: `/api/fire-alarms/records/${id}`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/fire-alarms/records/${id}`),
        });

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

        emitApiMutation({
            method: 'POST',
            path: `/api/fire-alarms/records/${id}/restore`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/fire-alarms/records/${id}/restore`),
        });

        return res.status(200).json({ success: true, message: 'Kayıt geri alındı' });
    } catch (error) {
        console.error('Restore fire alarm error:', error);
        return res.status(500).json({ success: false, message: 'Kayıt geri alınırken hata oluştu' });
    }
};

// WhatsApp mesajını otomatik gönder (modal tetiklemeli)
export const sendFireAlarmWhatsAppMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const { message } = req.body;

        if (!message || typeof message !== 'string' || !message.trim()) {
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
