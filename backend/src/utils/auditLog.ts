/**
 * Audit Log Service
 * GÜVENLİK: Tüm kritik veritabanı işlemlerini kaydeder
 * 
 * Audit logging güvenli varsayılan olarak açıktır. Yalnızca açıkça
 * AUDIT_LOG_ENABLED=false verilirse kapatılır.
 */
import pool from '../config/database';

/**
 * Audit log action türleri
 */
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE' | 'LOGIN' | 'LOGOUT' | 'FAILED_LOGIN';

/**
 * Audit log girişi tipi
 */
export interface AuditLogEntry {
    tableName: string;
    recordId: string;
    action: AuditAction;
    oldValues?: Record<string, unknown> | null;
    newValues?: Record<string, unknown> | null;
    performedBy: string | null;
    ipAddress: string | null;
    userAgent?: string | null;
    additionalInfo?: Record<string, unknown> | null;
}

/**
 * Audit log kaydı oluştur
 * GÜVENLİK: Bu fonksiyon asenkron olarak çalışır, ana işlemi bloklamamalı
 * 
 */
export const createAuditLog = async (entry: AuditLogEntry): Promise<void> => {
    const authAuditEnabled = process.env.AUTH_AUDIT_LOG_ENABLED === 'true';
    const guestRegistryAuditEnabled = process.env.GUEST_REGISTRY_AUDIT_LOG_ENABLED === 'true';
    const fullAuditEnabled = process.env.AUDIT_LOG_ENABLED !== 'false';
    const isAuthAudit = authAuditEnabled && entry.tableName === 'auth';
    const isGuestRegistryAudit = guestRegistryAuditEnabled && entry.tableName === 'misafir_kayitlari';
    if (!fullAuditEnabled && !isAuthAudit && !isGuestRegistryAudit) {
        return;
    }

    try {
        const newValues = entry.additionalInfo
            ? { ...(entry.newValues || {}), additionalInfo: entry.additionalInfo }
            : entry.newValues;

        await pool.query(
            `INSERT INTO audit_log (
                table_name, record_id, action, old_values, new_values,
                changed_by, ip_address, user_agent
            ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)`,
            [
                entry.tableName,
                entry.recordId,
                entry.action,
                JSON.stringify(maskSensitiveData(entry.oldValues)),
                JSON.stringify(maskSensitiveData(newValues)),
                entry.performedBy,
                entry.ipAddress,
                entry.userAgent || null
            ]
        );
    } catch (error) {
        console.error('Audit log yazılamadı:', error instanceof Error ? error.message : 'Bilinmeyen hata');
    }
};

/**
 * Hassas verileri maskele
 * GÜVENLİK: Şifre, token gibi hassas veriler loglanmamalı
 */
const maskSensitiveData = (
    data: Record<string, unknown> | null | undefined
): Record<string, unknown> | null => {
    if (!data) return null;

    const sensitiveFields = [
        'password',
        'password_hash',
        'token',
        'refresh_token',
        'access_token',
        'secret',
        'api_key',
        'credit_card',
        'ssn',
        'tc_kimlik'
    ];

    const masked = { ...data };

    for (const field of sensitiveFields) {
        if (field in masked) {
            masked[field] = '***MASKED***';
        }
    }

    return masked;
};

/**
 * Login audit log kaydı
 */
export const logLoginAttempt = async (
    userId: string | null,
    username: string,
    success: boolean,
    ipAddress: string | null,
    userAgent: string | null
): Promise<void> => {
    await createAuditLog({
        tableName: 'auth',
        recordId: userId || 'anonymous',
        action: success ? 'LOGIN' : 'FAILED_LOGIN',
        oldValues: null,
        newValues: {
            username,
            success,
            timestamp: new Date().toISOString()
        },
        performedBy: userId,
        ipAddress,
        userAgent
    });
};

/**
 * Logout audit log kaydı
 */
export const logLogout = async (
    userId: string,
    ipAddress: string | null
): Promise<void> => {
    await createAuditLog({
        tableName: 'auth',
        recordId: userId,
        action: 'LOGOUT',
        oldValues: null,
        newValues: {
            timestamp: new Date().toISOString()
        },
        performedBy: userId,
        ipAddress
    });
};

/**
 * Veri değişikliği audit log kaydı
 */
export const logDataChange = async (
    tableName: string,
    recordId: string,
    action: 'INSERT' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE',
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown> | null,
    performedBy: string | null,
    ipAddress: string | null
): Promise<void> => {
    await createAuditLog({
        tableName,
        recordId,
        action,
        oldValues,
        newValues,
        performedBy,
        ipAddress
    });
};

/**
 * Belirli bir kayıt için audit geçmişini getir
 * DEAKTIF: Audit logging devre dışı olduğundan her zaman boş array döner
 */
export const getAuditHistory = async (
    tableName: string,
    recordId: string
): Promise<AuditLogEntry[]> => {
    // Audit logging deaktif - geçmiş yoktur
    return [];
};

/**
 * Belirli bir kullanıcının son aktivitelerini getir
 * DEAKTIF: Audit logging devre dışı olduğundan her zaman boş array döner
 */
export const getUserActivity = async (
    userId: string,
    limit: number = 50
): Promise<AuditLogEntry[]> => {
    // Audit logging deaktif - aktivite yoktur
    return [];
};

export default {
    createAuditLog,
    logLoginAttempt,
    logLogout,
    logDataChange,
    getAuditHistory,
    getUserActivity
};
