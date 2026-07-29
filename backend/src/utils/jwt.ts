import jwt from 'jsonwebtoken';
import { readSecret } from '../config/secrets';

interface JWTPayload {
    userId: string;
    username: string;
    role: string;
    personnelRecordId?: number; // Optional: ID of the current login session
    isAdmin?: boolean; // Optional: Flag for admin users
}

// GÜVENLİK: JWT_SECRET .env dosyasından alınmalı, yoksa uygulama çalışmamalı
const JWT_SECRET = readSecret('JWT_SECRET', 'JWT_SECRET_FILE');
const JWT_EXPIRE = process.env.JWT_EXPIRE || process.env.JWT_EXPIRES_IN || '30d';

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET veya JWT_SECRET_FILE tanımlanmamış');
}

if (process.env.NODE_ENV === 'production' && JWT_SECRET.length < 64) {
    throw new Error('Production JWT secret en az 64 karakter olmalıdır');
}

/**
 * Generate JWT token
 * @param payload - User data to encode in token
 * @returns JWT token string
 */
export const generateToken = (payload: JWTPayload): string => {
    return jwt.sign(payload, JWT_SECRET as string, {
        expiresIn: JWT_EXPIRE as string,
        algorithm: 'HS256'
    } as jwt.SignOptions);
};

/**
 * Verify and decode JWT token
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid
 */
export const verifyToken = (token: string): JWTPayload | null => {
    try {
        if (!token || typeof token !== 'string') {
            return null;
        }
        return jwt.verify(token, JWT_SECRET as string, {
            algorithms: ['HS256']
        }) as JWTPayload;
    } catch (error) {
        // Token hatası loglanabilir ama detay vermemeli
        console.warn('Token doğrulama başarısız:', error instanceof Error ? error.name : 'Unknown');
        return null;
    }
};
