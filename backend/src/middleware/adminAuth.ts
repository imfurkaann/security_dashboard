import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { clearAuthCookies, getRequestToken } from '../utils/authCookies';
import { getActiveSessionUser } from '../services/sessionService';

// Extend Express Request type for admin authentication
declare global {
    namespace Express {
        interface Request {
            admin?: {
                userId: string;
                username: string;
                role: string;
                isAdmin: boolean;
                personnelRecordId?: number;
            };
        }
    }
}

/**
 * Admin authentication middleware
 * Verifies JWT token and checks if user is admin
 */
export const adminAuthMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const token = getRequestToken(req);
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Yetkisiz erişim - Oturum bulunamadı',
            });
            return;
        }

        // Debug logging in development only, without printing the actual decoded payload
        if (process.env.NODE_ENV !== 'production') {
            console.debug('Admin auth - Token received:', token ? 'yes' : 'no');
            console.debug('Admin auth - Token length:', token?.length);
        }

        // Verify token
        const decoded = verifyToken(token);

        // Check if token is valid
        if (!decoded) {
            clearAuthCookies(res);
            if (process.env.NODE_ENV !== 'production') {
                console.debug('Admin auth - Token verification failed');
            }
            res.status(401).json({
                success: false,
                message: 'Geçersiz veya süresi dolmuş token',
            });
            return;
        }

        // Check if user is admin
        if (
            !decoded.isAdmin ||
            decoded.role !== 'admin' ||
            !decoded.userId ||
            !decoded.username
        ) {
            res.status(403).json({
                success: false,
                message: 'Yetkisiz erişim - Admin yetkisi gerekli',
            });
            return;
        }

        const activeSessionUser = await getActiveSessionUser(decoded);

        if (!activeSessionUser || activeSessionUser.role !== 'admin') {
            clearAuthCookies(res);
            res.status(401).json({
                success: false,
                message: 'Admin oturumu artık geçerli değil',
            });
            return;
        }

        // Attach admin info to request
        req.admin = {
            userId: decoded.userId,
            username: activeSessionUser.username,
            role: activeSessionUser.role,
            isAdmin: decoded.isAdmin || false,
            personnelRecordId: decoded.personnelRecordId,
        };

        next();
    } catch (error) {
        console.error('Admin auth middleware error:', error);
        res.status(503).json({
            success: false,
            message: 'Yetkilendirme servisi geçici olarak kullanılamıyor',
        });
    }
};
