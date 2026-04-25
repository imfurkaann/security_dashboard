import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import { getClientIp } from '../middleware/rateLimiter';
import { emitApiMutation, resolveMutationTopics } from '../realtime/socket';
import { logDataChange } from '../utils/auditLog';
import { getResolvedGateFromRequest } from '../utils/gate';
import { normalizePlate, sanitizePlainText } from '../utils/validation';
import { consumeQrFormToken, issueQrFormToken } from '../services/visitorQrTokenStore';

const GUEST_QR_USERNAME = 'qr_misafir';
const GUEST_QR_PASSWORD_HASH = '$2a$10$EVcWI526jww.2pZF47pUeuERrJVQwEmq9fj4Buwh/p4TjmSm9.5u.';
const GUEST_QR_ENTRY_NAME = 'Misafir';

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
        if (!sanitizedFullName || sanitizedFullName.trim().length === 0) {
            res.status(400).json({ success: false, message: 'Ad Soyad zorunludur' });
            return;
        }

        const sanitizedCompanyName = sanitizePlainText(company_name, 100);
        const sanitizedVisitingPerson = sanitizePlainText(visiting_person, 100);
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
                sanitizedFullName,
                sanitizedCompanyName,
                sanitizedVisitingPerson,
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
                full_name: sanitizedFullName,
                company_name: sanitizedCompanyName,
                visiting_person: sanitizedVisitingPerson,
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
