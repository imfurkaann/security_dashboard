/**
 * Audit Log Service
 * GÜVENLİK: Tüm kritik veritabanı işlemlerini kaydeder
 * 
 * DURUM: Audit logging şu anda DEAKTIF durumdadır.
 * Herhangi bir log kaydı tutulmamaktadır.
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
 * DEAKTIF DURUM: Audit logging şu anda devre dışı bırakılmıştır.
 * Herhangi bir log kaydı tutulmamaktadır.
 */
export const createAuditLog = async (entry: AuditLogEntry): Promise<void> => {
    // Audit logging deaktif - veri tabanına yazma yapılmaz
    return;
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
