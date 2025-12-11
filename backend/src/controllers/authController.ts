import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { comparePassword, hashPassword } from '../utils/password';
import { generateToken } from '../utils/jwt';

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
    try {
        console.log('Login request received:', { body: req.body });

        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            res.status(400).json({
                success: false,
                message: 'Geçersiz giriş bilgileri',
                errors: errors.array(),
            });
            return;
        }

        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({
                success: false,
                message: 'Kullanıcı adı ve şifre gereklidir',
            });
            return;
        }

        // Find user by username
        const userQuery = `
            SELECT id, username, password, first_name, last_name, role, is_active
            FROM personnel
            WHERE username = $1 AND deleted_at IS NULL
        `;
        const userResult = await pool.query(userQuery, [username]);

        if (userResult.rows.length === 0) {
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
            res.status(401).json({
                success: false,
                message: 'Kullanıcı adı veya şifre hatalı',
            });
            return;
        }

        // Generate JWT token
        const token = generateToken({
            userId: user.id,
            username: user.username,
            role: user.role,
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
 * Logout controller (client-side token removal)
 * POST /api/auth/logout
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        res.status(200).json({
            success: true,
            message: 'Çıkış başarılı',
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Çıkış işlemi sırasında bir hata oluştu',
        });
    }
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
