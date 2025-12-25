import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { recordFailedAttempt, clearAttempts } from '../middleware/auth';
import { sanitizeInput, isValidLength } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';

/**
 * Admin login validation rules
 */
export const adminLoginValidation = [
    body('username')
        .trim()
        .notEmpty()
        .withMessage('Kullanıcı adı gereklidir')
        .isLength({ min: 3 })
        .withMessage('Kullanıcı adı en az 3 karakter olmalıdır'),
    body('password')
        .trim()
        .notEmpty()
        .withMessage('Şifre gereklidir')
        .isLength({ min: 6 })
        .withMessage('Şifre en az 6 karakter olmalıdır'),
];

/**
 * Admin login controller
 * POST /api/admin/login
 */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;

    try {
        console.log(`Admin login attempt from IP: ${clientIp}`);

        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            recordFailedAttempt(clientIp);
            res.status(400).json({
                success: false,
                message: 'Geçersiz giriş bilgileri',
                errors: errors.array(),
            });
            return;
        }

        const { username, password } = req.body;

        // Input sanitization
        const sanitizedUsername = sanitizeInput(username, 100);

        if (!sanitizedUsername || !password) {
            recordFailedAttempt(clientIp);
            res.status(400).json({
                success: false,
                message: 'Kullanıcı adı ve şifre gereklidir',
            });
            return;
        }

        // Username length validation
        if (!isValidLength(sanitizedUsername, 3, 100)) {
            recordFailedAttempt(clientIp);
            res.status(400).json({
                success: false,
                message: 'Geçersiz kullanıcı adı formatı',
            });
            return;
        }

        // Find user by username from personnel table - parameterized query
        const userQuery = `
            SELECT id, username, password, first_name, last_name, role, is_active
            FROM personnel
            WHERE username = $1 AND deleted_at IS NULL AND is_active = TRUE
        `;
        const userResult = await pool.query(userQuery, [sanitizedUsername]);

        if (userResult.rows.length === 0) {
            recordFailedAttempt(clientIp);
            res.status(401).json({
                success: false,
                message: 'Kullanıcı adı veya şifre hatalı',
            });
            return;
        }

        const user = userResult.rows[0];

        // Check if user has admin role
        if (user.role !== 'admin') {
            recordFailedAttempt(clientIp);
            res.status(403).json({
                success: false,
                message: 'Yetkisiz erişim - Admin yetkisi gerekli',
            });
            return;
        }

        // Compare password
        const isPasswordValid = await comparePassword(password, user.password);

        if (!isPasswordValid) {
            recordFailedAttempt(clientIp);
            res.status(401).json({
                success: false,
                message: 'Kullanıcı adı veya şifre hatalı',
            });
            return;
        }

        // Successful login - clear rate limit
        clearAttempts(clientIp);

        // Create personnel_record entry for admin login time tracking
        const personnelRecordQuery = `
            INSERT INTO personnel_records (personnel_id, login_time, login_ip)
            VALUES ($1, CURRENT_TIMESTAMP, $2)
            RETURNING id
        `;
        const personnelRecordResult = await pool.query(personnelRecordQuery, [user.id, clientIp]);
        const personnelRecordId = personnelRecordResult.rows[0].id;

        // Generate JWT token with admin flag
        const token = generateToken({
            userId: user.id,
            username: user.username,
            role: user.role,
            isAdmin: true,
            personnelRecordId: personnelRecordId,
        });

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Giriş başarılı',
            data: {
                token,
                admin: {
                    id: user.id,
                    username: user.username,
                    fullName: `${user.first_name} ${user.last_name}`,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role,
                    isAdmin: true,
                },
            },
        });
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Giriş işlemi sırasında bir hata oluştu',
        });
    }
};

/**
 * Admin logout controller
 * POST /api/admin/logout
 */
export const adminLogout = async (req: Request, res: Response): Promise<void> => {
    const adminId = req.admin?.userId;
    const clientIp = getClientIp(req);

    if (adminId) {
        console.log(`Admin logout: ${adminId} from IP: ${clientIp}`);

        // Update personnel_record with logout time
        try {
            const updateQuery = `
                UPDATE personnel_records
                SET logout_time = CURRENT_TIMESTAMP,
                    logout_ip = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE personnel_id = $1 AND logout_time IS NULL
            `;
            await pool.query(updateQuery, [adminId, clientIp]);
        } catch (error) {
            console.error('Error updating personnel_record on admin logout:', error);
        }
    }

    res.status(200).json({
        success: true,
        message: 'Çıkış başarılı',
    });
};

/**
 * Get current admin user
 * GET /api/admin/me
 */
export const getCurrentAdmin = async (req: Request, res: Response): Promise<void> => {
    try {
        const adminId = req.admin?.userId;

        if (!adminId) {
            res.status(401).json({
                success: false,
                message: 'Yetkisiz erişim',
            });
            return;
        }

        // Get admin user info from personnel table
        const query = `
            SELECT id, username, first_name, last_name, role, created_at
            FROM personnel
            WHERE id = $1 AND is_active = TRUE AND deleted_at IS NULL AND role = 'admin'
        `;
        const result = await pool.query(query, [adminId]);

        if (result.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Kullanıcı bulunamadı',
            });
            return;
        }

        const admin = result.rows[0];

        res.status(200).json({
            success: true,
            data: {
                id: admin.id,
                username: admin.username,
                fullName: `${admin.first_name} ${admin.last_name}`,
                firstName: admin.first_name,
                lastName: admin.last_name,
                role: admin.role,
                createdAt: admin.created_at,
                isAdmin: true,
            },
        });
    } catch (error) {
        console.error('Get current admin error:', error);
        res.status(500).json({
            success: false,
            message: 'Kullanıcı bilgileri alınamadı',
        });
    }
};
