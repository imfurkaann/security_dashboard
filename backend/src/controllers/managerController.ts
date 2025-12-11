import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get all manager records with joins
 * GET /api/managers/records
 */
export const getManagerRecords = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = `
            SELECT
                mr.id,
                mr.manager_id,
                mr.manager_name,
                    mr.recorded_by_name,
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
                p.first_name as personnel_first_name,
                p.last_name as personnel_last_name
            FROM managers_records mr
            LEFT JOIN managers m ON mr.manager_id = m.id
            LEFT JOIN personnel p ON mr.recorded_by = p.id
            WHERE mr.deleted_at IS NULL
            ORDER BY mr.entry_date DESC, mr.entry_time DESC
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
            personnel: row.recorded_by_name || ((row.personnel_first_name || row.personnel_last_name) ? `${row.personnel_first_name || ''} ${row.personnel_last_name || ''}`.trim() : null),
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
        const { manager_id, notes } = req.body;
        const recorded_by = (req as any).user?.userId || null;

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!manager_id || !uuidRegex.test(manager_id)) {
            res.status(400).json({ success: false, message: 'Geçerli bir müdür kimliği gereklidir' });
            return;
        }

        if (!recorded_by) {
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

        // Insert with minimal required fields; other columns have defaults
        // fetch recorder's name from personnel table when possible
        let recordedByName: string | null = null;
        try {
            const pRes = await pool.query('SELECT first_name, last_name FROM personnel WHERE id = $1', [recorded_by]);
            if (pRes.rows.length > 0) {
                recordedByName = `${pRes.rows[0].first_name || ''} ${pRes.rows[0].last_name || ''}`.trim();
            }
        } catch (err) {
            // ignore and keep recordedByName null
            console.warn('Could not fetch recorder name for managers_records:', err);
        }

        await pool.query('BEGIN');
        await pool.query(
            `INSERT INTO managers_records (
                id, manager_id, manager_name, recorded_by, recorded_by_name, entry_date, entry_time, status, notes
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, CURRENT_TIME, 'inside', $6)`,
            [id, manager_id, `${managerCheck.rows[0].first_name} ${managerCheck.rows[0].last_name}`, recorded_by, recordedByName, notes || null]
        );
        await pool.query('COMMIT');

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
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
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

        await pool.query(
            `UPDATE managers_records SET exit_date = CURRENT_DATE, exit_time = CURRENT_TIME, status = 'exited', updated_at = now() WHERE id = $1 AND deleted_at IS NULL`,
            [id]
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
        const { notes } = req.body;

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
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
