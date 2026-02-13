import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { recordFailedAttempt, clearAttempts } from '../middleware/auth';
import { logLoginAttempt, logLogout } from '../utils/auditLog';
import { sanitizeInput, isValidLength } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { generateLogoutExport } from '../services/exportService';

/**
 * Login validation rules
 */
export const loginValidation = [
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
 * Login controller
 * POST /api/auth/login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;

    try {
        // GÜVENLİK: Hassas bilgileri loglama (sadece IP, kullanıcı adı değil)
        console.log(`Login attempt from IP: ${clientIp}`);

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

        // GÜVENLİK: Input sanitization
        const sanitizedUsername = sanitizeInput(username, 50);

        if (!sanitizedUsername || !password) {
            recordFailedAttempt(clientIp);
            await logLoginAttempt(null, username || 'unknown', false, clientIp, userAgent);
            res.status(400).json({
                success: false,
                message: 'Kullanıcı adı ve şifre gereklidir',
            });
            return;
        }

        // GÜVENLİK: Kullanıcı adı uzunluk kontrolü
        if (!isValidLength(sanitizedUsername, 3, 50)) {
            recordFailedAttempt(clientIp);
            await logLoginAttempt(null, sanitizedUsername, false, clientIp, userAgent);
            res.status(400).json({
                success: false,
                message: 'Geçersiz kullanıcı adı formatı',
            });
            return;
        }

        // Find user by username - parameterized query
        const userQuery = `
            SELECT id, username, password, first_name, last_name, role, is_active
            FROM personnel
            WHERE username = $1 AND deleted_at IS NULL
        `;
        const userResult = await pool.query(userQuery, [sanitizedUsername]);

        if (userResult.rows.length === 0) {
            recordFailedAttempt(clientIp);
            await logLoginAttempt(null, sanitizedUsername, false, clientIp, userAgent);
            res.status(401).json({
                success: false,
                message: 'Kullanıcı adı veya şifre hatalı',
            });
            return;
        }

        const user = userResult.rows[0];

        // Check if user is active
        if (!user.is_active) {
            res.status(403).json({
                success: false,
                message: 'Hesabınız devre dışı bırakılmış',
            });
            return;
        }

        // Compare password
        const isPasswordValid = await comparePassword(password, user.password);

        if (!isPasswordValid) {
            recordFailedAttempt(clientIp);
            await logLoginAttempt(user.id, sanitizedUsername, false, clientIp, userAgent);
            res.status(401).json({
                success: false,
                message: 'Kullanıcı adı veya şifre hatalı',
            });
            return;
        }

        // Başarılı giriş - rate limit sıfırla ve audit log
        clearAttempts(clientIp);
        await logLoginAttempt(user.id, sanitizedUsername, true, clientIp, userAgent);

        // Create personnel_record entry for login time tracking
        const personnelRecordQuery = `
            INSERT INTO personnel_records (personnel_id, login_time, login_ip)
            VALUES ($1, CURRENT_TIMESTAMP, $2)
            RETURNING id
        `;
        const personnelRecordResult = await pool.query(personnelRecordQuery, [user.id, clientIp]);
        const personnelRecordId = personnelRecordResult.rows[0].id;

        // Generate JWT token
        const token = generateToken({
            userId: user.id,
            username: user.username,
            role: user.role,
            personnelRecordId: personnelRecordId,
        });

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Giriş başarılı',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    fullName: `${user.first_name} ${user.last_name}`,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    role: user.role,
                    is_active: user.is_active,
                },
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Giriş işlemi sırasında bir hata oluştu',
        });
    }
};

/**
 * Logout controller (client-side token removal + personnel record update)
 * POST /api/auth/logout
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
    // Not: JWT stateless olduğu için server-side logout yok
    // Client token'ı localStorage'dan silmeli

    // GÜVENLİK: Audit log kaydı
    const userId = req.user?.userId;
    const clientIp = getClientIp(req);

    if (userId) {
        // Önce günlük kayıtları masaüstüne export et
        try {
            console.log(`[Logout] Kullanıcı ${userId} için günlük kayıtlar export ediliyor...`);
            const exportResult = await generateLogoutExport(userId);
            if (exportResult.success) {
                console.log(`[Logout] Export başarılı: ${exportResult.exportPath}`);
            } else {
                console.error(`[Logout] Export hatası: ${exportResult.error}`);
            }
        } catch (error) {
            console.error('[Logout] Export sırasında hata:', error);
            // Export hatası çıkışı engellememelidir
        }

        await logLogout(userId, clientIp);

        // Update personnel_record with logout time
        try {
            const updateQuery = `
                UPDATE personnel_records
                SET logout_time = CURRENT_TIMESTAMP,
                    logout_ip = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE personnel_id = $1 AND logout_time IS NULL
            `;
            await pool.query(updateQuery, [userId, clientIp]);
        } catch (error) {
            console.error('Error updating personnel_record on logout:', error);
            // Don't fail logout if personnel_record update fails
        }
    }

    res.status(200).json({
        success: true,
        message: 'Çıkış başarılı',
    });
};

/**
 * Verify token and get current user
 * GET /api/auth/me
 */
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Yetkilendirme gerekli',
            });
            return;
        }

        // Get full user info from database
        const userQuery = `
            SELECT id, username, first_name, last_name, role, is_active
            FROM personnel
            WHERE id = $1 AND deleted_at IS NULL
        `;
        const userResult = await pool.query(userQuery, [req.user.userId]);

        if (userResult.rows.length === 0) {
            res.status(404).json({
                success: false,
                message: 'Kullanıcı bulunamadı',
            });
            return;
        }

        const user = userResult.rows[0];

        res.status(200).json({
            success: true,
            data: {
                id: user.id,
                username: user.username,
                fullName: `${user.first_name} ${user.last_name}`,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role,
                is_active: user.is_active,
            },
        });
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            message: 'Kullanıcı bilgileri alınırken hata oluştu',
        });
    }
};
