import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import os from 'os';
import pool from '../config/database';
import { comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { sanitizeInput, isValidLength } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { generateLogoutExport } from '../services/exportService';

interface TopPerformerRow {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    totalCount: number;
    rank: number;
}

const getWeeklyTopPerformers = async (): Promise<TopPerformerRow[]> => {
    const rankingResult = await pool.query(
        `WITH period_window AS (
            SELECT
                (date_trunc('week', CURRENT_DATE)::date - INTERVAL '7 day')::date AS start_date,
                date_trunc('week', CURRENT_DATE)::date AS end_date
        ),
        personnel_base AS (
            SELECT p.id, p.first_name, p.last_name, p.username
            FROM personnel p
            WHERE p.deleted_at IS NULL
              AND p.is_active = TRUE
              AND p.role = 'personnel'
        ),
        vehicle_counts AS (
            SELECT vr.given_by AS personnel_id, COUNT(*)::int AS vehicle_count
            FROM vehicle_records vr
            CROSS JOIN period_window pw
            WHERE vr.deleted_at IS NULL
              AND vr.given_by IS NOT NULL
              AND vr.given_date >= pw.start_date
              AND vr.given_date < pw.end_date
            GROUP BY vr.given_by
        ),
        visitor_counts AS (
            SELECT vr.entry_by AS personnel_id, COUNT(*)::int AS visitor_count
            FROM visitor_records vr
            CROSS JOIN period_window pw
            WHERE vr.deleted_at IS NULL
              AND vr.entry_by IS NOT NULL
              AND vr.entry_date >= pw.start_date
              AND vr.entry_date < pw.end_date
            GROUP BY vr.entry_by
        ),
        manager_counts AS (
            SELECT mr.entry_by AS personnel_id, COUNT(*)::int AS manager_count
            FROM managers_records mr
            CROSS JOIN period_window pw
            WHERE mr.deleted_at IS NULL
              AND mr.entry_by IS NOT NULL
              AND mr.entry_date >= pw.start_date
              AND mr.entry_date < pw.end_date
            GROUP BY mr.entry_by
        ),
        fire_alarm_counts AS (
            SELECT fa.recorded_by AS personnel_id, COUNT(*)::int AS fire_alarm_count
            FROM fire_alarms fa
            CROSS JOIN period_window pw
            WHERE fa.deleted_at IS NULL
              AND fa.recorded_by IS NOT NULL
              AND fa.alarm_time::date >= pw.start_date
              AND fa.alarm_time::date < pw.end_date
            GROUP BY fa.recorded_by
        ),
        sgk_counts AS (
            SELECT sr.personnel_id AS personnel_id, COUNT(*)::int AS sgk_count
            FROM sgk_records sr
            CROSS JOIN period_window pw
            WHERE sr.deleted_at IS NULL
              AND sr.personnel_id IS NOT NULL
              AND sr.upload_date::date >= pw.start_date
              AND sr.upload_date::date < pw.end_date
            GROUP BY sr.personnel_id
        ),
        ranked AS (
            SELECT
                pb.id,
                pb.first_name,
                pb.last_name,
                pb.username,
                (
                    COALESCE(vc.vehicle_count, 0)
                    + COALESCE(vic.visitor_count, 0)
                    + COALESCE(mc.manager_count, 0)
                    + COALESCE(fac.fire_alarm_count, 0)
                    + COALESCE(sc.sgk_count, 0)
                )::int AS total_count,
                DENSE_RANK() OVER (
                    ORDER BY
                        (
                            COALESCE(vc.vehicle_count, 0)
                            + COALESCE(vic.visitor_count, 0)
                            + COALESCE(mc.manager_count, 0)
                            + COALESCE(fac.fire_alarm_count, 0)
                            + COALESCE(sc.sgk_count, 0)
                        ) DESC,
                        pb.first_name ASC,
                        pb.last_name ASC
                )::int AS ranking
            FROM personnel_base pb
            LEFT JOIN vehicle_counts vc ON vc.personnel_id = pb.id
            LEFT JOIN visitor_counts vic ON vic.personnel_id = pb.id
            LEFT JOIN manager_counts mc ON mc.personnel_id = pb.id
            LEFT JOIN fire_alarm_counts fac ON fac.personnel_id = pb.id
            LEFT JOIN sgk_counts sc ON sc.personnel_id = pb.id
        )
        SELECT id, first_name, last_name, username, total_count, ranking
        FROM ranked
        WHERE total_count > 0
        ORDER BY ranking ASC, first_name ASC, last_name ASC
        LIMIT 3`
    );

    return rankingResult.rows.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        username: row.username,
        totalCount: Number(row.total_count),
        rank: Number(row.ranking),
    }));
};

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
            res.status(400).json({
                success: false,
                message: 'Kullanıcı adı ve şifre gereklidir',
            });
            return;
        }

        // Username length validation
        if (!isValidLength(sanitizedUsername, 3, 100)) {
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
            res.status(401).json({
                success: false,
                message: 'Kullanıcı adı veya şifre hatalı',
            });
            return;
        }

        const user = userResult.rows[0];

        // Check if user has admin role
        if (user.role !== 'admin') {
            res.status(403).json({
                success: false,
                message: 'Yetkisiz erişim - Admin yetkisi gerekli',
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

        // Successful login

        // Create personnel_record entry for admin login time tracking
        const personnelRecordQuery = `
            INSERT INTO personnel_records (personnel_id, login_time, login_ip)
            VALUES ($1, CURRENT_TIMESTAMP, $2)
            RETURNING id
        `;
        const personnelRecordResult = await pool.query(personnelRecordQuery, [user.id, clientIp]);
        const personnelRecordId = personnelRecordResult.rows[0].id;

        const weeklyCounterResult = await pool.query(
            `UPDATE personnel
             SET weekly_login_count = CASE
                     WHEN weekly_login_week_start IS DISTINCT FROM date_trunc('week', CURRENT_DATE)::date THEN 1
                     ELSE weekly_login_count + 1
                 END,
                 weekly_login_week_start = date_trunc('week', CURRENT_DATE)::date,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
             RETURNING weekly_login_count`,
            [user.id]
        );
        const weeklyLoginCount = Number(weeklyCounterResult.rows[0]?.weekly_login_count || 0);

        // Generate JWT token with admin flag
        const token = generateToken({
            userId: user.id,
            username: user.username,
            role: user.role,
            isAdmin: true,
            personnelRecordId: personnelRecordId,
        });

        let topPerformers: TopPerformerRow[] = [];
        if (weeklyLoginCount === 1) {
            topPerformers = await getWeeklyTopPerformers();
        }

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
                topPerformers,
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

        try {
            console.log(`[Admin Logout] Kullanıcı ${adminId} için günlük kayıtlar export ediliyor...`);
            const exportResult = await generateLogoutExport(adminId);
            if (exportResult.success) {
                console.log(`[Admin Logout] Export başarılı: ${exportResult.exportPath}`);
            } else {
                console.error(`[Admin Logout] Export hatası: ${exportResult.error}`);
            }
        } catch (error) {
            console.error('[Admin Logout] Export sırasında hata:', error);
        }

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

const getLocalPrivateIPv4 = (): string | null => {
    const interfaces = os.networkInterfaces();

    for (const interfaceName of Object.keys(interfaces)) {
        const addresses = interfaces[interfaceName] || [];
        for (const address of addresses) {
            if (!address || address.family !== 'IPv4' || address.internal) continue;

            const ip = address.address;
            if (
                ip.startsWith('192.168.') ||
                ip.startsWith('10.') ||
                /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
            ) {
                return ip;
            }
        }
    }

    return null;
};

/**
 * Get admin network info for LAN-safe QR generation
 * GET /api/admin/network-info
 */
export const getAdminNetworkInfo = async (_req: Request, res: Response): Promise<void> => {
    try {
        const localIp = getLocalPrivateIPv4();
        const frontendPort = process.env.FRONTEND_PORT || '5173';
        const backendPort = process.env.PORT || '5000';

        const frontendBaseUrl = localIp
            ? `http://${localIp}:${frontendPort}`
            : `http://localhost:${frontendPort}`;

        const backendBaseUrl = localIp
            ? `http://${localIp}:${backendPort}`
            : `http://localhost:${backendPort}`;

        res.status(200).json({
            success: true,
            data: {
                localIp,
                frontendBaseUrl,
                backendBaseUrl
            }
        });
    } catch (error) {
        console.error('Get admin network info error:', error);
        res.status(500).json({
            success: false,
            message: 'Ağ bilgisi alınamadı'
        });
    }
};
