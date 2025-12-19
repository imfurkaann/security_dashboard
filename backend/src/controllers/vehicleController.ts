import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizeInput, isValidLength, normalizePlate } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { createVehicleRecordMessage, createVehicleReturnMessage } from '../services/whatsapp';

/**
 * Get all vehicles
 * GET /api/vehicles
 */
export const getVehicles = async (_req: Request, res: Response): Promise<void> => {
    try {
        const query = `
            SELECT id, brand, plate, status, is_active, created_at
            FROM vehicles
            WHERE deleted_at IS NULL
            ORDER BY brand
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get vehicles error:', error);
        res.status(500).json({
            success: false,
            message: 'Araçlar listelenirken hata oluştu'
        });
    }
};

/**
 * Get all managers
 * GET /api/vehicles/managers
 */
export const getManagers = async (_req: Request, res: Response): Promise<void> => {
    try {
        const query = `
            SELECT id, first_name, last_name, title
            FROM managers
            WHERE deleted_at IS NULL AND is_active = true
            ORDER BY first_name, last_name
        `;
        const result = await pool.query(query);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Get managers error:', error);
        res.status(500).json({
            success: false,
            message: 'Müdürler listelenirken hata oluştu'
        });
    }
};

/**
 * Get all vehicle records with joins
 * GET /api/vehicles/records
 */
export const getVehicleRecords = async (_req: Request, res: Response): Promise<void> => {
    try {
        const query = `
            SELECT 
                vr.id,
                vr.given_date,
                vr.given_time,
                vr.return_date,
                vr.return_time,
                vr.destination,
                vr.manager_name,
                vr.status,
                vr.notes,
                vr.created_at,
                v.brand as vehicle_brand,
                v.plate as vehicle_plate,
                m.first_name as manager_first_name,
                m.last_name as manager_last_name,
                m.title as manager_title,
                pg.first_name as given_by_first_name,
                pg.last_name as given_by_last_name,
                pr.first_name as returned_by_first_name,
                pr.last_name as returned_by_last_name
            FROM vehicle_records vr
            INNER JOIN vehicles v ON vr.vehicle_id = v.id
            LEFT JOIN managers m ON vr.manager_id = m.id
            INNER JOIN personnel pg ON vr.given_by = pg.id
            LEFT JOIN personnel pr ON vr.returned_by = pr.id
            WHERE vr.deleted_at IS NULL
            ORDER BY vr.given_date DESC, vr.given_time DESC
            LIMIT 1000
        `;
        const result = await pool.query(query);

        // Format the data
        const formattedData = result.rows.map(row => ({
            id: row.id,
            vehicle: `${row.vehicle_plate} - ${row.vehicle_brand}`,
            vehicle_brand: row.vehicle_brand,
            vehicle_plate: row.vehicle_plate,
            manager: row.manager_name || `${row.manager_first_name} ${row.manager_last_name}`,
            manager_title: row.manager_title,
            given_by: `${row.given_by_first_name} ${row.given_by_last_name}`,
            returned_by: row.returned_by_first_name ? `${row.returned_by_first_name} ${row.returned_by_last_name}` : null,
            given_date: row.given_date,
            given_time: row.given_time,
            return_date: row.return_date,
            return_time: row.return_time,
            destination: row.destination,
            status: row.status,
            notes: row.notes,
            created_at: row.created_at
        }));

        res.status(200).json(formattedData);
    } catch (error) {
        console.error('Get vehicle records error:', error);
        res.status(500).json({
            success: false,
            message: 'Araç kayıtları listelenirken hata oluştu'
        });
    }
};

/**
 * Create new vehicle record
 * POST /api/vehicles/records
 */
export const createVehicleRecord = async (req: Request, res: Response): Promise<void> => {
    try {
        const { vehicle_id, manager_id, manager_name, destination, notes } = req.body;
        const personnel_id = req.user?.userId;

        // Validate required fields
        if (!vehicle_id) {
            res.status(400).json({
                success: false,
                message: 'Araç bilgisi gereklidir'
            });
            return;
        }

        // Either manager_id or manager_name must be provided
        if (!manager_id && !manager_name) {
            res.status(400).json({
                success: false,
                message: 'Müdür bilgisi gereklidir (ID veya ad)'
            });
            return;
        }

        // GÜVENLİK: Validate UUID format for vehicle_id
        if (!isValidUUID(vehicle_id)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz araç kimliği'
            });
            return;
        }

        // GÜVENLİK: If manager_id is provided, validate UUID format
        if (manager_id && !isValidUUID(manager_id)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz müdür kimliği'
            });
            return;
        }

        // If manager_name is provided, validate length
        if (manager_name && (typeof manager_name !== 'string' || manager_name.trim().length === 0)) {
            res.status(400).json({
                success: false,
                message: 'Geçerli bir müdür adı giriniz'
            });
            return;
        }

        if (manager_name && manager_name.length > 100) {
            res.status(400).json({
                success: false,
                message: 'Müdür adı çok uzun (maksimum 100 karakter)'
            });
            return;
        }

        // Validate destination
        if (!destination || typeof destination !== 'string' || destination.trim().length === 0) {
            res.status(400).json({
                success: false,
                message: 'Gidilen yer bilgisi gereklidir'
            });
            return;
        }

        if (destination.length > 255) {
            res.status(400).json({
                success: false,
                message: 'Gidilen yer çok uzun (maksimum 255 karakter)'
            });
            return;
        }

        // Validate notes length to prevent buffer overflow
        if (notes && typeof notes === 'string' && notes.length > 1000) {
            res.status(400).json({
                success: false,
                message: 'Açıklama çok uzun (maksimum 1000 karakter)'
            });
            return;
        }

        // Check if vehicle exists and is available
        const vehicleCheck = await pool.query(
            'SELECT status FROM vehicles WHERE id = $1 AND deleted_at IS NULL',
            [vehicle_id]
        );

        if (vehicleCheck.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Araç bulunamadı'
            });
            return;
        }

        if (vehicleCheck.rows[0].status !== 'available') {
            res.status(400).json({
                success: false,
                message: 'Araç kullanımda, müsait değil'
            });
            return;
        }

        // Check if manager exists and get name (only if manager_id is provided)
        let resolvedManagerName = manager_name;
        if (manager_id) {
            const managerCheck = await pool.query(
                'SELECT id, first_name, last_name FROM managers WHERE id = $1 AND deleted_at IS NULL AND is_active = true',
                [manager_id]
            );

            if (managerCheck.rows.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Müdür bulunamadı'
                });
                return;
            }

            // Auto-populate manager_name if manager_id is provided
            const manager = managerCheck.rows[0];
            resolvedManagerName = `${manager.first_name} ${manager.last_name}`;
        }

        const id = uuidv4();

        // Start transaction
        await pool.query('BEGIN');

        // Create record (resolvedManagerName is auto-populated if manager_id is provided)
        await pool.query(
            `INSERT INTO vehicle_records (
                id, vehicle_id, manager_id, manager_name, given_by,
                given_date, given_time, destination, notes, status
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, CURRENT_TIME, $6, $7, 'in_use')`,
            [id, vehicle_id, manager_id || null, resolvedManagerName, personnel_id, destination, notes || null]
        );

        // Update vehicle status
        await pool.query(
            'UPDATE vehicles SET status = $1 WHERE id = $2',
            ['in_use', vehicle_id]
        );

        await pool.query('COMMIT');

        // GÜVENLİK: Audit log kaydı
        const clientIp = getClientIp(req);
        await logDataChange(
            'vehicle_records',
            id,
            'INSERT',
            null,
            { vehicle_id, manager_id, destination, personnel_id },
            personnel_id || null,
            clientIp
        );

        // WhatsApp mesaj şablonu oluştur
        let whatsappMessage = '';
        try {
            const vehicleInfo = await pool.query(
                'SELECT plate FROM vehicles WHERE id = $1',
                [vehicle_id]
            );
            const vehiclePlate = vehicleInfo.rows[0]?.plate || 'Bilinmeyen';

            const recordInfo = await pool.query(
                'SELECT given_date, given_time FROM vehicle_records WHERE id = $1',
                [id]
            );
            const givenDate = recordInfo.rows[0]?.given_date || new Date().toISOString().split('T')[0];
            const timeString = recordInfo.rows[0]?.given_time || new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' });
            // Sadece saat:dakika formatına çevir (HH:MM)
            const givenTime = timeString.substring(0, 5);

            whatsappMessage = createVehicleRecordMessage({
                vehiclePlate,
                managerName: resolvedManagerName,
                givenDate,
                givenTime,
                destination
            });
        } catch (error) {
            console.error('WhatsApp mesaj oluşturma hatası:', error);
        }

        res.status(201).json({
            success: true,
            message: 'Araç kaydı oluşturuldu',
            whatsappMessage
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Create vehicle record error:', error);
        res.status(500).json({
            success: false,
            message: 'Araç kaydı oluşturulurken hata oluştu'
        });
    }
};

/**
 * Return vehicle
 * POST /api/vehicles/records/:id/return
 */
export const returnVehicle = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        // GÜVENLİK: UUID validasyonu
        if (!isValidUUID(id)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz kayıt ID formatı'
            });
            return;
        }

        // Get record and vehicle info
        const recordCheck = await pool.query(
            'SELECT vehicle_id, status FROM vehicle_records WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (recordCheck.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Kayıt bulunamadı'
            });
            return;
        }

        if (recordCheck.rows[0].status === 'returned') {
            res.status(400).json({
                success: false,
                message: 'Araç zaten iade edilmiş'
            });
            return;
        }

        const vehicle_id = recordCheck.rows[0].vehicle_id;

        const personnel_id = req.user?.userId;

        // Start transaction
        await pool.query('BEGIN');

        // Update record - aracı iade eden kişiyi kaydet
        await pool.query(
            `UPDATE vehicle_records 
             SET return_date = CURRENT_DATE, 
                 return_time = CURRENT_TIME, 
                 returned_by = $2,
                 status = 'returned'
             WHERE id = $1`,
            [id, personnel_id]
        );

        // Update vehicle status
        await pool.query(
            'UPDATE vehicles SET status = $1 WHERE id = $2',
            ['available', vehicle_id]
        );

        await pool.query('COMMIT');

        // GÜVENLİK: Audit log kaydı
        const clientIp = getClientIp(req);
        await logDataChange(
            'vehicle_records',
            id,
            'UPDATE',
            { status: 'in_use' },
            { status: 'returned', return_date: 'CURRENT_DATE' },
            req.user?.userId || null,
            clientIp
        );

        // WhatsApp mesaj şablonu oluştur
        let whatsappMessage = '';
        try {
            // Araç ve müdür bilgilerini al
            const recordInfo = await pool.query(
                `SELECT vr.manager_name, vr.return_time, v.plate
                 FROM vehicle_records vr
                 INNER JOIN vehicles v ON vr.vehicle_id = v.id
                 WHERE vr.id = $1`,
                [id]
            );

            if (recordInfo.rows.length > 0) {
                const vehiclePlate = recordInfo.rows[0].plate || 'Bilinmeyen';
                const managerName = recordInfo.rows[0].manager_name || 'Bilinmeyen';
                const timeString = recordInfo.rows[0].return_time || new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' });
                const returnTime = timeString.substring(0, 5);

                whatsappMessage = createVehicleReturnMessage({
                    vehiclePlate,
                    managerName,
                    returnTime
                });
            }
        } catch (error) {
            console.error('WhatsApp mesaj oluşturma hatası:', error);
        }

        res.status(200).json({
            success: true,
            message: 'Araç iadesi kaydedildi',
            whatsappMessage
        });
    } catch (error) {
        await pool.query('ROLLBACK');
        console.error('Return vehicle error:', error);
        res.status(500).json({
            success: false,
            message: 'Araç iadesi kaydedilirken hata oluştu'
        });
    }
};
