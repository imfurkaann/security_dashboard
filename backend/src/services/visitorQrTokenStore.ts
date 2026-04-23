import crypto from 'crypto';

interface QrFormTokenRecord {
    issuedAt: number;
    expiresAt: number;
    consumed: boolean;
    ip: string;
}

const TOKEN_TTL_MS = 3 * 60 * 1000;
const MIN_FILL_MS = 1500;
const tokenStore = new Map<string, QrFormTokenRecord>();

const cleanupExpiredTokens = (): void => {
    const now = Date.now();
    for (const [token, record] of tokenStore.entries()) {
        if (record.expiresAt <= now || record.consumed) {
            tokenStore.delete(token);
        }
    }
};

const cleanupInterval = setInterval(cleanupExpiredTokens, 60 * 1000);
cleanupInterval.unref?.();

export const issueQrFormToken = (ip: string): { token: string; expiresInSeconds: number } => {
    cleanupExpiredTokens();

    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    tokenStore.set(token, {
        issuedAt: now,
        expiresAt: now + TOKEN_TTL_MS,
        consumed: false,
        ip
    });

    return {
        token,
        expiresInSeconds: Math.floor(TOKEN_TTL_MS / 1000)
    };
};

export const consumeQrFormToken = (
    token: string,
    ip: string
): { isValid: boolean; reason?: 'missing' | 'invalid' | 'expired' | 'already-used' | 'too-fast' | 'ip-mismatch' } => {
    if (!token || typeof token !== 'string' || token.length < 20) {
        return { isValid: false, reason: 'invalid' };
    }

    const record = tokenStore.get(token);
    if (!record) {
        return { isValid: false, reason: 'missing' };
    }

    const now = Date.now();
    if (record.consumed) {
        return { isValid: false, reason: 'already-used' };
    }

    if (record.expiresAt <= now) {
        tokenStore.delete(token);
        return { isValid: false, reason: 'expired' };
    }

    if (record.ip !== ip) {
        return { isValid: false, reason: 'ip-mismatch' };
    }

    if (now - record.issuedAt < MIN_FILL_MS) {
        return { isValid: false, reason: 'too-fast' };
    }

    record.consumed = true;
    tokenStore.set(token, record);

    return { isValid: true };
};
