import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizePlainText, normalizePlate, normalizePhone } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { emitApiMutation } from '../realtime/socket';

/**
 * Get all predefined visitors (Admin only)
 * GET /api/admin/predefined-visitors
 */
export const getPredefinedVisitors = async (req: Request, res: Response): Promise<void> => {
    try {
        const queryParams: any[] = [];
        const filters: string[] = ['deleted_at IS NULL'];
        let paramIndex = 1;

        if (req.query.full_name) {
            filters.push(`LOWER(translate(full_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramIndex++}, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`);
            queryParams.push(`%${req.query.full_name}%`);
        }

        const limit = Number(req.query.limit || 100);
        const offset = Number(req.query.offset || 0);

        const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
        const countQuery = `SELECT COUNT(*) FROM predefined_visitors ${whereClause}`;
        const dataQuery = `
            SELECT * FROM predefined_visitors 
            ${whereClause} 
            ORDER BY full_name ASC 
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;

        const totalResult = await pool.query(countQuery, queryParams.slice(0, paramIndex - 3));
        const totalCount = parseInt(totalResult.rows[0].count, 10);

        const finalParams = [...queryParams, limit, offset];
        const result = await pool.query(dataQuery, finalParams);

        res.status(200).json({
            success: true,
            data: result.rows,
            total: totalCount,
            page: Math.floor(offset / limit) + 1,
            limit
        });
    } catch (error) {
        console.error('Get predefined visitors error:', error);
        res.status(500).json({ success: false, message: 'Tanımlı ziyaretçiler listelenirken hata oluştu' });
    }
};

/**
 * Create predefined visitor (Admin only)
 * POST /api/admin/predefined-visitors
 */
export const createPredefinedVisitor = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            full_name, company_name, phone, vehicle_plate, visiting_person, notes,
            subcontractor_worker, for_electric_station, daily_guest,
            entry_tag, exit_tag, tour_entry, tour_exit, meeting, delivery, guide,
            highlight_color
        } = req.body;

        const personnel_id = req.user?.userId || null;
        const clientIp = getClientIp(req);

        // Validation & Sanitization
        if (!full_name || String(full_name).trim().length === 0) {
            res.status(400).json({ success: false, message: 'İsim Soyisim alanı zorunludur' });
            return;
        }

        const sanitizedFullName = sanitizePlainText(full_name, 100);
        const sanitizedCompanyName = sanitizePlainText(company_name, 100);
        const sanitizedVisitingPerson = sanitizePlainText(visiting_person, 100);
        const sanitizedNotes = sanitizePlainText(notes, 1000);
        const normalizedPlate = normalizePlate(vehicle_plate);
        const normalizedPhone = normalizePhone(phone);

        if (sanitizedFullName && sanitizedFullName.length > 100) {
            res.status(400).json({ success: false, message: 'İsim Soyisim 100 karakterden uzun olamaz' });
            return;
        }

        const ALLOWED_COLORS = ['none','rose','amber','emerald','sky','violet','orange','pink','brown'];
        const safeHighlightColor = ALLOWED_COLORS.includes(highlight_color) ? highlight_color : 'none';

        const id = uuidv4();

        const insertQuery = `
            INSERT INTO predefined_visitors (
                id, full_name, company_name, phone, vehicle_plate, visiting_person, notes,
                subcontractor_worker, for_electric_station, daily_guest,
                entry_tag, exit_tag, tour_entry, tour_exit, meeting, delivery, guide,
                highlight_color
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
            ) RETURNING *
        `;

        const values = [
            id,
            sanitizedFullName,
            sanitizedCompanyName,
            normalizedPhone,
            normalizedPlate,
            sanitizedVisitingPerson,
            sanitizedNotes,
            Boolean(subcontractor_worker),
            Boolean(for_electric_station),
            Boolean(daily_guest),
            Boolean(entry_tag),
            Boolean(exit_tag),
            Boolean(tour_entry),
            Boolean(tour_exit),
            Boolean(meeting),
            Boolean(delivery),
            Boolean(guide),
            safeHighlightColor
        ];

        const result = await pool.query(insertQuery, values);

        // Log to audit log
        await logDataChange(
            'predefined_visitors',
            id,
            'INSERT',
            null,
            result.rows[0],
            personnel_id,
            clientIp
        );

        emitApiMutation({
            method: 'POST',
            path: '/api/admin/predefined-visitors',
            statusCode: 201,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: ['predefined-visitors'],
        });

        res.status(201).json({
            success: true,
            message: 'Tanımlı ziyaretçi başarıyla oluşturuldu',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Create predefined visitor error:', error);
        res.status(500).json({ success: false, message: 'Tanımlı ziyaretçi oluşturulurken hata oluştu' });
    }
};

/**
 * Update predefined visitor (Admin only)
 * PUT /api/admin/predefined-visitors/:id
 */
export const updatePredefinedVisitor = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const {
            full_name, company_name, phone, vehicle_plate, visiting_person, notes,
            subcontractor_worker, for_electric_station, daily_guest,
            entry_tag, exit_tag, tour_entry, tour_exit, meeting, delivery, guide,
            highlight_color
        } = req.body;

        const personnel_id = req.user?.userId || null;
        const clientIp = getClientIp(req);

        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        const recordCheck = await pool.query('SELECT * FROM predefined_visitors WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (recordCheck.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        if (full_name !== undefined && (!full_name || String(full_name).trim().length === 0)) {
            res.status(400).json({ success: false, message: 'İsim Soyisim alanı zorunludur' });
            return;
        }

        const sanitizedFullName = full_name !== undefined ? sanitizePlainText(full_name, 100) : recordCheck.rows[0].full_name;
        const sanitizedCompanyName = company_name !== undefined ? sanitizePlainText(company_name, 100) : recordCheck.rows[0].company_name;
        const sanitizedVisitingPerson = visiting_person !== undefined ? sanitizePlainText(visiting_person, 100) : recordCheck.rows[0].visiting_person;
        const sanitizedNotes = notes !== undefined ? sanitizePlainText(notes, 1000) : recordCheck.rows[0].notes;
        const normalizedPlate = vehicle_plate !== undefined ? normalizePlate(vehicle_plate) : recordCheck.rows[0].vehicle_plate;
        const normalizedPhone = phone !== undefined ? normalizePhone(phone) : recordCheck.rows[0].phone;

        const ALLOWED_COLORS = ['none','rose','amber','emerald','sky','violet','orange','pink','brown'];
        const safeHighlightColor = highlight_color !== undefined
            ? (ALLOWED_COLORS.includes(highlight_color) ? highlight_color : 'none')
            : recordCheck.rows[0].highlight_color;

        const updateQuery = `
            UPDATE predefined_visitors SET
                full_name = $1,
                company_name = $2,
                phone = $3,
                vehicle_plate = $4,
                visiting_person = $5,
                notes = $6,
                subcontractor_worker = $7,
                for_electric_station = $8,
                daily_guest = $9,
                entry_tag = $10,
                exit_tag = $11,
                tour_entry = $12,
                tour_exit = $13,
                meeting = $14,
                delivery = $15,
                guide = $16,
                highlight_color = $17,
                updated_at = NOW()
            WHERE id = $18 AND deleted_at IS NULL
            RETURNING *
        `;

        const values = [
            sanitizedFullName,
            sanitizedCompanyName,
            normalizedPhone,
            normalizedPlate,
            sanitizedVisitingPerson,
            sanitizedNotes,
            subcontractor_worker !== undefined ? Boolean(subcontractor_worker) : recordCheck.rows[0].subcontractor_worker,
            for_electric_station !== undefined ? Boolean(for_electric_station) : recordCheck.rows[0].for_electric_station,
            daily_guest !== undefined ? Boolean(daily_guest) : recordCheck.rows[0].daily_guest,
            entry_tag !== undefined ? Boolean(entry_tag) : recordCheck.rows[0].entry_tag,
            exit_tag !== undefined ? Boolean(exit_tag) : recordCheck.rows[0].exit_tag,
            tour_entry !== undefined ? Boolean(tour_entry) : recordCheck.rows[0].tour_entry,
            tour_exit !== undefined ? Boolean(tour_exit) : recordCheck.rows[0].tour_exit,
            meeting !== undefined ? Boolean(meeting) : recordCheck.rows[0].meeting,
            delivery !== undefined ? Boolean(delivery) : recordCheck.rows[0].delivery,
            guide !== undefined ? Boolean(guide) : recordCheck.rows[0].guide,
            safeHighlightColor,
            id
        ];

        const result = await pool.query(updateQuery, values);

        // Log to audit log
        await logDataChange(
            'predefined_visitors',
            id,
            'UPDATE',
            recordCheck.rows[0],
            result.rows[0],
            personnel_id,
            clientIp
        );

        emitApiMutation({
            method: 'PUT',
            path: `/api/admin/predefined-visitors/${id}`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: ['predefined-visitors'],
        });

        res.status(200).json({
            success: true,
            message: 'Tanımlı ziyaretçi başarıyla güncellendi',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update predefined visitor error:', error);
        res.status(500).json({ success: false, message: 'Tanımlı ziyaretçi güncellenirken hata oluştu' });
    }
};

/**
 * Soft delete predefined visitor (Admin only)
 * DELETE /api/admin/predefined-visitors/:id
 */
export const deletePredefinedVisitor = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const personnel_id = req.user?.userId || null;
        const clientIp = getClientIp(req);

        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        const recordCheck = await pool.query('SELECT * FROM predefined_visitors WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (recordCheck.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        await pool.query('UPDATE predefined_visitors SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1', [id]);

        // Log to audit log
        await logDataChange(
            'predefined_visitors',
            id,
            'SOFT_DELETE',
            recordCheck.rows[0],
            { deleted_at: new Date().toISOString() },
            personnel_id,
            clientIp
        );

        emitApiMutation({
            method: 'DELETE',
            path: `/api/admin/predefined-visitors/${id}`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: ['predefined-visitors'],
        });

        res.status(200).json({ success: true, message: 'Tanımlı ziyaretçi başarıyla silindi' });
    } catch (error) {
        console.error('Delete predefined visitor error:', error);
        res.status(500).json({ success: false, message: 'Tanımlı ziyaretçi silinirken hata oluştu' });
    }
};

/**
 * Search predefined visitors by full_name (Personnel & Admin)
 * GET /api/visitors/predefined/search
 */
export const searchPredefinedVisitors = async (req: Request, res: Response): Promise<void> => {
    try {
        const { q } = req.query;

        if (!q || typeof q !== 'string' || q.trim().length === 0) {
            res.status(200).json({ success: true, data: [] });
            return;
        }

        const searchQuery = `
            SELECT * FROM predefined_visitors 
            WHERE deleted_at IS NULL 
              AND LOWER(translate(full_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($1, 'IİĞÜŞÖÇ', 'ıiğüşöç'))
            ORDER BY full_name ASC 
            LIMIT 10
        `;

        const result = await pool.query(searchQuery, [`%${q.trim()}%`]);

        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Search predefined visitors error:', error);
        res.status(500).json({ success: false, message: 'Ziyaretçi araması sırasında hata oluştu' });
    }
};
