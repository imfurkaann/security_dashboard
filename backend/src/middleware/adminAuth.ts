import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

// Extend Express Request type for admin authentication
declare global {
    namespace Express {
        interface Request {
            admin?: {
                userId: string;
                username: string;
                role: string;
                isAdmin: boolean;
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
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'Yetkisiz erişim - Token bulunamadı',
            });
            return;
        }

        const token = authHeader.substring(7);

        // Debug logging in development only, without printing the actual decoded payload
        if (process.env.NODE_ENV !== 'production') {
            console.debug('Admin auth - Token received:', token ? 'yes' : 'no');
            console.debug('Admin auth - Token length:', token?.length);
        }

        // Verify token
        const decoded = verifyToken(token);

        // Check if token is valid
        if (!decoded) {
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
        if (!decoded.isAdmin) {
            res.status(403).json({
                success: false,
                message: 'Yetkisiz erişim - Admin yetkisi gerekli',
            });
            return;
        }

        // Attach admin info to request
        req.admin = {
            userId: decoded.userId,
            username: decoded.username,
            role: decoded.role,
            isAdmin: decoded.isAdmin || false,
        };

        next();
    } catch (error) {
        console.error('Admin auth middleware error:', error);
        res.status(401).json({
            success: false,
            message: 'Geçersiz veya süresi dolmuş token',
        });
    }
};
