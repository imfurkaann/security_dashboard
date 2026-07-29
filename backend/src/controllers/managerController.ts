import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizePlainText } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { getResolvedGateFromRequest } from '../utils/gate';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const MAX_FILTER_LENGTH = 120;
const MAX_EXPORT_ROWS = 50000;

const isValidIsoDate = (value: string): boolean => {
    if (!ISO_DATE_PATTERN.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const isRequestBodyObject = (body: unknown): body is Record<string, unknown> =>
    body !== null && typeof body === 'object' && !Array.isArray(body);

const decodeStoredHtmlEntities = (value: string | null | undefined): string | null => {
    if (value === null || value === undefined) return null;
    return String(value)
        .replace(/&#x2F;/g, '/')
        .replace(/&#x27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&');
};

const isUniqueViolation = (error: unknown): boolean =>
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error as { code?: string }).code === '23505';

/**
 * Get all manager records with joins
 * GET /api/managers/records
 */
export const getManagerRecords = async (req: Request, res: Response): Promise<void> => {
    try {
        const includeDeleted = req.query.includeDeleted === 'true';
        const unlimitedRequested = req.query.unlimited === 'true';

        const reqLimit = Number(req.query.limit ?? 1000);
        const reqOffset = Number(req.query.offset ?? 0);
        if (!Number.isInteger(reqLimit) || reqLimit < 1 || !Number.isInteger(reqOffset) || reqOffset < 0) {
            res.status(400).json({ success: false, message: 'Geçersiz sayfalama parametresi' });
            return;
        }

        const dateFilterNames = ['entryDateStart', 'entryDateEnd', 'exitDateStart', 'exitDateEnd', 'activityDate'] as const;
        for (const name of dateFilterNames) {
            const value = req.query[name];
            if (value !== undefined && (typeof value !== 'string' || !isValidIsoDate(value))) {
                res.status(400).json({ success: false, message: 'Geçersiz tarih filtresi' });
                return;
            }
        }

        const textFilterNames = ['manager_name', 'entry_by', 'exit_by', 'gate'] as const;
        for (const name of textFilterNames) {
            const value = req.query[name];
            if (value !== undefined && (typeof value !== 'string' || value.length > MAX_FILTER_LENGTH)) {
                res.status(400).json({ success: false, message: 'Geçersiz filtre değeri' });
                return;
            }
        }

        const statusFilter = req.query.status;
        if (statusFilter !== undefined && (typeof statusFilter !== 'string' || !['all', 'inside', 'exited', 'deleted'].includes(statusFilter))) {
            res.status(400).json({ success: false, message: 'Geçersiz durum filtresi' });
            return;
        }

        const hasDateFilter = dateFilterNames.some((name) => Boolean(req.query[name]));
        if (unlimitedRequested && !hasDateFilter) {
            res.status(400).json({ success: false, message: 'Sınırsız dışa aktarım için tarih filtresi gereklidir' });
            return;
        }

        const unlimited = unlimitedRequested && hasDateFilter;
        const safeLimit = Math.min(reqLimit, 10000);
        const safeOffset = reqOffset;
        const limitClause = unlimited
            ? `LIMIT ${MAX_EXPORT_ROWS + 1}`
            : `LIMIT ${safeLimit} OFFSET ${safeOffset}`;

        const filters: string[] = [];
        const queryParams: any[] = [];
        let paramIndex = 1;

        if (!includeDeleted && statusFilter !== 'deleted') {
            filters.push(`mr.deleted_at IS NULL`);
        }

        // Apply query filters
        if (req.query.manager_name) {
            filters.push(`(LOWER(translate(mr.manager_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramIndex}, 'IİĞÜŞÖÇ', 'ıiğüşöç')) OR LOWER(translate(CONCAT(m.first_name, ' ', m.last_name), 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramIndex}, 'IİĞÜŞÖÇ', 'ıiğüşöç')))`);
            queryParams.push(`%${req.query.manager_name}%`);
            paramIndex++;
        }

        if (req.query.entry_by) {
            filters.push(`(LOWER(translate(mr.entry_by_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate(${paramIndex}, 'IİĞÜŞÖÇ', 'ıiğüşöç')) OR LOWER(translate(CONCAT(pe.first_name, ' ', pe.last_name), 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate(${paramIndex}, 'IİĞÜŞÖÇ', 'ıiğüşöç')))`);
            queryParams.push(`%${req.query.entry_by}%`);
            paramIndex++;
        }

        if (req.query.exit_by) {
            filters.push(`(LOWER(translate(mr.exit_by_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate(${paramIndex}, 'IİĞÜŞÖÇ', 'ıiğüşöç')) OR LOWER(translate(CONCAT(px.first_name, ' ', px.last_name), 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate(${paramIndex}, 'IİĞÜŞÖÇ', 'ıiğüşöç')))`);
            queryParams.push(`%${req.query.exit_by}%`);
            paramIndex++;
        }

        if (req.query.status && req.query.status !== 'all') {
            if (req.query.status === 'deleted') {
                filters.push(`mr.deleted_at IS NOT NULL`);
            } else {
                filters.push(`mr.status = $${paramIndex++} AND mr.deleted_at IS NULL`);
                queryParams.push(req.query.status);
            }
        }

        if (req.query.gate && req.query.gate !== 'all') {
            filters.push(`mr.gate = $${paramIndex++}`);
            queryParams.push(req.query.gate);
        }

        if (req.query.entryDateStart) {
            filters.push(`mr.entry_date >= $${paramIndex++}::date`);
            queryParams.push(req.query.entryDateStart);
        }

        if (req.query.entryDateEnd) {
            filters.push(`mr.entry_date <= $${paramIndex++}::date`);
            queryParams.push(req.query.entryDateEnd);
        }

        if (req.query.exitDateStart) {
            filters.push(`mr.exit_date >= $${paramIndex++}::date`);
            queryParams.push(req.query.exitDateStart);
        }

        if (req.query.exitDateEnd) {
            filters.push(`mr.exit_date <= $${paramIndex++}::date`);
            queryParams.push(req.query.exitDateEnd);
        }

        if (req.query.activityDate) {
            filters.push(`(
                mr.entry_date = $${paramIndex}::date
                OR mr.exit_date = $${paramIndex}::date
                OR mr.deleted_at::date = $${paramIndex}::date
                OR (mr.deleted_at IS NULL AND mr.status = 'inside')
            )`);
            queryParams.push(req.query.activityDate);
            paramIndex++;
        }

        const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

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
                mr.deleted_at,
                mr.entry_by_name,
                mr.exit_by_name,
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
            ${whereClause}
            ORDER BY mr.entry_date DESC, mr.entry_time DESC, mr.id DESC
            ${limitClause}
        `;

        const result = await pool.query(query, queryParams);
        if (unlimited && result.rows.length > MAX_EXPORT_ROWS) {
            res.status(413).json({ success: false, message: 'Dışa aktarım sonucu çok büyük; lütfen tarih aralığını daraltın' });
            return;
        }

        const formatted = result.rows.map((row: any) => ({
            id: row.id,
            manager_id: row.manager_id,
            manager_name: decodeStoredHtmlEntities(row.manager_name),
            // prefer stored manager_name if available, otherwise use joined manager fields
            manager: decodeStoredHtmlEntities(row.manager_name) || (row.manager_first_name || row.manager_last_name ? `${row.manager_first_name || ''} ${row.manager_last_name || ''}`.trim() : null),
            manager_title: decodeStoredHtmlEntities(row.manager_title),
            gate: row.gate,
            entry_date: row.entry_date,
            entry_time: row.entry_time,
            exit_date: row.exit_date,
            exit_time: row.exit_time,
            status: row.status,
            notes: decodeStoredHtmlEntities(row.notes),
            deleted_at: row.deleted_at || null,
            entry_by: (row.entry_by_first_name || row.entry_by_last_name)
                ? `${row.entry_by_first_name || ''} ${row.entry_by_last_name || ''}`.trim()
                : decodeStoredHtmlEntities(row.entry_by_name),
            exit_by: (row.exit_by_first_name || row.exit_by_last_name)
                ? `${row.exit_by_first_name || ''} ${row.exit_by_last_name || ''}`.trim()
                : decodeStoredHtmlEntities(row.exit_by_name),
            created_at: row.created_at
        }));

        res.status(200).json(formatted);
    } catch (error) {
        console.error('Get manager records error:', error);
        res.status(500).json({ success: false, message: 'Müdür kayıtları listelenirken hata oluştu' });
    }
};

/**
 * Get active managers for authenticated record forms.
 * GET /api/managers/options
 */
export const getManagerOptions = async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query(
            `SELECT id, first_name, last_name, title
             FROM managers
             WHERE deleted_at IS NULL AND is_active = true
             ORDER BY first_name, last_name, id`
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get manager options error:', error);
        res.status(500).json({
            success: false,
            message: 'Müdür listesi alınırken hata oluştu'
        });
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
        if (!isRequestBodyObject(req.body)) {
            res.status(400).json({ success: false, message: 'GeÃ§ersiz istek gÃ¶vdesi' });
            return;
        }
        const { firstName, lastName, title } = req.body;
        const userId = (req as any).user?.userId;
        const clientIp = getClientIp(req);

        // Validate required fields
        if (typeof firstName !== 'string' || typeof lastName !== 'string' || (title !== undefined && title !== null && typeof title !== 'string')) {
            res.status(400).json({
                success: false,
                message: 'GeÃ§ersiz mÃ¼dÃ¼r bilgisi'
            });
            return;
        }

        // Sanitize inputs
        const sanitizedFirstName = sanitizePlainText(firstName, 50);
        const sanitizedLastName = sanitizePlainText(lastName, 50);
        const sanitizedTitle = sanitizePlainText(title as string | null | undefined, 100);

        if (!sanitizedFirstName || !sanitizedLastName) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz ad veya soyad'
            });
            return;
        }

        await client.query('BEGIN');

        // Check if manager with same name exists
        const duplicateCheck = await client.query(
            'SELECT id FROM managers WHERE LOWER(BTRIM(first_name)) = LOWER(BTRIM($1)) AND LOWER(BTRIM(last_name)) = LOWER(BTRIM($2)) AND deleted_at IS NULL',
            [sanitizedFirstName, sanitizedLastName]
        );

        if (duplicateCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            res.status(400).json({
                success: false,
                message: 'Bu isimde bir müdür zaten tanımlı'
            });
            return;
        }

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
        if (!isRequestBodyObject(req.body)) {
            res.status(400).json({ success: false, message: 'GeÃ§ersiz istek gÃ¶vdesi' });
            return;
        }
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
        if (
            typeof firstName !== 'string'
            || typeof lastName !== 'string'
            || (title !== undefined && title !== null && typeof title !== 'string')
            || (isActive !== undefined && typeof isActive !== 'boolean')
        ) {
            res.status(400).json({
                success: false,
                message: 'GeÃ§ersiz mÃ¼dÃ¼r bilgisi'
            });
            return;
        }

        // Sanitize inputs
        const sanitizedFirstName = sanitizePlainText(firstName, 50);
        const sanitizedLastName = sanitizePlainText(lastName, 50);
        const sanitizedTitle = sanitizePlainText(title as string | null | undefined, 100);

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

        const duplicateCheck = await client.query(
            `SELECT id
             FROM managers
             WHERE LOWER(BTRIM(first_name)) = LOWER(BTRIM($1))
               AND LOWER(BTRIM(last_name)) = LOWER(BTRIM($2))
               AND id <> $3
               AND deleted_at IS NULL`,
            [sanitizedFirstName, sanitizedLastName, id]
        );
        if (duplicateCheck.rows.length > 0) {
            await client.query('ROLLBACK');
            res.status(409).json({ success: false, message: 'Bu isimde bir mÃ¼dÃ¼r zaten tanÄ±mlÄ±' });
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

        const activeRecord = await client.query(
            `SELECT id FROM managers_records
             WHERE manager_id = $1 AND status = 'inside' AND deleted_at IS NULL
             LIMIT 1`,
            [id]
        );
        if (activeRecord.rows.length > 0) {
            await client.query('ROLLBACK');
            res.status(409).json({ success: false, message: 'Ä°Ã§eride kaydÄ± bulunan mÃ¼dÃ¼r silinemez; Ã¶nce Ã§Ä±kÄ±ÅŸ iÅŸlemini tamamlayÄ±n' });
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
 * Create a manager entry record.
 * POST /api/managers/records
 */
export const createManagerRecord = async (req: Request, res: Response): Promise<void> => {
    if (!isRequestBodyObject(req.body)) {
        res.status(400).json({ success: false, message: 'GeÃ§ersiz istek gÃ¶vdesi' });
        return;
    }

    const { manager_id, notes, entry_time, entry_date, exit_date, exit_time } = req.body;
    const entryBy = req.user?.userId || null;
    const isAdminUser = req.user?.role === 'admin';
    const clientIp = getClientIp(req);

    if (typeof manager_id !== 'string' || !isValidUUID(manager_id)) {
        res.status(400).json({ success: false, message: 'GeÃ§erli bir mÃ¼dÃ¼r kimliÄŸi gereklidir' });
        return;
    }
    if (!entryBy) {
        res.status(401).json({ success: false, message: 'KullanÄ±cÄ± doÄŸrulanmadÄ±. LÃ¼tfen giriÅŸ yapÄ±n.' });
        return;
    }
    if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 1000)) {
        res.status(400).json({ success: false, message: 'AÃ§Ä±klama en fazla 1000 karakter olabilir' });
        return;
    }
    if (entry_time !== undefined && entry_time !== null && (typeof entry_time !== 'string' || !TIME_PATTERN.test(entry_time))) {
        res.status(400).json({ success: false, message: 'GiriÅŸ saati HH:MM formatÄ±nda olmalÄ±dÄ±r' });
        return;
    }
    if (exit_time !== undefined && exit_time !== null && (typeof exit_time !== 'string' || !TIME_PATTERN.test(exit_time))) {
        res.status(400).json({ success: false, message: 'Ã‡Ä±kÄ±ÅŸ saati HH:MM formatÄ±nda olmalÄ±dÄ±r' });
        return;
    }
    if (entry_date !== undefined && entry_date !== null && (typeof entry_date !== 'string' || !isValidIsoDate(entry_date))) {
        res.status(400).json({ success: false, message: 'GiriÅŸ tarihi YYYY-MM-DD formatÄ±nda olmalÄ±dÄ±r' });
        return;
    }
    if (exit_date !== undefined && exit_date !== null && (typeof exit_date !== 'string' || !isValidIsoDate(exit_date))) {
        res.status(400).json({ success: false, message: 'Ã‡Ä±kÄ±ÅŸ tarihi YYYY-MM-DD formatÄ±nda olmalÄ±dÄ±r' });
        return;
    }

    const effectiveEntryDate = isAdminUser && typeof entry_date === 'string' ? entry_date : null;
    const effectiveExitDate = isAdminUser && typeof exit_date === 'string' ? exit_date : null;
    const effectiveExitTime = isAdminUser && typeof exit_time === 'string' ? exit_time : null;
    if ((effectiveExitDate && !effectiveExitTime) || (!effectiveExitDate && effectiveExitTime)) {
        res.status(400).json({ success: false, message: 'Ã‡Ä±kÄ±ÅŸ tarihi ve saati birlikte girilmelidir' });
        return;
    }
    if (effectiveEntryDate && effectiveExitDate && effectiveExitDate < effectiveEntryDate) {
        res.status(400).json({ success: false, message: 'Ã‡Ä±kÄ±ÅŸ tarihi giriÅŸ tarihinden Ã¶nce olamaz' });
        return;
    }

    const id = uuidv4();
    const sanitizedNotes = sanitizePlainText(notes as string | null | undefined, 1000);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const managerResult = await client.query(
            'SELECT id, first_name, last_name FROM managers WHERE id = $1 AND deleted_at IS NULL AND is_active = true FOR SHARE',
            [manager_id]
        );
        if (managerResult.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({ success: false, message: 'MÃ¼dÃ¼r bulunamadÄ± veya aktif deÄŸil' });
            return;
        }

        const gate = await getResolvedGateFromRequest(req);
        const managerName = (managerResult.rows[0].first_name + ' ' + managerResult.rows[0].last_name).trim();
        const initialStatus = effectiveExitDate ? 'exited' : 'inside';
        await client.query(
            `INSERT INTO managers_records (
                id, manager_id, manager_name, gate, entry_by, entry_date, entry_time,
                exit_date, exit_time, exit_by, status, notes
             ) VALUES (
                $1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE),
                COALESCE($7::time, CURRENT_TIME), $8::date, $9::time, $10, $11, $12
             )`,
            [
                id, manager_id, managerName, gate, entryBy, effectiveEntryDate,
                typeof entry_time === 'string' ? entry_time : null,
                effectiveExitDate, effectiveExitTime, effectiveExitDate ? entryBy : null,
                initialStatus, sanitizedNotes
            ]
        );
        await client.query('COMMIT');

        await logDataChange(
            'managers_records',
            id,
            'INSERT',
            null,
            {
                manager_id,
                manager_name: managerName,
                entry_date: effectiveEntryDate,
                entry_time: typeof entry_time === 'string' ? entry_time : null,
                exit_date: effectiveExitDate,
                exit_time: effectiveExitTime,
                status: initialStatus
            },
            entryBy,
            clientIp
        );
        res.status(201).json({ success: true, message: 'MÃ¼dÃ¼r kaydÄ± oluÅŸturuldu', data: { id } });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Create manager record error:', error instanceof Error ? error.message : error);
        if (isUniqueViolation(error)) {
            res.status(409).json({ success: false, message: 'Bu mÃ¼dÃ¼r zaten iÃ§eride olarak kayÄ±tlÄ±' });
            return;
        }
        res.status(500).json({ success: false, message: 'MÃ¼dÃ¼r kaydÄ± oluÅŸturulurken hata oluÅŸtu' });
    } finally {
        client.release();
    }
};

/**
 * Mark an active manager record as exited.
 * POST /api/managers/records/:id/exit
 */
export const exitManager = async (req: Request, res: Response): Promise<void> => {
    if (!isRequestBodyObject(req.body)) {
        res.status(400).json({ success: false, message: 'GeÃ§ersiz istek gÃ¶vdesi' });
        return;
    }
    const { id } = req.params;
    const { exit_time } = req.body;
    if (!isValidUUID(id)) {
        res.status(400).json({ success: false, message: 'GeÃ§ersiz kayÄ±t ID formatÄ±' });
        return;
    }
    if (exit_time !== undefined && exit_time !== null && (typeof exit_time !== 'string' || !TIME_PATTERN.test(exit_time))) {
        res.status(400).json({ success: false, message: 'Ã‡Ä±kÄ±ÅŸ saati HH:MM formatÄ±nda olmalÄ±dÄ±r' });
        return;
    }

    try {
        const result = await pool.query(
            `UPDATE managers_records
             SET exit_date = CURRENT_DATE,
                 exit_time = COALESCE($3::time, CURRENT_TIME),
                 exit_by = $2,
                 status = 'exited',
                 updated_at = now()
             WHERE id = $1 AND deleted_at IS NULL AND status = 'inside'
             RETURNING id`,
            [id, req.user?.userId || null, typeof exit_time === 'string' ? exit_time : null]
        );
        if (result.rowCount === 0) {
            const existing = await pool.query('SELECT id FROM managers_records WHERE id = $1 AND deleted_at IS NULL', [id]);
            res.status(existing.rows.length === 0 ? 404 : 409).json({
                success: false,
                message: existing.rows.length === 0 ? 'KayÄ±t bulunamadÄ±' : 'MÃ¼dÃ¼r iÃ§in Ã§Ä±kÄ±ÅŸ daha Ã¶nce kaydedilmiÅŸ'
            });
            return;
        }

        await logDataChange(
            'managers_records', id, 'UPDATE',
            { status: 'inside' }, { status: 'exited' },
            req.user?.userId || null, getClientIp(req)
        );
        res.status(200).json({ success: true, message: 'Ã‡Ä±kÄ±ÅŸ kaydedildi' });
    } catch (error) {
        console.error('Exit manager error:', error);
        res.status(500).json({ success: false, message: 'Ã‡Ä±kÄ±ÅŸ kaydedilirken hata oluÅŸtu' });
    }
};

/**
 * Update a manager record. Admin only (enforced by route middleware).
 * PUT /api/managers/records/:id
 */
export const updateManagerRecord = async (req: Request, res: Response): Promise<void> => {
    if (!isRequestBodyObject(req.body)) {
        res.status(400).json({ success: false, message: 'GeÃ§ersiz istek gÃ¶vdesi' });
        return;
    }
    const { id } = req.params;
    const { notes, entry_date, entry_time, exit_date, exit_time } = req.body;
    if (!isValidUUID(id)) {
        res.status(400).json({ success: false, message: 'GeÃ§ersiz kayÄ±t ID formatÄ±' });
        return;
    }
    if (notes !== undefined && notes !== null && (typeof notes !== 'string' || notes.length > 1000)) {
        res.status(400).json({ success: false, message: 'AÃ§Ä±klama en fazla 1000 karakter olabilir' });
        return;
    }
    if (entry_date !== undefined && (typeof entry_date !== 'string' || !isValidIsoDate(entry_date))) {
        res.status(400).json({ success: false, message: 'GeÃ§erli bir giriÅŸ tarihi gereklidir' });
        return;
    }
    if (entry_time !== undefined && (typeof entry_time !== 'string' || !TIME_PATTERN.test(entry_time))) {
        res.status(400).json({ success: false, message: 'GeÃ§erli bir giriÅŸ saati gereklidir' });
        return;
    }
    if (exit_date !== undefined && exit_date !== null && (typeof exit_date !== 'string' || !isValidIsoDate(exit_date))) {
        res.status(400).json({ success: false, message: 'GeÃ§ersiz Ã§Ä±kÄ±ÅŸ tarihi' });
        return;
    }
    if (exit_time !== undefined && exit_time !== null && (typeof exit_time !== 'string' || !TIME_PATTERN.test(exit_time))) {
        res.status(400).json({ success: false, message: 'GeÃ§ersiz Ã§Ä±kÄ±ÅŸ saati' });
        return;
    }
    if ([notes, entry_date, entry_time, exit_date, exit_time].every((value) => value === undefined)) {
        res.status(400).json({ success: false, message: 'GÃ¼ncellenecek alan bulunamadÄ±' });
        return;
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const recordResult = await client.query(
            `SELECT id, notes, entry_date, entry_time, exit_date, exit_time, exit_by, status
             FROM managers_records
             WHERE id = $1 AND deleted_at IS NULL
             FOR UPDATE`,
            [id]
        );
        if (recordResult.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({ success: false, message: 'KayÄ±t bulunamadÄ±' });
            return;
        }

        const existing = recordResult.rows[0];
        const nextEntryDate = entry_date !== undefined ? entry_date : String(existing.entry_date).slice(0, 10);
        const nextEntryTime = entry_time !== undefined ? entry_time : String(existing.entry_time).slice(0, 5);
        const nextExitDate = exit_date !== undefined ? exit_date : (existing.exit_date ? String(existing.exit_date).slice(0, 10) : null);
        const nextExitTime = exit_time !== undefined ? exit_time : (existing.exit_time ? String(existing.exit_time).slice(0, 5) : null);
        if ((nextExitDate && !nextExitTime) || (!nextExitDate && nextExitTime)) {
            await client.query('ROLLBACK');
            res.status(400).json({ success: false, message: 'Ã‡Ä±kÄ±ÅŸ tarihi ve saati birlikte girilmelidir' });
            return;
        }
        if (nextExitDate && nextExitDate < nextEntryDate) {
            await client.query('ROLLBACK');
            res.status(400).json({ success: false, message: 'Ã‡Ä±kÄ±ÅŸ tarihi giriÅŸ tarihinden Ã¶nce olamaz' });
            return;
        }

        const nextStatus = nextExitDate ? 'exited' : 'inside';
        const nextExitBy = nextStatus === 'inside'
            ? null
            : (existing.exit_by || req.user?.userId || null);
        const sanitizedNotes = notes !== undefined
            ? sanitizePlainText(notes as string | null | undefined, 1000)
            : existing.notes;

        await client.query(
            `UPDATE managers_records
             SET notes = $1, entry_date = $2::date, entry_time = $3::time,
                 exit_date = $4::date, exit_time = $5::time, exit_by = $6,
                 status = $7, updated_at = now()
             WHERE id = $8 AND deleted_at IS NULL`,
            [sanitizedNotes, nextEntryDate, nextEntryTime, nextExitDate, nextExitTime, nextExitBy, nextStatus, id]
        );
        await client.query('COMMIT');

        await logDataChange(
            'managers_records',
            id,
            'UPDATE',
            {
                notes: existing.notes,
                entry_date: existing.entry_date,
                entry_time: existing.entry_time,
                exit_date: existing.exit_date,
                exit_time: existing.exit_time,
                status: existing.status
            },
            {
                notes: sanitizedNotes,
                entry_date: nextEntryDate,
                entry_time: nextEntryTime,
                exit_date: nextExitDate,
                exit_time: nextExitTime,
                status: nextStatus
            },
            req.user?.userId || null,
            getClientIp(req)
        );
        res.status(200).json({ success: true, message: 'KayÄ±t gÃ¼ncellendi' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Update manager record error:', error);
        if (isUniqueViolation(error)) {
            res.status(409).json({ success: false, message: 'Bu mÃ¼dÃ¼r iÃ§in baÅŸka bir aktif iÃ§eride kaydÄ± bulunuyor' });
            return;
        }
        res.status(500).json({ success: false, message: 'KayÄ±t gÃ¼ncellenirken hata oluÅŸtu' });
    } finally {
        client.release();
    }
};

/**
 * Soft delete manager record.
 * DELETE /api/managers/records/:id
 */
export const deleteManagerRecord = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!isValidUUID(id)) {
        res.status(400).json({ success: false, message: 'GeÃ§ersiz kayÄ±t ID formatÄ±' });
        return;
    }
    try {
        const result = await pool.query(
            `UPDATE managers_records
             SET deleted_at = CURRENT_TIMESTAMP, updated_at = now()
             WHERE id = $1 AND deleted_at IS NULL
             RETURNING id`,
            [id]
        );
        if (result.rowCount === 0) {
            const existing = await pool.query('SELECT id FROM managers_records WHERE id = $1', [id]);
            res.status(existing.rows.length === 0 ? 404 : 409).json({
                success: false,
                message: existing.rows.length === 0 ? 'KayÄ±t bulunamadÄ±' : 'KayÄ±t zaten silinmiÅŸ'
            });
            return;
        }
        await logDataChange(
            'managers_records', id, 'SOFT_DELETE',
            { deleted_at: null }, { deleted_at: 'CURRENT_TIMESTAMP' },
            req.user?.userId || null, getClientIp(req)
        );
        res.status(200).json({ success: true, message: 'KayÄ±t silindi' });
    } catch (error) {
        console.error('Delete manager record error:', error);
        res.status(500).json({ success: false, message: 'KayÄ±t silinirken hata oluÅŸtu' });
    }
};

/**
 * Restore a soft-deleted manager record.
 * POST /api/managers/records/:id/restore
 */
export const restoreManagerRecord = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!isValidUUID(id)) {
        res.status(400).json({ success: false, message: 'GeÃ§ersiz kayÄ±t ID formatÄ±' });
        return;
    }
    try {
        const result = await pool.query(
            `UPDATE managers_records
             SET deleted_at = NULL, updated_at = now()
             WHERE id = $1 AND deleted_at IS NOT NULL
             RETURNING id`,
            [id]
        );
        if (result.rowCount === 0) {
            const existing = await pool.query('SELECT id FROM managers_records WHERE id = $1', [id]);
            res.status(existing.rows.length === 0 ? 404 : 409).json({
                success: false,
                message: existing.rows.length === 0 ? 'KayÄ±t bulunamadÄ±' : 'KayÄ±t zaten aktif'
            });
            return;
        }
        await logDataChange(
            'managers_records', id, 'UPDATE',
            { deleted_at: 'TIMESTAMP' }, { deleted_at: null },
            req.user?.userId || null, getClientIp(req)
        );
        res.status(200).json({ success: true, message: 'KayÄ±t geri alÄ±ndÄ±' });
    } catch (error) {
        console.error('Restore manager record error:', error);
        if (isUniqueViolation(error)) {
            res.status(409).json({ success: false, message: 'Bu mÃ¼dÃ¼r iÃ§in zaten aktif bir iÃ§eride kaydÄ± bulunuyor' });
            return;
        }
        res.status(500).json({ success: false, message: 'KayÄ±t geri alÄ±nÄ±rken hata oluÅŸtu' });
    }
};
