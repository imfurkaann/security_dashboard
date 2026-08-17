import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizeInput } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import {
    hashTC,
    deleteFile,
    getFilePath,
    hashPassport,
    getTCHashCandidates,
    getPassportHashCandidates
} from '../utils/fileUpload';
import path from 'path';

interface SgkFileMeta {
    id: string;
    record_id: string;
    file_name: string;
    original_file_name: string | null;
    mime_type: string | null;
    size_bytes: number | null;
    sort_order: number;
    created_at: string;
}

const escapeLikePattern = (value: string): string => value.replace(/[\\%_]/g, '\\$&');

const extractUploadedFiles = (req: Request): Express.Multer.File[] => {
    const filesFromSingle = req.file ? [req.file] : [];

    if (!req.files) {
        return filesFromSingle;
    }

    if (Array.isArray(req.files)) {
        return [...filesFromSingle, ...req.files];
    }

    const filesMap = req.files as { [fieldname: string]: Express.Multer.File[] };
    const filesFromFields = Object.values(filesMap).flat();
    return [...filesFromSingle, ...filesFromFields];
};

const mapFileRow = (row: any): SgkFileMeta => ({
    id: row.id,
    record_id: row.sgk_record_id,
    // Stored names may contain identifier fragments and are never exposed.
    file_name: row.original_file_name || `belge-${Number(row.sort_order || 0) + 1}`,
    original_file_name: row.original_file_name,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    sort_order: row.sort_order,
    created_at: row.created_at
});

const getRecordFilesByIds = async (recordIds: string[]): Promise<Map<string, SgkFileMeta[]>> => {
    const grouped = new Map<string, SgkFileMeta[]>();

    if (recordIds.length === 0) {
        return grouped;
    }

    const query = `
        SELECT
            id,
            sgk_record_id,
            stored_file_name,
            original_file_name,
            mime_type,
            size_bytes,
            sort_order,
            created_at
        FROM sgk_record_files
        WHERE deleted_at IS NULL AND sgk_record_id = ANY($1::uuid[])
        ORDER BY sgk_record_id, sort_order, created_at
    `;

    const result = await pool.query(query, [recordIds]);

    for (const row of result.rows) {
        const file = mapFileRow(row);
        const current = grouped.get(file.record_id) || [];
        current.push(file);
        grouped.set(file.record_id, current);
    }

    return grouped;
};

const withFallbackFile = (record: any, files: SgkFileMeta[]): SgkFileMeta[] => {
    if (files.length > 0) {
        return files;
    }

    if (!record.file_path) {
        return [];
    }

    const legacyExtension = String(record.file_path).match(/\.(pdf|jpe?g|png)$/i)?.[0]?.toLowerCase() || '';

    return [
        {
            id: '',
            record_id: record.id,
            file_name: `SGK-belgesi${legacyExtension}`,
            original_file_name: `SGK-belgesi${legacyExtension}`,
            mime_type: null,
            size_bytes: null,
            sort_order: 0,
            created_at: record.created_at
        }
    ];
};

const mapRecordResponse = (record: any, fileMap: Map<string, SgkFileMeta[]>) => {
    const files = withFallbackFile(record, fileMap.get(record.id) || []);
    return {
        id: record.id,
        full_name: record.full_name,
        company_name: record.company_name,
        file_path: files[0]?.file_name || null,
        files,
        file_count: files.length,
        upload_date: record.upload_date,
        notes: record.notes,
        personnel: (record.personnel_first_name || record.personnel_last_name)
            ? `${record.personnel_first_name || ''} ${record.personnel_last_name || ''}${record.is_qr ? ' (QR)' : ''}`.trim()
            : null,
        created_at: record.created_at
    };
};

const resolveContentType = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();

    switch (ext) {
        case 'pdf':
            return 'application/pdf';
        case 'jpg':
        case 'jpeg':
            return 'image/jpeg';
        case 'png':
            return 'image/png';
        default:
            return 'application/octet-stream';
    }
};

const sendStoredFile = (res: Response, fileName: string, originalFileName?: string | null): void => {
    const filePath = getFilePath(fileName);
    const fs = require('fs');

    if (!fs.existsSync(filePath)) {
        res.status(404).json({ success: false, message: `Dosya bulunamadı: ${fileName}` });
        return;
    }

    const contentType = resolveContentType(fileName);
    res.setHeader('Content-Type', contentType);
    const safeOriginalName = path.basename(originalFileName || `SGK-belgesi.${fileName.split('.').pop() || 'bin'}`)
        .replace(/[\r\n"]/g, '_');
    const encodedFileName = encodeURIComponent(safeOriginalName);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFileName}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');

    res.sendFile(filePath, (err) => {
        if (err && !res.headersSent) {
            res.status(500).json({ success: false, message: 'Dosya gönderilirken hata oluştu' });
        }
    });
};

/**
 * Get all SGK records
 * GET /api/sgk/records
 */
export const getSgkRecords = async (req: Request, res: Response): Promise<void> => {
    try {
        const limitQuery = req.query.limit;
        const offsetQuery = req.query.offset;
        const unlimited = req.query.unlimited === 'true' && req.user?.role === 'admin';

        const full_name = typeof req.query.full_name === 'string' ? sanitizeInput(req.query.full_name.trim(), 100) : '';
        const company_name = typeof req.query.company_name === 'string' ? sanitizeInput(req.query.company_name.trim(), 100) : '';

        const whereClauses: string[] = [];
        const queryParams: any[] = [];
        let paramCounter = 1;

        whereClauses.push(`sr.deleted_at IS NULL`);

        if (full_name) {
            whereClauses.push(`LOWER(translate(sr.full_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramCounter++}, 'IİĞÜŞÖÇ', 'ıiğüşöç')) ESCAPE '\\'`);
            queryParams.push(`%${escapeLikePattern(full_name)}%`);
        }

        if (company_name) {
            whereClauses.push(`LOWER(translate(sr.company_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${paramCounter++}, 'IİĞÜŞÖÇ', 'ıiğüşöç')) ESCAPE '\\'`);
            queryParams.push(`%${escapeLikePattern(company_name)}%`);
        }

        const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        let paginationString = '';
        if (!unlimited) {
            const parsedLimit = Number.parseInt(String(limitQuery || '200'), 10);
            const parsedOffset = Number.parseInt(String(offsetQuery || '0'), 10);
            const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 200, 1), 200);
            const offset = Math.max(Number.isFinite(parsedOffset) ? parsedOffset : 0, 0);
            paginationString = `LIMIT $${paramCounter++} OFFSET $${paramCounter++}`;
            queryParams.push(limit, offset);
        }

        const query = `
            SELECT 
                sr.id,
                sr.full_name,
                sr.company_name,
                sr.file_path,
                sr.upload_date,
                sr.notes,
                sr.created_at,
                sr.is_qr,
                COUNT(*) OVER()::int AS total_count,
                p.first_name as personnel_first_name,
                p.last_name as personnel_last_name
            FROM sgk_records sr
            LEFT JOIN personnel p ON sr.personnel_id = p.id
            ${whereString}
            ORDER BY sr.upload_date DESC, sr.id DESC
            ${paginationString}
        `;
        const result = await pool.query(query, queryParams);

        const recordIds = result.rows.map((row: any) => row.id);
        const fileMap = await getRecordFilesByIds(recordIds);
        const formattedData = result.rows.map((row: any) => mapRecordResponse(row, fileMap));
        const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;

        res.status(200).json({
            success: true,
            data: formattedData,
            total
        });
    } catch (error) {
        console.error('Get SGK records error:', error);
        res.status(500).json({ success: false, message: 'SGK kayıtları listelenirken hata oluştu' });
    }
};

/**
 * Create new SGK record with file upload
 * POST /api/sgk/records
 * Supports optional TC or Passport number (cannot be provided together)
 */
export const createSgkRecord = async (req: Request, res: Response): Promise<void> => {
    let committed = false;
    try {
        const { tc_no, passport_no, full_name, company_name, notes } = req.body;
        const personnel_id = req.user?.userId || null;
        const clientIp = getClientIp(req);
        const uploadedFiles = extractUploadedFiles(req);

        // Validasyonlar
        if (typeof full_name !== 'string' || !full_name.trim() || uploadedFiles.length === 0) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'Ad Soyad ve en az bir belge dosyası zorunludur' });
            return;
        }

        if ((company_name != null && typeof company_name !== 'string') || (notes != null && typeof notes !== 'string')) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'Metin alanlarının biçimi geçersiz' });
            return;
        }

        const hasTCInput = typeof tc_no === 'string' && tc_no.trim().length > 0;
        const hasPassportInput = typeof passport_no === 'string' && passport_no.trim().length > 0;

        // TC ve pasaport her ikisi de girilmiş mi kontrol et
        if (hasTCInput && hasPassportInput) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'TC Kimlik No ve Pasaport Numarası aynı anda girilemez' });
            return;
        }

        let hashedTC: string | null = null;
        let hashedPassport: string | null = null;
        let identifierHashCandidates: string[] = [];

        // TC kontrolü
        if (hasTCInput) {
            const cleanTC = tc_no.replace(/\D/g, '');
            if (cleanTC.length !== 11) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'TC Kimlik No 11 haneli olmalıdır' });
                return;
            }
            hashedTC = hashTC(cleanTC);
            identifierHashCandidates = getTCHashCandidates(cleanTC);

            // Aynı TC ile kayıt var mı kontrol et
            const existingQuery = 'SELECT id FROM sgk_records WHERE hashed_tc = ANY($1::text[]) AND deleted_at IS NULL';
            const existingResult = await pool.query(existingQuery, [identifierHashCandidates]);

            if (existingResult.rows.length > 0) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'Bu TC kimlik numarasına ait kayıt zaten mevcut' });
                return;
            }
        }

        // Pasaport kontrolü
        if (hasPassportInput) {
            const cleanPassport = passport_no.trim().toUpperCase();
            if (cleanPassport.length < 6 || cleanPassport.length > 20) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'Pasaport numarası 6-20 karakter arasında olmalıdır' });
                return;
            }
            hashedPassport = hashPassport(cleanPassport);
            identifierHashCandidates = getPassportHashCandidates(cleanPassport);

            // Aynı pasaport ile kayıt var mı kontrol et
            const existingQuery = 'SELECT id FROM sgk_records WHERE hashed_passport = ANY($1::text[]) AND deleted_at IS NULL';
            const existingResult = await pool.query(existingQuery, [identifierHashCandidates]);

            if (existingResult.rows.length > 0) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'Bu pasaport numarasına ait kayıt zaten mevcut' });
                return;
            }
        }

        // GÜVENLİK: Input sanitization
        const sanitizedFullName = sanitizeInput(full_name, 100);
        const sanitizedCompanyName = sanitizeInput(company_name, 100);
        const sanitizedNotes = sanitizeInput(notes, 1000);

        if (!sanitizedFullName || sanitizedFullName.trim().length === 0) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'Ad Soyad zorunludur' });
            return;
        }

        const id = uuidv4();
        const currentDate = new Date();

        const client = await pool.connect();
        let createdRecord: any;

        try {
            await client.query('BEGIN');

            const identifierHash = hashedTC || hashedPassport;
            if (identifierHash) {
                await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [identifierHash]);
                const duplicateResult = hashedTC
                    ? await client.query(
                        'SELECT id FROM sgk_records WHERE hashed_tc = ANY($1::text[]) AND deleted_at IS NULL',
                        [identifierHashCandidates]
                    )
                    : await client.query(
                        'SELECT id FROM sgk_records WHERE hashed_passport = ANY($1::text[]) AND deleted_at IS NULL',
                        [identifierHashCandidates]
                    );
                if (duplicateResult.rows.length > 0) {
                    const duplicateError = new Error('SGK identifier already exists') as Error & { code?: string };
                    duplicateError.code = '23505';
                    throw duplicateError;
                }
            }

            const insertQuery = `
                INSERT INTO sgk_records (
                    id, hashed_tc, hashed_passport, full_name, company_name,
                    file_path, upload_date, notes, personnel_id, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `;

            const values = [
                id,
                hashedTC,
                hashedPassport,
                sanitizedFullName,
                sanitizedCompanyName,
                uploadedFiles[0].filename,
                currentDate,
                sanitizedNotes,
                personnel_id,
                currentDate
            ];

            const insertResult = await client.query(insertQuery, values);
            createdRecord = insertResult.rows[0];

            for (let i = 0; i < uploadedFiles.length; i++) {
                const uploadedFile = uploadedFiles[i];
                const fileInsertQuery = `
                    INSERT INTO sgk_record_files (
                        id, sgk_record_id, stored_file_name, original_file_name,
                        mime_type, size_bytes, sort_order
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                `;

                await client.query(fileInsertQuery, [
                    uuidv4(),
                    id,
                    uploadedFile.filename,
                    uploadedFile.originalname || null,
                    uploadedFile.mimetype || null,
                    uploadedFile.size || null,
                    i
                ]);
            }

            await client.query('COMMIT');
            committed = true;
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

        const fileMap = await getRecordFilesByIds([id]);
        const responseData = mapRecordResponse(createdRecord, fileMap);

        // Audit log
        try {
            await logDataChange(
                'sgk_records',
                id,
                'INSERT',
                null,
                responseData,
                personnel_id,
                clientIp
            );
        } catch (auditError) {
            console.error('Create SGK audit log error:', auditError);
        }

        res.status(201).json({
            success: true,
            message: 'SGK belgeleri başarıyla kaydedildi',
            data: responseData
        });
    } catch (error) {
        console.error('Create SGK record error:', error);
        if (!committed) {
            const uploadedFiles = extractUploadedFiles(req);
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
        }
        if ((error as { code?: string }).code === '23505') {
            res.status(409).json({ success: false, message: 'Bu kimlik bilgisine ait SGK kaydı zaten mevcut' });
            return;
        }
        res.status(500).json({ success: false, message: 'SGK kaydı oluşturulurken hata oluştu' });
    }
};

/**
 * Search SGK records by TC, passport, name or company
 * POST /api/sgk/records/search
 */
export const searchSgkRecords = async (req: Request, res: Response): Promise<void> => {
    try {
        const { search_type, tc_no, passport_no, full_name, company_name } = req.body;

        if (!search_type || !['tc', 'passport', 'name', 'company'].includes(search_type)) {
            res.status(400).json({ success: false, message: 'Geçerli bir arama türü seçiniz (tc, passport, name, company)' });
            return;
        }

        let query = `
            SELECT 
                sr.id,
                sr.full_name,
                sr.company_name,
                sr.file_path,
                sr.upload_date,
                sr.notes,
                sr.created_at,
                p.first_name as personnel_first_name,
                p.last_name as personnel_last_name
            FROM sgk_records sr
            LEFT JOIN personnel p ON sr.personnel_id = p.id
            WHERE sr.deleted_at IS NULL
        `;
        const params: any[] = [];

        // Arama türüne göre filtrele
        if (search_type === 'tc') {
            if (typeof tc_no !== 'string' || !tc_no.trim()) {
                res.status(400).json({ success: false, message: 'TC Kimlik No zorunludur' });
                return;
            }

            // TC doğrulama
            const cleanTC = tc_no.replace(/\D/g, '');
            if (cleanTC.length !== 11) {
                res.status(400).json({ success: false, message: 'TC Kimlik No 11 haneli olmalıdır' });
                return;
            }

            // TC'yi hash'le
            query += ' AND sr.hashed_tc = ANY($1::text[])';
            params.push(getTCHashCandidates(cleanTC));

        } else if (search_type === 'passport') {
            if (typeof passport_no !== 'string' || !passport_no.trim()) {
                res.status(400).json({ success: false, message: 'Pasaport Numarası zorunludur' });
                return;
            }

            // Pasaport doğrulama
            const cleanPassport = passport_no.trim().toUpperCase();
            if (cleanPassport.length < 6 || cleanPassport.length > 20) {
                res.status(400).json({ success: false, message: 'Pasaport numarası 6-20 karakter arasında olmalıdır' });
                return;
            }

            // Pasaportu hash'le
            query += ' AND sr.hashed_passport = ANY($1::text[])';
            params.push(getPassportHashCandidates(cleanPassport));

        } else if (search_type === 'name') {
            if (typeof full_name !== 'string' || full_name.trim().length === 0) {
                res.status(400).json({ success: false, message: 'Ad Soyad zorunludur' });
                return;
            }

            const sanitizedName = sanitizeInput(full_name, 100);
            query += ` AND LOWER(translate(sr.full_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${params.length + 1}, 'IİĞÜŞÖÇ', 'ıiğüşöç')) ESCAPE '\\'`;
            params.push(`%${escapeLikePattern(sanitizedName || '')}%`);

        } else if (search_type === 'company') {
            if (typeof company_name !== 'string' || company_name.trim().length === 0) {
                res.status(400).json({ success: false, message: 'Firma adı zorunludur' });
                return;
            }

            const sanitizedCompany = sanitizeInput(company_name, 100);
            query += ` AND LOWER(translate(sr.company_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($${params.length + 1}, 'IİĞÜŞÖÇ', 'ıiğüşöç')) ESCAPE '\\'`;
            params.push(`%${escapeLikePattern(sanitizedCompany || '')}%`);
        }

        query += ' ORDER BY sr.upload_date DESC, sr.id DESC LIMIT 200';

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            res.status(200).json({
                success: true,
                data: [],
                message: 'Arama kriterlerine uygun kayıt bulunamadı'
            });
            return;
        }

        const recordIds = result.rows.map((row: any) => row.id);
        const fileMap = await getRecordFilesByIds(recordIds);
        const formattedData = result.rows.map((record) => mapRecordResponse(record, fileMap));

        res.status(200).json({
            success: true,
            data: formattedData,
            count: formattedData.length
        });
    } catch (error) {
        console.error('Search SGK record error:', error);
        res.status(500).json({ success: false, message: 'Arama sırasında hata oluştu' });
    }
};

/**
 * Get PDF file
 * GET /api/sgk/records/:id/file
 */
export const getSgkFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const fileIdFromQuery = typeof req.query.file_id === 'string' ? req.query.file_id : null;

        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID' });
            return;
        }

        if (fileIdFromQuery && !isValidUUID(fileIdFromQuery)) {
            res.status(400).json({ success: false, message: 'Geçersiz dosya ID' });
            return;
        }

        // Kaydı getir
        const query = 'SELECT file_path, full_name FROM sgk_records WHERE id = $1 AND deleted_at IS NULL';
        const result = await pool.query(query, [id]);

        if (result.rows.length === 0) {
            console.error(`[SGK File] Kayıt bulunamadı: ${id}`);
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        let fileName = result.rows[0].file_path;
        let originalFileName: string | null = null;

        if (fileIdFromQuery) {
            const fileQuery = `
                SELECT stored_file_name, original_file_name
                FROM sgk_record_files
                WHERE id = $1 AND sgk_record_id = $2 AND deleted_at IS NULL
            `;
            const fileResult = await pool.query(fileQuery, [fileIdFromQuery, id]);

            if (fileResult.rows.length === 0) {
                res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
                return;
            }

            fileName = fileResult.rows[0].stored_file_name;
            originalFileName = fileResult.rows[0].original_file_name;
        } else {
            const fileQuery = `
                SELECT stored_file_name, original_file_name
                FROM sgk_record_files
                WHERE sgk_record_id = $1 AND deleted_at IS NULL
                ORDER BY sort_order, created_at
                LIMIT 1
            `;
            const fileResult = await pool.query(fileQuery, [id]);

            if (fileResult.rows.length > 0) {
                fileName = fileResult.rows[0].stored_file_name;
                originalFileName = fileResult.rows[0].original_file_name;
            }
        }

        if (!fileName) {
            console.error(`[SGK File] Dosya yolu boş: ${id}`);
            res.status(404).json({ success: false, message: 'Dosya yolu bulunamadı' });
            return;
        }

        sendStoredFile(res, fileName, originalFileName);
    } catch (error) {
        console.error('[SGK File] Beklenmeyen hata:', error);
        res.status(500).json({ success: false, message: 'Dosya getirilirken hata oluştu' });
    }
};

/**
 * Get SGK file by file id
 * GET /api/sgk/records/:id/files/:fileId
 */
export const getSgkFileById = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id, fileId } = req.params;

        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID' });
            return;
        }

        if (!isValidUUID(fileId)) {
            res.status(400).json({ success: false, message: 'Geçersiz dosya ID' });
            return;
        }

        const recordQuery = 'SELECT id FROM sgk_records WHERE id = $1 AND deleted_at IS NULL';
        const recordResult = await pool.query(recordQuery, [id]);

        if (recordResult.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        const fileQuery = `
            SELECT stored_file_name, original_file_name
            FROM sgk_record_files
            WHERE id = $1 AND sgk_record_id = $2 AND deleted_at IS NULL
        `;
        const fileResult = await pool.query(fileQuery, [fileId, id]);

        if (fileResult.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
            return;
        }

        sendStoredFile(res, fileResult.rows[0].stored_file_name, fileResult.rows[0].original_file_name);
    } catch (error) {
        console.error('Get SGK file by ID error:', error);
        res.status(500).json({ success: false, message: 'Dosya getirilirken hata oluştu' });
    }
};

/**
 * Update SGK record
 * PUT /api/sgk/records/:id
 */
export const updateSgkRecord = async (req: Request, res: Response): Promise<void> => {
    let committed = false;
    try {
        const { id } = req.params;
        const { tc_no, passport_no, full_name, company_name, notes } = req.body;
        const uploadedFiles = extractUploadedFiles(req);
        const personnel_id = req.user?.userId || null;
        const clientIp = getClientIp(req);

        if (!isValidUUID(id)) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID' });
            return;
        }

        // Mevcut kaydı al
        const existingQuery = 'SELECT * FROM sgk_records WHERE id = $1 AND deleted_at IS NULL';
        const existingResult = await pool.query(existingQuery, [id]);

        if (existingResult.rows.length === 0) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        const oldData = existingResult.rows[0];
        const rawFileAction = typeof req.body.file_action === 'string'
            ? req.body.file_action.trim().toLowerCase()
            : '';

        if (uploadedFiles.length > 0 && rawFileAction && rawFileAction !== 'append' && rawFileAction !== 'replace') {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'Geçersiz dosya güncelleme modu. append veya replace kullanılmalıdır' });
            return;
        }

        const fileAction: 'append' | 'replace' | null = uploadedFiles.length > 0
            ? (rawFileAction === 'replace' ? 'replace' : 'append')
            : null;

        const hasTCInput = typeof tc_no === 'string' && tc_no.trim().length > 0;
        const hasPassportInput = typeof passport_no === 'string' && passport_no.trim().length > 0;

        if (typeof full_name !== 'string' ||
            (company_name != null && typeof company_name !== 'string') ||
            (notes != null && typeof notes !== 'string')) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'Metin alanlarının biçimi geçersiz' });
            return;
        }

        // TC ve pasaport her ikisi de girilmiş mi kontrol et
        if (hasTCInput && hasPassportInput) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'TC Kimlik No ve Pasaport Numarası aynı anda girilemez' });
            return;
        }

        let hashedTC: string | null = null;
        let hashedPassport: string | null = null;
        let updateIdentifierHashCandidates: string[] = [];

        // TC kontrolü
        if (hasTCInput) {
            const cleanTC = tc_no.replace(/\D/g, '');
            if (cleanTC.length !== 11) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'TC Kimlik No 11 haneli olmalıdır' });
                return;
            }
            hashedTC = hashTC(cleanTC);
            updateIdentifierHashCandidates = getTCHashCandidates(cleanTC);

            // Aynı TC ile başka kayıt var mı kontrol et (kendi ID'si hariç)
            const tcCheckQuery = 'SELECT id FROM sgk_records WHERE hashed_tc = ANY($1::text[]) AND id != $2 AND deleted_at IS NULL';
            const tcCheckResult = await pool.query(tcCheckQuery, [updateIdentifierHashCandidates, id]);

            if (tcCheckResult.rows.length > 0) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'Bu TC kimlik numarasına ait başka bir kayıt zaten mevcut' });
                return;
            }
        }

        // Pasaport kontrolü
        if (hasPassportInput) {
            const cleanPassport = passport_no.trim().toUpperCase();
            if (cleanPassport.length < 6 || cleanPassport.length > 20) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'Pasaport numarası 6-20 karakter arasında olmalıdır' });
                return;
            }
            hashedPassport = hashPassport(cleanPassport);
            updateIdentifierHashCandidates = getPassportHashCandidates(cleanPassport);

            // Aynı pasaport ile başka kayıt var mı kontrol et (kendi ID'si hariç)
            const passportCheckQuery = 'SELECT id FROM sgk_records WHERE hashed_passport = ANY($1::text[]) AND id != $2 AND deleted_at IS NULL';
            const passportCheckResult = await pool.query(passportCheckQuery, [updateIdentifierHashCandidates, id]);

            if (passportCheckResult.rows.length > 0) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'Bu pasaport numarasına ait başka bir kayıt zaten mevcut' });
                return;
            }
        }

        // Sanitization
        const sanitizedFullName = sanitizeInput(full_name.trim(), 100);
        const sanitizedCompanyName = sanitizeInput(company_name?.trim() || '', 100);
        const sanitizedNotes = sanitizeInput(notes?.trim() || '', 1000);

        if (!sanitizedFullName) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'Ad Soyad zorunludur' });
            return;
        }

        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramCounter = 1;

        if (hasTCInput) {
            updateFields.push(`hashed_tc = $${paramCounter++}`);
            updateValues.push(hashedTC);
            updateFields.push(`hashed_passport = $${paramCounter++}`);
            updateValues.push(null);
        } else if (hasPassportInput) {
            updateFields.push(`hashed_passport = $${paramCounter++}`);
            updateValues.push(hashedPassport);
            updateFields.push(`hashed_tc = $${paramCounter++}`);
            updateValues.push(null);
        }

        updateFields.push(`full_name = $${paramCounter++}`);
        updateValues.push(sanitizedFullName);

        updateFields.push(`company_name = $${paramCounter++}`);
        updateValues.push(sanitizedCompanyName);

        updateFields.push(`notes = $${paramCounter++}`);
        updateValues.push(sanitizedNotes);

        if (uploadedFiles.length > 0 && fileAction === 'replace') {
            updateFields.push(`file_path = $${paramCounter++}`);
            updateValues.push(uploadedFiles[0].filename);
        }

        updateFields.push(`updated_at = $${paramCounter++}`);
        updateValues.push(new Date());

        updateValues.push(id);

        const client = await pool.connect();
        let updatedRow: any;
        const oldFilesToDelete: string[] = [];
        committed = false;

        try {
            await client.query('BEGIN');

            const identifierHash = hashedTC || hashedPassport;
            if (identifierHash) {
                await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [identifierHash]);
                const duplicateResult = hashedTC
                    ? await client.query(
                        'SELECT id FROM sgk_records WHERE hashed_tc = ANY($1::text[]) AND id != $2 AND deleted_at IS NULL',
                        [updateIdentifierHashCandidates, id]
                    )
                    : await client.query(
                        'SELECT id FROM sgk_records WHERE hashed_passport = ANY($1::text[]) AND id != $2 AND deleted_at IS NULL',
                        [updateIdentifierHashCandidates, id]
                    );
                if (duplicateResult.rows.length > 0) {
                    const duplicateError = new Error('SGK identifier already exists') as Error & { code?: string };
                    duplicateError.code = '23505';
                    throw duplicateError;
                }
            }

            if (uploadedFiles.length > 0 && fileAction) {
                const existingFilesQuery = `
                    SELECT stored_file_name, sort_order
                    FROM sgk_record_files
                    WHERE sgk_record_id = $1 AND deleted_at IS NULL
                `;
                const existingFilesResult = await client.query(existingFilesQuery, [id]);

                // Legacy tek dosya kayıtları için, dosyayı önce dosya tablosuna taşı.
                if (existingFilesResult.rows.length === 0 && oldData.file_path) {
                    await client.query(
                        `
                            INSERT INTO sgk_record_files (
                                id, sgk_record_id, stored_file_name, original_file_name,
                                mime_type, size_bytes, sort_order
                            )
                            VALUES ($1, $2, $3, $4, $5, $6, $7)
                        `,
                        [
                            uuidv4(),
                            id,
                            oldData.file_path,
                            oldData.file_path,
                            null,
                            null,
                            0
                        ]
                    );

                    existingFilesResult.rows.push({
                        stored_file_name: oldData.file_path,
                        sort_order: 0
                    });
                }

                if (fileAction === 'replace') {
                    await client.query(
                        'UPDATE sgk_record_files SET deleted_at = NOW() WHERE sgk_record_id = $1 AND deleted_at IS NULL',
                        [id]
                    );

                    oldFilesToDelete.push(...existingFilesResult.rows.map((oldFile: any) => oldFile.stored_file_name));
                }

                const maxSortOrder = existingFilesResult.rows.reduce((max: number, row: any) => {
                    const currentSortOrder = typeof row.sort_order === 'number'
                        ? row.sort_order
                        : Number(row.sort_order) || 0;
                    return Math.max(max, currentSortOrder);
                }, -1);

                const baseSortOrder = fileAction === 'append' ? (maxSortOrder + 1) : 0;

                for (let i = 0; i < uploadedFiles.length; i++) {
                    const uploadedFile = uploadedFiles[i];
                    const fileInsertQuery = `
                        INSERT INTO sgk_record_files (
                            id, sgk_record_id, stored_file_name, original_file_name,
                            mime_type, size_bytes, sort_order
                        )
                        VALUES ($1, $2, $3, $4, $5, $6, $7)
                    `;

                    await client.query(fileInsertQuery, [
                        uuidv4(),
                        id,
                        uploadedFile.filename,
                        uploadedFile.originalname || null,
                        uploadedFile.mimetype || null,
                        uploadedFile.size || null,
                        baseSortOrder + i
                    ]);
                }
            }

            const updateQuery = `
                UPDATE sgk_records
                SET ${updateFields.join(', ')}
                WHERE id = $${paramCounter} AND deleted_at IS NULL
                RETURNING *
            `;

            const updatedResult = await client.query(updateQuery, updateValues);
            updatedRow = updatedResult.rows[0];

            await client.query('COMMIT');
            committed = true;
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

        // Physical deletion happens only after the database commit. If the
        // transaction rolls back, existing records never point to missing files.
        for (const oldFileName of oldFilesToDelete) {
            try {
                deleteFile(oldFileName);
            } catch (fileError) {
                console.error('Old SGK file deletion error:', fileError);
            }
        }

        const fileMap = await getRecordFilesByIds([id]);
        const responseData = mapRecordResponse(updatedRow, fileMap);

        // Audit log
        try {
            await logDataChange(
                'sgk_records',
                id,
                'UPDATE',
                oldData,
                responseData,
                personnel_id,
                clientIp
            );
        } catch (auditError) {
            console.error('Update SGK audit log error:', auditError);
        }

        res.status(200).json({
            success: true,
            message: 'SGK kaydı başarıyla güncellendi',
            data: responseData
        });
    } catch (error) {
        console.error('Update SGK record error:', error);
        if (!committed) {
            const uploadedFiles = extractUploadedFiles(req);
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
        }
        if ((error as { code?: string }).code === '23505') {
            res.status(409).json({ success: false, message: 'Bu kimlik bilgisine ait başka bir SGK kaydı zaten mevcut' });
            return;
        }
        res.status(500).json({ success: false, message: 'SGK kaydı güncellenirken hata oluştu' });
    }
};

/**
 * Delete SGK record and file
 * DELETE /api/sgk/records/:id
 */
export const deleteSgkRecord = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const personnel_id = req.user?.userId || null;
        const clientIp = getClientIp(req);

        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID' });
            return;
        }

        // Mevcut kaydı al
        const existingQuery = 'SELECT * FROM sgk_records WHERE id = $1 AND deleted_at IS NULL';
        const existingResult = await pool.query(existingQuery, [id]);

        if (existingResult.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        const oldData = existingResult.rows[0];

        const filesResult = await pool.query(
            `
                SELECT stored_file_name
                FROM sgk_record_files
                WHERE sgk_record_id = $1 AND deleted_at IS NULL
                ORDER BY sort_order, created_at
            `,
            [id]
        );

        const fileNames: string[] = filesResult.rows.map((row: any) => row.stored_file_name);
        if (fileNames.length === 0 && oldData.file_path) {
            fileNames.push(oldData.file_path);
        }

        // Soft delete
        const client = await pool.connect();
        let result: any;
        try {
            await client.query('BEGIN');

            await client.query(
                'UPDATE sgk_record_files SET deleted_at = $1 WHERE sgk_record_id = $2 AND deleted_at IS NULL',
                [new Date(), id]
            );

            const deleteQuery = `
                UPDATE sgk_records
                SET deleted_at = $1
                WHERE id = $2 AND deleted_at IS NULL
                RETURNING *
            `;

            result = await client.query(deleteQuery, [new Date(), id]);
            await client.query('COMMIT');
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

        // Dosyayı fiziksel olarak sil
        for (const fileName of fileNames) {
            try {
                deleteFile(fileName);
            } catch (fileError) {
                console.error('File deletion error:', fileError);
            }
        }

        // Audit log
        try {
            await logDataChange(
                'sgk_records',
                id,
                'DELETE',
                oldData,
                result.rows[0],
                personnel_id,
                clientIp
            );
        } catch (auditError) {
            console.error('Delete SGK audit log error:', auditError);
        }

        res.status(200).json({
            success: true,
            message: 'SGK kaydı ve belgesi başarıyla silindi'
        });
    } catch (error) {
        console.error('Delete SGK record error:', error);
        res.status(500).json({ success: false, message: 'SGK kaydı silinirken hata oluştu' });
    }
};

/**
 * Get all pending QR SGK records
 * GET /api/sgk/pending-qr
 */
export const getPendingQrSgk = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = `
            SELECT id, full_name, company_name, notes, status, created_at, gate
            FROM pending_qr_sgk
            WHERE status = 'pending'
            ORDER BY created_at ASC
        `;
        const result = await pool.query(query);

        const pendingIds = result.rows.map((row: any) => row.id);
        const filesMap = new Map<string, any[]>();

        if (pendingIds.length > 0) {
            const filesQuery = `
                SELECT id, pending_sgk_id, stored_file_name, original_file_name, mime_type, size_bytes, sort_order, created_at
                FROM pending_qr_sgk_files
                WHERE pending_sgk_id = ANY($1::uuid[])
                ORDER BY pending_sgk_id, sort_order, created_at
            `;
            const filesResult = await pool.query(filesQuery, [pendingIds]);

            for (const fileRow of filesResult.rows) {
                const current = filesMap.get(fileRow.pending_sgk_id) || [];
                current.push({
                    id: fileRow.id,
                    record_id: fileRow.pending_sgk_id,
                    file_name: fileRow.stored_file_name,
                    original_file_name: fileRow.original_file_name,
                    mime_type: fileRow.mime_type,
                    size_bytes: fileRow.size_bytes,
                    sort_order: fileRow.sort_order,
                    created_at: fileRow.created_at
                });
                filesMap.set(fileRow.pending_sgk_id, current);
            }
        }

        const formattedData = result.rows.map((row: any) => {
            const recordFiles = filesMap.get(row.id) || [];
            return {
                id: row.id,
                full_name: row.full_name,
                company_name: row.company_name,
                notes: row.notes,
                status: row.status,
                created_at: row.created_at,
                files: recordFiles,
                file_count: recordFiles.length,
                file_path: recordFiles[0]?.file_name || null,
                gate: row.gate
            };
        });

        res.status(200).json(formattedData);
    } catch (error) {
        console.error('Get pending QR SGK error:', error);
        res.status(500).json({ success: false, message: 'Bekleyen QR kayıtları listelenirken hata oluştu' });
    }
};

/**
 * Stream pending QR SGK file
 * GET /api/sgk/pending-qr/:id/files/:fileId
 */
export const getPendingQrSgkFile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id, fileId } = req.params;

        if (!isValidUUID(id) || !isValidUUID(fileId)) {
            res.status(400).json({ success: false, message: 'Geçersiz ID formatı' });
            return;
        }

        const query = `
            SELECT stored_file_name, original_file_name
            FROM pending_qr_sgk_files
            WHERE id = $1 AND pending_sgk_id = $2
        `;
        const result = await pool.query(query, [fileId, id]);

        if (result.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
            return;
        }

        sendStoredFile(res, result.rows[0].stored_file_name, result.rows[0].original_file_name);
    } catch (error) {
        console.error('Get pending QR SGK file error:', error);
        res.status(500).json({ success: false, message: 'Dosya getirilirken hata oluştu' });
    }
};

/**
 * Reject a pending QR SGK registration
 * POST /api/sgk/pending-qr/:id/reject
 */
export const rejectPendingQrSgk = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const personnel_id = req.user?.userId || null;
        const clientIp = getClientIp(req);

        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        const checkQuery = `SELECT id FROM pending_qr_sgk WHERE id = $1 AND status = 'pending'`;
        const checkResult = await pool.query(checkQuery, [id]);
        if (checkResult.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Bekleyen kayıt bulunamadı veya zaten işlendi' });
            return;
        }

        // Fetch files to delete physically
        const filesQuery = `SELECT stored_file_name FROM pending_qr_sgk_files WHERE pending_sgk_id = $1`;
        const filesResult = await pool.query(filesQuery, [id]);
        const fileNames = filesResult.rows.map((row: any) => row.stored_file_name);

        const rejectedResult = await pool.query(
            `UPDATE pending_qr_sgk
             SET status = 'rejected', updated_at = NOW()
             WHERE id = $1 AND status = 'pending'
             RETURNING id`,
            [id]
        );
        if (rejectedResult.rows.length === 0) {
            res.status(409).json({ success: false, message: 'Kayıt başka bir kullanıcı tarafından işlenmiş' });
            return;
        }

        // Delete physical files
        for (const fileName of fileNames) {
            try {
                deleteFile(fileName);
            } catch (err) {
                console.error('Error deleting physical file:', fileName, err);
            }
        }

        try {
            await logDataChange(
                'pending_qr_sgk',
                id,
                'UPDATE',
                { status: 'pending' },
                { status: 'rejected' },
                personnel_id,
                clientIp
            );
        } catch (auditError) {
            console.error('Reject pending SGK audit log error:', auditError);
        }

        res.status(200).json({ success: true, message: 'Kayıt başvurusu reddedildi' });
    } catch (error) {
        console.error('Reject pending QR SGK error:', error);
        res.status(500).json({ success: false, message: 'Kayıt reddedilirken hata oluştu' });
    }
};

/**
 * Approve pending QR SGK registration and save to sgk_records / sgk_record_files
 * POST /api/sgk/pending-qr/:id/approve
 */
export const approvePendingQrSgk = async (req: Request, res: Response): Promise<void> => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        const { tc_no, passport_no, full_name, company_name, notes } = req.body;
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

        const pendingCheck = await client.query(`SELECT id FROM pending_qr_sgk WHERE id = $1 AND status = 'pending'`, [id]);
        if (pendingCheck.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Bekleyen kayıt bulunamadı veya zaten işlendi' });
            return;
        }

        const hasTCInput = typeof tc_no === 'string' && tc_no.trim().length > 0;
        const hasPassportInput = typeof passport_no === 'string' && passport_no.trim().length > 0;

        if (hasTCInput && hasPassportInput) {
            res.status(400).json({ success: false, message: 'TC Kimlik No ve Pasaport Numarası aynı anda girilemez' });
            return;
        }

        let hashedTC: string | null = null;
        let hashedPassport: string | null = null;
        let approvalIdentifierHashCandidates: string[] = [];

        if (hasTCInput) {
            const cleanTC = tc_no.replace(/\D/g, '');
            if (cleanTC.length !== 11) {
                res.status(400).json({ success: false, message: 'TC Kimlik No 11 haneli olmalıdır' });
                return;
            }
            hashedTC = hashTC(cleanTC);
            approvalIdentifierHashCandidates = getTCHashCandidates(cleanTC);

            const existingQuery = 'SELECT id FROM sgk_records WHERE hashed_tc = ANY($1::text[]) AND deleted_at IS NULL';
            const existingResult = await client.query(existingQuery, [approvalIdentifierHashCandidates]);
            if (existingResult.rows.length > 0) {
                res.status(400).json({ success: false, message: 'Bu TC kimlik numarasına ait kayıt zaten mevcut' });
                return;
            }
        }

        if (hasPassportInput) {
            const cleanPassport = passport_no.trim().toUpperCase();
            if (cleanPassport.length < 6 || cleanPassport.length > 20) {
                res.status(400).json({ success: false, message: 'Pasaport numarası 6-20 karakter arasında olmalıdır' });
                return;
            }
            hashedPassport = hashPassport(cleanPassport);
            approvalIdentifierHashCandidates = getPassportHashCandidates(cleanPassport);

            const existingQuery = 'SELECT id FROM sgk_records WHERE hashed_passport = ANY($1::text[]) AND deleted_at IS NULL';
            const existingResult = await client.query(existingQuery, [approvalIdentifierHashCandidates]);
            if (existingResult.rows.length > 0) {
                res.status(400).json({ success: false, message: 'Bu pasaport numarasına ait kayıt zaten mevcut' });
                return;
            }
        }

        if (typeof full_name !== 'string' ||
            (company_name != null && typeof company_name !== 'string') ||
            (notes != null && typeof notes !== 'string')) {
            res.status(400).json({ success: false, message: 'Metin alanlarının biçimi geçersiz' });
            return;
        }

        const sanitizedFullName = sanitizeInput(full_name.trim(), 100);
        const sanitizedCompanyName = sanitizeInput(company_name?.trim() || '', 100);
        const sanitizedNotes = sanitizeInput(notes?.trim() || '', 1000);

        if (!sanitizedFullName) {
            res.status(400).json({ success: false, message: 'Ad Soyad zorunludur' });
            return;
        }

        // Fetch files from pending_qr_sgk_files
        const filesResult = await client.query(
            `
                SELECT stored_file_name, original_file_name, mime_type, size_bytes, sort_order
                FROM pending_qr_sgk_files
                WHERE pending_sgk_id = $1
                ORDER BY sort_order, created_at
            `,
            [id]
        );

        if (filesResult.rows.length === 0) {
            res.status(400).json({ success: false, message: 'Onaylanacak kayıt için yüklenmiş belge bulunamadı' });
            return;
        }

        const newRecordId = uuidv4();
        const currentDate = new Date();

        await client.query('BEGIN');

        const identifierHash = hashedTC || hashedPassport;
        if (identifierHash) {
            await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [identifierHash]);
            const duplicateResult = hashedTC
                ? await client.query(
                    'SELECT id FROM sgk_records WHERE hashed_tc = ANY($1::text[]) AND deleted_at IS NULL',
                    [approvalIdentifierHashCandidates]
                )
                : await client.query(
                    'SELECT id FROM sgk_records WHERE hashed_passport = ANY($1::text[]) AND deleted_at IS NULL',
                    [approvalIdentifierHashCandidates]
                );
            if (duplicateResult.rows.length > 0) {
                const duplicateError = new Error('SGK identifier already exists') as Error & { code?: string };
                duplicateError.code = '23505';
                throw duplicateError;
            }
        }

        // Insert into sgk_records
        const insertQuery = `
            INSERT INTO sgk_records (
                id, hashed_tc, hashed_passport, full_name, company_name,
                file_path, upload_date, notes, personnel_id, created_at, is_qr
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
            RETURNING *
        `;
        const insertResult = await client.query(insertQuery, [
            newRecordId,
            hashedTC,
            hashedPassport,
            sanitizedFullName,
            sanitizedCompanyName,
            filesResult.rows[0].stored_file_name,
            currentDate,
            sanitizedNotes,
            personnel_id,
            currentDate
        ]);

        // Insert into sgk_record_files
        for (const fileRow of filesResult.rows) {
            const fileInsertQuery = `
                INSERT INTO sgk_record_files (
                    id, sgk_record_id, stored_file_name, original_file_name,
                    mime_type, size_bytes, sort_order
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `;
            await client.query(fileInsertQuery, [
                uuidv4(),
                newRecordId,
                fileRow.stored_file_name,
                fileRow.original_file_name,
                fileRow.mime_type,
                fileRow.size_bytes,
                fileRow.sort_order
            ]);
        }

        // Claim the pending row atomically. If another user processed it while
        // this transaction was running, rollback the new SGK record as well.
        const pendingUpdateResult = await client.query(
            `UPDATE pending_qr_sgk
             SET status = 'approved', updated_at = NOW()
             WHERE id = $1 AND status = 'pending'
             RETURNING id`,
            [id]
        );
        if (pendingUpdateResult.rows.length === 0) {
            const alreadyProcessedError = new Error('Kayıt başka bir kullanıcı tarafından işlenmiş') as Error & { code?: string };
            alreadyProcessedError.code = 'SGK_ALREADY_PROCESSED';
            throw alreadyProcessedError;
        }

        await client.query('COMMIT');

        // Audit log
        try {
            await logDataChange(
                'sgk_records',
                newRecordId,
                'INSERT',
                null,
                { id: newRecordId, full_name: sanitizedFullName, company_name: sanitizedCompanyName, is_qr: true },
                personnel_id,
                clientIp
            );
        } catch (auditError) {
            console.error('Approve pending SGK audit log error:', auditError);
        }

        res.status(201).json({
            success: true,
            message: 'SGK kaydı onaylandı ve kaydedildi',
            data: { id: newRecordId }
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Approve pending QR SGK error:', error);
        if ((error as { code?: string }).code === 'SGK_ALREADY_PROCESSED') {
            res.status(409).json({ success: false, message: 'Kayıt başka bir kullanıcı tarafından işlenmiş' });
            return;
        }
        if ((error as { code?: string }).code === '23505') {
            res.status(409).json({ success: false, message: 'Bu kimlik bilgisine ait SGK kaydı zaten mevcut' });
            return;
        }
        res.status(500).json({ success: false, message: 'Kayıt onaylanırken hata oluştu' });
    } finally {
        client.release();
    }
};
