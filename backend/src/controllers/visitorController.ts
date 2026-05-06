import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizePlainText, normalizePlate, isValidLength, isValidNumber } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { emitApiMutation, resolveMutationTopics } from '../realtime/socket';
import { createVisitorRecordMessage, createVisitorExitMessage } from '../services/whatsapp';
import { sendWhatsAppTextMessage } from '../services/whatsappBaileys';
import { getResolvedGateFromRequest } from '../utils/gate';

const VISITOR_HIGHLIGHT_COLORS = ['none', 'rose', 'amber', 'emerald', 'sky', 'violet', 'orange', 'pink', 'brown'] as const;

const normalizeVisitorHighlightColor = (value: unknown): string => {
    if (typeof value !== 'string') return 'none';
    const normalized = value.trim().toLowerCase();
    return VISITOR_HIGHLIGHT_COLORS.includes(normalized as (typeof VISITOR_HIGHLIGHT_COLORS)[number])
        ? normalized
        : 'none';
};

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

/**
 * Get all visitor records with joins
 * GET /api/visitors/records
 */
export const getVisitorRecords = async (req: Request, res: Response): Promise<void> => {
    try {
        const includeDeleted = req.query.includeDeleted === 'true';
        const deletedAtSelect = includeDeleted ? 'vr.deleted_at,' : '';
        const deletedAtFilter = includeDeleted ? '' : 'WHERE vr.deleted_at IS NULL';

        const query = `
            SELECT 
                vr.id,
                vr.vehicle_plate,
                vr.full_name,
                vr.company_name,
                vr.visiting_person,
                vr.person_count,
                vr.children_count,
                vr.gate,
                vr.phone,
                vr.notes,
                vr.highlight_color,
                vr.subcontractor_worker,
                vr.for_electric_station,
                vr.daily_guest,
                vr.entry_tag,
                vr.exit_tag,
                vr.entry_date,
                vr.entry_time,
                vr.exit_date,
                vr.exit_time,
                vr.status,
                vr.created_at,
                ${deletedAtSelect}
                vr.entry_by_name,
                vr.exit_by_name,
                pe.first_name as entry_by_first_name,
                pe.last_name as entry_by_last_name,
                px.first_name as exit_by_first_name,
                px.last_name as exit_by_last_name
            FROM visitor_records vr
            LEFT JOIN personnel pe ON vr.entry_by = pe.id
            LEFT JOIN personnel px ON vr.exit_by = px.id
            ${deletedAtFilter}
            ORDER BY vr.entry_date DESC, vr.entry_time DESC
            LIMIT 1000
        `;
        const result = await pool.query(query);

        const formattedData = result.rows.map((row: any) => ({
            id: row.id,
            vehicle_plate: row.vehicle_plate,
            full_name: decodeStoredHtmlEntities(row.full_name),
            company_name: decodeStoredHtmlEntities(row.company_name),
            visiting_person: decodeStoredHtmlEntities(row.visiting_person),
            person_count: row.person_count,
            children_count: row.children_count ?? 0,
            gate: row.gate,
            phone: row.phone,
            notes: decodeStoredHtmlEntities(row.notes),
            highlight_color: row.highlight_color || 'none',
            subcontractor_worker: row.subcontractor_worker,
            for_electric_station: row.for_electric_station,
            daily_guest: row.daily_guest,
            entry_tag: row.entry_tag,
            exit_tag: row.exit_tag,
            entry_date: row.entry_date,
            entry_time: row.entry_time,
            exit_date: row.exit_date,
            exit_time: row.exit_time,
            status: row.status,
            deleted_at: row.deleted_at || null,
            entry_by: (row.entry_by_first_name || row.entry_by_last_name)
                ? `${row.entry_by_first_name || ''} ${row.entry_by_last_name || ''}`.trim()
                : (row.entry_by_name || null),
            exit_by: (row.exit_by_first_name || row.exit_by_last_name)
                ? `${row.exit_by_first_name || ''} ${row.exit_by_last_name || ''}`.trim()
                : (row.exit_by_name || null),
            created_at: row.created_at
        }));

        res.status(200).json(formattedData);
    } catch (error) {
        console.error('Get visitor records error:', error);
        res.status(500).json({ success: false, message: 'Ziyaretçi kayıtları listelenirken hata oluştu' });
    }
};


/**
 * Create new visitor record
 * POST /api/visitors/records
 */
export const createVisitorRecord = async (req: Request, res: Response): Promise<void> => {
    try {
        const { vehicle_plate, full_name, company_name, visiting_person, person_count, children_count, phone, notes, subcontractor_worker, for_electric_station, daily_guest, entry_tag, exit_tag, entry_time, highlight_color } = req.body;
        const personnel_id = req.user?.userId || null;
        const clientIp = getClientIp(req);
        const gate = await getResolvedGateFromRequest(req);

        // GÜVENLİK: Input sanitization
        const sanitizedFullName = sanitizePlainText(full_name, 100);
        const sanitizedCompanyName = sanitizePlainText(company_name, 100);
        const sanitizedVisitingPerson = sanitizePlainText(visiting_person, 100);
        const sanitizedNotes = sanitizePlainText(notes, 1000);
        const normalizedPlate = normalizePlate(vehicle_plate);
        const normalizedPhone = phone ? String(phone).replace(/[\s\-()]/g, '').trim() : null;

        // Tüm alanlar opsiyonel. Sadece girilen alanlar için uzunluk/format kontrolleri yapılır.
        if (normalizedPlate && normalizedPlate.length > 20) {
            res.status(400).json({ success: false, message: 'Araç plakası 20 karakterden uzun olamaz' });
            return;
        }

        if (full_name && full_name.length > 100) {
            res.status(400).json({ success: false, message: 'Ad Soyad 100 karakterden uzun olamaz' });
            return;
        }

        if (company_name && company_name.length > 100) {
            res.status(400).json({ success: false, message: 'Firma adı 100 karakterden uzun olamaz' });
            return;
        }

        if (visiting_person && visiting_person.length > 100) {
            res.status(400).json({ success: false, message: 'Ziyaret edilen 100 karakterden uzun olamaz' });
            return;
        }

        if (phone && phone.length > 20) {
            res.status(400).json({ success: false, message: 'Telefon numarası 20 karakterden uzun olamaz' });
            return;
        }

        if (notes && notes.length > 1000) {
            res.status(400).json({ success: false, message: 'Açıklama 1000 karakterden uzun olamaz' });
            return;
        }

        // entry_time validasyonu (HH:MM formatı)
        if (entry_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(entry_time)) {
            res.status(400).json({ success: false, message: 'Giriş saati HH:MM formatında olmalıdır' });
            return;
        }

        // person_count opsiyonel
        let personCountValue: number | null = null;
        if (person_count !== undefined && person_count !== null && person_count !== '') {
            if (isNaN(person_count) || Number(person_count) < 1) {
                res.status(400).json({ success: false, message: 'Kişi sayısı geçerli bir sayı olmalı ve en az 1 olmalıdır' });
                return;
            }
            personCountValue = Number(person_count);
        }

        let childrenCountValue = 0;
        if (children_count !== undefined && children_count !== null && children_count !== '') {
            if (isNaN(children_count) || Number(children_count) < 0) {
                res.status(400).json({ success: false, message: 'Çocuk sayısı geçerli bir sayı olmalı ve en az 0 olmalıdır' });
                return;
            }
            childrenCountValue = Number(children_count);
        }

        const normalizedHighlightColor = normalizeVisitorHighlightColor(highlight_color);

        const id = uuidv4();

        // Kullanıcı doğrulama
        if (!personnel_id) {
            res.status(401).json({ success: false, message: 'Kullanıcı doğrulanmadı. Lütfen giriş yapın.' });
            return;
        }

        // Varsayılan değerler
        const personCountToInsert = personCountValue ?? 1;

        // Basitleştirilmiş INSERT sorgusu
        const insertQuery = `
            INSERT INTO visitor_records (
                id, vehicle_plate, full_name, company_name, visiting_person,
                person_count, children_count, gate, phone, notes, highlight_color, subcontractor_worker, for_electric_station, daily_guest,
                entry_tag, exit_tag, entry_by, entry_date, entry_time, status, send_whatsapp
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                CURRENT_DATE, 
                COALESCE($18::time, CURRENT_TIME), 
                'inside', $19
            )
            RETURNING entry_date, entry_time
        `;

        const sendWhatsApp = Boolean(req.body.send_whatsapp);
        const values = [
            id,
            normalizedPlate,
            sanitizedFullName,
            sanitizedCompanyName,
            sanitizedVisitingPerson,
            personCountToInsert,
            childrenCountValue,
            gate,
            normalizedPhone,
            sanitizedNotes,
            normalizedHighlightColor,
            Boolean(subcontractor_worker),
            Boolean(for_electric_station),
            Boolean(daily_guest),
            Boolean(entry_tag),
            Boolean(exit_tag),
            personnel_id,
            entry_time || null,  // entry_time boşsa null, CURRENT_TIME kullanılacak
            sendWhatsApp
        ];

        await pool.query('BEGIN');
        const insertResult = await pool.query(insertQuery, values);
        await pool.query('COMMIT');

        // GÜVENLİK: Audit log kaydı
        await logDataChange(
            'visitor_records',
            id,
            'INSERT',
            null,
            { vehicle_plate: normalizedPlate, full_name: sanitizedFullName, company_name: sanitizedCompanyName },
            personnel_id,
            clientIp
        );

        emitApiMutation({
            method: 'POST',
            path: '/api/visitors/records',
            statusCode: 201,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics('/api/visitors/records'),
        });

        // WhatsApp mesaj şablonu oluştur (sadece send_whatsapp = true ise)
        let whatsappMessage = '';
        if (sendWhatsApp) {
            try {
                const entryDate = insertResult.rows[0]?.entry_date || new Date().toISOString().split('T')[0];
                const timeString = insertResult.rows[0]?.entry_time || new Date().toLocaleTimeString('tr-TR');
                // Sadece saat:dakika formatına çevir (HH:MM)
                const entryTime = timeString.substring(0, 5);

                whatsappMessage = createVisitorRecordMessage({
                    fullName: sanitizedFullName || undefined,
                    companyName: sanitizedCompanyName || undefined,
                    visitingPerson: sanitizedVisitingPerson || undefined,
                    entryDate,
                    entryTime,
                    gate: gate || undefined,
                    vehiclePlate: normalizedPlate || undefined,
                    personCount: personCountToInsert,
                    childrenCount: childrenCountValue,
                    phone: normalizedPhone || undefined,
                    subcontractorWorker: Boolean(subcontractor_worker),
                    forElectricStation: Boolean(for_electric_station),
                    dailyGuest: Boolean(daily_guest),
                    notes: sanitizedNotes || undefined
                });
            } catch (error) {
                console.error('WhatsApp mesaj oluşturma hatası:', error);
            }
        }

        res.status(201).json({ success: true, message: 'Ziyaretçi girişi kaydedildi', data: { id }, whatsappMessage });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Create visitor record error:', error instanceof Error ? error.message : error);
        res.status(500).json({ success: false, message: 'Ziyaretçi girişi kaydedilirken hata oluştu' });
    }
};


/**
 * Update visitor record
 * PUT /api/visitors/records/:id
 */
export const updateVisitorRecord = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { vehicle_plate, full_name, company_name, visiting_person, person_count, children_count, phone, notes, subcontractor_worker, for_electric_station, daily_guest, entry_tag, exit_tag, entry_time, exit_time, highlight_color } = req.body;
        const clientIp = getClientIp(req);

        // GÜVENLİK: UUID validasyonu
        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        const recordCheck = await pool.query('SELECT id FROM visitor_records WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (recordCheck.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        // entry_time ve exit_time validasyonu
        if (entry_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(entry_time)) {
            res.status(400).json({ success: false, message: 'Giriş saati HH:MM formatında olmalıdır' });
            return;
        }
        if (exit_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(exit_time)) {
            res.status(400).json({ success: false, message: 'Çıkış saati HH:MM formatında olmalıdır' });
            return;
        }

        if (person_count !== undefined && person_count !== null && person_count !== '' && (isNaN(person_count) || Number(person_count) < 1)) {
            res.status(400).json({ success: false, message: 'Kişi sayısı geçerli bir sayı olmalı ve en az 1 olmalıdır' });
            return;
        }

        if (children_count !== undefined && children_count !== null && children_count !== '' && (isNaN(children_count) || Number(children_count) < 0)) {
            res.status(400).json({ success: false, message: 'Çocuk sayısı geçerli bir sayı olmalı ve en az 0 olmalıdır' });
            return;
        }

        // Opsiyonel alanlar için sadece girilmiş olanları güncelle
        const updates: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (vehicle_plate !== undefined) {
            updates.push(`vehicle_plate = $${idx++}`);
            params.push(vehicle_plate ? String(vehicle_plate).replace(/\s/g, '').toUpperCase() : null);
        }
        if (full_name !== undefined) { updates.push(`full_name = $${idx++}`); params.push(full_name || null); }
        if (company_name !== undefined) { updates.push(`company_name = $${idx++}`); params.push(company_name || null); }
        if (visiting_person !== undefined) { updates.push(`visiting_person = $${idx++}`); params.push(visiting_person || null); }
        if (person_count !== undefined) {
            // DB requires non-null person_count — default to 1 when empty/null
            const pc = (person_count === '' || person_count === null) ? 1 : Number(person_count);
            params.push(pc);
            updates.push(`person_count = $${idx++}`);
        }
        if (children_count !== undefined) {
            // DB requires non-null children_count — default to 0 when empty/null
            const cc = (children_count === '' || children_count === null) ? 0 : Number(children_count);
            params.push(cc);
            updates.push(`children_count = $${idx++}`);
        }
        if (subcontractor_worker !== undefined) { updates.push(`subcontractor_worker = $${idx++}`); params.push(Boolean(subcontractor_worker)); }
        if (for_electric_station !== undefined) { updates.push(`for_electric_station = $${idx++}`); params.push(Boolean(for_electric_station)); }
        if (daily_guest !== undefined) { updates.push(`daily_guest = $${idx++}`); params.push(Boolean(daily_guest)); }
        if (entry_tag !== undefined) { updates.push(`entry_tag = $${idx++}`); params.push(Boolean(entry_tag)); }
        if (exit_tag !== undefined) { updates.push(`exit_tag = $${idx++}`); params.push(Boolean(exit_tag)); }
        if (highlight_color !== undefined) { updates.push(`highlight_color = $${idx++}`); params.push(normalizeVisitorHighlightColor(highlight_color)); }
        if (phone !== undefined) {
            updates.push(`phone = $${idx++}`);
            params.push(phone ? String(phone).replace(/[\s\-()]/g, '').trim() : null);
        }
        if (notes !== undefined) { updates.push(`notes = $${idx++}`); params.push(notes || null); }
        if (entry_time !== undefined) {
            updates.push(`entry_time = $${idx++}`);
            params.push(entry_time || null);
        }
        if (exit_time !== undefined) {
            updates.push(`exit_time = $${idx++}`);
            params.push(exit_time || null);
        }

        if (updates.length === 0) {
            res.status(400).json({ success: false, message: 'Güncellenecek alan bulunamadı' });
            return;
        }

        const query = `UPDATE visitor_records SET ${updates.join(', ')}, updated_at = now() WHERE id = $${idx} AND deleted_at IS NULL`;
        params.push(id);

        await pool.query(query, params);

        // GÜVENLİK: Audit log kaydı
        await logDataChange(
            'visitor_records',
            id,
            'UPDATE',
            null,
            { updated_fields: updates },
            req.user?.userId || null,
            clientIp
        );

        res.status(200).json({ success: true, message: 'Kayıt güncellendi' });
    } catch (error) {
        console.error('Update visitor record error:', error);
        res.status(500).json({ success: false, message: 'Kayıt güncellenirken hata oluştu' });
    }
};


/**
 * Exit visitor
 * POST /api/visitors/records/:id/exit
 */
export const exitVisitor = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { exit_time } = req.body;
        const clientIp = getClientIp(req);

        // GÜVENLİK: UUID validasyonu
        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        // exit_time validasyonu
        if (exit_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(exit_time)) {
            res.status(400).json({ success: false, message: 'Çıkış saati HH:MM formatında olmalıdır' });
            return;
        }

        const recordCheck = await pool.query('SELECT id, status FROM visitor_records WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (recordCheck.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        const currentStatus = recordCheck.rows[0].status;
        if (currentStatus !== 'inside') {
            res.status(400).json({ success: false, message: 'Ziyaretçi zaten çıkış yapmış' });
            return;
        }

        const personnel_id = req.user?.userId;

        await pool.query(
            `UPDATE visitor_records 
             SET exit_date = CURRENT_DATE, 
                 exit_time = COALESCE($3::time, CURRENT_TIME), 
                 exit_by = $2,
                 status = 'exited', 
                 updated_at = now() 
             WHERE id = $1 AND deleted_at IS NULL`,
            [id, personnel_id, exit_time || null]
        );

        // GÜVENLİK: Audit log kaydı
        await logDataChange(
            'visitor_records',
            id,
            'UPDATE',
            { status: 'inside' },
            { status: 'exited' },
            req.user?.userId || null,
            clientIp
        );

        // WhatsApp mesaj şablonu oluştur (sadece send_whatsapp = true olanlar için)
        let whatsappMessage = '';
        try {
            const visitorInfo = await pool.query(
                `SELECT full_name, company_name, visiting_person, vehicle_plate, 
                    person_count, children_count, gate, phone, subcontractor_worker, for_electric_station, daily_guest,
                        notes, exit_time, send_whatsapp 
                 FROM visitor_records WHERE id = $1`,
                [id]
            );

            if (visitorInfo.rows.length > 0 && visitorInfo.rows[0].send_whatsapp) {
                const record = visitorInfo.rows[0];
                const timeString = record.exit_time || new Date().toLocaleTimeString('tr-TR');
                const exitTime = timeString.substring(0, 5);

                whatsappMessage = createVisitorExitMessage({
                    fullName: record.full_name || undefined,
                    companyName: record.company_name || undefined,
                    visitingPerson: record.visiting_person || undefined,
                    gate: record.gate || undefined,
                    vehiclePlate: record.vehicle_plate || undefined,
                    personCount: record.person_count || undefined,
                    childrenCount: record.children_count || undefined,
                    phone: record.phone || undefined,
                    subcontractorWorker: Boolean(record.subcontractor_worker),
                    forElectricStation: Boolean(record.for_electric_station),
                    dailyGuest: Boolean(record.daily_guest),
                    notes: record.notes || undefined,
                    exitTime
                });
            }
        } catch (error) {
            console.error('WhatsApp mesaj oluşturma hatası:', error);
        }

        res.status(200).json({ success: true, message: 'Çıkış kaydedildi', whatsappMessage });
    } catch (error) {
        console.error('Exit visitor error:', error);
        res.status(500).json({ success: false, message: 'Çıkış kaydedilirken hata oluştu' });
    }
};

/**
 * Soft delete visitor record
 * DELETE /api/visitors/records/:id
 */
export const deleteVisitorRecord = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.userId || null;
    const clientIp = getClientIp(req);

    try {
        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        const existing = await pool.query('SELECT id, deleted_at FROM visitor_records WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        if (existing.rows[0].deleted_at) {
            res.status(400).json({ success: false, message: 'Kayıt zaten silinmiş' });
            return;
        }

        await pool.query(
            `UPDATE visitor_records
             SET deleted_at = CURRENT_TIMESTAMP,
                 updated_at = now()
             WHERE id = $1`,
            [id]
        );

        await logDataChange(
            'visitor_records',
            id,
            'SOFT_DELETE',
            { deleted_at: null },
            { deleted_at: 'CURRENT_TIMESTAMP' },
            userId,
            clientIp
        );

        res.status(200).json({ success: true, message: 'Kayıt silindi' });
    } catch (error) {
        console.error('Delete visitor record error:', error);
        res.status(500).json({ success: false, message: 'Kayıt silinirken hata oluştu' });
    }
};

/**
 * Restore visitor record
 * POST /api/visitors/records/:id/restore
 */
export const restoreVisitorRecord = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.userId || null;
    const clientIp = getClientIp(req);

    try {
        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        const existing = await pool.query('SELECT id, deleted_at FROM visitor_records WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        if (!existing.rows[0].deleted_at) {
            res.status(400).json({ success: false, message: 'Kayıt zaten aktif' });
            return;
        }

        await pool.query(
            `UPDATE visitor_records
             SET deleted_at = NULL,
                 updated_at = now()
             WHERE id = $1`,
            [id]
        );

        await logDataChange(
            'visitor_records',
            id,
            'UPDATE',
            { deleted_at: 'TIMESTAMP' },
            { deleted_at: null },
            userId,
            clientIp
        );

        res.status(200).json({ success: true, message: 'Kayıt geri alındı' });
    } catch (error) {
        console.error('Restore visitor record error:', error);
        res.status(500).json({ success: false, message: 'Kayıt geri alınırken hata oluştu' });
    }
};

/**
 * Undo visitor exit
 * POST /api/visitors/records/:id/undo-exit
 */
export const undoVisitorExit = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const clientIp = getClientIp(req);

        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        const recordCheck = await pool.query('SELECT id, status FROM visitor_records WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (recordCheck.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        if (recordCheck.rows[0].status !== 'exited') {
            res.status(400).json({ success: false, message: 'Sadece çıkış yapmış kayıtlar geri alınabilir' });
            return;
        }

        await pool.query(
            `UPDATE visitor_records
             SET exit_date = NULL,
                 exit_time = NULL,
                 exit_by = NULL,
                 exit_by_name = NULL,
                 status = 'inside',
                 updated_at = now()
             WHERE id = $1`,
            [id]
        );

        await logDataChange(
            'visitor_records',
            id,
            'UPDATE',
            { status: 'exited' },
            { status: 'inside', exit_date: null },
            req.user?.userId || null,
            clientIp
        );

        res.status(200).json({ success: true, message: 'Çıkış işlemi geri alındı' });

        emitApiMutation({
            method: 'POST',
            path: `/api/visitors/records/${id}/undo-exit`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/visitors/records/${id}/undo-exit`),
        });
    } catch (error) {
        console.error('Undo visitor exit error:', error);
        res.status(500).json({ success: false, message: 'Çıkış geri alınırken hata oluştu' });
    }
};

/**
 * POST /api/visitors/send-whatsapp-message
 */
export const sendVisitorWhatsAppMessage = async (req: Request, res: Response): Promise<void> => {
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
        console.error('Send visitor WhatsApp message error:', error);
        res.status(500).json({
            success: false,
            message: 'WhatsApp mesajı gönderilirken hata oluştu.',
        });
    }
};
