import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { logLoginAttempt, logLogout } from '../utils/auditLog';
import { sanitizeInput, isValidLength } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { generateLogoutExport } from '../services/exportService';

interface WeeklyRankingCelebration {
    rank: number;
    totalCount: number;
    weekStart: string;
    weekEnd: string;
    message: string;
}

const getWeeklyRankingCelebration = async (
    userId: string,
    firstName: string,
    lastName: string,
    role: string,
    weeklyLoginCount: number
): Promise<WeeklyRankingCelebration | null> => {
    if (role !== 'personnel') {
        return null;
    }

    if (weeklyLoginCount !== 1) {
        return null;
    }

    const rankingResult = await pool.query(
        `WITH period_window AS (
            SELECT
                (date_trunc('week', CURRENT_DATE)::date - INTERVAL '7 day')::date AS start_date,
                date_trunc('week', CURRENT_DATE)::date AS end_date
        ),
        personnel_base AS (
            SELECT p.id, p.first_name, p.last_name
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
                )::int AS ranking,
                (SELECT start_date FROM period_window)::date AS start_date,
                ((SELECT end_date FROM period_window) - INTERVAL '1 day')::date AS end_date
            FROM personnel_base pb
            LEFT JOIN vehicle_counts vc ON vc.personnel_id = pb.id
            LEFT JOIN visitor_counts vic ON vic.personnel_id = pb.id
            LEFT JOIN manager_counts mc ON mc.personnel_id = pb.id
            LEFT JOIN fire_alarm_counts fac ON fac.personnel_id = pb.id
            LEFT JOIN sgk_counts sc ON sc.personnel_id = pb.id
        )
        SELECT id, ranking, total_count, start_date, end_date
                FROM ranked
                WHERE id = $1
                    AND ranking <= 3
                    AND total_count > 0`,
                [userId]
    );

    if (rankingResult.rows.length === 0) {
        return null;
    }

    const rankRow = rankingResult.rows[0];
    const fullName = `${firstName} ${lastName}`.trim();

    return {
        rank: Number(rankRow.ranking),
        totalCount: Number(rankRow.total_count),
        weekStart: rankRow.start_date,
        weekEnd: rankRow.end_date,
        message: `Tebrikler ${fullName}! Geçen haftanın en çok kayıt yapanlar listemizde ${rankRow.ranking}. oldun. Başarılarının devamını dileriz! 👏`,
    };
};

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
            await logLoginAttempt(null, username || 'unknown', false, clientIp, userAgent);
            res.status(400).json({
                success: false,
                message: 'Kullanıcı adı ve şifre gereklidir',
            });
            return;
        }

        // GÜVENLİK: Kullanıcı adı uzunluk kontrolü
        if (!isValidLength(sanitizedUsername, 3, 50)) {
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
            await logLoginAttempt(user.id, sanitizedUsername, false, clientIp, userAgent);
            res.status(401).json({
                success: false,
                message: 'Kullanıcı adı veya şifre hatalı',
            });
            return;
        }

        // Başarılı giriş - audit log
        await logLoginAttempt(user.id, sanitizedUsername, true, clientIp, userAgent);

        // Create personnel_record entry for login time tracking
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

        const weeklyRankingCelebration = await getWeeklyRankingCelebration(
            user.id,
            user.first_name,
            user.last_name,
            user.role,
            weeklyLoginCount
        );

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
                weeklyRankingCelebration,
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
