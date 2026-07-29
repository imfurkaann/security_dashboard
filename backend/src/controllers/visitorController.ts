import { Request, Response } from 'express';
import pool from '../config/database';
import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizePlainText, normalizePlate, isValidNumber } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
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

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILTER_LENGTH = 120;
const MAX_EXPORT_ROWS = 50000;
const isValidIsoDate = (value: string): boolean => {
    if (!ISO_DATE_PATTERN.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const VISITOR_BOOLEAN_FIELDS = [
    'subcontractor_worker',
    'for_electric_station',
    'daily_guest',
    'entry_tag',
    'exit_tag',
    'tour_entry',
    'tour_exit',
    'meeting',
    'delivery',
    'guide',
    'send_whatsapp',
] as const;

const hasValidBooleanInputs = (body: Record<string, unknown>): boolean =>
    VISITOR_BOOLEAN_FIELDS.every((field) => body[field] === undefined || typeof body[field] === 'boolean');

const isValidCountInput = (value: unknown, min: number): boolean =>
    (typeof value === 'string' || typeof value === 'number')
    && isValidNumber(value, { min, max: 999, integer: true });

const isRequestBodyObject = (body: unknown): boolean =>
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

/**
 * Get all visitor records with joins
 * GET /api/visitors/records
 */
export const getVisitorRecords = async (req: Request, res: Response): Promise<void> => {
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

        const textFilterNames = ['full_name', 'vehicle_plate', 'company_name', 'visiting_person', 'phone', 'entry_by', 'exit_by', 'gate'] as const;
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
            filters.push(`vr.deleted_at IS NULL`);
        }

        // Apply query filters
        if (req.query.full_name) {
            filters.push(`LOWER(translate(vr.full_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramIndex++}, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`);
            queryParams.push(`%${req.query.full_name}%`);
        }

        if (req.query.vehicle_plate) {
            filters.push(`LOWER(translate(vr.vehicle_plate, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramIndex++}, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`);
            queryParams.push(`%${req.query.vehicle_plate}%`);
        }

        if (req.query.company_name) {
            filters.push(`LOWER(translate(vr.company_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramIndex++}, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`);
            queryParams.push(`%${req.query.company_name}%`);
        }

        if (req.query.visiting_person) {
            filters.push(`LOWER(translate(vr.visiting_person, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramIndex++}, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`);
            queryParams.push(`%${req.query.visiting_person}%`);
        }

        if (req.query.phone) {
            filters.push(`LOWER(vr.phone) LIKE LOWER($${paramIndex++})`);
            queryParams.push(`%${req.query.phone}%`);
        }

        if (req.query.entry_by) {
            filters.push(`(LOWER(translate(vr.entry_by_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramIndex}, 'IİĞÜŞÖÇ', 'ıiğüşöç')) OR LOWER(translate(CONCAT(pe.first_name, ' ', pe.last_name), 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramIndex}, 'IİĞÜŞÖÇ', 'ıiğüşöç')))`);
            queryParams.push(`%${req.query.entry_by}%`);
            paramIndex++;
        }

        if (req.query.exit_by) {
            filters.push(`(LOWER(translate(vr.exit_by_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramIndex}, 'IİĞÜŞÖÇ', 'ıiğüşöç')) OR LOWER(translate(CONCAT(px.first_name, ' ', px.last_name), 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramIndex}, 'IİĞÜŞÖÇ', 'ıiğüşöç')))`);
            queryParams.push(`%${req.query.exit_by}%`);
            paramIndex++;
        }

        if (req.query.status && req.query.status !== 'all') {
            if (req.query.status === 'deleted') {
                filters.push(`vr.deleted_at IS NOT NULL`);
            } else {
                filters.push(`vr.status = $${paramIndex++} AND vr.deleted_at IS NULL`);
                queryParams.push(req.query.status);
            }
        }

        if (req.query.gate && req.query.gate !== 'all') {
            filters.push(`vr.gate = $${paramIndex++}`);
            queryParams.push(req.query.gate);
        }

        if (req.query.entryDateStart) {
            filters.push(`vr.entry_date >= $${paramIndex++}::date`);
            queryParams.push(req.query.entryDateStart);
        }

        if (req.query.entryDateEnd) {
            filters.push(`vr.entry_date <= $${paramIndex++}::date`);
            queryParams.push(req.query.entryDateEnd);
        }

        if (req.query.exitDateStart) {
            filters.push(`vr.exit_date >= $${paramIndex++}::date`);
            queryParams.push(req.query.exitDateStart);
        }

        if (req.query.exitDateEnd) {
            filters.push(`vr.exit_date <= $${paramIndex++}::date`);
            queryParams.push(req.query.exitDateEnd);
        }

        if (req.query.activityDate) {
            filters.push(`(
                vr.entry_date = $${paramIndex}::date
                OR vr.exit_date = $${paramIndex}::date
                OR vr.deleted_at::date = $${paramIndex}::date
                OR (vr.deleted_at IS NULL AND vr.status = 'inside')
            )`);
            queryParams.push(req.query.activityDate);
            paramIndex++;
        }

        // Tag filters
        if (req.query.subcontractor_worker === 'true') {
            filters.push(`vr.subcontractor_worker = true`);
        }
        if (req.query.for_electric_station === 'true') {
            filters.push(`vr.for_electric_station = true`);
        }
        if (req.query.daily_guest === 'true') {
            filters.push(`vr.daily_guest = true`);
        }
        if (req.query.entry_tag === 'true') {
            filters.push(`vr.entry_tag = true`);
        }
        if (req.query.exit_tag === 'true') {
            filters.push(`vr.exit_tag = true`);
        }
        if (req.query.tour_entry === 'true') {
            filters.push(`vr.tour_entry = true`);
        }
        if (req.query.tour_exit === 'true') {
            filters.push(`vr.tour_exit = true`);
        }
        if (req.query.meeting === 'true') {
            filters.push(`vr.meeting = true`);
        }
        if (req.query.delivery === 'true') {
            filters.push(`vr.delivery = true`);
        }
        if (req.query.guide === 'true') {
            filters.push(`vr.guide = true`);
        }

        const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

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
                vr.tour_entry,
                vr.tour_exit,
                vr.meeting,
                vr.delivery,
                vr.guide,
                vr.entry_date,
                vr.entry_time,
                vr.exit_date,
                vr.exit_time,
                vr.status,
                vr.created_at,
                vr.deleted_at,
                vr.entry_by_name,
                vr.exit_by_name,
                vr.is_qr,
                pe.first_name as entry_by_first_name,
                pe.last_name as entry_by_last_name,
                px.first_name as exit_by_first_name,
                px.last_name as exit_by_last_name
            FROM visitor_records vr
            LEFT JOIN personnel pe ON vr.entry_by = pe.id
            LEFT JOIN personnel px ON vr.exit_by = px.id
            ${whereClause}
            ORDER BY vr.entry_date DESC, vr.entry_time DESC, vr.id DESC
            ${limitClause}
        `;
        const result = await pool.query(query, queryParams);

        if (unlimited && result.rows.length > MAX_EXPORT_ROWS) {
            res.status(413).json({ success: false, message: 'Dışa aktarım sonucu çok büyük; lütfen tarih aralığını daraltın' });
            return;
        }

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
            tour_entry: row.tour_entry,
            tour_exit: row.tour_exit,
            meeting: row.meeting,
            delivery: row.delivery,
            guide: row.guide,
            entry_date: row.entry_date,
            entry_time: row.entry_time,
            exit_date: row.exit_date,
            exit_time: row.exit_time,
            status: row.status,
            deleted_at: row.deleted_at || null,
            entry_by: (row.entry_by_first_name || row.entry_by_last_name)
                ? `${row.entry_by_first_name || ''} ${row.entry_by_last_name || ''}${row.is_qr ? ' (QR)' : ''}`.trim()
                : (row.entry_by_name ? `${row.entry_by_name}${row.is_qr ? ' (QR)' : ''}` : null),
            exit_by: (row.exit_by_first_name || row.exit_by_last_name)
                ? `${row.exit_by_first_name || ''} ${row.exit_by_last_name || ''}${row.is_qr ? ' (QR)' : ''}`.trim()
                : (row.exit_by_name ? `${row.exit_by_name}${row.is_qr ? ' (QR)' : ''}` : null),
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
        if (!isRequestBodyObject(req.body)) {
            res.status(400).json({ success: false, message: 'Geçersiz istek gövdesi' });
            return;
        }

        const { vehicle_plate, full_name, company_name, visiting_person, person_count, children_count, phone, notes, subcontractor_worker, for_electric_station, daily_guest, entry_tag, exit_tag, tour_entry, tour_exit, meeting, delivery, guide, entry_time, entry_date, highlight_color } = req.body;
        const personnel_id = req.user?.userId || null;
        const clientIp = getClientIp(req);
        const gate = await getResolvedGateFromRequest(req);

        const textInputs: Array<[unknown, number]> = [
            [vehicle_plate, 20],
            [full_name, 100],
            [company_name, 100],
            [visiting_person, 100],
            [phone, 20],
            [notes, 1000],
        ];
        if (textInputs.some(([value, max]) => value !== undefined && value !== null && (typeof value !== 'string' || value.length > max))) {
            res.status(400).json({ success: false, message: 'Ziyaretçi metin alanlarından biri geçersiz veya çok uzun' });
            return;
        }

        if (!hasValidBooleanInputs(req.body)) {
            res.status(400).json({ success: false, message: 'Geçersiz ziyaretçi seçim değeri' });
            return;
        }

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

        // entry_date validasyonu (YYYY-MM-DD formatı)
        let validEntryDate: string | null = null;
        if (entry_date !== undefined && entry_date !== null && entry_date !== '') {
            if (typeof entry_date !== 'string' || !isValidIsoDate(entry_date)) {
                res.status(400).json({ success: false, message: 'Geçersiz giriş tarihi' });
                return;
            }
            validEntryDate = entry_date;
        }

        // entry_time validasyonu (HH:MM formatı)
        if (entry_time !== undefined && entry_time !== null && entry_time !== '' && (typeof entry_time !== 'string' || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(entry_time))) {
            res.status(400).json({ success: false, message: 'Giriş saati HH:MM formatında olmalıdır' });
            return;
        }

        // person_count opsiyonel
        let personCountValue: number | null = null;
        if (person_count !== undefined && person_count !== null && person_count !== '') {
            if (!isValidCountInput(person_count, 1)) {
                res.status(400).json({ success: false, message: 'Kişi sayısı geçerli bir sayı olmalı ve en az 1 olmalıdır' });
                return;
            }
            personCountValue = Number(person_count);
        }

        let childrenCountValue = 0;
        if (children_count !== undefined && children_count !== null && children_count !== '') {
            if (!isValidCountInput(children_count, 0)) {
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
                entry_tag, exit_tag, tour_entry, tour_exit, meeting, delivery, guide, entry_by, entry_date, entry_time, status, send_whatsapp
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
                COALESCE($23::date, CURRENT_DATE), 
                COALESCE($24::time, CURRENT_TIME), 
                'inside', $25
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
            Boolean(tour_entry),
            Boolean(tour_exit),
            Boolean(meeting),
            Boolean(delivery),
            Boolean(guide),
            personnel_id,
            validEntryDate,
            entry_time || null,  // entry_time boşsa null, CURRENT_TIME kullanılacak
            sendWhatsApp
        ];

        const client = await pool.connect();
        let insertResult;
        try {
            await client.query('BEGIN');
            insertResult = await client.query(insertQuery, values);
            await client.query('COMMIT');
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

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
                    meeting: Boolean(meeting),
                    delivery: Boolean(delivery),
                    notes: sanitizedNotes || undefined
                });
            } catch (error) {
                console.error('WhatsApp mesaj oluşturma hatası:', error);
            }
        }

        res.status(201).json({ success: true, message: 'Ziyaretçi girişi kaydedildi', data: { id }, whatsappMessage });
    } catch (error) {
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
        if (!isRequestBodyObject(req.body)) {
            res.status(400).json({ success: false, message: 'Geçersiz istek gövdesi' });
            return;
        }

        const { id } = req.params;
        const { vehicle_plate, full_name, company_name, visiting_person, person_count, children_count, phone, notes, subcontractor_worker, for_electric_station, daily_guest, entry_tag, exit_tag, tour_entry, tour_exit, meeting, delivery, guide, entry_time, exit_time, entry_date, highlight_color } = req.body;
        const clientIp = getClientIp(req);

        // GÜVENLİK: UUID validasyonu
        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        const recordCheck = await pool.query('SELECT * FROM visitor_records WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (recordCheck.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        const textInputs: Array<[unknown, number]> = [
            [vehicle_plate, 20],
            [full_name, 100],
            [company_name, 100],
            [visiting_person, 100],
            [phone, 20],
            [notes, 1000],
        ];
        if (textInputs.some(([value, max]) => value !== undefined && value !== null && (typeof value !== 'string' || value.length > max))) {
            res.status(400).json({ success: false, message: 'Ziyaretçi metin alanlarından biri geçersiz veya çok uzun' });
            return;
        }

        if (!hasValidBooleanInputs(req.body)) {
            res.status(400).json({ success: false, message: 'Geçersiz ziyaretçi seçim değeri' });
            return;
        }

        const currentStatus = recordCheck.rows[0].status;

        // entry_date validasyonu (YYYY-MM-DD formatı)
        if (entry_date !== undefined && (typeof entry_date !== 'string' || !isValidIsoDate(entry_date))) {
            res.status(400).json({ success: false, message: 'Geçersiz giriş tarihi' });
            return;
        }

        // entry_time ve exit_time validasyonu
        if (entry_time !== undefined && (typeof entry_time !== 'string' || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(entry_time))) {
            res.status(400).json({ success: false, message: 'Giriş saati HH:MM formatında olmalıdır' });
            return;
        }
        if (exit_time !== undefined && exit_time !== null && exit_time !== '' && (typeof exit_time !== 'string' || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(exit_time))) {
            res.status(400).json({ success: false, message: 'Çıkış saati HH:MM formatında olmalıdır' });
            return;
        }

        if (currentStatus === 'exited' && exit_time !== undefined && (exit_time === null || exit_time === '')) {
            res.status(400).json({ success: false, message: 'Çıkış yapmış kayıtta çıkış saati boş bırakılamaz' });
            return;
        }

        if (currentStatus === 'inside' && exit_time) {
            res.status(400).json({ success: false, message: 'İçerideki ziyaretçiye düzenleme ekranından çıkış saati verilemez' });
            return;
        }

        if (person_count !== undefined && person_count !== null && person_count !== '' && !isValidCountInput(person_count, 1)) {
            res.status(400).json({ success: false, message: 'Kişi sayısı geçerli bir sayı olmalı ve en az 1 olmalıdır' });
            return;
        }

        if (children_count !== undefined && children_count !== null && children_count !== '' && !isValidCountInput(children_count, 0)) {
            res.status(400).json({ success: false, message: 'Çocuk sayısı geçerli bir sayı olmalı ve en az 0 olmalıdır' });
            return;
        }

        // Opsiyonel alanlar için sadece girilmiş olanları güncelle
        const updates: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (vehicle_plate !== undefined) {
            updates.push(`vehicle_plate = $${idx++}`);
            params.push(vehicle_plate ? normalizePlate(vehicle_plate) : null);
        }
        if (full_name !== undefined) { updates.push(`full_name = $${idx++}`); params.push(sanitizePlainText(full_name, 100)); }
        if (company_name !== undefined) { updates.push(`company_name = $${idx++}`); params.push(sanitizePlainText(company_name, 100)); }
        if (visiting_person !== undefined) { updates.push(`visiting_person = $${idx++}`); params.push(sanitizePlainText(visiting_person, 100)); }
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
        if (tour_entry !== undefined) { updates.push(`tour_entry = $${idx++}`); params.push(Boolean(tour_entry)); }
        if (tour_exit !== undefined) { updates.push(`tour_exit = $${idx++}`); params.push(Boolean(tour_exit)); }
        if (meeting !== undefined) { updates.push(`meeting = $${idx++}`); params.push(Boolean(meeting)); }
        if (delivery !== undefined) { updates.push(`delivery = $${idx++}`); params.push(Boolean(delivery)); }
        if (guide !== undefined) { updates.push(`guide = $${idx++}`); params.push(Boolean(guide)); }
        if (highlight_color !== undefined) { updates.push(`highlight_color = $${idx++}`); params.push(normalizeVisitorHighlightColor(highlight_color)); }
        if (phone !== undefined) {
            updates.push(`phone = $${idx++}`);
            params.push(phone ? phone.replace(/[\s\-()]/g, '').trim() : null);
        }
        if (notes !== undefined) { updates.push(`notes = $${idx++}`); params.push(sanitizePlainText(notes, 1000)); }
        if (entry_date !== undefined) {
            updates.push(`entry_date = $${idx++}`);
            params.push(entry_date || null);
        }
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
            recordCheck.rows[0] || null,
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
        if (!isRequestBodyObject(req.body)) {
            res.status(400).json({ success: false, message: 'Geçersiz istek gövdesi' });
            return;
        }

        const { id } = req.params;
        const { exit_time } = req.body;
        const clientIp = getClientIp(req);

        // GÜVENLİK: UUID validasyonu
        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        // exit_time validasyonu
        if (exit_time !== undefined && exit_time !== null && exit_time !== '' && (typeof exit_time !== 'string' || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(exit_time))) {
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

        const updateResult = await pool.query(
            `UPDATE visitor_records 
             SET exit_date = CURRENT_DATE, 
                 exit_time = COALESCE($3::time, CURRENT_TIME), 
                 exit_by = $2,
                 status = 'exited', 
                 updated_at = now() 
             WHERE id = $1
               AND deleted_at IS NULL
               AND status = 'inside'
             RETURNING full_name, company_name, visiting_person, vehicle_plate, 
                       person_count, children_count, gate, phone, subcontractor_worker, 
                       for_electric_station, daily_guest, meeting, delivery, notes, exit_time, send_whatsapp`,
            [id, personnel_id, exit_time || null]
        );

        if (updateResult.rowCount !== 1) {
            res.status(409).json({ success: false, message: 'Ziyaretçi çıkışı başka bir işlem tarafından kaydedildi' });
            return;
        }

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
            if (updateResult.rows.length > 0 && updateResult.rows[0].send_whatsapp) {
                const record = updateResult.rows[0];
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
                    meeting: Boolean(record.meeting),
                    delivery: Boolean(record.delivery),
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

        const deleteResult = await pool.query(
            `UPDATE visitor_records
             SET deleted_at = CURRENT_TIMESTAMP,
                 updated_at = now()
             WHERE id = $1
               AND deleted_at IS NULL
             RETURNING id`,
            [id]
        );

        if (deleteResult.rowCount !== 1) {
            res.status(409).json({ success: false, message: 'Kayıt başka bir işlem tarafından silindi' });
            return;
        }

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

        const restoreResult = await pool.query(
            `UPDATE visitor_records
             SET deleted_at = NULL,
                 updated_at = now()
             WHERE id = $1
               AND deleted_at IS NOT NULL
             RETURNING id`,
            [id]
        );

        if (restoreResult.rowCount !== 1) {
            res.status(409).json({ success: false, message: 'Kayıt başka bir işlem tarafından geri alındı' });
            return;
        }

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

        const undoResult = await pool.query(
            `UPDATE visitor_records
             SET exit_date = NULL,
                 exit_time = NULL,
                 exit_by = NULL,
                 exit_by_name = NULL,
                 status = 'inside',
                 updated_at = now()
             WHERE id = $1
               AND deleted_at IS NULL
               AND status = 'exited'
             RETURNING id`,
            [id]
        );

        if (undoResult.rowCount !== 1) {
            res.status(409).json({ success: false, message: 'Çıkış kaydı başka bir işlem tarafından güncellendi' });
            return;
        }

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
        if (!isRequestBodyObject(req.body)) {
            res.status(400).json({ success: false, message: 'Geçersiz istek gövdesi' });
            return;
        }

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

/**
 * Get all pending QR visitors
 * GET /api/visitors/pending-qr
 */
export const getPendingQrVisitors = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = `
            SELECT id, vehicle_plate, full_name, company_name, visiting_person,
                   person_count, children_count, phone, gate, status, created_at
            FROM pending_qr_visitors
            WHERE status = 'pending'
            ORDER BY created_at ASC
        `;
        const result = await pool.query(query);
        
        // Decode stored HTML entities if any
        const formatted = result.rows.map((row: any) => ({
            id: row.id,
            vehicle_plate: row.vehicle_plate,
            full_name: decodeStoredHtmlEntities(row.full_name),
            company_name: decodeStoredHtmlEntities(row.company_name),
            visiting_person: decodeStoredHtmlEntities(row.visiting_person),
            person_count: row.person_count,
            children_count: row.children_count ?? 0,
            phone: row.phone,
            gate: row.gate,
            status: row.status,
            created_at: row.created_at
        }));
        
        res.status(200).json(formatted);
    } catch (error) {
        console.error('Get pending QR visitors error:', error);
        res.status(500).json({ success: false, message: 'Bekleyen QR kayıtları listelenirken hata oluştu' });
    }
};

/**
 * Reject a pending QR visitor
 * POST /api/visitors/pending-qr/:id/reject
 */
export const rejectPendingQrVisitor = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const personnel_id = req.user?.userId || null;
        const clientIp = getClientIp(req);

        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        const updateResult = await pool.query(
            `UPDATE pending_qr_visitors
             SET status = 'rejected', updated_at = NOW()
             WHERE id = $1 AND status = 'pending'
             RETURNING id`,
            [id]
        );
        if (updateResult.rowCount !== 1) {
            res.status(404).json({ success: false, message: 'Bekleyen kayıt bulunamadı veya zaten işlendi' });
            return;
        }

        await logDataChange(
            'pending_qr_visitors',
            id,
            'UPDATE',
            { status: 'pending' },
            { status: 'rejected' },
            personnel_id,
            clientIp
        );

        res.status(200).json({ success: true, message: 'QR kaydı reddedildi' });
    } catch (error) {
        console.error('Reject pending QR visitor error:', error);
        res.status(500).json({ success: false, message: 'Kayıt reddedilirken hata oluştu' });
    }
};

/**
 * Approve a pending QR visitor and save to visitor_records
 * POST /api/visitors/pending-qr/:id/approve
 */
export const approvePendingQrVisitor = async (req: Request, res: Response): Promise<void> => {
    let client: PoolClient | null = null;
    try {
        if (!isRequestBodyObject(req.body)) {
            res.status(400).json({ success: false, message: 'Geçersiz istek gövdesi' });
            return;
        }

        const { id } = req.params;
        const {
            vehicle_plate,
            full_name,
            company_name,
            visiting_person,
            person_count,
            children_count,
            phone,
            notes,
            highlight_color,
            subcontractor_worker,
            for_electric_station,
            daily_guest,
            entry_tag,
            exit_tag,
            tour_entry,
            tour_exit,
            meeting,
            delivery,
            guide,
            entry_time,
            send_whatsapp
        } = req.body;

        const personnel_id = req.user?.userId || null;
        const clientIp = getClientIp(req);

        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        if (!personnel_id) {
            res.status(401).json({ success: false, message: 'Kullanıcı doğrulanmadı. Lütfen giriş yapın.' });
            return;
        }

        // Get personnel name to store in entry_by_name
        const personnelCheck = await pool.query('SELECT first_name, last_name FROM personnel WHERE id = $1', [personnel_id]);
        if (personnelCheck.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Onaylayan personel bulunamadı' });
            return;
        }
        const personnelName = `${personnelCheck.rows[0].first_name || ''} ${personnelCheck.rows[0].last_name || ''}`.trim();

        // Check if pending record exists
        const pendingCheck = await pool.query('SELECT id, gate FROM pending_qr_visitors WHERE id = $1 AND status = \'pending\'', [id]);
        if (pendingCheck.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Bekleyen kayıt bulunamadı veya zaten onaylandı/reddedildi' });
            return;
        }
        const gate = pendingCheck.rows[0].gate;

        const textInputs: Array<[unknown, number]> = [
            [vehicle_plate, 20],
            [full_name, 100],
            [company_name, 100],
            [visiting_person, 100],
            [phone, 20],
            [notes, 1000],
        ];
        if (textInputs.some(([value, max]) => value !== undefined && value !== null && (typeof value !== 'string' || value.length > max))) {
            res.status(400).json({ success: false, message: 'QR ziyaretçi metin alanlarından biri geçersiz veya çok uzun' });
            return;
        }

        if (!hasValidBooleanInputs(req.body)) {
            res.status(400).json({ success: false, message: 'Geçersiz ziyaretçi seçim değeri' });
            return;
        }

        if (person_count !== undefined && person_count !== null && person_count !== '' && !isValidCountInput(person_count, 1)) {
            res.status(400).json({ success: false, message: 'Kişi sayısı 1-999 arasında bir tam sayı olmalıdır' });
            return;
        }

        if (children_count !== undefined && children_count !== null && children_count !== '' && !isValidCountInput(children_count, 0)) {
            res.status(400).json({ success: false, message: 'Çocuk sayısı 0-999 arasında bir tam sayı olmalıdır' });
            return;
        }

        // Validations
        const sanitizedFullName = sanitizePlainText(full_name, 100);
        const sanitizedCompanyName = sanitizePlainText(company_name, 100);
        const sanitizedVisitingPerson = sanitizePlainText(visiting_person, 100);
        const sanitizedNotes = sanitizePlainText(notes, 1000);
        const normalizedPlate = normalizePlate(vehicle_plate);
        const normalizedPhone = phone ? String(phone).replace(/[\s\-()]/g, '').trim() : null;

        if (!sanitizedFullName) {
            res.status(400).json({ success: false, message: 'Ad Soyad zorunludur' });
            return;
        }

        if (normalizedPlate && normalizedPlate.length > 20) {
            res.status(400).json({ success: false, message: 'Araç plakası 20 karakterden uzun olamaz' });
            return;
        }

        if (phone && phone.length > 20) {
            res.status(400).json({ success: false, message: 'Telefon numarası 20 karakterden uzun olamaz' });
            return;
        }

        if (entry_time !== undefined && entry_time !== null && entry_time !== '' && (typeof entry_time !== 'string' || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(entry_time))) {
            res.status(400).json({ success: false, message: 'Giriş saati HH:MM formatında olmalıdır' });
            return;
        }

        const personCountToInsert = (person_count === '' || person_count === null || isNaN(person_count)) ? 1 : Number(person_count);
        const childrenCountValue = (children_count === '' || children_count === null || isNaN(children_count)) ? 0 : Number(children_count);
        const normalizedHighlightColor = normalizeVisitorHighlightColor(highlight_color);

        const newRecordId = uuidv4();

        client = await pool.connect();
        await client.query('BEGIN');

        const claimResult = await client.query(
            `UPDATE pending_qr_visitors
             SET status = 'approved', updated_at = NOW()
             WHERE id = $1 AND status = 'pending'
             RETURNING id`,
            [id]
        );
        if (claimResult.rowCount !== 1) {
            await client.query('ROLLBACK');
            res.status(409).json({ success: false, message: 'QR kaydı başka bir işlem tarafından işlendi' });
            return;
        }

        // 1. Insert into visitor_records
        const insertQuery = `
            INSERT INTO visitor_records (
                id, vehicle_plate, full_name, company_name, visiting_person,
                person_count, children_count, gate, phone, notes, highlight_color, subcontractor_worker, for_electric_station, daily_guest,
                entry_tag, exit_tag, tour_entry, tour_exit, meeting, delivery, guide, entry_by, entry_by_name, entry_date, entry_time, status, send_whatsapp, is_qr
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
                CURRENT_DATE, 
                COALESCE($24::time, CURRENT_TIME), 
                'inside', $25, TRUE
            )
            RETURNING entry_date, entry_time
        `;

        const insertResult = await client.query(insertQuery, [
            newRecordId,
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
            Boolean(tour_entry),
            Boolean(tour_exit),
            Boolean(meeting),
            Boolean(delivery),
            Boolean(guide),
            personnel_id,
            personnelName,
            entry_time || null,
            Boolean(send_whatsapp)
        ]);

        await client.query('COMMIT');

        // GÜVENLİK: Audit log kaydı
        await logDataChange(
            'visitor_records',
            newRecordId,
            'INSERT',
            null,
            { vehicle_plate: normalizedPlate, full_name: sanitizedFullName, company_name: sanitizedCompanyName, source: 'qr_approved' },
            personnel_id,
            clientIp
        );

        // WhatsApp message logic (only if send_whatsapp is true)
        let whatsappMessage = '';
        if (Boolean(send_whatsapp)) {
            try {
                const entryDate = insertResult.rows[0]?.entry_date || new Date().toISOString().split('T')[0];
                const timeString = insertResult.rows[0]?.entry_time || new Date().toLocaleTimeString('tr-TR');
                const formattedEntryTime = timeString.substring(0, 5);

                whatsappMessage = createVisitorRecordMessage({
                    fullName: sanitizedFullName || undefined,
                    companyName: sanitizedCompanyName || undefined,
                    visitingPerson: sanitizedVisitingPerson || undefined,
                    entryDate,
                    entryTime: formattedEntryTime,
                    gate: gate || undefined,
                    vehiclePlate: normalizedPlate || undefined,
                    personCount: personCountToInsert,
                    childrenCount: childrenCountValue,
                    phone: normalizedPhone || undefined,
                    subcontractorWorker: Boolean(subcontractor_worker),
                    forElectricStation: Boolean(for_electric_station),
                    dailyGuest: Boolean(daily_guest),
                    meeting: Boolean(meeting),
                    delivery: Boolean(delivery),
                    notes: sanitizedNotes || undefined
                });
            } catch (error) {
                console.error('WhatsApp message generation error:', error);
            }
        }

        res.status(201).json({ success: true, message: 'Ziyaretçi girişi onaylandı', data: { id: newRecordId }, whatsappMessage });
    } catch (error) {
        if (client) {
            await client.query('ROLLBACK').catch(() => undefined);
        }
        console.error('Approve pending QR visitor error:', error);
        res.status(500).json({ success: false, message: 'Kayıt onaylanırken hata oluştu' });
    } finally {
        if (client) {
            client.release();
        }
    }
};
