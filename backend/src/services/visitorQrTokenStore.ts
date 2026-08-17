import crypto from 'crypto';
import pool from '../config/database';

const TOKEN_TTL_MS = 3 * 60 * 1000;
const MIN_FILL_MS = 1500;
const hashToken = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

export const issueQrFormToken = async (ip: string): Promise<{ token: string; expiresInSeconds: number }> => {
    // Düzenli kullanılan sistemlerde tabloyu sınırsız büyütmeden temizle. Bu
    // işlem güvenlik kararının parçası değildir; başarısız olsa da yeni anahtar
    // üretimi ayrı sorguda güvenle devam eder.
    if (crypto.randomInt(100) === 0) {
        pool.query(
            `DELETE FROM qr_form_tokens
             WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '1 day'
                OR consumed_at < CURRENT_TIMESTAMP - INTERVAL '1 day'`
        ).catch((error) => console.warn('QR token cleanup failed:', error instanceof Error ? error.message : 'unknown'));
    }

    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
        `INSERT INTO qr_form_tokens (token_hash, requester_ip, expires_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP + ($3 * INTERVAL '1 millisecond'))`,
        [hashToken(token), ip.slice(0, 64), TOKEN_TTL_MS]
    );

    return {
        token,
        expiresInSeconds: Math.floor(TOKEN_TTL_MS / 1000)
    };
};

export const consumeQrFormToken = async (
    token: string,
    ip: string
): Promise<{ isValid: boolean; reason?: 'missing' | 'invalid' | 'expired' | 'already-used' | 'too-fast' | 'ip-mismatch' }> => {
    if (!token || typeof token !== 'string' || token.length < 20) {
        return { isValid: false, reason: 'invalid' };
    }

    const tokenHash = hashToken(token);
    const consumed = await pool.query(
        `UPDATE qr_form_tokens
         SET consumed_at = CURRENT_TIMESTAMP
         WHERE token_hash = $1
           AND requester_ip = $2
           AND consumed_at IS NULL
           AND expires_at > CURRENT_TIMESTAMP
           AND issued_at <= CURRENT_TIMESTAMP - ($3 * INTERVAL '1 millisecond')
         RETURNING token_hash`,
        [tokenHash, ip.slice(0, 64), MIN_FILL_MS]
    );

    if (consumed.rowCount === 1) return { isValid: true };

    // Bu sorgu yalnızca kullanıcıya uygun bir yeniden-deneme mesajı seçmek
    // içindir. Güvenlik kararı yukarıdaki tek atomik UPDATE ile verilmiştir.
    const existing = await pool.query<{
        requester_ip: string;
        issued_at: Date;
        expires_at: Date;
        consumed_at: Date | null;
    }>(
        `SELECT requester_ip, issued_at, expires_at, consumed_at
         FROM qr_form_tokens
         WHERE token_hash = $1`,
        [tokenHash]
    );

    if (existing.rows.length === 0) return { isValid: false, reason: 'missing' };
    const record = existing.rows[0];
    const now = Date.now();
    if (record.consumed_at) return { isValid: false, reason: 'already-used' };
    if (new Date(record.expires_at).getTime() <= now) return { isValid: false, reason: 'expired' };
    if (record.requester_ip !== ip.slice(0, 64)) return { isValid: false, reason: 'ip-mismatch' };
    if (now - new Date(record.issued_at).getTime() < MIN_FILL_MS) return { isValid: false, reason: 'too-fast' };
    return { isValid: false, reason: 'invalid' };
};
