import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import pool from '../config/database';
import { clearAuthCookies, getRequestToken } from '../utils/authCookies';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                username: string;
                role: string;
                personnelRecordId?: number;
                isAdmin?: boolean;
            };
        }
    }
}

/**
 * Authentication middleware - Verifies JWT token
 */
export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Prefer the HttpOnly cookie; keep Bearer support during migration.
        const token = getRequestToken(req);

        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Yetkilendirme token\'ı bulunamadı',
            });
            return;
        }

        // Token uzunluk kontrolü (güvenlik)

        if (!token || token.length < 10 || token.length > 1000) {
            res.status(401).json({
                success: false,
                message: 'Geçersiz token formatı',
            });
            return;
        }

        // Verify token
        const decoded = verifyToken(token);

        if (!decoded) {
            clearAuthCookies(res);
            res.status(401).json({
                success: false,
                message: 'Geçersiz veya süresi dolmuş token',
            });
            return;
        }

        // Kullanıcı bilgilerinin geçerliliğini kontrol et
        if (!decoded.userId || !decoded.username || !decoded.role) {
            res.status(401).json({
                success: false,
                message: 'Token içeriği geçersiz',
            });
            return;
        }

        // JWT validity alone is not enough: disabled/deleted users and role changes
        // must take effect without waiting for token expiration.
        const userResult = await pool.query<{
            username: string;
            role: string;
        }>(
            `SELECT username, role
             FROM personnel
             WHERE id = $1
               AND deleted_at IS NULL
               AND is_active = TRUE`,
            [decoded.userId]
        );

        if (userResult.rows.length !== 1) {
            clearAuthCookies(res);
            res.status(401).json({
                success: false,
                message: 'Kullanıcı oturumu artık geçerli değil',
            });
            return;
        }

        req.user = {
            ...decoded,
            username: userResult.rows[0].username,
            role: userResult.rows[0].role,
        };
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(503).json({
            success: false,
            message: 'Yetkilendirme servisi geçici olarak kullanılamıyor',
        });
    }
};

/**
 * Role-based authorization middleware
 * @param roles - Allowed roles
 */
export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Yetkilendirme gerekli',
            });
            return;
        }

        // Geçerli rolleri kontrol et
        const validRoles = ['admin', 'manager', 'personnel', 'security'];
        if (!validRoles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: 'Geçersiz kullanıcı rolü',
            });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                message: 'Bu işlem için yetkiniz yok',
            });
            return;
        }

        next();
    };
};
