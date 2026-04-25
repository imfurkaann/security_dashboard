import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizeInput, isValidDate } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { getResolvedGateFromRequest } from '../utils/gate';
import { emitApiMutation, resolveMutationTopics } from '../realtime/socket';

/**
 * Get all manager records with joins
 * GET /api/managers/records
 */
export const getManagerRecords = async (req: Request, res: Response): Promise<void> => {
    try {
        const includeDeleted = req.query.includeDeleted === 'true';
        const deletedAtSelect = includeDeleted ? 'mr.deleted_at,' : '';
        const deletedAtFilter = includeDeleted ? '' : 'WHERE mr.deleted_at IS NULL';

        const query = `
            SELECT
                mr.id,
                mr.manager_id,
                mr.manager_name,
                mr.gate,
                mr.entry_date,
                mr.entry_time,
                mr.exit_date,
                mr.exit_time,
                mr.status,
                mr.notes,
                mr.created_at,
                ${deletedAtSelect}
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
            ${deletedAtFilter}
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
            gate: row.gate,
            entry_date: row.entry_date,
            entry_time: row.entry_time,
            exit_date: row.exit_date,
            exit_time: row.exit_time,
            status: row.status,
            notes: row.notes,
            deleted_at: row.deleted_at || null,
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
 * Get all managers (not records)
 * GET /api/managers
 */
export const getAllManagers = async (_req: Request, res: Response): Promise<void> => {
    try {
        const query = `
            SELECT id, first_name, last_name, title, is_active, created_at, updated_at
            FROM managers
            WHERE deleted_at IS NULL
            ORDER BY first_name, last_name
        `;
        const result = await pool.query(query);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching managers:', error);
        res.status(500).json({
            success: false,
            message: 'Müdür verileri alınırken bir hata oluştu'
        });
    }
};

/**
 * Create new manager
 * POST /api/managers
 */
export const createManager = async (req: Request, res: Response): Promise<void> => {
    const client = await pool.connect();

    try {
        const { firstName, lastName, title } = req.body;
        const userId = (req as any).user?.userId;
        const clientIp = getClientIp(req);

        // Validate required fields
        if (!firstName || !lastName) {
            res.status(400).json({
                success: false,
                message: 'Ad ve soyad zorunludur'
            });
            return;
        }

        // Sanitize inputs
        const sanitizedFirstName = sanitizeInput(firstName, 50);
        const sanitizedLastName = sanitizeInput(lastName, 50);
        const sanitizedTitle = sanitizeInput(title, 100);

        if (!sanitizedFirstName || !sanitizedLastName) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz ad veya soyad'
            });
            return;
        }

        await client.query('BEGIN');

        // Insert manager
        const insertQuery = `
            INSERT INTO managers (first_name, last_name, title, is_active)
            VALUES ($1, $2, $3, true)
            RETURNING id, first_name, last_name, title, is_active, created_at
        `;
        const result = await client.query(insertQuery, [
            sanitizedFirstName,
            sanitizedLastName,
            sanitizedTitle || null
        ]);

        const newManager = result.rows[0];

        // Log the creation
        await logDataChange(
            'managers',
            newManager.id,
            'INSERT',
            null,
            {
                first_name: sanitizedFirstName,
                last_name: sanitizedLastName,
                title: sanitizedTitle
            },
            userId,
            clientIp
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Müdür başarıyla eklendi',
            data: newManager
        });

        emitApiMutation({
            method: 'POST',
            path: '/api/managers',
            statusCode: 201,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics('/api/managers'),
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating manager:', error);
        res.status(500).json({
            success: false,
            message: 'Müdür eklenirken bir hata oluştu'
        });
    } finally {
        client.release();
    }
};

/**
 * Update manager
 * PUT /api/managers/:id
 */
export const updateManager = async (req: Request, res: Response): Promise<void> => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { firstName, lastName, title, isActive } = req.body;
        const userId = (req as any).user?.userId;
        const clientIp = getClientIp(req);

        // Validate UUID
        if (!isValidUUID(id)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz müdür kimliği'
            });
            return;
        }

        // Validate required fields
        if (!firstName || !lastName) {
            res.status(400).json({
                success: false,
                message: 'Ad ve soyad zorunludur'
            });
            return;
        }

        // Sanitize inputs
        const sanitizedFirstName = sanitizeInput(firstName, 50);
        const sanitizedLastName = sanitizeInput(lastName, 50);
        const sanitizedTitle = sanitizeInput(title, 100);

        if (!sanitizedFirstName || !sanitizedLastName) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz ad veya soyad'
            });
            return;
        }

        await client.query('BEGIN');

        // Get old values
        const oldDataQuery = 'SELECT first_name, last_name, title, is_active FROM managers WHERE id = $1 AND deleted_at IS NULL';
        const oldData = await client.query(oldDataQuery, [id]);

        if (oldData.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({
                success: false,
                message: 'Müdür bulunamadı'
            });
            return;
        }

        // Update query
        const updateQuery = `
            UPDATE managers
            SET first_name = $1, last_name = $2, title = $3, is_active = $4, updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            RETURNING id, first_name, last_name, title, is_active, updated_at
        `;
        const result = await client.query(updateQuery, [
            sanitizedFirstName,
            sanitizedLastName,
            sanitizedTitle || null,
            isActive !== undefined ? isActive : true,
            id
        ]);

        const updatedManager = result.rows[0];

        // Log the update
        await logDataChange(
            'managers',
            id,
            'UPDATE',
            oldData.rows[0],
            {
                first_name: sanitizedFirstName,
                last_name: sanitizedLastName,
                title: sanitizedTitle,
                is_active: isActive !== undefined ? isActive : true
            },
            userId,
            clientIp
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Müdür başarıyla güncellendi',
            data: updatedManager
        });

        emitApiMutation({
            method: 'PUT',
            path: `/api/managers/${id}`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/managers/${id}`),
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error updating manager:', error);
        res.status(500).json({
            success: false,
            message: 'Müdür güncellenirken bir hata oluştu'
        });
    } finally {
        client.release();
    }
};

/**
 * Delete manager (soft delete)
 * DELETE /api/managers/:id
 */
export const deleteManager = async (req: Request, res: Response): Promise<void> => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const userId = (req as any).user?.userId;
        const clientIp = getClientIp(req);

        // Validate UUID
        if (!isValidUUID(id)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz müdür kimliği'
            });
            return;
        }

        await client.query('BEGIN');

        // Get old values
        const oldDataQuery = 'SELECT first_name, last_name, title FROM managers WHERE id = $1 AND deleted_at IS NULL';
        const oldData = await client.query(oldDataQuery, [id]);

        if (oldData.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({
                success: false,
                message: 'Müdür bulunamadı'
            });
            return;
        }

        // Soft delete
        const deleteQuery = `
            UPDATE managers
            SET deleted_at = CURRENT_TIMESTAMP, is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `;
        await client.query(deleteQuery, [id]);

        // Log the deletion
        await logDataChange(
            'managers',
            id,
            'DELETE',
            oldData.rows[0],
            null,
            userId,
            clientIp
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Müdür başarıyla silindi'
        });

        emitApiMutation({
            method: 'DELETE',
            path: `/api/managers/${id}`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/managers/${id}`),
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting manager:', error);
        res.status(500).json({
            success: false,
            message: 'Müdür silinirken bir hata oluştu'
        });
    } finally {
        client.release();
    }
};


/**
 * Create new manager record
 * POST /api/managers/records
 */
export const createManagerRecord = async (req: Request, res: Response): Promise<void> => {
    try {
        const { manager_id, notes, entry_time, entry_date, exit_date, exit_time } = req.body;
        const entry_by = req.user?.userId || null;
        const isAdminUser = req.user?.role === 'admin';
        const clientIp = getClientIp(req);
        const gate = await getResolvedGateFromRequest(req);

        // GÜVENLİK: Input sanitization
        const sanitizedNotes = sanitizeInput(notes, 1000);

        // Time validation (optional, HH:MM format)
        if (entry_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(entry_time)) {
            res.status(400).json({ success: false, message: 'Giriş saati HH:MM formatında olmalıdır' });
            return;
        }
        if (exit_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(exit_time)) {
            res.status(400).json({ success: false, message: 'Çıkış saati HH:MM formatında olmalıdır' });
            return;
        }

        const isValidISODate = (dateValue: string): boolean => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return false;

            const [yearStr, monthStr, dayStr] = dateValue.split('-');
            const year = Number(yearStr);
            const month = Number(monthStr);
            const day = Number(dayStr);

            if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
                return false;
            }

            const parsedUtc = new Date(Date.UTC(year, month - 1, day));

            return parsedUtc.getUTCFullYear() === year
                && parsedUtc.getUTCMonth() === month - 1
                && parsedUtc.getUTCDate() === day;
        };

        if (isAdminUser && entry_date && !isValidISODate(entry_date)) {
            res.status(400).json({ success: false, message: 'Giriş tarihi YYYY-MM-DD formatında olmalıdır' });
            return;
        }

        if (isAdminUser && exit_date && !isValidISODate(exit_date)) {
            res.status(400).json({ success: false, message: 'Çıkış tarihi YYYY-MM-DD formatında olmalıdır' });
            return;
        }

        if (isAdminUser && entry_date && exit_date && exit_date < entry_date) {
            res.status(400).json({ success: false, message: 'Çıkış tarihi giriş tarihinden önce olamaz' });
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
        const effectiveEntryDate = isAdminUser && entry_date ? entry_date : null;
        const effectiveExitDate = isAdminUser && exit_date ? exit_date : null;
        const effectiveExitTime = effectiveExitDate && isAdminUser ? (exit_time || null) : null;
        const initialStatus = effectiveExitDate ? 'exited' : 'inside';
        const exitBy = effectiveExitDate ? entry_by : null;

        await pool.query('BEGIN');
        await pool.query(
            `INSERT INTO managers_records (
                id, manager_id, manager_name, gate, entry_by, entry_date, entry_time, exit_date, exit_time, exit_by, status, notes
            ) VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                COALESCE($7::date, CURRENT_DATE),
                COALESCE($8::time, CURRENT_TIME),
                $9::date,
                $10::time,
                $11,
                $12,
                $6
            )`,
            [
                id,
                manager_id,
                managerName,
                gate,
                entry_by,
                sanitizedNotes,
                effectiveEntryDate,
                entry_time || null,
                effectiveExitDate,
                effectiveExitTime,
                exitBy,
                initialStatus
            ]
        );
        await pool.query('COMMIT');

        // GÜVENLİK: Audit log kaydı
        await logDataChange(
            'managers_records',
            id,
            'INSERT',
            null,
            {
                manager_id,
                manager_name: managerName,
                entry_date: effectiveEntryDate,
                entry_time: entry_time || null,
                exit_date: effectiveExitDate,
                exit_time: effectiveExitTime,
                status: initialStatus
            },
            entry_by,
            clientIp
        );

        res.status(201).json({ success: true, message: 'Müdür kaydı oluşturuldu', data: { id } });

        emitApiMutation({
            method: 'POST',
            path: '/api/managers/records',
            statusCode: 201,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics('/api/managers/records'),
        });
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

        emitApiMutation({
            method: 'POST',
            path: `/api/managers/records/${id}/exit`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/managers/records/${id}/exit`),
        });
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
        const { notes, entry_date, entry_time, exit_date, exit_time } = req.body;
        const clientIp = getClientIp(req);

        // Date validation (optional, YYYY-MM-DD format)
        if (entry_date !== undefined && entry_date !== null) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(entry_date) || !isValidDate(entry_date)) {
                res.status(400).json({ success: false, message: 'Giriş tarihi YYYY-MM-DD formatında olmalıdır' });
                return;
            }
        }
        if (exit_date !== undefined && exit_date !== null) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(exit_date) || !isValidDate(exit_date)) {
                res.status(400).json({ success: false, message: 'Çıkış tarihi YYYY-MM-DD formatında olmalıdır' });
                return;
            }
        }

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

        const recordCheck = await pool.query(
            'SELECT id, entry_date, exit_date, exit_time, status FROM managers_records WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );
        if (recordCheck.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        const existing = recordCheck.rows[0];

        const updates: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (notes !== undefined) { updates.push(`notes = $${idx++}`); params.push(notes || null); }
        if (entry_date !== undefined) { updates.push(`entry_date = $${idx++}`); params.push(entry_date || null); }
        if (exit_date !== undefined) { updates.push(`exit_date = $${idx++}`); params.push(exit_date || null); }
        if (entry_time !== undefined) { updates.push(`entry_time = $${idx++}`); params.push(entry_time || null); }
        if (exit_time !== undefined) { updates.push(`exit_time = $${idx++}`); params.push(exit_time || null); }

        const nextEntryDate = entry_date !== undefined ? (entry_date || null) : existing.entry_date;
        const nextExitDate = exit_date !== undefined ? (exit_date || null) : existing.exit_date;
        const nextExitTime = exit_time !== undefined ? (exit_time || null) : existing.exit_time;

        if (nextEntryDate && nextExitDate && String(nextExitDate) < String(nextEntryDate)) {
            res.status(400).json({ success: false, message: 'Çıkış tarihi giriş tarihinden önce olamaz' });
            return;
        }

        const nextStatus = (nextExitDate || nextExitTime) ? 'exited' : 'inside';
        updates.push(`status = $${idx++}`);
        params.push(nextStatus);

        if (updates.length === 0) {
            res.status(400).json({ success: false, message: 'Güncellenecek alan bulunamadı' });
            return;
        }

        const query = `UPDATE managers_records SET ${updates.join(', ')}, updated_at = now() WHERE id = $${idx} AND deleted_at IS NULL`;
        params.push(id);

        await pool.query(query, params);

        res.status(200).json({ success: true, message: 'Kayıt güncellendi' });

        emitApiMutation({
            method: 'PUT',
            path: `/api/managers/records/${id}`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/managers/records/${id}`),
        });
    } catch (error) {
        console.error('Update manager record error:', error);
        res.status(500).json({ success: false, message: 'Kayıt güncellenirken hata oluştu' });
    }
};

/**
 * Soft delete manager record
 * DELETE /api/managers/records/:id
 */
export const deleteManagerRecord = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.userId || null;
    const clientIp = getClientIp(req);

    try {
        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        const existing = await pool.query('SELECT id, deleted_at FROM managers_records WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        if (existing.rows[0].deleted_at) {
            res.status(400).json({ success: false, message: 'Kayıt zaten silinmiş' });
            return;
        }

        await pool.query(
            `UPDATE managers_records
             SET deleted_at = CURRENT_TIMESTAMP,
                 updated_at = now()
             WHERE id = $1`,
            [id]
        );

        await logDataChange(
            'managers_records',
            id,
            'SOFT_DELETE',
            { deleted_at: null },
            { deleted_at: 'CURRENT_TIMESTAMP' },
            userId,
            clientIp
        );

        res.status(200).json({ success: true, message: 'Kayıt silindi' });

        emitApiMutation({
            method: 'DELETE',
            path: `/api/managers/records/${id}`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/managers/records/${id}`),
        });
    } catch (error) {
        console.error('Delete manager record error:', error);
        res.status(500).json({ success: false, message: 'Kayıt silinirken hata oluştu' });
    }
};

/**
 * Restore manager record
 * POST /api/managers/records/:id/restore
 */
export const restoreManagerRecord = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.userId || null;
    const clientIp = getClientIp(req);

    try {
        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        const existing = await pool.query('SELECT id, deleted_at FROM managers_records WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        if (!existing.rows[0].deleted_at) {
            res.status(400).json({ success: false, message: 'Kayıt zaten aktif' });
            return;
        }

        await pool.query(
            `UPDATE managers_records
             SET deleted_at = NULL,
                 updated_at = now()
             WHERE id = $1`,
            [id]
        );

        await logDataChange(
            'managers_records',
            id,
            'UPDATE',
            { deleted_at: 'TIMESTAMP' },
            { deleted_at: null },
            userId,
            clientIp
        );

        res.status(200).json({ success: true, message: 'Kayıt geri alındı' });

        emitApiMutation({
            method: 'POST',
            path: `/api/managers/records/${id}/restore`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/managers/records/${id}/restore`),
        });
    } catch (error) {
        console.error('Restore manager record error:', error);
        res.status(500).json({ success: false, message: 'Kayıt geri alınırken hata oluştu' });
    }
};
