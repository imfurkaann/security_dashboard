/**
 * Enhanced Rate Limiting Middleware
 * GÜVENLİK: DoS/DDoS saldırılarına karşı koruma
 */
import { Request, Response, NextFunction } from 'express';
import net from 'net';
import crypto from 'crypto';

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
        maxRequests: isTestEnv ? 10000 : 10,         // IP + kullanıcı adı başına
        blockDurationMs: isTestEnv ? 1000 : 30 * 60 * 1000  // Test: 1sn, Prod: 30 dakika
    },
    // Aynı IP'nin çok sayıda farklı kullanıcı adı denemesini de sınırlar.
    loginIp: {
        windowMs: isTestEnv ? 1000 : 15 * 60 * 1000,
        maxRequests: isTestEnv ? 10000 : 100,
        blockDurationMs: isTestEnv ? 1000 : 30 * 60 * 1000
    },
    // Yazma işlemleri (POST/PUT/DELETE)
    write: {
        windowMs: isTestEnv ? 1000 : 60 * 1000,      // Test: 1sn, Prod: 1 dakika
        maxRequests: isTestEnv ? 10000 : 300,        // Test: 10000, Prod: 300
        blockDurationMs: isTestEnv ? 1000 : 10 * 60 * 1000  // Test: 1sn, Prod: 10 dakika
    },
    // QR Ziyaretçi ve SGK kayıt limitleri (Halk açık form)
    qrPublic: {
        windowMs: isTestEnv ? 1000 : 15 * 60 * 1000, // Test: 1sn, Prod: 15 dakika
        maxRequests: isTestEnv ? 10000 : 15,          // Test: 10000, Prod: 15 istek (IP başına)
        blockDurationMs: isTestEnv ? 1000 : 15 * 60 * 1000 // Test: 1sn, Prod: 15 dakika
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
const getRateLimitKey = (identifier: string, type: string): string => {
    return `${type}:${identifier}`;
};

const getLoginCredentialIdentifier = (req: Request, ip: string): string => {
    const username = typeof req.body?.username === 'string'
        ? req.body.username.trim().toLocaleLowerCase('tr-TR').slice(0, 100)
        : 'invalid';
    const usernameHash = crypto.createHash('sha256').update(username).digest('hex').slice(0, 24);
    return `${ip}:${usernameHash}`;
};

/**
 * IP adresini güvenli şekilde al
 */
export const getClientIp = (req: Request): string => {
    // Express resolves trusted proxy headers according to the configured proxy hops.
    // Never read X-Forwarded-For directly because a client can forge it.
    const rawIp = req.ip || req.socket.remoteAddress || '';
    const withoutBrackets = rawIp.replace(/^\[|\]$/g, '');
    const normalizedIp = withoutBrackets.startsWith('::ffff:')
        ? withoutBrackets.slice(7)
        : withoutBrackets;

    return net.isIP(normalizedIp) ? normalizedIp : 'unknown';
};

/**
 * Rate limit kontrolü
 */
const checkRateLimit = (
    identifier: string,
    type: keyof typeof RATE_LIMIT_CONFIG
): { allowed: boolean; retryAfter?: number; remaining?: number } => {
    const config = RATE_LIMIT_CONFIG[type];
    const key = getRateLimitKey(identifier, type);
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
    const credentialIdentifier = getLoginCredentialIdentifier(req, ip);
    const ipResult = checkRateLimit(ip, 'loginIp');
    const credentialResult = checkRateLimit(credentialIdentifier, 'login');
    const result = !ipResult.allowed ? ipResult : credentialResult;

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
            message: 'Çok fazla giriş denemesi. Lütfen daha sonra tekrar deneyin.',
            retryAfter: result.retryAfter
        });
        return;
    }

    // Başarılı girişler aynı kullanıcı için kaba kuvvet sayacını temizler;
    // IP toplam sayacı farklı hesaplara yönelik taramayı engellemek için korunur.
    res.once('finish', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            rateLimitStore.delete(getRateLimitKey(credentialIdentifier, 'login'));
        }
    });

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
 * QR Ziyaretçi ve SGK kayıtları için rate limiting middleware (Halka açık uçlar)
 */
export const qrPublicRateLimiter = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const ip = getClientIp(req);
    const result = checkRateLimit(ip, 'qrPublic');

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_CONFIG.qrPublic.maxRequests);
    if (result.remaining !== undefined) {
        res.setHeader('X-RateLimit-Remaining', result.remaining);
    }

    if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter || 900);
        res.status(429).json({
            success: false,
            message: 'Çok fazla form isteği gönderildi. Lütfen bir süre sonra tekrar deneyin.',
            retryAfter: result.retryAfter
        });
        return;
    }

    next();
};

/**
 * Başarısız giriş denemesi kaydet (login controller'dan çağrılır)
 */
export const recordFailedLogin = (ip: string, username = 'invalid'): void => {
    const normalized = username.trim().toLocaleLowerCase('tr-TR').slice(0, 100);
    const usernameHash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24);
    const key = getRateLimitKey(`${ip}:${usernameHash}`, 'login');
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
export const clearLoginAttempts = (ip: string, username = 'invalid'): void => {
    const normalized = username.trim().toLocaleLowerCase('tr-TR').slice(0, 100);
    const usernameHash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 24);
    const key = getRateLimitKey(`${ip}:${usernameHash}`, 'login');
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
    qrPublicRateLimiter,
    recordFailedLogin,
    clearLoginAttempts,
    isIpBlocked,
    getClientIp
};
