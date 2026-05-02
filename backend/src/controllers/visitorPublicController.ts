import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { getClientIp } from '../middleware/rateLimiter';
import { emitApiMutation, resolveMutationTopics } from '../realtime/socket';
import { logDataChange } from '../utils/auditLog';
import { getResolvedGateFromRequest } from '../utils/gate';
import { normalizePlate, sanitizePlainText } from '../utils/validation';
import { consumeQrFormToken, issueQrFormToken } from '../services/visitorQrTokenStore';
import { deleteFile, hashPassport, hashTC } from '../utils/fileUpload';

const GUEST_QR_USERNAME = 'qr_misafir';
const GUEST_QR_PASSWORD_HASH = '$2a$10$EVcWI526jww.2pZF47pUeuERrJVQwEmq9fj4Buwh/p4TjmSm9.5u.';
const GUEST_QR_ENTRY_NAME = 'Misafir';
const SGK_QR_USERNAME = 'qr_sgk';
const SGK_QR_ENTRY_NAME = 'QR Kaydi';

const toTurkishUpper = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const normalized = value.trim();
    if (!normalized) return null;
    return normalized.toLocaleUpperCase('tr-TR');
};

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

const getOrCreateGuestPersonnelId = async (): Promise<string> => {
    const existing = await pool.query(
        `
            SELECT id, deleted_at
            FROM personnel
            WHERE username = $1
            ORDER BY created_at ASC
            LIMIT 1
        `,
        [GUEST_QR_USERNAME]
    );

    if (existing.rows.length > 0) {
        const existingId = existing.rows[0].id as string;
        if (existing.rows[0].deleted_at) {
            await pool.query(
                `
                    UPDATE personnel
                    SET deleted_at = NULL,
                        is_active = TRUE,
                        updated_at = NOW()
                    WHERE id = $1
                `,
                [existingId]
            );
        }
        return existingId;
    }

    const id = uuidv4();

    try {
        await pool.query(
            `
                INSERT INTO personnel (
                    id,
                    first_name,
                    last_name,
                    username,
                    password,
                    role,
                    is_active
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, TRUE
                )
            `,
            [id, 'Misafir', 'QR', GUEST_QR_USERNAME, GUEST_QR_PASSWORD_HASH, 'personnel']
        );
    } catch (error: any) {
        // Aynı anda birden fazla QR isteği gelirse oluşabilecek duplicate durumunu tolere et.
        if (error?.code !== '23505') {
            throw error;
        }
    }

    const created = await pool.query(
        `
            SELECT id
            FROM personnel
            WHERE username = $1
            ORDER BY created_at ASC
            LIMIT 1
        `,
        [GUEST_QR_USERNAME]
    );

    if (created.rows.length === 0) {
        throw new Error('QR misafir personeli olusturulamadi');
    }

    return created.rows[0].id as string;
};

export const getQrVisitorFormToken = async (req: Request, res: Response): Promise<void> => {
    try {
        const clientIp = getClientIp(req);
        const { token, expiresInSeconds } = issueQrFormToken(clientIp);

        res.status(200).json({
            success: true,
            data: {
                formToken: token,
                expiresInSeconds
            }
        });
    } catch (error) {
        console.error('Get QR visitor form token error:', error);
        res.status(500).json({ success: false, message: 'Form olusturulamadi' });
    }
};

export const createQrVisitorRecord = async (req: Request, res: Response): Promise<void> => {
    try {
        const {
            formToken,
            full_name,
            company_name,
            visiting_person,
            person_count,
            children_count,
            phone,
            vehicle_plate,
            website
        } = req.body;

        const clientIp = getClientIp(req);

        // Basit bot korumasi: gizli alan bos olmali
        if (website) {
            res.status(400).json({ success: false, message: 'Gecersiz istek' });
            return;
        }

        const tokenValidation = consumeQrFormToken(String(formToken || ''), clientIp);
        if (!tokenValidation.isValid) {
            res.status(400).json({
                success: false,
                message: tokenValidation.reason === 'already-used'
                    ? 'Bu form daha once kullanildi. Yeni kayit icin QR kodu tekrar okutun.'
                    : 'Form gecersiz veya suresi dolmus. QR kodu tekrar okutun.'
            });
            return;
        }

        const sanitizedFullName = sanitizePlainText(full_name, 100);
        const normalizedFullName = toTurkishUpper(sanitizedFullName);
        if (!normalizedFullName) {
            res.status(400).json({ success: false, message: 'Ad Soyad zorunludur' });
            return;
        }

        const sanitizedCompanyName = sanitizePlainText(company_name, 100);
        const sanitizedVisitingPerson = sanitizePlainText(visiting_person, 100);
        const normalizedCompanyName = toTurkishUpper(sanitizedCompanyName);
        const normalizedVisitingPerson = toTurkishUpper(sanitizedVisitingPerson);
        const normalizedPlate = normalizePlate(vehicle_plate);
        const normalizedPhone = phone ? String(phone).replace(/[\s\-()]/g, '').trim() : null;

        if (normalizedPlate && normalizedPlate.length > 20) {
            res.status(400).json({ success: false, message: 'Arac plakasi 20 karakterden uzun olamaz' });
            return;
        }

        if (normalizedPhone && normalizedPhone.length > 20) {
            res.status(400).json({ success: false, message: 'Telefon numarasi 20 karakterden uzun olamaz' });
            return;
        }

        let personCountValue: number | null = null;
        if (person_count !== undefined && person_count !== null && person_count !== '') {
            if (isNaN(person_count) || Number(person_count) < 1) {
                res.status(400).json({ success: false, message: 'Kisi sayisi en az 1 olmalidir' });
                return;
            }
            personCountValue = Number(person_count);
        }

        let childrenCountValue = 0;
        if (children_count !== undefined && children_count !== null && children_count !== '') {
            if (isNaN(children_count) || Number(children_count) < 0) {
                res.status(400).json({ success: false, message: 'Cocuk sayisi en az 0 olmalidir' });
                return;
            }
            childrenCountValue = Number(children_count);
        }

        const guestPersonnelId = await getOrCreateGuestPersonnelId();
        const gate = await getResolvedGateFromRequest(req);
        const id = uuidv4();
        const personCountToInsert = personCountValue ?? 1;

        await pool.query(
            `
                INSERT INTO visitor_records (
                    id,
                    vehicle_plate,
                    full_name,
                    company_name,
                    visiting_person,
                    person_count,
                    children_count,
                    gate,
                    phone,
                    notes,
                    subcontractor_worker,
                    for_electric_station,
                    entry_by,
                    entry_by_name,
                    entry_date,
                    entry_time,
                    status,
                    send_whatsapp
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9,
                    NULL,
                    FALSE,
                    FALSE,
                    $10, $11,
                    CURRENT_DATE,
                    CURRENT_TIME,
                    'inside',
                    FALSE
                )
            `,
            [
                id,
                normalizedPlate,
                normalizedFullName,
                normalizedCompanyName,
                normalizedVisitingPerson,
                personCountToInsert,
                childrenCountValue,
                gate,
                normalizedPhone,
                guestPersonnelId,
                GUEST_QR_ENTRY_NAME
            ]
        );

        await logDataChange(
            'visitor_records',
            id,
            'INSERT',
            null,
            {
                full_name: normalizedFullName,
                company_name: normalizedCompanyName,
                visiting_person: normalizedVisitingPerson,
                source: 'qr_guest'
            },
            guestPersonnelId,
            clientIp
        );

        emitApiMutation({
            method: 'POST',
            path: '/api/visitor-public/records',
            statusCode: 201,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics('/api/visitor-public/records'),
        });

        res.status(201).json({
            success: true,
            message: 'Kayit basariyla alindi',
            data: { id }
        });
    } catch (error) {
        console.error('Create QR visitor record error:', error);
        res.status(500).json({ success: false, message: 'Kayit olusturulamadi' });
    }
};

const getOrCreateQrSgkPersonnelId = async (): Promise<string> => {
    const existing = await pool.query(
        `
            SELECT id, deleted_at
            FROM personnel
            WHERE username = $1
            ORDER BY created_at ASC
            LIMIT 1
        `,
        [SGK_QR_USERNAME]
    );

    if (existing.rows.length > 0) {
        const existingId = existing.rows[0].id as string;
        if (existing.rows[0].deleted_at) {
            await pool.query(
                `
                    UPDATE personnel
                    SET deleted_at = NULL,
                        is_active = TRUE,
                        updated_at = NOW()
                    WHERE id = $1
                `,
                [existingId]
            );
        }
        return existingId;
    }

    const id = uuidv4();

    try {
        await pool.query(
            `
                INSERT INTO personnel (
                    id,
                    first_name,
                    last_name,
                    username,
                    password,
                    role,
                    is_active
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, TRUE
                )
            `,
            [id, 'QR', 'Kaydi', SGK_QR_USERNAME, GUEST_QR_PASSWORD_HASH, 'personnel']
        );
    } catch (error: any) {
        if (error?.code !== '23505') {
            throw error;
        }
    }

    const created = await pool.query(
        `
            SELECT id
            FROM personnel
            WHERE username = $1
            ORDER BY created_at ASC
            LIMIT 1
        `,
        [SGK_QR_USERNAME]
    );

    if (created.rows.length === 0) {
        throw new Error('QR SGK personeli olusturulamadi');
    }

    return created.rows[0].id as string;
};

export const createQrSgkRecord = async (req: Request, res: Response): Promise<void> => {
    const uploadedFiles = extractUploadedFiles(req);

    try {
        const { formToken, website, tc_no, passport_no, full_name, company_name, notes } = req.body;
        const clientIp = getClientIp(req);

        if (website) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'Gecersiz istek' });
            return;
        }

        const tokenValidation = consumeQrFormToken(String(formToken || ''), clientIp);
        if (!tokenValidation.isValid) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({
                success: false,
                message: tokenValidation.reason === 'already-used'
                    ? 'Bu form daha once kullanildi. Yeni kayit icin QR kodu tekrar okutun.'
                    : 'Form gecersiz veya suresi dolmus. QR kodu tekrar okutun.'
            });
            return;
        }

        const sanitizedFullName = sanitizePlainText(full_name, 100);
        const sanitizedCompanyName = sanitizePlainText(company_name, 100);
        const sanitizedNotes = sanitizePlainText(notes, 1000);
        const normalizedFullName = toTurkishUpper(sanitizedFullName);
        const normalizedCompanyName = toTurkishUpper(sanitizedCompanyName);

        if (!normalizedFullName) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'Ad Soyad zorunludur' });
            return;
        }

        if (!normalizedCompanyName) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'Firma Ismi zorunludur' });
            return;
        }

        if (uploadedFiles.length === 0) {
            res.status(400).json({ success: false, message: 'En az bir belge dosyasi zorunludur' });
            return;
        }

        const hasTCInput = typeof tc_no === 'string' && tc_no.trim().length > 0;
        const hasPassportInput = typeof passport_no === 'string' && passport_no.trim().length > 0;

        if (hasTCInput && hasPassportInput) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(400).json({ success: false, message: 'TC Kimlik No ve Pasaport Numarasi ayni anda girilemez' });
            return;
        }

        let hashedTC: string | null = null;
        let hashedPassport: string | null = null;

        if (hasTCInput) {
            const cleanTC = String(tc_no).replace(/\D/g, '');
            if (cleanTC.length !== 11) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'TC Kimlik No 11 haneli olmalidir' });
                return;
            }
            hashedTC = hashTC(cleanTC);

            const existingByTC = await pool.query(
                'SELECT id FROM sgk_records WHERE hashed_tc = $1 AND deleted_at IS NULL',
                [hashedTC]
            );

            if (existingByTC.rows.length > 0) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'Bu TC kimlik numarasina ait kayit zaten mevcut' });
                return;
            }
        }

        if (hasPassportInput) {
            const cleanPassport = String(passport_no).trim().toUpperCase();
            if (cleanPassport.length < 6 || cleanPassport.length > 20) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'Pasaport numarasi 6-20 karakter arasinda olmalidir' });
                return;
            }
            hashedPassport = hashPassport(cleanPassport);

            const existingByPassport = await pool.query(
                'SELECT id FROM sgk_records WHERE hashed_passport = $1 AND deleted_at IS NULL',
                [hashedPassport]
            );

            if (existingByPassport.rows.length > 0) {
                uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
                res.status(400).json({ success: false, message: 'Bu pasaport numarasina ait kayit zaten mevcut' });
                return;
            }
        }

        const id = uuidv4();
        const currentDate = new Date();
        const personnelId = await getOrCreateQrSgkPersonnelId();
        const client = await pool.connect();
        let committed = false;

        try {
            await client.query('BEGIN');

            await client.query(
                `
                    INSERT INTO sgk_records (
                        id, hashed_tc, hashed_passport, full_name, company_name,
                        file_path, upload_date, notes, personnel_id, created_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `,
                [
                    id,
                    hashedTC,
                    hashedPassport,
                    normalizedFullName,
                    normalizedCompanyName,
                    uploadedFiles[0].filename,
                    currentDate,
                    sanitizedNotes,
                    personnelId,
                    currentDate
                ]
            );

            for (let i = 0; i < uploadedFiles.length; i++) {
                const uploadedFile = uploadedFiles[i];
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
                        uploadedFile.filename,
                        uploadedFile.originalname || null,
                        uploadedFile.mimetype || null,
                        uploadedFile.size || null,
                        i
                    ]
                );
            }

            await client.query('COMMIT');
            committed = true;
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

        if (!committed) {
            uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
            res.status(500).json({ success: false, message: 'SGK kaydi olusturulamadi' });
            return;
        }

        await logDataChange(
            'sgk_records',
            id,
            'INSERT',
            null,
            {
                full_name: normalizedFullName,
                company_name: normalizedCompanyName,
                notes: sanitizedNotes,
                source: 'qr_sgk',
                recorded_by_name: SGK_QR_ENTRY_NAME
            },
            personnelId,
            clientIp
        );

        emitApiMutation({
            method: 'POST',
            path: '/api/visitor-public/sgk-records',
            statusCode: 201,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics('/api/sgk/records'),
        });

        res.status(201).json({
            success: true,
            message: 'SGK belgesi basariyla kaydedildi',
            data: { id }
        });
    } catch (error) {
        console.error('Create QR SGK record error:', error);
        uploadedFiles.forEach((uploadedFile) => deleteFile(uploadedFile.filename));
        res.status(500).json({ success: false, message: 'SGK kaydi olusturulamadi' });
    }
};
