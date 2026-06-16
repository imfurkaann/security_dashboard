import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizeInput } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { hashTC, deleteFile, getFilePath, hashPassport } from '../utils/fileUpload';

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
    file_name: row.stored_file_name,
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

    return [
        {
            id: '',
            record_id: record.id,
            file_name: record.file_path,
            original_file_name: record.file_path,
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
        hashed_tc: record.hashed_tc,
        hashed_passport: record.hashed_passport,
        full_name: record.full_name,
        company_name: record.company_name,
        file_path: files[0]?.file_name || record.file_path || null,
        files,
        file_count: files.length,
        upload_date: record.upload_date,
        notes: record.notes,
        personnel: (record.personnel_first_name || record.personnel_last_name)
            ? `${record.personnel_first_name || ''} ${record.personnel_last_name || ''}`.trim()
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

const sendStoredFile = (res: Response, fileName: string): void => {
    const filePath = getFilePath(fileName);
    const fs = require('fs');

    if (!fs.existsSync(filePath)) {
        res.status(404).json({ success: false, message: `Dosya bulunamadı: ${fileName}` });
        return;
    }

    const contentType = resolveContentType(fileName);
    res.setHeader('Content-Type', contentType);
    const encodedFileName = encodeURIComponent(fileName).replace(/['()]/g, escape);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFileName}`);
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');

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
export const getSgkRecords = async (_req: Request, res: Response): Promise<void> => {
    try {
        const query = `
            SELECT 
                sr.id,
                sr.hashed_tc,
                sr.hashed_passport,
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
            ORDER BY sr.upload_date DESC
            LIMIT 1000
        `;
        const result = await pool.query(query);

        const recordIds = result.rows.map((row: any) => row.id);
        const fileMap = await getRecordFilesByIds(recordIds);
        const formattedData = result.rows.map((row: any) => mapRecordResponse(row, fileMap));

        res.status(200).json(formattedData);
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
    try {
        const { tc_no, passport_no, full_name, company_name, notes } = req.body;
        const personnel_id = req.user?.userId || null;
        const clientIp = getClientIp(req);
        const uploadedFiles = extractUploadedFiles(req);

        // Validasyonlar
        if (!full_name || uploadedFiles.length === 0) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'Ad Soyad ve en az bir belge dosyası zorunludur' });
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

        // TC kontrolü
        if (hasTCInput) {
            const cleanTC = tc_no.replace(/\D/g, '');
            if (cleanTC.length !== 11) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'TC Kimlik No 11 haneli olmalıdır' });
                return;
            }
            hashedTC = hashTC(cleanTC);

            // Aynı TC ile kayıt var mı kontrol et
            const existingQuery = 'SELECT id FROM sgk_records WHERE hashed_tc = $1 AND deleted_at IS NULL';
            const existingResult = await pool.query(existingQuery, [hashedTC]);

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

            // Aynı pasaport ile kayıt var mı kontrol et
            const existingQuery = 'SELECT id FROM sgk_records WHERE hashed_passport = $1 AND deleted_at IS NULL';
            const existingResult = await pool.query(existingQuery, [hashedPassport]);

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
        let committed = false;

        try {
            await client.query('BEGIN');

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
        await logDataChange(
            'sgk_records',
            id,
            'INSERT',
            null,
            responseData,
            personnel_id,
            clientIp
        );

        res.status(201).json({
            success: true,
            message: 'SGK belgeleri başarıyla kaydedildi',
            data: responseData
        });
    } catch (error) {
        console.error('Create SGK record error:', error);
        const uploadedFiles = extractUploadedFiles(req);
        uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
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
                sr.hashed_tc,
                sr.hashed_passport,
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
            if (!tc_no) {
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
            const hashedTC = hashTC(cleanTC);
            query += ' AND sr.hashed_tc = $1';
            params.push(hashedTC);

        } else if (search_type === 'passport') {
            if (!passport_no) {
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
            const hashedPassport = hashPassport(cleanPassport);
            query += ' AND sr.hashed_passport = $1';
            params.push(hashedPassport);

        } else if (search_type === 'name') {
            if (!full_name || full_name.trim().length === 0) {
                res.status(400).json({ success: false, message: 'Ad Soyad zorunludur' });
                return;
            }

            const sanitizedName = sanitizeInput(full_name, 100);
            query += ' AND LOWER(sr.full_name) LIKE LOWER($1)';
            params.push(`%${sanitizedName}%`);

        } else if (search_type === 'company') {
            if (!company_name || company_name.trim().length === 0) {
                res.status(400).json({ success: false, message: 'Firma adı zorunludur' });
                return;
            }

            const sanitizedCompany = sanitizeInput(company_name, 100);
            query += ' AND LOWER(sr.company_name) LIKE LOWER($1)';
            params.push(`%${sanitizedCompany}%`);
        }

        query += ' ORDER BY sr.upload_date DESC';

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

        if (fileIdFromQuery) {
            const fileQuery = `
                SELECT stored_file_name
                FROM sgk_record_files
                WHERE id = $1 AND sgk_record_id = $2 AND deleted_at IS NULL
            `;
            const fileResult = await pool.query(fileQuery, [fileIdFromQuery, id]);

            if (fileResult.rows.length === 0) {
                res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
                return;
            }

            fileName = fileResult.rows[0].stored_file_name;
        } else {
            const fileQuery = `
                SELECT stored_file_name
                FROM sgk_record_files
                WHERE sgk_record_id = $1 AND deleted_at IS NULL
                ORDER BY sort_order, created_at
                LIMIT 1
            `;
            const fileResult = await pool.query(fileQuery, [id]);

            if (fileResult.rows.length > 0) {
                fileName = fileResult.rows[0].stored_file_name;
            }
        }

        if (!fileName) {
            console.error(`[SGK File] Dosya yolu boş: ${id}`);
            res.status(404).json({ success: false, message: 'Dosya yolu bulunamadı' });
            return;
        }

        sendStoredFile(res, fileName);
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
            SELECT stored_file_name
            FROM sgk_record_files
            WHERE id = $1 AND sgk_record_id = $2 AND deleted_at IS NULL
        `;
        const fileResult = await pool.query(fileQuery, [fileId, id]);

        if (fileResult.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
            return;
        }

        sendStoredFile(res, fileResult.rows[0].stored_file_name);
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

        // TC ve pasaport her ikisi de girilmiş mi kontrol et
        if (tc_no && passport_no) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'TC Kimlik No ve Pasaport Numarası aynı anda girilemez' });
            return;
        }

        let hashedTC: string | null = null;
        let hashedPassport: string | null = null;

        // TC kontrolü
        if (tc_no) {
            const cleanTC = tc_no.replace(/\D/g, '');
            if (cleanTC.length !== 11) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'TC Kimlik No 11 haneli olmalıdır' });
                return;
            }
            hashedTC = hashTC(cleanTC);

            // Aynı TC ile başka kayıt var mı kontrol et (kendi ID'si hariç)
            const tcCheckQuery = 'SELECT id FROM sgk_records WHERE hashed_tc = $1 AND id != $2 AND deleted_at IS NULL';
            const tcCheckResult = await pool.query(tcCheckQuery, [hashedTC, id]);

            if (tcCheckResult.rows.length > 0) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'Bu TC kimlik numarasına ait başka bir kayıt zaten mevcut' });
                return;
            }
        }

        // Pasaport kontrolü
        if (passport_no) {
            const cleanPassport = passport_no.trim().toUpperCase();
            if (cleanPassport.length < 6 || cleanPassport.length > 20) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'Pasaport numarası 6-20 karakter arasında olmalıdır' });
                return;
            }
            hashedPassport = hashPassport(cleanPassport);

            // Aynı pasaport ile başka kayıt var mı kontrol et (kendi ID'si hariç)
            const passportCheckQuery = 'SELECT id FROM sgk_records WHERE hashed_passport = $1 AND id != $2 AND deleted_at IS NULL';
            const passportCheckResult = await pool.query(passportCheckQuery, [hashedPassport, id]);

            if (passportCheckResult.rows.length > 0) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'Bu pasaport numarasına ait başka bir kayıt zaten mevcut' });
                return;
            }
        }

        // Sanitization
        const sanitizedFullName = sanitizeInput(full_name?.trim() || '');
        const sanitizedCompanyName = sanitizeInput(company_name?.trim() || '');
        const sanitizedNotes = sanitizeInput(notes?.trim() || '');

        if (!sanitizedFullName) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'Ad Soyad zorunludur' });
            return;
        }

        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramCounter = 1;

        if (tc_no) {
            updateFields.push(`hashed_tc = $${paramCounter++}`);
            updateValues.push(hashedTC);
            updateFields.push(`hashed_passport = $${paramCounter++}`);
            updateValues.push(null);
        } else if (passport_no) {
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
        let committed = false;

        try {
            await client.query('BEGIN');

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

                    for (const oldFile of existingFilesResult.rows) {
                        try {
                            deleteFile(oldFile.stored_file_name);
                        } catch (fileError) {
                            console.error('Old file deletion error:', fileError);
                        }
                    }
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

        const fileMap = await getRecordFilesByIds([id]);
        const responseData = mapRecordResponse(updatedRow, fileMap);

        // Audit log
        await logDataChange(
            'sgk_records',
            id,
            'UPDATE',
            oldData,
            responseData,
            personnel_id,
            clientIp
        );

        res.status(200).json({
            success: true,
            message: 'SGK kaydı başarıyla güncellendi',
            data: responseData
        });
    } catch (error) {
        console.error('Update SGK record error:', error);
        const uploadedFiles = extractUploadedFiles(req);
        uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
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
        await logDataChange(
            'sgk_records',
            id,
            'DELETE',
            oldData,
            result.rows[0],
            personnel_id,
            clientIp
        );

        res.status(200).json({
            success: true,
            message: 'SGK kaydı ve belgesi başarıyla silindi'
        });
    } catch (error) {
        console.error('Delete SGK record error:', error);
        res.status(500).json({ success: false, message: 'SGK kaydı silinirken hata oluştu' });
    }
};
