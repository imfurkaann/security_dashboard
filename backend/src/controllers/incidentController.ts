import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizeInput, isValidEnum, isValidLength } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { createWordFromHtml } from '../utils/wordGenerator';

// Geçerli severity ve type değerleri
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
const VALID_TYPES = ['general', 'security', 'fire', 'medical', 'theft', 'vandalism', 'other'] as const;
const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

// Tüm rapor kayıtlarını getir
export const getIncidentRecords = async (_req: Request, res: Response) => {
    try {
        const result = await pool.query(`
            SELECT 
                i.id,
                i.description,
                i.incident_type,
                i.severity,
                i.location,
                i.shift_label,
                i.report_content,
                i.report_date,
                CASE WHEN i.resolved THEN 'resolved' ELSE 'open' END as status,
                i.created_at,
                i.incident_time,
                i.resolved,
                i.resolution_notes,
                i.resolved_at,
                p.first_name || ' ' || p.last_name as reported_by
            FROM incidents i
            LEFT JOIN personnel p ON i.recorded_by = p.id
            WHERE i.deleted_at IS NULL 
            ORDER BY i.created_at DESC
            LIMIT 1000
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('Get incidents error:', error);
        res.status(500).json({ success: false, message: 'Olay kayıtları alınamadı' });
    }
};

// Yeni rapor kaydı oluştur
export const createIncidentRecord = async (req: Request, res: Response) => {
    try {
        const { description, incident_type, severity, location, shift_label, fire_alarm, fire_count, fire_location } = req.body;
        const userId = req.user?.userId;
        const clientIp = getClientIp(req);

        // Kullanıcı doğrulama
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
        }

        // En az bir açıklama olmalı
        if (!description && !shift_label) {
            return res.status(400).json({ success: false, message: 'Açıklama veya vardiya bilgisi gereklidir' });
        }

        // GÜVENLİK: Input validasyonu ve sanitizasyonu
        const sanitizedDescription = sanitizeInput(description || '', 5000);
        const sanitizedLocation = sanitizeInput(location, 200);
        const sanitizedShiftLabel = sanitizeInput(shift_label, 100);
        const sanitizedFireLocation = sanitizeInput(fire_location, 200);

        // GÜVENLİK: Uzunluk kontrolleri
        if (!isValidLength(sanitizedDescription, 0, 5000)) {
            return res.status(400).json({ success: false, message: 'Açıklama 5000 karakteri geçemez' });
        }
        if (!isValidLength(sanitizedLocation, 0, 200)) {
            return res.status(400).json({ success: false, message: 'Konum 200 karakteri geçemez' });
        }

        // GÜVENLİK: Severity validasyonu
        if (severity && !isValidEnum(severity, VALID_SEVERITIES)) {
            return res.status(400).json({ success: false, message: 'Geçersiz önem derecesi' });
        }

        // GÜVENLİK: incident_type validasyonu
        const finalType = incident_type && isValidEnum(incident_type, VALID_TYPES) ? incident_type : 'general';

        const id = uuidv4();

        // Tam açıklama oluştur (vardiys bilgisi + açıklama + yangın bilgisi)
        let fullDescription = sanitizedDescription || '';
        if (sanitizedShiftLabel) {
            fullDescription = `[${sanitizedShiftLabel}] ${fullDescription}`;
        }
        if (fire_alarm && fire_count) {
            fullDescription += `\n\n🔥 YANGIN ALARMI: ${fire_count} kez - Konum: ${sanitizedFireLocation || 'Belirtilmedi'}`;
        }

        const result = await pool.query(
            `INSERT INTO incidents (
                id, description, incident_type, severity, location, 
                recorded_by, resolved, incident_time
            ) VALUES ($1, $2, $3, $4, $5, $6, false, NOW()) 
            RETURNING *`,
            [id, fullDescription, finalType, severity || null, sanitizedLocation, userId]
        );

        // GÜVENLİK: Audit log kaydı
        await logDataChange(
            'incidents',
            id,
            'INSERT',
            null,
            { incident_type: finalType, severity, location: sanitizedLocation },
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
        if (!isValidEnum(status, VALID_STATUSES)) {
            return res.status(400).json({ success: false, message: 'Geçersiz durum' });
        }

        const sanitizedNotes = sanitizeInput(resolution_notes, 2000);

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

        await pool.query(
            `UPDATE incidents 
             SET resolved = $1, 
                 resolution_notes = $2,
                 resolved_by = CASE WHEN $1 = true THEN $3 ELSE resolved_by END,
                 resolved_at = CASE WHEN $1 = true THEN NOW() ELSE resolved_at END,
                 updated_at = NOW()
             WHERE id = $4 AND deleted_at IS NULL`,
            [isResolved, sanitizedNotes, userId, id]
        );

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
        const { shift_label, report_content, categories } = req.body;
        const userId = req.user?.userId;
        const clientIp = getClientIp(req);

        // Kullanıcı doğrulama
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
        }

        // Gerekli alanlar kontrolü
        if (!shift_label || !report_content) {
            return res.status(400).json({
                success: false,
                message: 'Vardiya etiketi ve rapor içeriği gereklidir'
            });
        }

        // GÜVENLİK: Input validasyonu ve sanitizasyonu
        const sanitizedShiftLabel = sanitizeInput(shift_label, 100);
        const sanitizedReportContent = sanitizeInput(report_content, 50000); // HTML için daha büyük limit

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
            const htmlForWord = sanitizedReportContent.replace(/\n/g, '<br>');
            wordFilePath = await createWordFromHtml(htmlForWord, sanitizedShiftLabel, reporterName);
        } catch (wordError) {
            console.error('Word dosyası oluşturma hatası:', wordError);
            return res.status(500).json({ success: false, message: 'Word dosyası oluşturulamadı' });
        }

        const id = uuidv4();

        const result = await pool.query(
            `INSERT INTO incidents (
                id, shift_label, report_content, description, 
                incident_type, severity, resolved, 
                recorded_by, incident_time, report_date, report_file_path
            ) VALUES ($1, $2, $3, $4, $5, $6, false, $7, NOW(), CURRENT_DATE, $8) 
            RETURNING *`,
            [
                id,
                sanitizedShiftLabel,
                sanitizedReportContent,  // Düz metin olarak kaydet
                `Vardiya Raporu: ${sanitizedShiftLabel}`,
                'general',
                'low',
                userId,
                wordFilePath
            ]
        );

        // GÜVENLİK: Audit log kaydı
        await logDataChange(
            'incidents',
            id,
            'INSERT',
            null,
            { shift_label: sanitizedShiftLabel, report_type: 'shift_report', file_path: wordFilePath },
            userId,
            clientIp
        );

        // Kategorileri kaydet
        if (categories && Object.keys(categories).length > 0) {
            try {
                const categoryColumns = Object.keys(categories).join(', ');
                const categoryValues = Object.values(categories).map(v => v ? 'true' : 'false').join(', ');

                await pool.query(
                    `INSERT INTO incident_categories (
                        shift_report_id, ${categoryColumns}
                    ) VALUES ($1, ${categoryValues})`,
                    [id]
                );
            } catch (categoryError) {
                console.error('Kategori kaydetme hatası:', categoryError);
                // Kategori kaydedilemese bile rapor kaydedildi, uyarı ver ama hata döndürme
            }
        }

        res.status(201).json({
            success: true,
            data: result.rows[0],
            message: 'Vardiya raporu kaydedildi ve Word dosyası oluşturuldu'
        });
    } catch (error) {
        console.error('Create shift report error:', error);
        res.status(500).json({ success: false, message: 'Vardiya raporu kaydedilemedi' });
    }
};

// Bugünkü vardiya raporunu getir
export const getShiftReport = async (req: Request, res: Response) => {
    try {
        const { shift_label } = req.params;

        // Bugünkü tarihe göre rapor ara
        const result = await pool.query(
            `SELECT i.id, i.shift_label, i.report_content, i.report_date, i.report_file_path, 
                    i.created_at, i.recorded_by
             FROM incidents i
             WHERE i.shift_label = $1 
               AND i.report_date = CURRENT_DATE 
               AND i.deleted_at IS NULL
             ORDER BY i.created_at DESC 
             LIMIT 1`,
            [shift_label]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Rapor bulunamadı' });
        }

        // Kategorileri de getir
        const categoryResult = await pool.query(
            'SELECT * FROM incident_categories WHERE shift_report_id = $1',
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
        const { id } = req.params;
        const { report_content, categories } = req.body;
        const userId = req.user?.userId;
        const clientIp = getClientIp(req);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Yetkilendirme gerekli' });
        }

        if (!report_content) {
            return res.status(400).json({ success: false, message: 'Rapor içeriği gereklidir' });
        }

        // Mevcut raporu kontrol et
        const existing = await pool.query(
            'SELECT shift_label, report_file_path FROM incidents WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Rapor bulunamadı' });
        }

        const shiftLabel = existing.rows[0].shift_label;

        // Input sanitizasyonu
        const sanitizedReportContent = sanitizeInput(report_content, 50000);

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
            const htmlForWord = sanitizedReportContent.replace(/\n/g, '<br>');
            wordFilePath = await createWordFromHtml(htmlForWord, shiftLabel, reporterName);
        } catch (wordError) {
            console.error('Word dosyası oluşturma hatası:', wordError);
            return res.status(500).json({ success: false, message: 'Word dosyası oluşturulamadı' });
        }

        // Raporu güncelle (veritabanına düz metin kaydet)
        const result = await pool.query(
            `UPDATE incidents 
             SET report_content = $1, 
                 report_file_path = $2,
                 updated_at = NOW()
             WHERE id = $3 
             RETURNING *`,
            [sanitizedReportContent, wordFilePath, id]
        );

        // Audit log kaydı
        await logDataChange(
            'incidents',
            id,
            'UPDATE',
            existing.rows[0],
            { report_content: sanitizedReportContent, report_file_path: wordFilePath },
            userId,
            clientIp
        );

        // Kategorileri güncelle veya ekle
        if (categories && Object.keys(categories).length > 0) {
            try {
                // Önce mevcut kategori kaydını kontrol et
                const existingCategory = await pool.query(
                    'SELECT id FROM incident_categories WHERE shift_report_id = $1',
                    [id]
                );

                if (existingCategory.rows.length > 0) {
                    // Güncelle
                    const updateFields = Object.keys(categories)
                        .map((key, index) => `${key} = $${index + 2}`)
                        .join(', ');
                    const updateValues = Object.values(categories).map(v => v ? true : false);

                    await pool.query(
                        `UPDATE incident_categories SET ${updateFields}, updated_at = NOW() WHERE shift_report_id = $1`,
                        [id, ...updateValues]
                    );
                } else {
                    // Yeni kayıt ekle
                    const categoryColumns = Object.keys(categories).join(', ');
                    const categoryPlaceholders = Object.keys(categories).map((_, i) => `$${i + 2}`).join(', ');
                    const categoryValues = Object.values(categories).map(v => v ? true : false);

                    await pool.query(
                        `INSERT INTO incident_categories (shift_report_id, ${categoryColumns}) VALUES ($1, ${categoryPlaceholders})`,
                        [id, ...categoryValues]
                    );
                }
            } catch (categoryError) {
                console.error('Kategori güncelleme hatası:', categoryError);
                // Kategori güncellenemese bile rapor güncellendi
            }
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Vardiya raporu güncellendi ve yeni Word dosyası oluşturuldu'
        });
    } catch (error) {
        console.error('Update shift report error:', error);
        res.status(500).json({ success: false, message: 'Rapor güncellenemedi' });
    }
};

