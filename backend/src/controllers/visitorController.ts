import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get all visitor records with joins
 * GET /api/visitors/records
 */
export const getVisitorRecords = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = `
            SELECT 
                vr.id,
                vr.vehicle_plate,
                vr.full_name,
                vr.company_name,
                vr.visiting_person,
                vr.person_count,
                vr.phone,
                vr.notes,
                vr.entry_date,
                vr.entry_time,
                vr.exit_date,
                vr.exit_time,
                vr.status,
                vr.created_at,
                p.first_name as personnel_first_name,
                p.last_name as personnel_last_name
            FROM visitor_records vr
            LEFT JOIN personnel p ON vr.personnel_id = p.id
            WHERE vr.deleted_at IS NULL
            ORDER BY vr.entry_date DESC, vr.entry_time DESC
        `;
        const result = await pool.query(query);

        const formattedData = result.rows.map((row: any) => ({
            id: row.id,
            vehicle_plate: row.vehicle_plate,
            full_name: row.full_name,
            company_name: row.company_name,
            visiting_person: row.visiting_person,
            person_count: row.person_count,
            phone: row.phone,
            notes: row.notes,
            entry_date: row.entry_date,
            entry_time: row.entry_time,
            exit_date: row.exit_date,
            exit_time: row.exit_time,
            status: row.status,
            personnel: (row.personnel_first_name || row.personnel_last_name) ? `${row.personnel_first_name || ''} ${row.personnel_last_name || ''}`.trim() : null,
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
        const { vehicle_plate, full_name, company_name, visiting_person, person_count, phone, notes } = req.body;
        const personnel_id = (req as any).user?.userId || null;

        // Tüm alanlar opsiyonel. Sadece girilen alanlar için uzunluk/format kontrolleri yapılır.
        if (vehicle_plate && vehicle_plate.length > 20) {
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

        // person_count opsiyonel
        let personCountValue: number | null = null;
        if (person_count !== undefined && person_count !== null && person_count !== '') {
            if (isNaN(person_count) || Number(person_count) < 1) {
                res.status(400).json({ success: false, message: 'Kişi sayısı geçerli bir sayı olmalı ve en az 1 olmalıdır' });
                return;
            }
            personCountValue = Number(person_count);
        }

        const id = uuidv4();

        // Query schema to find required NOT NULL columns without defaults
        const infoRes = await pool.query(
            `SELECT column_name, is_nullable, column_default, data_type
             FROM information_schema.columns
             WHERE table_name = 'visitor_records'`
        );

        const cols: string[] = ['id', 'entry_date', 'entry_time', 'status'];
        const placeholders: string[] = ['$1', 'CURRENT_DATE', 'CURRENT_TIME', "'inside'"];
        const values: any[] = [id];

        // person_count: default to 1 when not provided
        const personCountToInsert = personCountValue ?? 1;

        let idx = values.length + 1; // next parameter index

        // Helper to push a column and its value
        const pushCol = (colName: string, val: any) => {
            cols.push(colName);
            placeholders.push(`$${idx++}`);
            values.push(val);
        };

        // If personnel_id (the recorder) isn't present, require authentication because DB demands personnel_id NOT NULL
        if (!personnel_id) {
            res.status(401).json({ success: false, message: 'Kullanıcı doğrulanmadı. Lütfen giriş yapın.' });
            return;
        }

        // Build values for known fields; for fields that are NOT NULL in DB and missing from payload,
        // supply safe defaults based on data_type.
        const colsInfo: any = {};
        infoRes.rows.forEach((r: any) => { colsInfo[r.column_name] = r; });

        // vehicle_plate
        if (vehicle_plate !== undefined && vehicle_plate !== null) {
            pushCol('vehicle_plate', String(vehicle_plate).toUpperCase());
        } else if (colsInfo['vehicle_plate'] && colsInfo['vehicle_plate'].is_nullable === 'NO' && !colsInfo['vehicle_plate'].column_default) {
            pushCol('vehicle_plate', '');
        }

        // full_name
        if (full_name !== undefined && full_name !== null) {
            pushCol('full_name', full_name);
        } else if (colsInfo['full_name'] && colsInfo['full_name'].is_nullable === 'NO' && !colsInfo['full_name'].column_default) {
            pushCol('full_name', '');
        }

        // company_name
        if (company_name !== undefined && company_name !== null) {
            pushCol('company_name', company_name);
        } else if (colsInfo['company_name'] && colsInfo['company_name'].is_nullable === 'NO' && !colsInfo['company_name'].column_default) {
            pushCol('company_name', '');
        }

        // visiting_person (destination)
        if (visiting_person !== undefined && visiting_person !== null) {
            pushCol('visiting_person', visiting_person);
        } else if (colsInfo['visiting_person'] && colsInfo['visiting_person'].is_nullable === 'NO' && !colsInfo['visiting_person'].column_default) {
            pushCol('visiting_person', '');
        }

        // person_count (always include with safe default)
        pushCol('person_count', personCountToInsert);

        // phone
        if (phone !== undefined && phone !== null) {
            pushCol('phone', phone);
        } else if (colsInfo['phone'] && colsInfo['phone'].is_nullable === 'NO' && !colsInfo['phone'].column_default) {
            pushCol('phone', '');
        }

        // notes (nullable) include if provided
        if (notes !== undefined) {
            pushCol('notes', notes || null);
        }

        // personnel_id: include authenticated user id
        pushCol('personnel_id', personnel_id);

        const insertQuery = `INSERT INTO visitor_records (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`;

        await pool.query('BEGIN');
        await pool.query(insertQuery, values);
        await pool.query('COMMIT');

        res.status(201).json({ success: true, message: 'Ziyaretçi girişi kaydedildi', data: { id } });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Create visitor record error:', error instanceof Error ? error.message : error);
        res.status(500).json({ success: false, message: 'Ziyaretçi girişi kaydedilirken hata oluştu', error: error instanceof Error ? error.message : String(error) });
    }
};


/**
 * Update visitor record
 * PUT /api/visitors/records/:id
 */
export const updateVisitorRecord = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { vehicle_plate, full_name, company_name, visiting_person, person_count, phone, notes } = req.body;

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
            return;
        }

        const recordCheck = await pool.query('SELECT id FROM visitor_records WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (recordCheck.rows.length === 0) {
            res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
            return;
        }

        // Opsiyonel alanlar için sadece girilmiş olanları güncelle
        const updates: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (vehicle_plate !== undefined) { updates.push(`vehicle_plate = $${idx++}`); params.push(vehicle_plate ? String(vehicle_plate).toUpperCase() : null); }
        if (full_name !== undefined) { updates.push(`full_name = $${idx++}`); params.push(full_name || null); }
        if (company_name !== undefined) { updates.push(`company_name = $${idx++}`); params.push(company_name || null); }
        if (visiting_person !== undefined) { updates.push(`visiting_person = $${idx++}`); params.push(visiting_person || null); }
        if (person_count !== undefined) {
            // DB requires non-null person_count — default to 1 when empty/null
            const pc = (person_count === '' || person_count === null) ? 1 : Number(person_count);
            params.push(pc);
            updates.push(`person_count = $${idx++}`);
        }
        if (phone !== undefined) { updates.push(`phone = $${idx++}`); params.push(phone || null); }
        if (notes !== undefined) { updates.push(`notes = $${idx++}`); params.push(notes || null); }

        if (updates.length === 0) {
            res.status(400).json({ success: false, message: 'Güncellenecek alan bulunamadı' });
            return;
        }

        const query = `UPDATE visitor_records SET ${updates.join(', ')}, updated_at = now() WHERE id = $${idx} AND deleted_at IS NULL`;
        params.push(id);

        await pool.query(query, params);

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

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz kayıt ID formatı' });
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

        await pool.query(
            `UPDATE visitor_records SET exit_date = CURRENT_DATE, exit_time = CURRENT_TIME, status = 'exited', updated_at = now() WHERE id = $1 AND deleted_at IS NULL`,
            [id]
        );

        res.status(200).json({ success: true, message: 'Çıkış kaydedildi' });
    } catch (error) {
        console.error('Exit visitor error:', error);
        res.status(500).json({ success: false, message: 'Çıkış kaydedilirken hata oluştu' });
    }
};
