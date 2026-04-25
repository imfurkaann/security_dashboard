import { Request, Response } from 'express';
import pool from '../config/database';
import bcrypt from 'bcryptjs';
import { sanitizeInput } from '../utils/validation';
import { logDataChange } from '../utils/auditLog';
import { emitApiMutation, resolveMutationTopics } from '../realtime/socket';

// Get all personnel
export const getAllPersonnel = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = `
            SELECT id, first_name, last_name, username, role, is_active, created_at, updated_at
            FROM personnel
            WHERE deleted_at IS NULL
            ORDER BY first_name, last_name
        `;
        const result = await pool.query(query);

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching personnel:', error);
        res.status(500).json({
            success: false,
            message: 'Personel verileri alınırken bir hata oluştu'
        });
    }
};

// Create new personnel
export const createPersonnel = async (req: Request, res: Response): Promise<void> => {
    const client = await pool.connect();

    try {
        const { firstName, lastName, username, password, role } = req.body;
        const userId = (req as any).user?.userId;
        const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

        // Validate required fields
        if (!firstName || !lastName || !username || !password || !role) {
            res.status(400).json({
                success: false,
                message: 'Tüm alanları doldurunuz'
            });
            return;
        }

        // Sanitize inputs
        const sanitizedFirstName = sanitizeInput(firstName);
        const sanitizedLastName = sanitizeInput(lastName);
        const sanitizedUsername = sanitizeInput(username);
        const sanitizedRole = sanitizeInput(role);

        // Validate role
        if (!sanitizedRole || !['admin', 'personnel'].includes(sanitizedRole)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz rol tipi'
            });
            return;
        }

        // Check if username already exists among active records
        const checkQuery = 'SELECT id FROM personnel WHERE username = $1 AND deleted_at IS NULL';
        const checkResult = await client.query(checkQuery, [sanitizedUsername]);

        if (checkResult.rows.length > 0) {
            res.status(400).json({
                success: false,
                message: 'Bu kullanıcı adı zaten kullanılıyor'
            });
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        await client.query('BEGIN');

        // Insert personnel
        const insertQuery = `
            INSERT INTO personnel (first_name, last_name, username, password, role, is_active)
            VALUES ($1, $2, $3, $4, $5, true)
            RETURNING id, first_name, last_name, username, role, is_active, created_at
        `;
        const result = await client.query(insertQuery, [
            sanitizedFirstName,
            sanitizedLastName,
            sanitizedUsername,
            hashedPassword,
            sanitizedRole
        ]);

        const newPersonnel = result.rows[0];

        // Log the creation
        await logDataChange(
            'personnel',
            newPersonnel.id,
            'INSERT',
            null,
            {
                first_name: sanitizedFirstName,
                last_name: sanitizedLastName,
                username: sanitizedUsername,
                role: sanitizedRole
            },
            userId,
            clientIp
        );

        await client.query('COMMIT');

        emitApiMutation({
            method: 'POST',
            path: '/api/personnel',
            statusCode: 201,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics('/api/personnel'),
        });

        res.status(201).json({
            success: true,
            message: 'Personel başarıyla eklendi',
            data: newPersonnel
        });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Error creating personnel:', error);

        if (
            error?.code === '23505' &&
            (error?.constraint === 'personnel_username_key' || error?.constraint === 'idx_personnel_username_active_unique')
        ) {
            res.status(409).json({
                success: false,
                message: 'Bu kullanıcı adı zaten kullanımda. Lütfen farklı bir kullanıcı adı girin.'
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: 'Personel eklenirken bir hata oluştu'
        });
    } finally {
        client.release();
    }
};

// Update personnel
export const updatePersonnel = async (req: Request, res: Response): Promise<void> => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const { firstName, lastName, username, password, role, isActive } = req.body;
        const userId = (req as any).user?.userId;
        const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

        // Validate required fields
        if (!firstName || !lastName || !username || !role) {
            res.status(400).json({
                success: false,
                message: 'Tüm alanları doldurunuz'
            });
            return;
        }

        // Sanitize inputs
        const sanitizedFirstName = sanitizeInput(firstName);
        const sanitizedLastName = sanitizeInput(lastName);
        const sanitizedUsername = sanitizeInput(username);
        const sanitizedRole = sanitizeInput(role);

        // Validate role
        if (!sanitizedRole || !['admin', 'personnel'].includes(sanitizedRole)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz rol tipi'
            });
            return;
        }

        // Check if username is taken by another active user
        const checkQuery = 'SELECT id FROM personnel WHERE username = $1 AND id != $2 AND deleted_at IS NULL';
        const checkResult = await client.query(checkQuery, [sanitizedUsername, id]);

        if (checkResult.rows.length > 0) {
            res.status(400).json({
                success: false,
                message: 'Bu kullanıcı adı başka bir kullanıcı tarafından kullanılıyor'
            });
            return;
        }

        await client.query('BEGIN');

        // Get old values
        const oldDataQuery = 'SELECT first_name, last_name, username, role, is_active FROM personnel WHERE id = $1';
        const oldData = await client.query(oldDataQuery, [id]);

        if (oldData.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({
                success: false,
                message: 'Personel bulunamadı'
            });
            return;
        }

        // Update query
        let updateQuery: string;
        let queryParams: any[];

        if (password) {
            // If password is provided, hash and update it
            const hashedPassword = await bcrypt.hash(password, 10);
            updateQuery = `
                UPDATE personnel
                SET first_name = $1, last_name = $2, username = $3, password = $4, 
                    role = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
                WHERE id = $7
                RETURNING id, first_name, last_name, username, role, is_active, updated_at
            `;
            queryParams = [
                sanitizedFirstName,
                sanitizedLastName,
                sanitizedUsername,
                hashedPassword,
                sanitizedRole,
                isActive !== undefined ? isActive : true,
                id
            ];
        } else {
            // If no password, don't update it
            updateQuery = `
                UPDATE personnel
                SET first_name = $1, last_name = $2, username = $3, 
                    role = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
                WHERE id = $6
                RETURNING id, first_name, last_name, username, role, is_active, updated_at
            `;
            queryParams = [
                sanitizedFirstName,
                sanitizedLastName,
                sanitizedUsername,
                sanitizedRole,
                isActive !== undefined ? isActive : true,
                id
            ];
        }

        const result = await client.query(updateQuery, queryParams);
        const updatedPersonnel = result.rows[0];

        // Log the update
        const newValues: any = {
            first_name: sanitizedFirstName,
            last_name: sanitizedLastName,
            username: sanitizedUsername,
            role: sanitizedRole,
            is_active: isActive !== undefined ? isActive : true
        };

        if (password) {
            newValues.password = '[UPDATED]';
        }

        await logDataChange(
            'personnel',
            id,
            'UPDATE',
            oldData.rows[0],
            newValues,
            userId,
            clientIp
        );

        await client.query('COMMIT');

        emitApiMutation({
            method: 'PUT',
            path: `/api/personnel/${id}`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/personnel/${id}`),
        });

        res.json({
            success: true,
            message: 'Personel başarıyla güncellendi',
            data: updatedPersonnel
        });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Error updating personnel:', error);

        if (
            error?.code === '23505' &&
            (error?.constraint === 'personnel_username_key' || error?.constraint === 'idx_personnel_username_active_unique')
        ) {
            res.status(409).json({
                success: false,
                message: 'Bu kullanıcı adı başka bir kullanıcı tarafından kullanılıyor.'
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: 'Personel güncellenirken bir hata oluştu'
        });
    } finally {
        client.release();
    }
};

// Delete personnel (soft delete)
export const deletePersonnel = async (req: Request, res: Response): Promise<void> => {
    const client = await pool.connect();

    try {
        const { id } = req.params;
        const userId = (req as any).user?.userId;
        const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

        await client.query('BEGIN');

        // Get old values
        const oldDataQuery = 'SELECT first_name, last_name, username, role FROM personnel WHERE id = $1 AND deleted_at IS NULL';
        const oldData = await client.query(oldDataQuery, [id]);

        if (oldData.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({
                success: false,
                message: 'Personel bulunamadı'
            });
            return;
        }

        // Soft delete
        const deleteQuery = `
            UPDATE personnel
            SET deleted_at = CURRENT_TIMESTAMP,
                is_active = false,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `;
        await client.query(deleteQuery, [id]);

        // Log the deletion
        await logDataChange(
            'personnel',
            id,
            'DELETE',
            oldData.rows[0],
            null,
            userId,
            clientIp
        );

        await client.query('COMMIT');

        emitApiMutation({
            method: 'DELETE',
            path: `/api/personnel/${id}`,
            statusCode: 200,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics(`/api/personnel/${id}`),
        });

        res.json({
            success: true,
            message: 'Personel başarıyla silindi'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error deleting personnel:', error);
        res.status(500).json({
            success: false,
            message: 'Personel silinirken bir hata oluştu'
        });
    } finally {
        client.release();
    }
};
