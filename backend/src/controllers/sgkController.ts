import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizeInput } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { hashTC, formatFileName, deleteFile, getFilePath, hashPassport } from '../utils/fileUpload';
import path from 'path';

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

        const formattedData = result.rows.map((row: any) => ({
            id: row.id,
            hashed_tc: row.hashed_tc,
            hashed_passport: row.hashed_passport,
            full_name: row.full_name,
            company_name: row.company_name,
            file_path: row.file_path,
            upload_date: row.upload_date,
            notes: row.notes,
            personnel: (row.personnel_first_name || row.personnel_last_name)
                ? `${row.personnel_first_name || ''} ${row.personnel_last_name || ''}`.trim()
                : null,
            created_at: row.created_at
        }));

        res.status(200).json(formattedData);
    } catch (error) {
        console.error('Get SGK records error:', error);
        res.status(500).json({ success: false, message: 'SGK kayıtları listelenirken hata oluştu' });
    }
};

/**
 * Create new SGK record with file upload
 * POST /api/sgk/records
 * Supports TC or Passport number (one of them is required, but not both)
 * If neither is provided, record will use UUID-based naming
 */
export const createSgkRecord = async (req: Request, res: Response): Promise<void> => {
    try {
        const { tc_no, passport_no, full_name, company_name, notes } = req.body;
        const personnel_id = req.user?.userId || null;
        const clientIp = getClientIp(req);
        const file = req.file;

        // Validasyonlar
        if (!full_name || !file) {
            res.status(400).json({ success: false, message: 'Ad Soyad ve PDF dosyası zorunludur' });
            return;
        }

        // TC ve pasaport her ikisi de girilmiş mi kontrol et
        if (tc_no && passport_no) {
            if (file.filename) deleteFile(file.filename);
            res.status(400).json({ success: false, message: 'TC Kimlik No ve Pasaport Numarası aynı anda girilemez' });
            return;
        }

        let hashedTC: string | null = null;
        let hashedPassport: string | null = null;

        // TC kontrolü
        if (tc_no) {
            const cleanTC = tc_no.replace(/\D/g, '');
            if (cleanTC.length !== 11) {
                if (file.filename) deleteFile(file.filename);
                res.status(400).json({ success: false, message: 'TC Kimlik No 11 haneli olmalıdır' });
                return;
            }
            hashedTC = hashTC(cleanTC);

            // Aynı TC ile kayıt var mı kontrol et
            const existingQuery = 'SELECT id FROM sgk_records WHERE hashed_tc = $1 AND deleted_at IS NULL';
            const existingResult = await pool.query(existingQuery, [hashedTC]);

            if (existingResult.rows.length > 0) {
                if (file.filename) deleteFile(file.filename);
                res.status(400).json({ success: false, message: 'Bu TC kimlik numarasına ait kayıt zaten mevcut' });
                return;
            }
        }

        // Pasaport kontrolü
        if (passport_no) {
            const cleanPassport = passport_no.trim().toUpperCase();
            if (cleanPassport.length < 6 || cleanPassport.length > 20) {
                if (file.filename) deleteFile(file.filename);
                res.status(400).json({ success: false, message: 'Pasaport numarası 6-20 karakter arasında olmalıdır' });
                return;
            }
            hashedPassport = hashPassport(cleanPassport);

            // Aynı pasaport ile kayıt var mı kontrol et
            const existingQuery = 'SELECT id FROM sgk_records WHERE hashed_passport = $1 AND deleted_at IS NULL';
            const existingResult = await pool.query(existingQuery, [hashedPassport]);

            if (existingResult.rows.length > 0) {
                if (file.filename) deleteFile(file.filename);
                res.status(400).json({ success: false, message: 'Bu pasaport numarasına ait kayıt zaten mevcut' });
                return;
            }
        }

        // GÜVENLİK: Input sanitization
        const sanitizedFullName = sanitizeInput(full_name, 100);
        const sanitizedCompanyName = sanitizeInput(company_name, 100);
        const sanitizedNotes = sanitizeInput(notes, 1000);

        if (!sanitizedFullName || sanitizedFullName.trim().length === 0) {
            if (file.filename) deleteFile(file.filename);
            res.status(400).json({ success: false, message: 'Ad Soyad zorunludur' });
            return;
        }

        const id = uuidv4();
        const currentDate = new Date();

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
            file.filename, // Sadece dosya adı kaydet
            currentDate,
            sanitizedNotes,
            personnel_id,
            currentDate
        ];

        const result = await pool.query(insertQuery, values);

        // Audit log
        await logDataChange(
            'sgk_records',
            id,
            'INSERT',
            null,
            result.rows[0],
            personnel_id,
            clientIp
        );

        res.status(201).json({
            success: true,
            message: 'SGK belgesi başarıyla kaydedildi',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Create SGK record error:', error);
        // Hata durumunda dosyayı sil
        if (req.file?.filename) {
            deleteFile(req.file.filename);
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

        const formattedData = result.rows.map(record => ({
            id: record.id,
            hashed_tc: record.hashed_tc,
            hashed_passport: record.hashed_passport,
            full_name: record.full_name,
            company_name: record.company_name,
            file_path: record.file_path,
            upload_date: record.upload_date,
            notes: record.notes,
            personnel: (record.personnel_first_name || record.personnel_last_name)
                ? `${record.personnel_first_name || ''} ${record.personnel_last_name || ''}`.trim()
                : null,
            created_at: record.created_at
        }));

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

        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID' });
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

        const fileName = result.rows[0].file_path;

        if (!fileName) {
            console.error(`[SGK File] Dosya yolu boş: ${id}`);
            res.status(404).json({ success: false, message: 'Dosya yolu bulunamadı' });
            return;
        }

        const filePath = getFilePath(fileName);
        console.log(`[SGK File] Dosya istendi: ${fileName}, Tam yol: ${filePath}`);

        // Dosya var mı kontrol et
        const fs = require('fs');
        const path = require('path');
        if (!fs.existsSync(filePath)) {
            console.error(`[SGK File] Dosya mevcut değil: ${filePath}`);
            res.status(404).json({ success: false, message: `Dosya bulunamadı: ${fileName}` });
            return;
        }

        // Dosya uzantısına göre Content-Type belirle
        const ext = path.extname(fileName).toLowerCase();
        let contentType = 'application/octet-stream';

        switch (ext) {
            case '.pdf':
                contentType = 'application/pdf';
                break;
            case '.jpg':
            case '.jpeg':
                contentType = 'image/jpeg';
                break;
            case '.png':
                contentType = 'image/png';
                break;
        }

        // Dosyayı gönder
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        // iframe içinde görüntülenebilmesi için güvenlik başlıklarını kaldır
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');

        // sendFile ile dosyayı gönder (absolute path gerekli)
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error(`[SGK File] sendFile hatası: ${filePath}`, err);
                // Header gönderilmemişse hata döndür
                if (!res.headersSent) {
                    res.status(500).json({ success: false, message: 'Dosya gönderilirken hata oluştu' });
                }
            }
        });
    } catch (error) {
        console.error('[SGK File] Beklenmeyen hata:', error);
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
        const file = req.file;
        const personnel_id = req.user?.userId || null;
        const clientIp = getClientIp(req);

        if (!isValidUUID(id)) {
            if (file?.filename) deleteFile(file.filename);
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID' });
            return;
        }

        // Mevcut kaydı al
        const existingQuery = 'SELECT * FROM sgk_records WHERE id = $1 AND deleted_at IS NULL';
        const existingResult = await pool.query(existingQuery, [id]);

        if (existingResult.rows.length === 0) {
            if (file?.filename) deleteFile(file.filename);
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        const oldData = existingResult.rows[0];

        // TC ve pasaport her ikisi de girilmiş mi kontrol et
        if (tc_no && passport_no) {
            if (file?.filename) deleteFile(file.filename);
            res.status(400).json({ success: false, message: 'TC Kimlik No ve Pasaport Numarası aynı anda girilemez' });
            return;
        }

        let hashedTC: string | null = null;
        let hashedPassport: string | null = null;

        // TC kontrolü
        if (tc_no) {
            const cleanTC = tc_no.replace(/\D/g, '');
            if (cleanTC.length !== 11) {
                if (file?.filename) deleteFile(file.filename);
                res.status(400).json({ success: false, message: 'TC Kimlik No 11 haneli olmalıdır' });
                return;
            }
            hashedTC = hashTC(cleanTC);

            // Aynı TC ile başka kayıt var mı kontrol et (kendi ID'si hariç)
            const tcCheckQuery = 'SELECT id FROM sgk_records WHERE hashed_tc = $1 AND id != $2 AND deleted_at IS NULL';
            const tcCheckResult = await pool.query(tcCheckQuery, [hashedTC, id]);

            if (tcCheckResult.rows.length > 0) {
                if (file?.filename) deleteFile(file.filename);
                res.status(400).json({ success: false, message: 'Bu TC kimlik numarasına ait başka bir kayıt zaten mevcut' });
                return;
            }
        }

        // Pasaport kontrolü
        if (passport_no) {
            const cleanPassport = passport_no.trim().toUpperCase();
            if (cleanPassport.length < 6 || cleanPassport.length > 20) {
                if (file?.filename) deleteFile(file.filename);
                res.status(400).json({ success: false, message: 'Pasaport numarası 6-20 karakter arasında olmalıdır' });
                return;
            }
            hashedPassport = hashPassport(cleanPassport);

            // Aynı pasaport ile başka kayıt var mı kontrol et (kendi ID'si hariç)
            const passportCheckQuery = 'SELECT id FROM sgk_records WHERE hashed_passport = $1 AND id != $2 AND deleted_at IS NULL';
            const passportCheckResult = await pool.query(passportCheckQuery, [hashedPassport, id]);

            if (passportCheckResult.rows.length > 0) {
                if (file?.filename) deleteFile(file.filename);
                res.status(400).json({ success: false, message: 'Bu pasaport numarasına ait başka bir kayıt zaten mevcut' });
                return;
            }
        }

        // Sanitization
        const sanitizedFullName = sanitizeInput(full_name?.trim() || '');
        const sanitizedCompanyName = sanitizeInput(company_name?.trim() || '');
        const sanitizedNotes = sanitizeInput(notes?.trim() || '');

        if (!sanitizedFullName) {
            if (file?.filename) deleteFile(file.filename);
            res.status(400).json({ success: false, message: 'Ad Soyad zorunludur' });
            return;
        }

        const updateFields: string[] = [];
        const updateValues: any[] = [];
        let paramCounter = 1;

        // TC/Pasaport güncellenebilir (birini null yap, diğerini set et)
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

        // Ad Soyad güncellenebilir
        updateFields.push(`full_name = $${paramCounter++}`);
        updateValues.push(sanitizedFullName);

        // Firma adı güncellenebilir
        updateFields.push(`company_name = $${paramCounter++}`);
        updateValues.push(sanitizedCompanyName);

        // Notlar güncellenebilir
        updateFields.push(`notes = $${paramCounter++}`);
        updateValues.push(sanitizedNotes);

        // Dosya güncellenirse eski dosyayı sil
        if (file?.filename) {
            updateFields.push(`file_path = $${paramCounter++}`);
            updateValues.push(file.filename);

            // Eski dosyayı sil
            try {
                deleteFile(oldData.file_path);
            } catch (fileError) {
                console.error('Old file deletion error:', fileError);
            }
        }

        updateFields.push(`updated_at = $${paramCounter++}`);
        updateValues.push(new Date());

        updateValues.push(id);

        const updateQuery = `
            UPDATE sgk_records 
            SET ${updateFields.join(', ')}
            WHERE id = $${paramCounter} AND deleted_at IS NULL
            RETURNING *
        `;

        const result = await pool.query(updateQuery, updateValues);

        // Audit log
        await logDataChange(
            'sgk_records',
            id,
            'UPDATE',
            oldData,
            result.rows[0],
            personnel_id,
            clientIp
        );

        res.status(200).json({
            success: true,
            message: 'SGK kaydı başarıyla güncellendi',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update SGK record error:', error);
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
        const fileName = oldData.file_path;

        // Soft delete
        const deleteQuery = `
            UPDATE sgk_records 
            SET deleted_at = $1
            WHERE id = $2 AND deleted_at IS NULL
            RETURNING *
        `;

        const result = await pool.query(deleteQuery, [new Date(), id]);

        // Dosyayı fiziksel olarak sil
        try {
            deleteFile(fileName);
        } catch (fileError) {
            console.error('File deletion error:', fileError);
            // Dosya silme hatası kritik değil, devam et
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
