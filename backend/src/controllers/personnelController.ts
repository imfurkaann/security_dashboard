import { Request, Response } from 'express';
import pool from '../config/database';
import { isValidUUID, sanitizeInput } from '../utils/validation';
import { logDataChange } from '../utils/auditLog';
import { hashPassword, validateNewPassword } from '../utils/password';

const PERSONNEL_ADMIN_LOCK_ID = 8172027;

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

        // Validate required fields and primitive types before sanitization.
        if ([firstName, lastName, username, password, role].some((value) => typeof value !== 'string' || !value.trim())) {
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

        const passwordValidation = validateNewPassword(password, sanitizedUsername);
        if (!passwordValidation.valid) {
            res.status(400).json({ success: false, message: passwordValidation.message });
            return;
        }

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
        const hashedPassword = await hashPassword(password);

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

        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz personel kimliği' });
            return;
        }

        // Validate required fields
        if ([firstName, lastName, username, role].some((value) => typeof value !== 'string' || !value.trim())
            || (password !== undefined && password !== null && typeof password !== 'string')
            || (isActive !== undefined && typeof isActive !== 'boolean')) {
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

        if (password) {
            const passwordValidation = validateNewPassword(password, sanitizedUsername);
            if (!passwordValidation.valid) {
                res.status(400).json({ success: false, message: passwordValidation.message });
                return;
            }
        }

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

        // Yönetici rol değişikliklerini sıralayarak iki eşzamanlı isteğin son
        // aktif yöneticiyi birlikte devre dışı bırakmasını engelle.
        await client.query('SELECT pg_advisory_xact_lock($1)', [PERSONNEL_ADMIN_LOCK_ID]);

        // Get old values
        const oldDataQuery = 'SELECT first_name, last_name, username, role, is_active FROM personnel WHERE id = $1 FOR UPDATE';
        const oldData = await client.query(oldDataQuery, [id]);

        if (oldData.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({
                success: false,
                message: 'Personel bulunamadı'
            });
            return;
        }

        if (id === userId && (sanitizedRole !== 'admin' || isActive === false)) {
            await client.query('ROLLBACK');
            res.status(409).json({ success: false, message: 'Kendi aktif yönetici hesabınızı devre dışı bırakamaz veya rolünü düşüremezsiniz' });
            return;
        }

        const removesActiveAdmin = oldData.rows[0].role === 'admin'
            && oldData.rows[0].is_active === true
            && (sanitizedRole !== 'admin' || isActive === false);
        if (removesActiveAdmin) {
            const otherAdmins = await client.query(
                `SELECT 1 FROM personnel
                 WHERE id <> $1 AND role = 'admin' AND is_active = TRUE AND deleted_at IS NULL
                 LIMIT 1`,
                [id]
            );
            if (otherAdmins.rows.length === 0) {
                await client.query('ROLLBACK');
                res.status(409).json({ success: false, message: 'Sistemde en az bir aktif yönetici kalmalıdır' });
                return;
            }
        }

        // Update query
        let updateQuery: string;
        let queryParams: any[];

        if (password) {
            // If password is provided, hash and update it
            const hashedPassword = await hashPassword(password);
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

        if (!isValidUUID(id)) {
            res.status(400).json({ success: false, message: 'Geçersiz personel kimliği' });
            return;
        }

        if (id === userId) {
            res.status(409).json({ success: false, message: 'Kendi oturum açtığınız yönetici hesabını silemezsiniz' });
            return;
        }

        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock($1)', [PERSONNEL_ADMIN_LOCK_ID]);

        // Get old values
        const oldDataQuery = 'SELECT first_name, last_name, username, role, is_active FROM personnel WHERE id = $1 AND deleted_at IS NULL FOR UPDATE';
        const oldData = await client.query(oldDataQuery, [id]);

        if (oldData.rows.length === 0) {
            await client.query('ROLLBACK');
            res.status(404).json({
                success: false,
                message: 'Personel bulunamadı'
            });
            return;
        }

        if (oldData.rows[0].role === 'admin' && oldData.rows[0].is_active === true) {
            const otherAdmins = await client.query(
                `SELECT 1 FROM personnel
                 WHERE id <> $1 AND role = 'admin' AND is_active = TRUE AND deleted_at IS NULL
                 LIMIT 1`,
                [id]
            );
            if (otherAdmins.rows.length === 0) {
                await client.query('ROLLBACK');
                res.status(409).json({ success: false, message: 'Son aktif yönetici hesabı silinemez' });
                return;
            }
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
