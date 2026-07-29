import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import fs from 'fs';
import path from 'path';
import os from 'os';
import pool from '../config/database';
import { comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { isValidLength } from '../utils/validation';
import { getClientIp } from '../middleware/rateLimiter';
import { generateLogoutExport } from '../services/exportService';
import {
    createLoginSession,
    getWeeklyTopPerformers,
    type TopPerformerRow,
} from '../services/loginSessionService';
import { logLoginAttempt, logLogout } from '../utils/auditLog';
import { clearAuthCookies, setAuthCookies } from '../utils/authCookies';

const DUMMY_PASSWORD_HASH = '$2a$10$fTErQltYuvKSDtMMqLtzJ.ymeJ5TgU9fdgHwmBmeLb1Z6d7FtlgaC';

/**
 * Admin login validation rules
 */
export const adminLoginValidation = [
    body('username')
        .isString()
        .withMessage('Kullanıcı adı geçersizdir')
        .trim()
        .notEmpty()
        .withMessage('Kullanıcı adı gereklidir')
        .isLength({ min: 3, max: 100 })
        .withMessage('Kullanıcı adı 3-100 karakter arasında olmalıdır'),
    body('password')
        .isString()
        .withMessage('Şifre geçersizdir')
        .notEmpty()
        .withMessage('Şifre gereklidir')
        .isLength({ min: 6, max: 128 })
        .withMessage('Şifre 6-128 karakter arasında olmalıdır'),
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

        const sanitizedUsername = String(username).trim();

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
            await comparePassword(password, DUMMY_PASSWORD_HASH);
            await logLoginAttempt(null, sanitizedUsername, false, clientIp, userAgent);
            res.status(401).json({
                success: false,
                message: 'Kullanıcı adı veya şifre hatalı',
            });
            return;
        }

        const user = userResult.rows[0];

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

        // Check the role only after password verification to avoid account enumeration.
        if (user.role !== 'admin') {
            await logLoginAttempt(user.id, sanitizedUsername, false, clientIp, userAgent);
            res.status(403).json({
                success: false,
                message: 'Yetkisiz erişim - Admin yetkisi gerekli',
            });
            return;
        }

        // Successful login

        const { personnelRecordId, weeklyLoginCount } = await createLoginSession(user.id, clientIp);
        await logLoginAttempt(user.id, sanitizedUsername, true, clientIp, userAgent);

        // Generate JWT token with admin flag
        const token = generateToken({
            userId: user.id,
            username: user.username,
            role: user.role,
            isAdmin: true,
            personnelRecordId: personnelRecordId,
        });

        setAuthCookies(res, token);

        let topPerformers: TopPerformerRow[] = [];
        if (weeklyLoginCount === 1) {
            try {
                topPerformers = await getWeeklyTopPerformers();
            } catch (error) {
                console.error('Admin login ranking information could not be loaded:', error);
            }
        }

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Giriş başarılı',
            data: {
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
    const personnelRecordId = req.admin?.personnelRecordId;
    const clientIp = getClientIp(req);

    if (adminId) {
        console.log(`Admin logout: ${adminId} from IP: ${clientIp}`);

        try {
            if (process.env.LOGOUT_EXPORT_ENABLED === 'true') {
                console.log(`[Admin Logout] Kullanıcı ${adminId} için günlük kayıtlar export ediliyor...`);
                const exportResult = await generateLogoutExport(adminId);
                if (exportResult.success) {
                    console.log(`[Admin Logout] Export başarılı: ${exportResult.exportPath}`);
                } else {
                    console.error(`[Admin Logout] Export hatası: ${exportResult.error}`);
                }
            } else {
                console.log('[Admin Logout] Günlük export devre dışı bırakıldı (LOGOUT_EXPORT_ENABLED!=true)');
            }
        } catch (error) {
            console.error('[Admin Logout] Export sırasında hata:', error);
        }

        await logLogout(adminId, clientIp);

        // Close only the session represented by this token.
        if (personnelRecordId) {
            try {
                const updateQuery = `
                    UPDATE personnel_records
                    SET logout_time = CURRENT_TIMESTAMP,
                        logout_ip = $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                      AND personnel_id = $2
                      AND logout_time IS NULL
                `;
                await pool.query(updateQuery, [personnelRecordId, adminId, clientIp]);
            } catch (error) {
                console.error('Error updating personnel_record on admin logout:', error);
            }
        }
    }

    clearAuthCookies(res);
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

    type Candidate = {
        ip: string;
        interfaceName: string;
        score: number;
    };

    const candidates: Candidate[] = [];

    for (const interfaceName of Object.keys(interfaces)) {
        const addresses = interfaces[interfaceName] || [];
        for (const address of addresses) {
            if (!address || address.family !== 'IPv4' || address.internal) continue;

            const ip = address.address;
            const isPrivate =
                ip.startsWith('192.168.') ||
                ip.startsWith('10.') ||
                /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);

            if (!isPrivate) continue;

            const nameLower = interfaceName.toLowerCase();

            let score = 0;
            if (ip.startsWith('192.168.')) score += 100;
            else if (ip.startsWith('10.')) score += 80;
            else score += 60; // 172.16-31

            // Docker bridge IPs are often in 172.17/172.18 and not reachable from LAN devices.
            if (ip.startsWith('172.17.') || ip.startsWith('172.18.')) score -= 50;

            // Deprioritize virtual adapters (Docker/Hyper-V/WSL/VM)
            if (/docker|vethernet|hyper-v|virtualbox|vmware|wsl|loopback|nat/.test(nameLower)) score -= 30;

            // Slightly prefer physical adapters
            if (/wi-?fi|wireless|ethernet/.test(nameLower)) score += 10;

            candidates.push({ ip, interfaceName, score });
        }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].ip;
};

const ACCESS_INFO_FILE_CANDIDATES = [
    path.resolve(process.cwd(), 'ERISIM_BILGILERI.txt'),
    path.resolve(process.cwd(), '..', 'ERISIM_BILGILERI.txt'),
    path.resolve(__dirname, '..', '..', 'ERISIM_BILGILERI.txt'),
];

const extractHostIpFromAccessInfo = (): string | null => {
    for (const filePath of ACCESS_INFO_FILE_CANDIDATES) {
        try {
            if (!fs.existsSync(filePath)) continue;

            const fileContent = fs.readFileSync(filePath, 'utf8');
            const hostLine = fileContent.match(/^Host IP:\s*(.+)$/im)?.[1]?.trim();
            if (hostLine) return hostLine;

            const networkLine = fileContent.match(/^Ag Erisimi:\s*http:\/\/([^:\s/]+)(?::\d+)?/im)?.[1]?.trim();
            if (networkLine) return networkLine;
        } catch {
            continue;
        }
    }

    return null;
};

const extractFrontendPortFromFrontendEnv = (): string | null => {
    // Look for frontend/.env or ../frontend/.env relative to project root
    const candidates = [
        path.resolve(process.cwd(), 'frontend', '.env'),
        path.resolve(process.cwd(), '..', 'frontend', '.env'),
        path.resolve(__dirname, '..', '..', 'frontend', '.env')
    ];

    for (const filePath of candidates) {
        try {
            if (!fs.existsSync(filePath)) continue;
            const content = fs.readFileSync(filePath, 'utf8');
            // Look for FRONTEND_PORT= or VITE_PORT=
            const matchFront = content.match(/^\s*FRONTEND_PORT\s*=\s*(\d+)\s*$/m);
            if (matchFront && matchFront[1]) return matchFront[1].trim();
            const matchVite = content.match(/^\s*VITE_PORT\s*=\s*(\d+)\s*$/m);
            if (matchVite && matchVite[1]) return matchVite[1].trim();
            const matchPort = content.match(/^\s*PORT\s*=\s*(\d+)\s*$/m);
            if (matchPort && matchPort[1]) return matchPort[1].trim();
        } catch {
            continue;
        }
    }

    return null;
};

const extractHostFromRequest = (req: Request): string | null => {
    const origin = req.header('origin') || req.header('referer') || req.header('host');
    if (!origin) return null;

    try {
        const url = origin.startsWith('http://') || origin.startsWith('https://') ? new URL(origin) : new URL(`http://${origin}`);
        const hostname = url.hostname.trim();
        if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
            return null;
        }

        return hostname;
    } catch {
        return null;
    }
};

/**
 * Get admin network info for LAN-safe QR generation
 * GET /api/admin/network-info
 */
export const getAdminNetworkInfo = async (req: Request, res: Response): Promise<void> => {
    try {
        const configuredHostIp = process.env.PUBLIC_HOST_IP?.trim() || process.env.HOST_IP?.trim() || '';
        const accessInfoHostIp = extractHostIpFromAccessInfo();
        const requestHostIp = extractHostFromRequest(req);
        // Prefer the actual host used by the admin UI request (LAN-safe and not stale),
        // then fall back to access-info file or container/OS network probing.
        const localIp = configuredHostIp || requestHostIp || accessInfoHostIp || getLocalPrivateIPv4();
        const frontendPort = process.env.FRONTEND_PORT || extractFrontendPortFromFrontendEnv() || '5173';
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
