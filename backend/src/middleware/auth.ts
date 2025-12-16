import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';

// Extend Express Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                username: string;
                role: string;
            };
        }
    }
}

// Rate limiting için basit in-memory store
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 dakika
const MAX_ATTEMPTS = 5;

/**
 * IP bazlı rate limiting kontrolü
 */
export const checkRateLimit = (ip: string): boolean => {
    const now = Date.now();
    const attempts = loginAttempts.get(ip);

    if (!attempts) {
        return true;
    }

    // Zaman penceresi geçmişse sıfırla
    if (now - attempts.lastAttempt > RATE_LIMIT_WINDOW) {
        loginAttempts.delete(ip);
        return true;
    }

    return attempts.count < MAX_ATTEMPTS;
};

/**
 * Başarısız giriş denemesi kaydet
 */
export const recordFailedAttempt = (ip: string): void => {
    const now = Date.now();
    const attempts = loginAttempts.get(ip);

    if (!attempts || now - attempts.lastAttempt > RATE_LIMIT_WINDOW) {
        loginAttempts.set(ip, { count: 1, lastAttempt: now });
    } else {
        loginAttempts.set(ip, { count: attempts.count + 1, lastAttempt: now });
    }
};

/**
 * Başarılı giriş sonrası sıfırla
 */
export const clearAttempts = (ip: string): void => {
    loginAttempts.delete(ip);
};

/**
 * Authentication middleware - Verifies JWT token
 */
export const authMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'Yetkilendirme token\'ı bulunamadı',
            });
            return;
        }

        // Token uzunluk kontrolü (güvenlik)
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

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

        // Attach user info to request
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({
            success: false,
            message: 'Yetkilendirme hatası',
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

/**
 * Rate limiting middleware - Login endpointi için
 */
export const rateLimitMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    if (!checkRateLimit(clientIp)) {
        res.status(429).json({
            success: false,
            message: 'Çok fazla başarısız deneme. Lütfen 15 dakika sonra tekrar deneyin.',
        });
        return;
    }

    next();
};
