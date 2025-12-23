import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface JWTPayload {
    userId: string;
    username: string;
    role: string;
    personnelRecordId?: number; // Optional: ID of the current login session
}

// GÜVENLİK: JWT_SECRET .env dosyasından alınmalı, yoksa uygulama çalışmamalı
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || '30d'; // Kullanıcı isteği: Otomatik çıkış devre dışı

if (!JWT_SECRET) {
    console.error('❌ KRİTİK GÜVENLİK HATASI: JWT_SECRET ortam değişkeni tanımlanmamış!');
    console.error('Lütfen .env dosyasına güçlü bir JWT_SECRET ekleyin:');
    console.error(`JWT_SECRET=${crypto.randomBytes(64).toString('hex')}`);
    process.exit(1);
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
