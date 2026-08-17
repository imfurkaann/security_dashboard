import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizeInput, sanitizePlainText, isValidEnum, isValidLength } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { getResolvedGateFromRequest } from '../utils/gate';
import { createWordFromHtml } from '../utils/wordGenerator';
import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

// Geçerli severity ve type değerleri
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const VALID_TYPES = ['general', 'security', 'fire', 'medical', 'theft', 'vandalism', 'other'] as const;
const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
const VALID_SHIFT_LABELS = ['00:00 - 08:00', '08:00 - 16:00', '16:00 - 00:00'] as const;
const INCIDENT_CATEGORY_COLUMNS = [
    'theft_guest_property', 'theft_hotel_property', 'theft_personnel',
    'assault_physical', 'assault_verbal', 'assault_mass_fight',
    'substance_personnel', 'substance_property',
    'vandalism_room', 'vandalism_common_area',
    'unauthorized_room', 'unauthorized_restricted_area',
    'accident_slip_fall', 'accident_equipment', 'accident_work',
    'medical_serious', 'medical_first_aid', 'medical_ambulance',
    'fire_real', 'fire_false_alarm', 'fire_evacuation',
    'security_cctv_malfunction', 'other'
] as const;
const MAX_PAGE_SIZE = 500;
const MAX_EXPORT_ROWS = 10_000;
const MAX_FILTER_LENGTH = 120;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isRequestBodyObject = (body: unknown): body is Record<string, unknown> =>
    body !== null && typeof body === 'object' && !Array.isArray(body);

const isValidIsoDate = (value: string): boolean => {
    if (!ISO_DATE_PATTERN.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const parsePaginationValue = (value: unknown, fallback: number, min: number, max: number): number | null => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
};

const normalizeCategories = (value: unknown): Record<string, boolean> | null => {
    if (value === undefined || value === null) return {};
    if (!isRequestBodyObject(value)) return null;

    const normalized: Record<string, boolean> = {};
    for (const [key, selected] of Object.entries(value)) {
        if (!(INCIDENT_CATEGORY_COLUMNS as readonly string[]).includes(key) || typeof selected !== 'boolean') {
            return null;
        }
        normalized[key] = selected;
    }
    return normalized;
};

const escapeForWordHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\n/g, '<br>');

const deleteGeneratedReportFile = (filePath: string | null | undefined): void => {
    if (!filePath) return;
    try {
        const reportsRoot = path.resolve(process.cwd(), 'reports');
        const resolvedPath = path.resolve(filePath);
        if (resolvedPath !== reportsRoot && resolvedPath.startsWith(`${reportsRoot}${path.sep}`) && fs.existsSync(resolvedPath)) {
            fs.unlinkSync(resolvedPath);
        }
    } catch (error) {
        console.error('Eski rapor dosyası silinemedi:', error);
    }
};

// Tüm rapor kayıtlarını getir (gate filtresi YOK - tüm raporları göster)
export const getIncidentRecords = async (req: Request, res: Response) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        const includeDeleted = req.query.includeDeleted === 'true';
        const unlimited = req.query.unlimited === 'true';
        const page = parsePaginationValue(req.query.page, 1, 1, 1_000_000);
        const requestedLimit = parsePaginationValue(req.query.limit, 200, 1, MAX_PAGE_SIZE);
        const requestedOffset = parsePaginationValue(req.query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
        if (page === null || requestedLimit === null || requestedOffset === null) {
            res.status(400).json({ success: false, message: 'Geçersiz sayfalama parametresi' });
            return;
        }

        const reported_by = typeof req.query.reported_by === 'string' ? req.query.reported_by.trim() : '';
        const gate = typeof req.query.gate === 'string' ? req.query.gate.trim() : '';
        const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : '';
        const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
        const status = typeof req.query.status === 'string' ? req.query.status.trim() : 'all';
        const severity = typeof req.query.severity === 'string' ? req.query.severity.trim() : '';
        const incidentType = typeof req.query.incident_type === 'string' ? req.query.incident_type.trim() : '';
        const dateStart = typeof req.query.dateStart === 'string' ? req.query.dateStart : '';
        const dateEnd = typeof req.query.dateEnd === 'string' ? req.query.dateEnd : '';

        if (reported_by.length > MAX_FILTER_LENGTH || gate.length > MAX_FILTER_LENGTH || keyword.length > 200
            || (category !== '' && !(INCIDENT_CATEGORY_COLUMNS as readonly string[]).includes(category))
            || !['all', 'open', 'resolved', 'deleted'].includes(status)
            || (severity !== '' && !isValidEnum(severity, VALID_SEVERITIES))
            || (incidentType !== '' && !isValidEnum(incidentType, VALID_TYPES))
            || [dateStart, dateEnd].some((value) => value !== '' && !isValidIsoDate(value))) {
            res.status(400).json({ success: false, message: 'Geçersiz filtre parametresi' });
            return;
        }
        if (unlimited && (!dateStart || !dateEnd)) {
            res.status(400).json({ success: false, message: 'Sınırsız indirme için başlangıç ve bitiş tarihi gereklidir' });
            return;
        }

        const incidentsHasGate = async (): Promise<boolean> => {
            try {
                const info = await pool.query(
                    "SELECT column_name FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'gate' LIMIT 1"
                );
                return info.rows.length > 0;
            } catch (e) {
                return false;
            }
        };

        const hasGate = await incidentsHasGate();

        const whereClauses: string[] = [];
        const queryParams: any[] = [];
        let paramCounter = 1;

        if (status === 'deleted') {
            whereClauses.push(`i.deleted_at IS NOT NULL`);
        } else if (!includeDeleted || status !== 'all') {
            whereClauses.push(`i.deleted_at IS NULL`);
        }

        if (status === 'open') whereClauses.push(`i.resolved = false`);
        if (status === 'resolved') whereClauses.push(`i.resolved = true`);

        if (reported_by) {
            whereClauses.push(`LOWER(translate(COALESCE(NULLIF(CONCAT_WS(' ', p.first_name, p.last_name), ''), i.recorded_by_name, ''), 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramCounter++}, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`);
            queryParams.push(`%${reported_by}%`);
        }

        if (keyword) {
            whereClauses.push(`LOWER(translate(CONCAT_WS(' ', i.description, i.report_content, i.location, i.shift_label), 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramCounter++}, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`);
            queryParams.push(`%${keyword}%`);
        }

        if (category) whereClauses.push(`COALESCE(ic.${category}, false) = true`);
        if (severity) {
            whereClauses.push(`i.severity = $${paramCounter++}`);
            queryParams.push(severity);
        }
        if (incidentType) {
            whereClauses.push(`i.incident_type = $${paramCounter++}`);
            queryParams.push(incidentType);
        }

        if (hasGate && gate) {
            whereClauses.push(`i.gate = $${paramCounter++}`);
            queryParams.push(gate);
        }

        if (dateStart) {
            whereClauses.push(`COALESCE(i.report_date, i.incident_time::date, i.created_at::date) >= $${paramCounter++}::date`);
            queryParams.push(dateStart);
        }
        if (dateEnd) {
            whereClauses.push(`COALESCE(i.report_date, i.incident_time::date, i.created_at::date) <= $${paramCounter++}::date`);
            queryParams.push(dateEnd);
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        let paginationString = `LIMIT ${MAX_EXPORT_ROWS + 1}`;
        if (!unlimited) {
            const offset = req.query.offset === undefined
                ? (page - 1) * requestedLimit
                : requestedOffset;
            paginationString = `LIMIT $${paramCounter++} OFFSET $${paramCounter++}`;
            queryParams.push(requestedLimit, offset);
        }

        const gateSelect = hasGate ? 'i.gate' : 'NULL AS gate';

        const query = `
            SELECT 
                COUNT(*) OVER()::int AS total_count,
                i.id,
                i.description,
                i.incident_type,
                i.severity,
                i.location,
                i.shift_label,
                i.report_content,
                ${gateSelect},
                i.report_date,
                CASE WHEN i.resolved THEN 'resolved' ELSE 'open' END as status,
                i.created_at,
                i.incident_time,
                i.resolved,
                i.resolution_notes,
                i.resolved_at,
                i.deleted_at,
                CASE WHEN ic.incident_id IS NULL THEN NULL ELSE to_jsonb(ic) - 'id' - 'incident_id' - 'created_at' - 'updated_at' END AS categories,
                COALESCE(NULLIF(CONCAT_WS(' ', p.first_name, p.last_name), ''), i.recorded_by_name) as reported_by
            FROM incidents i
            LEFT JOIN personnel p ON i.recorded_by = p.id
            LEFT JOIN incident_categories ic ON ic.incident_id = i.id
            ${whereString}
            ORDER BY i.incident_time DESC, i.id DESC
            ${paginationString}
        `;
        
        const result = await pool.query(query, queryParams);
        if (unlimited && result.rows.length > MAX_EXPORT_ROWS) {
            res.status(413).json({ success: false, message: 'İndirme sonucu çok büyük; lütfen tarih aralığını daraltın' });
            return;
        }
        const total = Number(result.rows[0]?.total_count ?? 0);
        const data = result.rows.map(({ total_count: _totalCount, ...row }) => row);
        res.setHeader('X-Total-Count', String(total));
        res.json({ success: true, data, total });
    } catch (error) {
        console.error('Get incidents error:', error);
        res.status(500).json({ success: false, message: 'Olay kayıtları alınamadı' });
    }
};

// Yeni rapor kaydı oluştur
export const createIncidentRecord = async (req: Request, res: Response) => {
    try {
        if (!isRequestBodyObject(req.body)) {
            return res.status(400).json({ success: false, message: 'Geçersiz istek gövdesi' });
        }
        const { description, incident_type, severity, location, shift_label, fire_alarm, fire_count, fire_location } = req.body;
        const userId = req.user?.userId;
        const clientIp = getClientIp(req);

        // Kullanıcı doğrulama
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
        }

        // En az bir açıklama olmalı
        if ((description !== undefined && typeof description !== 'string')
            || (location !== undefined && location !== null && typeof location !== 'string')
            || (shift_label !== undefined && shift_label !== null && typeof shift_label !== 'string')
            || (fire_location !== undefined && fire_location !== null && typeof fire_location !== 'string')
            || (fire_alarm !== undefined && typeof fire_alarm !== 'boolean')
            || (fire_count !== undefined && (typeof fire_count !== 'number' || !Number.isInteger(fire_count) || fire_count < 1 || fire_count > 999))
            || (severity !== undefined && severity !== null && typeof severity !== 'string')
            || (incident_type !== undefined && incident_type !== null && typeof incident_type !== 'string')) {
            return res.status(400).json({ success: false, message: 'Geçersiz olay kaydı alanı' });
        }

        const descriptionText = typeof description === 'string' ? description : '';
        const locationText = typeof location === 'string' ? location : null;
        const shiftLabelText = typeof shift_label === 'string' ? shift_label : null;
        const fireLocationText = typeof fire_location === 'string' ? fire_location : null;
        const fireCount = typeof fire_count === 'number' ? fire_count : undefined;

        if (!descriptionText && !shiftLabelText) {
            return res.status(400).json({ success: false, message: 'Açıklama veya vardiya bilgisi gereklidir' });
        }

        // GÜVENLİK: Input validasyonu ve sanitizasyonu
        const sanitizedDescription = sanitizeInput(descriptionText, 5000);
        const sanitizedLocation = sanitizeInput(locationText, 200);
        const sanitizedShiftLabel = sanitizeInput(shiftLabelText, 100);
        const sanitizedFireLocation = sanitizeInput(fireLocationText, 200);

        // GÜVENLİK: Uzunluk kontrolleri
        if (!isValidLength(sanitizedDescription, 0, 5000)) {
            return res.status(400).json({ success: false, message: 'Açıklama 5000 karakteri geçemez' });
        }
        if (!isValidLength(sanitizedLocation, 0, 200)) {
            return res.status(400).json({ success: false, message: 'Konum 200 karakteri geçemez' });
        }

        // GÜVENLİK: Severity validasyonu
        const severityText = typeof severity === 'string' ? severity : null;
        const incidentTypeText = typeof incident_type === 'string' ? incident_type : null;
        if (severityText && !isValidEnum(severityText, VALID_SEVERITIES)) {
            return res.status(400).json({ success: false, message: 'Geçersiz önem derecesi' });
        }

        // GÜVENLİK: incident_type validasyonu
        const finalType = incidentTypeText && isValidEnum(incidentTypeText, VALID_TYPES) ? incidentTypeText : 'general';

        const id = uuidv4();
        const resolvedGate = await getResolvedGateFromRequest(req);

        // Tam açıklama oluştur (vardiys bilgisi + açıklama + yangın bilgisi)
        let fullDescription = sanitizedDescription || '';
        if (sanitizedShiftLabel) {
            fullDescription = `[${sanitizedShiftLabel}] ${fullDescription}`;
        }
        if (fire_alarm === true && fireCount) {
            fullDescription += `\n\n🔥 YANGIN ALARMI: ${fireCount} kez - Konum: ${sanitizedFireLocation || 'Belirtilmedi'}`;
        }

        // check if incidents.gate exists before attempting to insert it
        const colInfo = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'gate' LIMIT 1");
        const hasGateCol = colInfo.rows.length > 0;

        let result;
        if (hasGateCol) {
            result = await pool.query(
                `INSERT INTO incidents (
                    id, description, incident_type, severity, location, 
                    recorded_by, resolved, incident_time, gate
                ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW(), $7) 
                RETURNING *`,
                [id, fullDescription, finalType, severityText, sanitizedLocation, userId, resolvedGate]
            );
        } else {
            result = await pool.query(
                `INSERT INTO incidents (
                    id, description, incident_type, severity, location, 
                    recorded_by, resolved, incident_time
                ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW()) 
                RETURNING *`,
                [id, fullDescription, finalType, severityText, sanitizedLocation, userId]
            );
        }

        // GÜVENLİK: Audit log kaydı
        await logDataChange(
            'incidents',
            id,
            'INSERT',
            null,
            { incident_type: finalType, severity: severityText, location: sanitizedLocation },
            userId,
            clientIp
        );

        res.status(201).json({ success: true, data: result.rows[0], message: 'Olay kaydedildi' });
    } catch (error) {
        console.error('Create incident error:', error);
        res.status(500).json({ success: false, message: 'Olay kaydedilemedi' });
    }
};

// Olay durumunu güncelle
export const updateIncidentStatus = async (req: Request, res: Response) => {
    try {
        if (!isRequestBodyObject(req.body)) {
            return res.status(400).json({ success: false, message: 'Geçersiz istek gövdesi' });
        }
        const { id } = req.params;
        const { status, resolution_notes } = req.body;
        const userId = req.user?.userId;
        const clientIp = getClientIp(req);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
        }

        // GÜVENLİK: UUID validasyonu
        if (!isValidUUID(id)) {
            return res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
        }

        // GÜVENLİK: Status validasyonu
        if (typeof status !== 'string' || !isValidEnum(status, VALID_STATUSES)) {
            return res.status(400).json({ success: false, message: 'Geçersiz durum' });
        }

        if (resolution_notes !== undefined && resolution_notes !== null && typeof resolution_notes !== 'string') {
            return res.status(400).json({ success: false, message: 'Geçersiz çözüm notu' });
        }
        const sanitizedNotes = typeof resolution_notes === 'string' ? sanitizePlainText(resolution_notes, 2000) : null;

        // Mevcut durumu al (audit log için)
        const oldRecord = await pool.query(
            'SELECT resolved, resolution_notes FROM incidents WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (oldRecord.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
        }

        // status değerini boolean resolved'a çevir
        const isResolved = status === 'resolved' || status === 'closed';

        const result = await pool.query(
            `UPDATE incidents 
             SET resolved = $1, 
                 resolution_notes = $2,
                 resolved_by = CASE WHEN $1 = true THEN $3 ELSE NULL END,
                 resolved_at = CASE WHEN $1 = true THEN NOW() ELSE NULL END,
                 updated_at = NOW()
             WHERE id = $4 AND deleted_at IS NULL`,
            [isResolved, sanitizedNotes, userId, id]
        );

        if (result.rowCount !== 1) {
            return res.status(409).json({ success: false, message: 'Kayıt işlem sırasında değiştirildi' });
        }

        // GÜVENLİK: Audit log kaydı
        await logDataChange(
            'incidents',
            id,
            'UPDATE',
            { resolved: oldRecord.rows[0].resolved },
            { resolved: isResolved, resolution_notes: sanitizedNotes },
            userId,
            clientIp
        );

        res.status(200).json({ success: true, message: 'Olay durumu güncellendi' });
    } catch (error) {
        console.error('Update incident error:', error);
        res.status(500).json({ success: false, message: 'Olay güncellenemedi' });
    }
};

// Vardiya raporu kaydı oluştur
export const createShiftReport = async (req: Request, res: Response) => {
    try {
        if (!isRequestBodyObject(req.body)) {
            return res.status(400).json({ success: false, message: 'Geçersiz istek gövdesi' });
        }
        const { shift_label, report_content, categories } = req.body;
        const userId = req.user?.userId;
        const clientIp = getClientIp(req);

        // Kullanıcı doğrulama
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
        }

        // Gerekli alanlar kontrolü
        if (typeof shift_label !== 'string' || typeof report_content !== 'string' || !shift_label || !report_content) {
            return res.status(400).json({
                success: false,
                message: 'Vardiya etiketi ve rapor içeriği gereklidir'
            });
        }

        if (!isValidEnum(shift_label, VALID_SHIFT_LABELS)) {
            return res.status(400).json({ success: false, message: 'Geçersiz vardiya etiketi' });
        }
        const normalizedCategories = normalizeCategories(categories);
        if (normalizedCategories === null) {
            return res.status(400).json({ success: false, message: 'Geçersiz olay kategorisi' });
        }

        // GÜVENLİK: Input validasyonu ve sanitizasyonu
        const sanitizedShiftLabel = sanitizeInput(shift_label, 100);
        // Rapor içeriği düz metindir, HTML escape yapılmaz (textarea'da gösterilir, innerHTML ile render edilmez)
        const sanitizedReportContent = sanitizePlainText(report_content, 50000);

        // Null kontrolü
        if (!sanitizedShiftLabel || !sanitizedReportContent) {
            return res.status(400).json({
                success: false,
                message: 'Geçersiz giriş verisi'
            });
        }

        // GÜVENLİK: Uzunluk kontrolleri
        if (!isValidLength(sanitizedShiftLabel, 1, 100)) {
            return res.status(400).json({ success: false, message: 'Vardiya etiketi 1-100 karakter arası olmalıdır' });
        }
        if (!isValidLength(sanitizedReportContent, 1, 50000)) {
            return res.status(400).json({ success: false, message: 'Rapor içeriği 50000 karakteri geçemez' });
        }

        // Gate'i önceden al
        const resolvedGate = await getResolvedGateFromRequest(req);

        // Aynı vardiya, tarih ve kapı için mevcut rapor var mı kontrol et
        const existingReport = await pool.query(
            `SELECT id FROM incidents 
             WHERE shift_label = $1 AND report_date = CURRENT_DATE AND (gate = $2 OR (gate IS NULL AND $2 IS NULL)) AND deleted_at IS NULL 
             LIMIT 1`,
            [sanitizedShiftLabel, resolvedGate]
        );

        if (existingReport.rows.length > 0) {
            // Mevcut rapor varsa güncellemeye yönlendir (PUT endpoint kullanılmalı)
            return res.status(409).json({
                success: false,
                message: 'Bu vardiya için bugün zaten bir rapor mevcut. Lütfen güncelleme yapın.',
                existingId: existingReport.rows[0].id
            });
        }

        // Raporu kaydeden kişinin bilgisini al
        const userResult = await pool.query(
            'SELECT first_name, last_name FROM personnel WHERE id = $1',
            [userId]
        );
        const reporterName = userResult.rows[0]
            ? `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`
            : undefined;

        // Word dosyası oluştur (düz metin içeriği HTML formatına çevir)
        let wordFilePath: string;
        
        try {
            // Düz metni basit HTML formatına çevir (satır sonlarını <br> yap)
            const htmlForWord = escapeForWordHtml(sanitizedReportContent);
            wordFilePath = await createWordFromHtml(htmlForWord, sanitizedShiftLabel, reporterName, resolvedGate);
        } catch (wordError) {
            console.error('Word dosyası oluşturma hatası:', wordError);
            return res.status(500).json({ success: false, message: 'Word dosyası oluşturulamadı' });
        }

        // insert with/without gate depending on schema
        const id = uuidv4();
        const shiftColInfo = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'gate' LIMIT 1");
        const hasGateForShift = shiftColInfo.rows.length > 0;

        const client = await pool.connect();
        let createdRecord: Record<string, unknown>;
        try {
            await client.query('BEGIN');
            let resultShift;
            if (hasGateForShift) {
                resultShift = await client.query(
                `INSERT INTO incidents (
                    id, shift_label, report_content, description, 
                    incident_type, severity, resolved, 
                    recorded_by, incident_time, report_date, report_file_path, gate
                ) VALUES ($1, $2, $3, $4, $5, $6, false, $7, NOW(), CURRENT_DATE, $8, $9) 
                RETURNING *`,
                [
                    id,
                    sanitizedShiftLabel,
                    sanitizedReportContent,
                    `Vardiya Raporu: ${sanitizedShiftLabel}`,
                    'general',
                    'low',
                    userId,
                    wordFilePath,
                    resolvedGate
                ]
                );
            } else {
                resultShift = await client.query(
                `INSERT INTO incidents (
                    id, shift_label, report_content, description, 
                    incident_type, severity, resolved, 
                    recorded_by, incident_time, report_date, report_file_path
                ) VALUES ($1, $2, $3, $4, $5, $6, false, $7, NOW(), CURRENT_DATE, $8) 
                RETURNING *`,
                [
                    id,
                    sanitizedShiftLabel,
                    sanitizedReportContent,
                    `Vardiya Raporu: ${sanitizedShiftLabel}`,
                    'general',
                    'low',
                    userId,
                    wordFilePath
                ]
                );
            }

            if (Object.keys(normalizedCategories).length > 0) {
                const categoryColumns = Object.keys(normalizedCategories);
                const categoryPlaceholders = categoryColumns.map((_, index) => `$${index + 2}`).join(', ');
                const categoryValues = categoryColumns.map((key) => normalizedCategories[key]);
                await client.query(
                    `INSERT INTO incident_categories (incident_id, ${categoryColumns.join(', ')})
                     VALUES ($1, ${categoryPlaceholders})`,
                    [id, ...categoryValues]
                );
            }

            await client.query('COMMIT');
            createdRecord = resultShift.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            deleteGeneratedReportFile(wordFilePath);
            throw error;
        } finally {
            client.release();
        }

        // Audit log, ana kayıt işlemini engellemeden veritabanı işlemi tamamlandıktan sonra yazılır.
        await logDataChange(
            'incidents',
            id,
            'INSERT',
            null,
            { shift_label: sanitizedShiftLabel, report_type: 'shift_report', file_path: wordFilePath },
            userId,
            clientIp
        );

        res.status(201).json({
            success: true,
            data: createdRecord,
            message: 'Vardiya raporu kaydedildi ve Word dosyası oluşturuldu'
        });
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505') {
            res.status(409).json({ success: false, message: 'Bu vardiya için rapor zaten oluşturulmuş' });
            return;
        }
        console.error('Create shift report error:', error);
        res.status(500).json({ success: false, message: 'Vardiya raporu kaydedilemedi' });
    }
};

// Bugünkü vardiya raporunu getir
export const getShiftReport = async (req: Request, res: Response) => {
    try {
        const { shift_label } = req.params;
        if (!isValidEnum(shift_label, VALID_SHIFT_LABELS)) {
            return res.status(400).json({ success: false, message: 'Geçersiz vardiya etiketi' });
        }
        const resolvedGate = await getResolvedGateFromRequest(req);

        // Bugünkü tarihe göre rapor ara
        const colInfo = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'incidents' AND column_name = 'gate' LIMIT 1");
        const hasGate = colInfo.rows.length > 0;

        let result;
        if (hasGate) {
            result = await pool.query(
                `SELECT i.id, i.shift_label, i.report_content, i.report_date, i.report_file_path, 
                        i.created_at, i.recorded_by, i.gate
                 FROM incidents i
                 WHERE i.shift_label = $1 
                     AND i.report_date = CURRENT_DATE 
                     AND (i.gate = $2 OR (i.gate IS NULL AND $2 IS NULL))
                     AND i.deleted_at IS NULL
                 ORDER BY i.created_at DESC 
                 LIMIT 1`,
                [shift_label, resolvedGate]
            );
        } else {
            result = await pool.query(
                `SELECT i.id, i.shift_label, i.report_content, i.report_date, i.report_file_path, 
                        i.created_at, i.recorded_by, NULL AS gate
                 FROM incidents i
                 WHERE i.shift_label = $1 
                     AND i.report_date = CURRENT_DATE 
                     AND i.deleted_at IS NULL
                 ORDER BY i.created_at DESC 
                 LIMIT 1`,
                [shift_label]
            );
        }

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Rapor bulunamadı' });
        }

        // Kategorileri de getir
        const categoryResult = await pool.query(
            'SELECT * FROM incident_categories WHERE incident_id = $1',
            [result.rows[0].id]
        );

        const responseData = {
            ...result.rows[0],
            categories: categoryResult.rows.length > 0 ? categoryResult.rows[0] : null
        };

        res.json({ success: true, data: responseData });
    } catch (error) {
        console.error('Get shift report error:', error);
        res.status(500).json({ success: false, message: 'Rapor alınamadı' });
    }
};

// Vardiya raporunu güncelle
export const updateShiftReport = async (req: Request, res: Response) => {
    try {
        if (!isRequestBodyObject(req.body)) {
            return res.status(400).json({ success: false, message: 'Geçersiz istek gövdesi' });
        }
        const { id } = req.params;
        const { report_content, categories } = req.body;
        const userId = req.user?.userId;
        const clientIp = getClientIp(req);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
        }

        if (!isValidUUID(id)) {
            return res.status(400).json({ success: false, message: 'Geçersiz rapor kimliği' });
        }

        if (typeof report_content !== 'string' || !report_content) {
            return res.status(400).json({ success: false, message: 'Rapor içeriği gereklidir' });
        }
        const normalizedCategories = normalizeCategories(categories);
        if (normalizedCategories === null) {
            return res.status(400).json({ success: false, message: 'Geçersiz olay kategorisi' });
        }

        // Mevcut raporu kontrol et (gate bilgisini de al)
        const existing = await pool.query(
            'SELECT shift_label, report_file_path, gate FROM incidents WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Rapor bulunamadı' });
        }

        const shiftLabel = existing.rows[0].shift_label;
        const existingGate = existing.rows[0].gate;

        // Input sanitizasyonu - düz metin olduğu için HTML escape yapılmaz
        const sanitizedReportContent = sanitizePlainText(report_content, 50000);

        if (!sanitizedReportContent) {
            return res.status(400).json({ success: false, message: 'Geçersiz giriş verisi' });
        }

        if (!isValidLength(sanitizedReportContent, 1, 50000)) {
            return res.status(400).json({ success: false, message: 'Rapor içeriği 50000 karakteri geçemez' });
        }

        // Raporu güncelleyen kişinin bilgisini al
        const userResult = await pool.query(
            'SELECT first_name, last_name FROM personnel WHERE id = $1',
            [userId]
        );
        const reporterName = userResult.rows[0]
            ? `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`
            : undefined;

        // Yeni Word dosyası oluştur (düz metni HTML formatına çevir)
        let wordFilePath: string;
        try {
            // Düz metni basit HTML formatına çevir (satır sonlarını <br> yap)
            const htmlForWord = escapeForWordHtml(sanitizedReportContent);
            wordFilePath = await createWordFromHtml(htmlForWord, shiftLabel, reporterName, existingGate);
        } catch (wordError) {
            console.error('Word dosyası oluşturma hatası:', wordError);
            return res.status(500).json({ success: false, message: 'Word dosyası oluşturulamadı' });
        }

        // Rapor ve kategoriler tek işlemde güncellenir; ikisinden biri başarısızsa
        // kullanıcıya yarım/yanlış filtrelenen bir kayıt bırakılmaz.
        const client = await pool.connect();
        let updatedRecord: Record<string, unknown>;
        try {
            await client.query('BEGIN');
            const result = await client.query(
                `UPDATE incidents
                 SET report_content = $1,
                     report_file_path = $2,
                     updated_at = NOW()
                 WHERE id = $3 AND deleted_at IS NULL
                 RETURNING *`,
                [sanitizedReportContent, wordFilePath, id]
            );
            if (result.rowCount !== 1) {
                throw new Error('Rapor güncelleme sırasında değiştirildi veya silindi');
            }

            if (Object.keys(normalizedCategories).length > 0) {
                const categoryColumns = Object.keys(normalizedCategories);
                const updateFields = categoryColumns
                    .map((key, index) => `${key} = $${index + 2}`)
                    .join(', ');
                const categoryValues = categoryColumns.map((key) => normalizedCategories[key]);
                const categoryPlaceholders = categoryColumns.map((_, index) => `$${index + 2}`).join(', ');

                await client.query(
                    `INSERT INTO incident_categories (incident_id, ${categoryColumns.join(', ')})
                     VALUES ($1, ${categoryPlaceholders})
                     ON CONFLICT (incident_id) DO UPDATE
                     SET ${updateFields}, updated_at = NOW()`,
                    [id, ...categoryValues]
                );
            }

            await client.query('COMMIT');
            updatedRecord = result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            deleteGeneratedReportFile(wordFilePath);
            throw error;
        } finally {
            client.release();
        }

        await logDataChange(
            'incidents',
            id,
            'UPDATE',
            existing.rows[0],
            { report_content: sanitizedReportContent, report_file_path: wordFilePath },
            userId,
            clientIp
        );

        deleteGeneratedReportFile(existing.rows[0].report_file_path);

        res.json({
            success: true,
            data: updatedRecord,
            message: 'Vardiya raporu güncellendi ve yeni Word dosyası oluşturuldu'
        });
    } catch (error) {
        console.error('Update shift report error:', error);
        res.status(500).json({ success: false, message: 'Rapor güncellenemedi' });
    }
};

// Raporları Word dosyası olarak dışa aktar
export const exportIncidentRecordsAsWord = async (req: Request, res: Response) => {
    try {
        if (!isRequestBodyObject(req.body)) {
            return res.status(400).json({ success: false, message: 'Geçersiz istek gövdesi' });
        }
        const { dateStart, dateEnd, reported_by, gate, keyword, category, status, severity, incident_type } = req.body;

        if (typeof dateStart !== 'string' || typeof dateEnd !== 'string'
            || !isValidIsoDate(dateStart) || !isValidIsoDate(dateEnd)
            || (reported_by !== undefined && (typeof reported_by !== 'string' || reported_by.length > MAX_FILTER_LENGTH))
            || (gate !== undefined && (typeof gate !== 'string' || gate.length > MAX_FILTER_LENGTH))
            || (keyword !== undefined && (typeof keyword !== 'string' || keyword.length > 200))
            || (category !== undefined && (typeof category !== 'string' || !(INCIDENT_CATEGORY_COLUMNS as readonly string[]).includes(category)))
            || (status !== undefined && (typeof status !== 'string' || !['all', 'open', 'resolved', 'deleted'].includes(status)))
            || (severity !== undefined && (typeof severity !== 'string' || !isValidEnum(severity, VALID_SEVERITIES)))
            || (incident_type !== undefined && (typeof incident_type !== 'string' || !isValidEnum(incident_type, VALID_TYPES)))) {
            return res.status(400).json({ success: false, message: 'Geçersiz dışa aktarma filtresi' });
        }

        const whereClauses = [
            'COALESCE(i.report_date, i.incident_time::date, i.created_at::date) >= $1::date',
            'COALESCE(i.report_date, i.incident_time::date, i.created_at::date) <= $2::date'
        ];
        const queryParams: string[] = [dateStart, dateEnd];
        let parameterIndex = 3;

        if (reported_by?.trim()) {
            whereClauses.push(`LOWER(translate(COALESCE(NULLIF(CONCAT_WS(' ', p.first_name, p.last_name), ''), i.recorded_by_name, ''), 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${parameterIndex++}, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`);
            queryParams.push(`%${reported_by.trim()}%`);
        }
        if (gate?.trim()) {
            whereClauses.push(`i.gate = $${parameterIndex++}`);
            queryParams.push(gate.trim());
        }
        if (keyword?.trim()) {
            whereClauses.push(`LOWER(translate(CONCAT_WS(' ', i.description, i.report_content, i.location, i.shift_label), 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${parameterIndex++}, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`);
            queryParams.push(`%${keyword.trim()}%`);
        }
        if (category) whereClauses.push(`COALESCE(ic.${category}, false) = true`);
        if (status === 'deleted') whereClauses.push('i.deleted_at IS NOT NULL');
        if (status === 'open') whereClauses.push('i.deleted_at IS NULL', 'i.resolved = false');
        if (status === 'resolved') whereClauses.push('i.deleted_at IS NULL', 'i.resolved = true');
        if (severity) {
            whereClauses.push(`i.severity = $${parameterIndex++}`);
            queryParams.push(severity);
        }
        if (incident_type) {
            whereClauses.push(`i.incident_type = $${parameterIndex++}`);
            queryParams.push(incident_type);
        }

        const recordsResult = await pool.query(
            `SELECT
                i.id, i.shift_label, i.report_content, i.description, i.report_date, i.created_at, i.gate, i.deleted_at,
                COALESCE(NULLIF(CONCAT_WS(' ', p.first_name, p.last_name), ''), i.recorded_by_name) AS reported_by
             FROM incidents i
             LEFT JOIN personnel p ON i.recorded_by = p.id
             LEFT JOIN incident_categories ic ON ic.incident_id = i.id
             WHERE ${whereClauses.join(' AND ')}
             ORDER BY i.incident_time DESC, i.id DESC
             LIMIT ${MAX_EXPORT_ROWS + 1}`,
            queryParams
        );
        if (recordsResult.rows.length > MAX_EXPORT_ROWS) {
            return res.status(413).json({ success: false, message: 'İndirme sonucu çok büyük; lütfen tarih aralığını daraltın' });
        }
        const records = recordsResult.rows;
        if (records.length === 0) {
            return res.status(404).json({ success: false, message: 'Dışa aktarılacak rapor bulunamadı' });
        }

        // Raporları gün ve kapıya göre grupla
        interface GroupKey {
            dayKey: string;
            gate: string;
        }
        
        const groupMap = new Map<string, any[]>();

        records.forEach((record: any) => {
            // Tarih parse et - eğer ISO string ise (2026-05-12T00:00:00Z gibi), timezone'u düzelt
            let dayKey = '';
            
            if (record.report_date) {
                const dateStr = record.report_date;
                if (dateStr.includes('T')) {
                    // ISO format: 2026-05-11T21:00:00Z -> Türkiye timezone'unda 2026-05-12 olabilir
                    const date = new Date(dateStr);
                    // Türkiye: UTC+3
                    const turkeyDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
                    dayKey = turkeyDate.toISOString().split('T')[0];
                } else {
                    // Zaten DATE formatı: 2026-05-12
                    dayKey = dateStr.split('T')[0];
                }
            } else {
                // created_at fallback
                const date = new Date(record.created_at);
                const turkeyDate = new Date(date.getTime() + 3 * 60 * 60 * 1000);
                dayKey = turkeyDate.toISOString().split('T')[0];
            }
            
            const gate = record.gate || 'Belirsiz';
            const groupKey = `${dayKey}|${gate}`;

            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, []);
            }
            groupMap.get(groupKey)!.push(record);
        });

        // Grupları sırala (gün descending, sonra kapı ascending)
        const sortedGroups = Array.from(groupMap.entries())
            .sort((a, b) => {
                const [dayA, gateA] = a[0].split('|');
                const [dayB, gateB] = b[0].split('|');
                const dayCompare = dayB.localeCompare(dayA);
                return dayCompare !== 0 ? dayCompare : gateA.localeCompare(gateB);
            });

        // Her gün/kapı kombinasyonu için Word dosyası oluştur
        const zip = new JSZip();
        const reportsFolder = zip.folder('Vardiya_Raporları');

        for (const [groupKey, groupRecords] of sortedGroups) {
            const [dayKey, gate] = groupKey.split('|');
            
            // Klasör yapısını oluştur: 2026-Mayis/12/AnaKapı/
            // Timezone problemi yaşanmasın diye string'den direkt parse et
            const [year, monthStr, dayStr] = dayKey.split('-');
            const monthNum = parseInt(monthStr, 10) - 1; // 0-indexed
            const monthNames = ["Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran", "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"];
            const monthName = monthNames[monthNum];
            const monthFolderName = `${year}-${monthName}`;
            const safeGateName = gate.replace(/\//g, '-');

            const folderPath = `${monthFolderName}/${dayStr}/${safeGateName}`;
            const dayFolder = reportsFolder!.folder(folderPath);

            // Her rapor için ayrı Word dosyası oluştur
            for (const record of groupRecords) {
                try {
                    const doc = new Document({
                        sections: [{
                            properties: {},
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: `VARDIYA RAPORU`,
                                            bold: true,
                                        })
                                    ],
                                    heading: HeadingLevel.HEADING_1,
                                }),
                                new Paragraph({ text: '' }),
                                new Paragraph({
                                    text: `Tarih: ${record.report_date || record.created_at}`,
                                }),
                                new Paragraph({
                                    text: `Vardiya: ${record.shift_label || '-'}`,
                                }),
                                new Paragraph({
                                    text: `Raporu Kaydeden: ${record.reported_by}`,
                                }),
                                new Paragraph({
                                    text: `Kapı: ${record.gate || '-'}`,
                                }),
                                new Paragraph({
                                    text: `Durum: ${record.deleted_at ? 'Silindi' : 'Aktif'}`,
                                }),
                                new Paragraph({ text: '' }),
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: 'İçerik:',
                                            bold: true,
                                        })
                                    ],
                                }),
                                new Paragraph({
                                    text: record.report_content || record.description || '-',
                                }),
                            ],
                        }],
                    });

                    const buffer = await Packer.toBuffer(doc);
                    // Dosya ismi: rapor_08-00-16-00.docx (vardiya bilgisine göre)
                    const fileName = `rapor_${(record.shift_label || 'belirsiz').replace(/:/g, '-')}.docx`;
                    dayFolder!.file(fileName, buffer);
                } catch (error) {
                    console.error(`Rapor dosyası oluşturma hatası:`, error);
                }
            }
        }

        // ZIP'i buffer'a çevir
        const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

        // Response'u gönder
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="Vardiya_Raporlari_Export.zip"');
        res.send(Buffer.from(zipBuffer));
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ success: false, message: 'Raporlar dışa aktarılamadı' });
    }
};

