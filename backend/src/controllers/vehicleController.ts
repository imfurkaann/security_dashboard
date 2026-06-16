import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { logDataChange } from '../utils/auditLog';
import { isValidUUID, sanitizeInput, isValidLength, normalizePlate } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { createVehicleRecordMessage, createVehicleReturnMessage } from '../services/whatsapp';
import { sendWhatsAppTextMessage } from '../services/whatsappBaileys';
import { getResolvedGateFromRequest } from '../utils/gate';
import { emitApiMutation, resolveMutationTopics } from '../realtime/socket';

const formatDriveDuration = (totalMinutes: number): string => {
    const normalized = Number.isFinite(totalMinutes) ? Math.max(0, Math.floor(totalMinutes)) : 0;
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;

    if (hours > 0 && minutes > 0) return `${hours} Saat ${minutes} Dakika`;
    if (hours > 0) return `${hours} Saat`;
    return `${minutes} Dakika`;
};

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
export const getVehicleRecords = async (req: Request, res: Response): Promise<void> => {
    try {
        const includeDeleted = req.query.includeDeleted === 'true';
        const unlimited = req.query.unlimited === 'true';

        const reqLimit = Number(req.query.limit ?? 1000);
        const reqOffset = Number(req.query.offset ?? 0);
        const safeLimit = Number.isFinite(reqLimit) && reqLimit > 0 ? Math.min(reqLimit, 10000) : 1000;
        const safeOffset = Number.isFinite(reqOffset) && reqOffset >= 0 ? reqOffset : 0;

        const limitClause = unlimited ? '' : `LIMIT ${safeLimit} OFFSET ${safeOffset}`;

        const filters: string[] = [];
        const queryParams: any[] = [];
        let paramIndex = 1;

        if (!includeDeleted) {
            filters.push(`vr.deleted_at IS NULL`);
        }

        // Apply query filters
        if (req.query.vehicle_plate) {
            filters.push(`v.plate = $${paramIndex++}`);
            queryParams.push(req.query.vehicle_plate);
        }

        if (req.query.manager) {
            filters.push(`(vr.manager_name ILIKE $${paramIndex} OR CONCAT(m.first_name, ' ', m.last_name) ILIKE $${paramIndex})`);
            queryParams.push(`%${req.query.manager}%`);
            paramIndex++;
        }

        if (req.query.destination) {
            filters.push(`vr.destination ILIKE $${paramIndex++}`);
            queryParams.push(`%${req.query.destination}%`);
        }

        if (req.query.given_by) {
            filters.push(`CONCAT(pg.first_name, ' ', pg.last_name) ILIKE $${paramIndex++}`);
            queryParams.push(`%${req.query.given_by}%`);
        }

        if (req.query.returned_by) {
            filters.push(`CONCAT(pr.first_name, ' ', pr.last_name) ILIKE $${paramIndex++}`);
            queryParams.push(`%${req.query.returned_by}%`);
        }

        if (req.query.status && req.query.status !== 'all') {
            if (req.query.status === 'deleted') {
                filters.push(`vr.deleted_at IS NOT NULL`);
            } else {
                filters.push(`vr.status = $${paramIndex++}`);
                queryParams.push(req.query.status);
            }
        }

        if (req.query.gate && req.query.gate !== 'all') {
            filters.push(`vr.gate = $${paramIndex++}`);
            queryParams.push(req.query.gate);
        }

        if (req.query.givenDateStart) {
            filters.push(`vr.given_date >= $${paramIndex++}::date`);
            queryParams.push(req.query.givenDateStart);
        }

        if (req.query.givenDateEnd) {
            filters.push(`vr.given_date <= $${paramIndex++}::date`);
            queryParams.push(req.query.givenDateEnd);
        }

        if (req.query.returnDateStart) {
            filters.push(`vr.return_date >= $${paramIndex++}::date`);
            queryParams.push(req.query.returnDateStart);
        }

        if (req.query.returnDateEnd) {
            filters.push(`vr.return_date <= $${paramIndex++}::date`);
            queryParams.push(req.query.returnDateEnd);
        }

        const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

        const query = `
            SELECT 
                vr.id,
                vr.given_date,
                vr.given_time,
                vr.return_date,
                vr.return_time,
                vr.destination,
                vr.gate,
                vr.manager_name,
                vr.status,
                vr.notes,
                vr.created_at,
                vr.deleted_at,
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
            ${whereClause}
            ORDER BY vr.given_date DESC, vr.given_time DESC
            ${limitClause}
        `;
        const result = await pool.query(query, queryParams);

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
            gate: row.gate,
            status: row.status,
            notes: row.notes,
            deleted_at: row.deleted_at || null,
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
        const { vehicle_id, manager_id, manager_name, destination, notes, given_time } = req.body;
        const personnel_id = req.user?.userId;
        const gate = await getResolvedGateFromRequest(req);

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

        const id = uuidv4();
        const clientIp = getClientIp(req);
        let resolvedManagerName = manager_name;
        let givenDate = '';
        let givenTimeFormatted = '';
        let vehiclePlate = 'Bilinmeyen';

        // Start transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // GÜVENLİK/CONCURRENCY: Lock the vehicle row to prevent duplicate active checkouts
            const vehicleCheck = await client.query(
                'SELECT status, plate FROM vehicles WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
                [vehicle_id]
            );

            if (vehicleCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                res.status(404).json({
                    success: false,
                    message: 'Araç bulunamadı'
                });
                return;
            }

            let vehicleStatus = vehicleCheck.rows[0].status;
            vehiclePlate = vehicleCheck.rows[0].plate || 'Bilinmeyen';

            // Stale durumlari otomatik duzelt
            if (vehicleStatus !== 'available') {
                const activeInUseRecord = await client.query(
                    `SELECT 1
                     FROM vehicle_records
                     WHERE vehicle_id = $1
                       AND deleted_at IS NULL
                       AND status = 'in_use'
                     LIMIT 1`,
                    [vehicle_id]
                );

                if (activeInUseRecord.rows.length === 0) {
                    await client.query(
                        'UPDATE vehicles SET status = $1 WHERE id = $2',
                        ['available', vehicle_id]
                    );
                    vehicleStatus = 'available';
                }
            }

            if (vehicleStatus !== 'available') {
                await client.query('ROLLBACK');
                res.status(400).json({
                    success: false,
                    message: 'Araç kullanımda, müsait değil'
                });
                return;
            }

            // Check if manager exists (if manager_id is provided)
            if (manager_id) {
                const managerCheck = await client.query(
                    'SELECT id, first_name, last_name FROM managers WHERE id = $1 AND deleted_at IS NULL AND is_active = true',
                    [manager_id]
                );

                if (managerCheck.rows.length === 0) {
                    await client.query('ROLLBACK');
                    res.status(404).json({
                        success: false,
                        message: 'Müdür bulunamadı'
                    });
                    return;
                }

                const manager = managerCheck.rows[0];
                resolvedManagerName = `${manager.first_name} ${manager.last_name}`;
            }

            // Create record with custom time if provided, returning actual database values
            let insertQuery: string;
            let queryParams: any[];

            if (given_time && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(given_time)) {
                insertQuery = `INSERT INTO vehicle_records (
                    id, vehicle_id, manager_id, manager_name, given_by,
                    given_date, given_time, destination, notes, gate, status
                ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6::TIME, $7, $8, $9, 'in_use')
                RETURNING given_date, given_time`;
                queryParams = [id, vehicle_id, manager_id || null, resolvedManagerName, personnel_id, given_time, destination, notes || null, gate];
            } else {
                insertQuery = `INSERT INTO vehicle_records (
                    id, vehicle_id, manager_id, manager_name, given_by,
                    given_date, given_time, destination, notes, gate, status
                ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, CURRENT_TIME, $6, $7, $8, 'in_use')
                RETURNING given_date, given_time`;
                queryParams = [id, vehicle_id, manager_id || null, resolvedManagerName, personnel_id, destination, notes || null, gate];
            }

            const insertResult = await client.query(insertQuery, queryParams);
            const dbGivenDate = insertResult.rows[0]?.given_date;
            const dbGivenTime = insertResult.rows[0]?.given_time;

            givenDate = dbGivenDate ? (typeof dbGivenDate === 'string' ? dbGivenDate : new Date(dbGivenDate).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0];
            givenTimeFormatted = dbGivenTime ? String(dbGivenTime).substring(0, 5) : new Date().toLocaleTimeString('tr-TR').substring(0, 5);

            // Update vehicle status
            await client.query(
                'UPDATE vehicles SET status = $1 WHERE id = $2',
                ['in_use', vehicle_id]
            );

            await client.query('COMMIT');
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

        // GÜVENLİK: Audit log kaydı
        await logDataChange(
            'vehicle_records',
            id,
            'INSERT',
            null,
            { vehicle_id, manager_id, destination, personnel_id },
            personnel_id || null,
            clientIp
        );

        // WhatsApp mesajı oluştur
        let whatsappMessage = '';
        try {
            whatsappMessage = createVehicleRecordMessage({
                vehiclePlate,
                managerName: resolvedManagerName,
                givenDate,
                givenTime: givenTimeFormatted,
                destination,
                notes: notes || undefined
            });
        } catch (error) {
            console.error('WhatsApp mesaj oluşturma hatası:', error);
        }

        res.status(201).json({
            success: true,
            message: 'Araç kaydı oluşturuldu',
            whatsappMessage
        });

        emitApiMutation({
            method: 'POST',
            path: '/api/vehicles/records',
            statusCode: 201,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics('/api/vehicles/records'),
        });
    } catch (error) {
        console.error('Create vehicle record error:', error);
        res.status(500).json({
            success: false,
            message: 'Araç kaydı oluşturulurken hata oluştu'
        });
    }
};

/**
 * Update vehicle record
 * PUT /api/vehicles/records/:id
 */
export const updateVehicleRecord = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { vehicle_id, manager_id, manager_name, destination, notes, given_time, return_time } = req.body;
        const personnel_id = req.user?.userId;

        // GÜVENLİK: UUID validasyonu
        if (!isValidUUID(id)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz kayıt ID formatı'
            });
            return;
        }

        // Check if record exists
        const recordCheck = await pool.query(
            'SELECT id, status, vehicle_id FROM vehicle_records WHERE id = $1 AND deleted_at IS NULL',
            [id]
        );

        if (recordCheck.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Kayıt bulunamadı'
            });
            return;
        }

        const recordStatus = recordCheck.rows[0].status;
        const oldVehicleId = recordCheck.rows[0].vehicle_id;

        // Validate at least one field is provided
        if (!vehicle_id && !manager_id && !manager_name && !destination && notes === undefined && !given_time && !return_time) {
            res.status(400).json({
                success: false,
                message: 'En az bir alan güncellenmelidir'
            });
            return;
        }

        // GÜVENLİK: If vehicle_id is provided, validate UUID format
        if (vehicle_id && !isValidUUID(vehicle_id)) {
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

        // Validate manager_name (only if provided and not empty)
        if (manager_name && typeof manager_name === 'string' && manager_name.trim().length === 0) {
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
        if (destination !== undefined && (typeof destination !== 'string' || destination.trim().length === 0)) {
            res.status(400).json({
                success: false,
                message: 'Geçerli bir gidilen yer giriniz'
            });
            return;
        }

        if (destination && destination.length > 255) {
            res.status(400).json({
                success: false,
                message: 'Gidilen yer çok uzun (maksimum 255 karakter)'
            });
            return;
        }

        // Validate notes length
        if (notes !== undefined && typeof notes === 'string' && notes.length > 1000) {
            res.status(400).json({
                success: false,
                message: 'Açıklama çok uzun (maksimum 1000 karakter)'
            });
            return;
        }

        // Validate given_time format
        if (given_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(given_time)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz saat formatı (HH:MM olmalıdır)'
            });
            return;
        }

        // Validate return_time format
        if (return_time && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(return_time)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz teslim alınma saati formatı (HH:MM olmalıdır)'
            });
            return;
        }

        // DATA INTEGRITY: If return_date exists in database, return_time is required
        if (!return_time) {
            // Check if record already has return_date set
            const existingRecord = await pool.query(
                'SELECT return_date FROM vehicle_records WHERE id = $1',
                [id]
            );
            if (existingRecord.rows[0]?.return_date && recordStatus !== 'returned') {
                res.status(400).json({
                    success: false,
                    message: 'Teslim alınma saati zorunludur (araç iade tarihi belirtilmiş)'
                });
                return;
            }
        }

        // If vehicle_id is provided, check if new vehicle exists and is available (only if record is still in_use)
        if (vehicle_id && vehicle_id !== oldVehicleId) {
            // Don't allow vehicle change for returned records
            if (recordStatus === 'returned') {
                res.status(400).json({
                    success: false,
                    message: 'Teslim alınmış araç kayıtlarında araç değiştirilemez'
                });
                return;
            }

            const newVehicleCheck = await pool.query(
                'SELECT status FROM vehicles WHERE id = $1 AND deleted_at IS NULL',
                [vehicle_id]
            );

            if (newVehicleCheck.rows.length === 0) {
                res.status(404).json({
                    success: false,
                    message: 'Yeni araç bulunamadı'
                });
                return;
            }

            if (newVehicleCheck.rows[0].status !== 'available') {
                res.status(400).json({
                    success: false,
                    message: 'Seçilen araç kullanımda, müsait değil'
                });
                return;
            }
        }

        // If manager_id is provided, check if it exists and get name
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

            const manager = managerCheck.rows[0];
            resolvedManagerName = `${manager.first_name} ${manager.last_name}`;
        }

        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (vehicle_id !== undefined && vehicle_id !== oldVehicleId) {
            updates.push(`vehicle_id = $${paramIndex++}`);
            values.push(vehicle_id);
        }

        if (manager_id !== undefined) {
            updates.push(`manager_id = $${paramIndex++}`);
            values.push(manager_id || null);
        }

        if (resolvedManagerName !== undefined) {
            updates.push(`manager_name = $${paramIndex++}`);
            values.push(resolvedManagerName);
        }

        if (destination !== undefined) {
            updates.push(`destination = $${paramIndex++}`);
            values.push(destination);
        }

        if (notes !== undefined) {
            updates.push(`notes = $${paramIndex++}`);
            values.push(notes || null);
        }

        if (given_time !== undefined) {
            updates.push(`given_time = $${paramIndex++}::TIME`);
            values.push(given_time);
        }

        if (return_time !== undefined) {
            updates.push(`return_time = $${paramIndex++}::TIME`);
            values.push(return_time);
        }

        // Add record ID as last parameter
        values.push(id);

        // Start transaction for vehicle status updates
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Execute update
            await client.query(
                `UPDATE vehicle_records SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
                values
            );

            // If vehicle changed and record is still in_use, update both old and new vehicle statuses
            if (vehicle_id && vehicle_id !== oldVehicleId && recordStatus === 'in_use') {
                // Set old vehicle to available
                await client.query(
                    'UPDATE vehicles SET status = $1 WHERE id = $2',
                    ['available', oldVehicleId]
                );

                // Set new vehicle to in_use
                await client.query(
                    'UPDATE vehicles SET status = $1 WHERE id = $2',
                    ['in_use', vehicle_id]
                );
            }

            await client.query('COMMIT');
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

        // GÜVENLİK: Audit log kaydı
        const clientIp = getClientIp(req);
        await logDataChange(
            'vehicle_records',
            id,
            'UPDATE',
            null,
            { vehicle_id, manager_id, manager_name: resolvedManagerName, destination, notes, given_time, return_time },
            personnel_id || null,
            clientIp
        );

        res.status(200).json({
            success: true,
            message: 'Araç kaydı güncellendi'
        });

        emitApiMutation({
            method: 'PUT',
            path: `/api/vehicles/records/${id}`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/vehicles/records/${id}`),
        });
    } catch (error) {
        console.error('Update vehicle record error:', error);
        res.status(500).json({
            success: false,
            message: 'Araç kaydı güncellenirken hata oluştu'
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
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update record - aracı iade eden kişiyi kaydet
            await client.query(
                `UPDATE vehicle_records 
                 SET return_date = CURRENT_DATE, 
                     return_time = CURRENT_TIME, 
                     returned_by = $2,
                     status = 'returned'
                 WHERE id = $1`,
                [id, personnel_id]
            );

            // Update vehicle status
            await client.query(
                'UPDATE vehicles SET status = $1 WHERE id = $2',
                ['available', vehicle_id]
            );

            await client.query('COMMIT');
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

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
                `SELECT
                    vr.manager_name,
                    vr.destination,
                    vr.return_time,
                    v.plate,
                    GREATEST(
                        FLOOR(
                            EXTRACT(EPOCH FROM ((vr.return_date + vr.return_time) - (vr.given_date + vr.given_time))) / 60
                        )::int,
                        0
                    ) AS drive_minutes
                 FROM vehicle_records vr
                 INNER JOIN vehicles v ON vr.vehicle_id = v.id
                 WHERE vr.id = $1`,
                [id]
            );

            if (recordInfo.rows.length > 0) {
                const vehiclePlate = recordInfo.rows[0].plate || 'Bilinmeyen';
                const managerName = recordInfo.rows[0].manager_name || 'Bilinmeyen';
                const destination = recordInfo.rows[0].destination || undefined;
                const timeString = recordInfo.rows[0].return_time || new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' });
                const returnTime = timeString.substring(0, 5);
                const driveDuration = formatDriveDuration(Number(recordInfo.rows[0].drive_minutes || 0));

                whatsappMessage = createVehicleReturnMessage({
                    vehiclePlate,
                    managerName,
                    returnTime,
                    destination,
                    driveDuration
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

        emitApiMutation({
            method: 'POST',
            path: `/api/vehicles/records/${id}/return`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/vehicles/records/${id}/return`),
        });
    } catch (error) {
        console.error('Return vehicle error:', error);
        res.status(500).json({
            success: false,
            message: 'Araç iadesi kaydedilirken hata oluştu'
        });
    }
};

/**
 * Undo vehicle return
 * POST /api/vehicles/records/:id/undo-return
 */
export const undoVehicleReturn = async (req: Request, res: Response): Promise<void> => {
    let transactionStarted = false;

    try {
        const { id } = req.params;

        if (!isValidUUID(id)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz kayıt ID formatı'
            });
            return;
        }

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

        if (recordCheck.rows[0].status !== 'returned') {
            res.status(400).json({
                success: false,
                message: 'Sadece teslim alınmış kayıtlar geri alınabilir'
            });
            return;
        }

        const vehicleId = recordCheck.rows[0].vehicle_id;

        const activeInUseRecord = await pool.query(
            `SELECT id
             FROM vehicle_records
             WHERE vehicle_id = $1
               AND id <> $2
               AND deleted_at IS NULL
               AND status = 'in_use'
             LIMIT 1`,
            [vehicleId, id]
        );

        if (activeInUseRecord.rows.length > 0) {
            res.status(400).json({
                success: false,
                message: 'Bu araç için aktif kullanım kaydı bulunduğu için teslim alma geri alınamaz'
            });
            return;
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `UPDATE vehicle_records
                 SET return_date = NULL,
                     return_time = NULL,
                     returned_by = NULL,
                     returned_by_name = NULL,
                     status = 'in_use',
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [id]
            );

            await client.query(
                'UPDATE vehicles SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                ['in_use', vehicleId]
            );

            await client.query('COMMIT');
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

        const clientIp = getClientIp(req);
        await logDataChange(
            'vehicle_records',
            id,
            'UPDATE',
            { status: 'returned' },
            { status: 'in_use', return_date: null },
            req.user?.userId || null,
            clientIp
        );

        res.status(200).json({
            success: true,
            message: 'Teslim alma işlemi geri alındı'
        });

        emitApiMutation({
            method: 'POST',
            path: `/api/vehicles/records/${id}/undo-return`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/vehicles/records/${id}/undo-return`),
        });
    } catch (error) {
        console.error('Undo vehicle return error:', error);
        res.status(500).json({
            success: false,
            message: 'Teslim alma işlemi geri alınırken hata oluştu'
        });
    }
};

/**
 * Soft delete vehicle record
 * DELETE /api/vehicles/records/:id
 */
export const deleteVehicleRecord = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.userId || null;
    const clientIp = getClientIp(req);

    try {
        if (!isValidUUID(id)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz kayıt ID formatı'
            });
            return;
        }

        const existing = await pool.query(
            'SELECT id, deleted_at, vehicle_id FROM vehicle_records WHERE id = $1',
            [id]
        );

        if (existing.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Kayıt bulunamadı'
            });
            return;
        }

        if (existing.rows[0].deleted_at) {
            res.status(400).json({
                success: false,
                message: 'Kayıt zaten silinmiş'
            });
            return;
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `UPDATE vehicle_records
                 SET deleted_at = CURRENT_TIMESTAMP,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [id]
            );

            const vehicleId = existing.rows[0].vehicle_id;
            if (vehicleId) {
                const activeInUseRecord = await client.query(
                    `SELECT 1
                     FROM vehicle_records
                     WHERE vehicle_id = $1
                       AND deleted_at IS NULL
                       AND status = 'in_use'
                     LIMIT 1`,
                    [vehicleId]
                );

                const nextVehicleStatus = activeInUseRecord.rows.length > 0 ? 'in_use' : 'available';
                await client.query(
                    'UPDATE vehicles SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    [nextVehicleStatus, vehicleId]
                );
            }

            await client.query('COMMIT');
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

        await logDataChange(
            'vehicle_records',
            id,
            'SOFT_DELETE',
            { deleted_at: null },
            { deleted_at: 'CURRENT_TIMESTAMP' },
            userId,
            clientIp
        );

        res.status(200).json({
            success: true,
            message: 'Kayıt silindi'
        });

        emitApiMutation({
            method: 'DELETE',
            path: `/api/vehicles/records/${id}`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/vehicles/records/${id}`),
        });
    } catch (error) {
        console.error('Delete vehicle record error:', error);
        res.status(500).json({
            success: false,
            message: 'Kayıt silinirken hata oluştu'
        });
    }
};

/**
 * Restore soft deleted vehicle record
 * POST /api/vehicles/records/:id/restore
 */
export const restoreVehicleRecord = async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const userId = req.user?.userId || null;
    const clientIp = getClientIp(req);

    try {
        if (!isValidUUID(id)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz kayıt ID formatı'
            });
            return;
        }

        const existing = await pool.query(
            'SELECT id, deleted_at, vehicle_id, status FROM vehicle_records WHERE id = $1',
            [id]
        );

        if (existing.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Kayıt bulunamadı'
            });
            return;
        }

        if (!existing.rows[0].deleted_at) {
            res.status(400).json({
                success: false,
                message: 'Kayıt zaten aktif'
            });
            return;
        }

        const vehicleId = existing.rows[0].vehicle_id;
        const recordStatus = existing.rows[0].status;

        if (vehicleId && recordStatus === 'in_use') {
            const conflictingInUseRecord = await pool.query(
                `SELECT id
                 FROM vehicle_records
                 WHERE vehicle_id = $1
                   AND id <> $2
                   AND deleted_at IS NULL
                   AND status = 'in_use'
                 LIMIT 1`,
                [vehicleId, id]
            );

            if (conflictingInUseRecord.rows.length > 0) {
                res.status(400).json({
                    success: false,
                    message: 'Bu araç için aktif bir kullanım kaydı bulunduğu için kayıt geri alınamaz'
                });
                return;
            }
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `UPDATE vehicle_records
                 SET deleted_at = NULL,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1`,
                [id]
            );

            if (vehicleId) {
                const activeInUseRecord = await client.query(
                    `SELECT 1
                     FROM vehicle_records
                     WHERE vehicle_id = $1
                       AND deleted_at IS NULL
                       AND status = 'in_use'
                     LIMIT 1`,
                    [vehicleId]
                );

                const nextVehicleStatus = activeInUseRecord.rows.length > 0 ? 'in_use' : 'available';
                await client.query(
                    'UPDATE vehicles SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                    [nextVehicleStatus, vehicleId]
                );
            }

            await client.query('COMMIT');
        } catch (txError) {
            await client.query('ROLLBACK');
            throw txError;
        } finally {
            client.release();
        }

        await logDataChange(
            'vehicle_records',
            id,
            'UPDATE',
            { deleted_at: 'TIMESTAMP' },
            { deleted_at: null },
            userId,
            clientIp
        );

        res.status(200).json({
            success: true,
            message: 'Kayıt geri alındı'
        });

        emitApiMutation({
            method: 'POST',
            path: `/api/vehicles/records/${id}/restore`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/vehicles/records/${id}/restore`),
        });
    } catch (error) {
        console.error('Restore vehicle record error:', error);
        res.status(500).json({
            success: false,
            message: 'Kayıt geri alınırken hata oluştu'
        });
    }
};

/**
 * POST /api/vehicles/send-whatsapp-message
 */
export const sendVehicleWhatsAppMessage = async (req: Request, res: Response): Promise<void> => {
    try {
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
        console.error('Send vehicle WhatsApp message error:', error);
        res.status(500).json({
            success: false,
            message: 'WhatsApp mesajı gönderilirken hata oluştu.',
        });
    }
};

/**
 * Create new vehicle
 * POST /api/vehicles
 */
export const createVehicle = async (req: Request, res: Response): Promise<void> => {
    const clientIp = getClientIp(req);
    const userId = req.user?.userId;

    try {
        const { plate, brand } = req.body;

        // Validation
        if (!plate || !brand) {
            res.status(400).json({
                success: false,
                message: 'Plaka ve marka zorunludur'
            });
            return;
        }

        const normalizedPlate = normalizePlate(plate);
        if (!normalizedPlate) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz plaka formatı'
            });
            return;
        }

        // Check if plate already exists
        const checkQuery = 'SELECT id FROM vehicles WHERE plate = $1 AND deleted_at IS NULL';
        const checkResult = await pool.query(checkQuery, [normalizedPlate]);

        if (checkResult.rows.length > 0) {
            res.status(400).json({
                success: false,
                message: 'Bu plaka zaten kayıtlı'
            });
            return;
        }

        const id = uuidv4();
        const query = `
            INSERT INTO vehicles (id, plate, brand, is_active, status)
            VALUES ($1, $2, $3, true, 'available')
            RETURNING *
        `;

        const result = await pool.query(query, [
            id,
            normalizedPlate,
            sanitizeInput(brand, 100)
        ]);

        // Audit log
        await logDataChange(
            'vehicles',
            id,
            'INSERT',
            null,
            result.rows[0],
            userId || 'unknown',
            clientIp
        );

        res.status(201).json({
            success: true,
            message: 'Araç başarıyla eklendi',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Create vehicle error:', error);
        res.status(500).json({
            success: false,
            message: 'Araç eklenirken hata oluştu'
        });
    }
};

/**
 * Update vehicle
 * PUT /api/vehicles/:id
 */
export const updateVehicle = async (req: Request, res: Response): Promise<void> => {
    const clientIp = getClientIp(req);
    const userId = req.user?.userId;
    const { id } = req.params;

    try {
        if (!isValidUUID(id)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz araç ID'
            });
            return;
        }

        const { plate, brand } = req.body;

        // Get old data for audit log
        const oldDataQuery = 'SELECT * FROM vehicles WHERE id = $1 AND deleted_at IS NULL';
        const oldDataResult = await pool.query(oldDataQuery, [id]);

        if (oldDataResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Araç bulunamadı'
            });
            return;
        }

        const normalizedPlate = normalizePlate(plate);
        if (!normalizedPlate) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz plaka formatı'
            });
            return;
        }

        // Check if plate is taken by another vehicle
        const checkQuery = 'SELECT id FROM vehicles WHERE plate = $1 AND id != $2 AND deleted_at IS NULL';
        const checkResult = await pool.query(checkQuery, [normalizedPlate, id]);

        if (checkResult.rows.length > 0) {
            res.status(400).json({
                success: false,
                message: 'Bu plaka başka bir araçta kayıtlı'
            });
            return;
        }

        const query = `
            UPDATE vehicles
            SET plate = $1,
                brand = $2,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $3 AND deleted_at IS NULL
            RETURNING *
        `;

        const result = await pool.query(query, [
            normalizedPlate,
            sanitizeInput(brand, 100),
            id
        ]);

        // Audit log
        await logDataChange(
            'vehicles',
            id,
            'UPDATE',
            oldDataResult.rows[0],
            result.rows[0],
            userId || 'unknown',
            clientIp
        );

        res.status(200).json({
            success: true,
            message: 'Araç başarıyla güncellendi',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Update vehicle error:', error);
        res.status(500).json({
            success: false,
            message: 'Araç güncellenirken hata oluştu'
        });
    }
};

/**
 * Delete vehicle (soft delete)
 * DELETE /api/vehicles/:id
 */
export const deleteVehicle = async (req: Request, res: Response): Promise<void> => {
    const clientIp = getClientIp(req);
    const userId = req.user?.userId;
    const { id } = req.params;

    try {
        if (!isValidUUID(id)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz araç ID'
            });
            return;
        }

        // Get old data for audit log
        const oldDataQuery = 'SELECT * FROM vehicles WHERE id = $1 AND deleted_at IS NULL';
        const oldDataResult = await pool.query(oldDataQuery, [id]);

        if (oldDataResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Araç bulunamadı'
            });
            return;
        }

        // Check if vehicle has active records
        const activeRecordsQuery = `
            SELECT COUNT(*) as count
            FROM vehicle_records
            WHERE vehicle_id = $1 AND return_time IS NULL AND deleted_at IS NULL
        `;
        const activeRecordsResult = await pool.query(activeRecordsQuery, [id]);

        if (parseInt(activeRecordsResult.rows[0].count) > 0) {
            res.status(400).json({
                success: false,
                message: 'Bu araç şu anda kullanımda, silinemez'
            });
            return;
        }

        const query = `
            UPDATE vehicles
            SET deleted_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;

        const result = await pool.query(query, [id]);

        // Audit log
        await logDataChange(
            'vehicles',
            id,
            'SOFT_DELETE',
            oldDataResult.rows[0],
            result.rows[0],
            userId || 'unknown',
            clientIp
        );

        res.status(200).json({
            success: true,
            message: 'Araç başarıyla silindi'
        });
    } catch (error) {
        console.error('Delete vehicle error:', error);
        res.status(500).json({
            success: false,
            message: 'Araç silinirken hata oluştu'
        });
    }
};
