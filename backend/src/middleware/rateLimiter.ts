/**
 * Enhanced Rate Limiting Middleware
 * GÜVENLİK: DoS/DDoS saldırılarına karşı koruma
 */
import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
    count: number;
    firstRequest: number;
    blockedUntil: number | null;
}

// Test ortamı kontrolü
const isTestEnv = process.env.NODE_ENV === 'test';

// Rate limit konfigürasyonu
const RATE_LIMIT_CONFIG = {
    // Genel API limitleri
    general: {
        windowMs: isTestEnv ? 1000 : 60 * 1000,      // Test: 1sn, Prod: 1 dakika
        maxRequests: isTestEnv ? 10000 : 1000,       // Test: 10000, Prod: 1000
        blockDurationMs: isTestEnv ? 1000 : 5 * 60 * 1000  // Test: 1sn, Prod: 5 dakika
    },
    // Login endpoint limitleri
    login: {
        windowMs: isTestEnv ? 1000 : 15 * 60 * 1000, // Test: 1sn, Prod: 15 dakika
        maxRequests: isTestEnv ? 10000 : 50,         // Test: 10000, Prod: 50
        blockDurationMs: isTestEnv ? 1000 : 30 * 60 * 1000  // Test: 1sn, Prod: 30 dakika
    },
    // Yazma işlemleri (POST/PUT/DELETE)
    write: {
        windowMs: isTestEnv ? 1000 : 60 * 1000,      // Test: 1sn, Prod: 1 dakika
        maxRequests: isTestEnv ? 10000 : 300,        // Test: 10000, Prod: 300
        blockDurationMs: isTestEnv ? 1000 : 10 * 60 * 1000  // Test: 1sn, Prod: 10 dakika
    }
};

// In-memory rate limit storage (production'da Redis kullanılmalı)
const rateLimitStore = new Map<string, RateLimitRecord>();

// Periyodik temizlik - bellek sızıntısını önle
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
        // 1 saatten eski kayıtları sil
        if (now - record.firstRequest > 60 * 60 * 1000) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000); // Her 5 dakikada bir temizle

/**
 * Rate limit anahtarı oluştur
 */
const getRateLimitKey = (ip: string, type: string): string => {
    return `${type}:${ip}`;
};

/**
 * IP adresini güvenli şekilde al
 */
export const getClientIp = (req: Request): string => {
    // Proxy arkasında ise X-Forwarded-For header'ını kullan
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        const ips = String(forwardedFor).split(',');
        return ips[0].trim();
    }

    // X-Real-IP header'ı (nginx)
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
        return String(realIp);
    }

    // Doğrudan bağlantı
    return req.ip || req.socket.remoteAddress || 'unknown';
};

/**
 * Rate limit kontrolü
 */
const checkRateLimit = (
    ip: string,
    type: keyof typeof RATE_LIMIT_CONFIG
): { allowed: boolean; retryAfter?: number; remaining?: number } => {
    const config = RATE_LIMIT_CONFIG[type];
    const key = getRateLimitKey(ip, type);
    const now = Date.now();

    let record = rateLimitStore.get(key);

    // Bloklanmış mı kontrol et
    if (record?.blockedUntil && now < record.blockedUntil) {
        const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
        return { allowed: false, retryAfter };
    }

    // Yeni kayıt veya süre dolmuş
    if (!record || now - record.firstRequest > config.windowMs) {
        record = {
            count: 1,
            firstRequest: now,
            blockedUntil: null
        };
        rateLimitStore.set(key, record);
        return { allowed: true, remaining: config.maxRequests - 1 };
    }

    // Limit aşıldı mı?
    if (record.count >= config.maxRequests) {
        record.blockedUntil = now + config.blockDurationMs;
        rateLimitStore.set(key, record);
        const retryAfter = Math.ceil(config.blockDurationMs / 1000);
        return { allowed: false, retryAfter };
    }

    // İsteği kaydet
    record.count++;
    rateLimitStore.set(key, record);

    return { allowed: true, remaining: config.maxRequests - record.count };
};

/**
 * Genel API rate limiting middleware
 */
export const generalRateLimiter = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const ip = getClientIp(req);
    const result = checkRateLimit(ip, 'general');

    // Rate limit headers ekle
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_CONFIG.general.maxRequests);
    if (result.remaining !== undefined) {
        res.setHeader('X-RateLimit-Remaining', result.remaining);
    }

    if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter || 300);
        res.status(429).json({
            success: false,
            message: 'Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.',
            retryAfter: result.retryAfter
        });
        return;
    }

    next();
};

/**
 * Login endpoint rate limiting middleware
 */
export const loginRateLimiter = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const ip = getClientIp(req);
    const result = checkRateLimit(ip, 'login');

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_CONFIG.login.maxRequests);
    if (result.remaining !== undefined) {
        res.setHeader('X-RateLimit-Remaining', result.remaining);
    }

    if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter || 1800);

        // GÜVENLİK: Çok fazla deneme yapıldığında uyarı logla
        console.warn(`[SECURITY] Rate limit exceeded for login from IP: ${ip}`);

        res.status(429).json({
            success: false,
            message: 'Çok fazla başarısız giriş denemesi. Lütfen daha sonra tekrar deneyin.',
            retryAfter: result.retryAfter
        });
        return;
    }

    next();
};

/**
 * Yazma işlemleri (POST/PUT/DELETE) rate limiting middleware
 */
export const writeRateLimiter = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Sadece yazma metodları için uygula
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        next();
        return;
    }

    const ip = getClientIp(req);
    const result = checkRateLimit(ip, 'write');

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_CONFIG.write.maxRequests);
    if (result.remaining !== undefined) {
        res.setHeader('X-RateLimit-Remaining', result.remaining);
    }

    if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter || 600);
        res.status(429).json({
            success: false,
            message: 'Çok fazla yazma işlemi. Lütfen daha sonra tekrar deneyin.',
            retryAfter: result.retryAfter
        });
        return;
    }

    next();
};

/**
 * Başarısız giriş denemesi kaydet (login controller'dan çağrılır)
 */
export const recordFailedLogin = (ip: string): void => {
    const key = getRateLimitKey(ip, 'login');
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now - record.firstRequest > RATE_LIMIT_CONFIG.login.windowMs) {
        record = {
            count: 1,
            firstRequest: now,
            blockedUntil: null
        };
    } else {
        record.count++;
    }

    rateLimitStore.set(key, record);
};

/**
 * Başarılı giriş sonrası rate limit sıfırla
 */
export const clearLoginAttempts = (ip: string): void => {
    const key = getRateLimitKey(ip, 'login');
    rateLimitStore.delete(key);
};

/**
 * IP'nin bloklanma durumunu kontrol et
 */
export const isIpBlocked = (ip: string, type: keyof typeof RATE_LIMIT_CONFIG = 'general'): boolean => {
    const key = getRateLimitKey(ip, type);
    const record = rateLimitStore.get(key);

    if (!record?.blockedUntil) return false;

    return Date.now() < record.blockedUntil;
};

export default {
    generalRateLimiter,
    loginRateLimiter,
    writeRateLimiter,
    recordFailedLogin,
    clearLoginAttempts,
    isIpBlocked,
    getClientIp
};
