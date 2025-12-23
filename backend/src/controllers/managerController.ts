import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizeInput } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';

/**
 * Get all manager records with joins
 * GET /api/managers/records
 */
export const getManagerRecords = async (_req: Request, res: Response): Promise<void> => {
    try {
        const query = `
            SELECT
                mr.id,
                mr.manager_id,
                mr.manager_name,
                mr.entry_date,
                mr.entry_time,
                mr.exit_date,
                mr.exit_time,
                mr.status,
                mr.notes,
                mr.created_at,
                m.first_name as manager_first_name,
                m.last_name as manager_last_name,
                m.title as manager_title,
                pe.first_name as entry_by_first_name,
                pe.last_name as entry_by_last_name,
                pe.first_name as entry_by_name_first,
                pe.last_name as entry_by_name_last,
                px.first_name as exit_by_first_name,
                px.last_name as exit_by_last_name,
                px.first_name as exit_by_name_first,
                px.last_name as exit_by_name_last
            FROM managers_records mr
            LEFT JOIN managers m ON mr.manager_id = m.id
            LEFT JOIN personnel pe ON mr.entry_by = pe.id
            LEFT JOIN personnel px ON mr.exit_by = px.id
            WHERE mr.deleted_at IS NULL
            ORDER BY mr.entry_date DESC, mr.entry_time DESC
            LIMIT 1000
        `;

        const result = await pool.query(query);

        const formatted = result.rows.map((row: any) => ({
            id: row.id,
            manager_id: row.manager_id,
            manager_name: row.manager_name,
            // prefer stored manager_name if available, otherwise use joined manager fields
            manager: row.manager_name || (row.manager_first_name || row.manager_last_name ? `${row.manager_first_name || ''} ${row.manager_last_name || ''}`.trim() : null),
            manager_title: row.manager_title,
            entry_date: row.entry_date,
            entry_time: row.entry_time,
            exit_date: row.exit_date,
            exit_time: row.exit_time,
            status: row.status,
            notes: row.notes,
            entry_by: (row.entry_by_first_name || row.entry_by_last_name) ? `${row.entry_by_first_name || ''} ${row.entry_by_last_name || ''}`.trim() : null,
            exit_by: (row.exit_by_first_name || row.exit_by_last_name) ? `${row.exit_by_first_name || ''} ${row.exit_by_last_name || ''}`.trim() : null,
            created_at: row.created_at
        }));

        res.status(200).json(formatted);
    } catch (error) {
        console.error('Get manager records error:', error);
        res.status(500).json({ success: false, message: 'Müdür kayıtları listelenirken hata oluştu' });
    }
};


/**
 * Create new manager record
 * POST /api/managers/records
 */
export const createManagerRecord = async (req: Request, res: Response): Promise<void> => {
    try {
        const { manager_id, notes, entry_time } = req.body;
        const entry_by = req.user?.userId || null;
        const clientIp = getClientIp(req);

        // GÜVENLİK: Input sanitization
        const sanitizedNotes = sanitizeInput(notes, 1000);

        // Time validation (optional, HH:MM format)
        if (entry_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(entry_time)) {
            res.status(400).json({ success: false, message: 'Giriş saati HH:MM formatında olmalıdır' });
            return;
        }

        // GÜVENLİK: UUID validasyonu
        if (!manager_id || !isValidUUID(manager_id)) {
            res.status(400).json({ success: false, message: 'Geçerli bir müdür kimliği gereklidir' });
            return;
        }

        if (!entry_by) {
            res.status(401).json({ success: false, message: 'Kullanıcı doğrulanmadı. Lütfen giriş yapın.' });
            return;
        }

        // Ensure manager exists and is active
        const managerCheck = await pool.query('SELECT id, first_name, last_name FROM managers WHERE id = $1 AND deleted_at IS NULL AND is_active = true', [manager_id]);
        if (managerCheck.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Müdür bulunamadı' });
            return;
        }

        const id = uuidv4();

        const managerName = `${managerCheck.rows[0].first_name} ${managerCheck.rows[0].last_name}`;

        await pool.query('BEGIN');
        await pool.query(
            `INSERT INTO managers_records (
                id, manager_id, manager_name, entry_by, entry_date, entry_time, status, notes
            ) VALUES ($1, $2, $3, $4, CURRENT_DATE, COALESCE($6::time, CURRENT_TIME), 'inside', $5)`,
            [id, manager_id, managerName, entry_by, sanitizedNotes, entry_time || null]
        );
        await pool.query('COMMIT');

        // GÜVENLİK: Audit log kaydı
        await logDataChange(
            'managers_records',
            id,
            'INSERT',
            null,
            { manager_id, manager_name: managerName },
            entry_by,
            clientIp
        );

        res.status(201).json({ success: true, message: 'Müdür kaydı oluşturuldu', data: { id } });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Create manager record error:', error instanceof Error ? error.message : error);
        res.status(500).json({ success: false, message: 'Müdür kaydı oluşturulurken hata oluştu' });
    }
};


/**
 * Exit manager (mark exit_date/exit_time and status)
 * POST /api/managers/records/:id/exit
 */
export const exitManager = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { exit_time } = req.body;
        const clientIp = getClientIp(req);

        // Time validation (optional, HH:MM format)
        if (exit_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(exit_time)) {
            res.status(400).json({ success: false, message: 'Çıkış saati HH:MM formatında olmalıdır' });
            return;
        }

        // GÜVENLİK: UUID validasyonu
        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        const recordCheck = await pool.query('SELECT id, status FROM managers_records WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (recordCheck.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        if (recordCheck.rows[0].status !== 'inside') {
            res.status(400).json({ success: false, message: 'Müdür zaten çıkış yapmış' });
            return;
        }

        const exit_by = req.user?.userId;

        await pool.query(
            `UPDATE managers_records 
             SET exit_date = CURRENT_DATE, 
                 exit_time = COALESCE($3::time, CURRENT_TIME), 
                 exit_by = $2,
                 status = 'exited', 
                 updated_at = now() 
             WHERE id = $1 AND deleted_at IS NULL`,
            [id, exit_by, exit_time || null]
        );

        // GÜVENLİK: Audit log kaydı
        await logDataChange(
            'managers_records',
            id,
            'UPDATE',
            { status: 'inside' },
            { status: 'exited' },
            req.user?.userId || null,
            clientIp
        );

        res.status(200).json({ success: true, message: 'Çıkış kaydedildi' });
    } catch (error) {
        console.error('Exit manager error:', error);
        res.status(500).json({ success: false, message: 'Çıkış kaydedilirken hata oluştu' });
    }
};


/**
 * Update manager record (partial update)
 * PUT /api/managers/records/:id
 */
export const updateManagerRecord = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { notes, entry_time, exit_time } = req.body;
        const clientIp = getClientIp(req);

        // Time validation
        if (entry_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(entry_time)) {
            res.status(400).json({ success: false, message: 'Giriş saati HH:MM formatında olmalıdır' });
            return;
        }
        if (exit_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(exit_time)) {
            res.status(400).json({ success: false, message: 'Çıkış saati HH:MM formatında olmalıdır' });
            return;
        }

        // GÜVENLİK: UUID validasyonu
        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        const recordCheck = await pool.query('SELECT id FROM managers_records WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (recordCheck.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        const updates: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (notes !== undefined) { updates.push(`notes = $${idx++}`); params.push(notes || null); }
        if (entry_time !== undefined) { updates.push(`entry_time = $${idx++}`); params.push(entry_time || null); }
        if (exit_time !== undefined) { updates.push(`exit_time = $${idx++}`); params.push(exit_time || null); }

        if (updates.length === 0) {
            res.status(400).json({ success: false, message: 'Güncellenecek alan bulunamadı' });
            return;
        }

        const query = `UPDATE managers_records SET ${updates.join(', ')}, updated_at = now() WHERE id = $${idx} AND deleted_at IS NULL`;
        params.push(id);

        await pool.query(query, params);

        res.status(200).json({ success: true, message: 'Kayıt güncellendi' });
    } catch (error) {
        console.error('Update manager record error:', error);
        res.status(500).json({ success: false, message: 'Kayıt güncellenirken hata oluştu' });
    }
};
