/**
 * Audit Log Service
 * GÜVENLİK: Tüm kritik veritabanı işlemlerini kaydeder
 */
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';

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
 */
export const createAuditLog = async (entry: AuditLogEntry): Promise<void> => {
    try {
        const id = uuidv4();

        // Hassas verileri maskeleme
        const sanitizedOldValues = maskSensitiveData(entry.oldValues);
        const sanitizedNewValues = maskSensitiveData(entry.newValues);

        // Schema'ya uygun kolon isimleri: changed_by, changed_at
        await pool.query(
            `INSERT INTO audit_log (
                id, table_name, record_id, action, 
                old_values, new_values, changed_by, 
                ip_address, changed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
            [
                id,
                entry.tableName,
                entry.recordId,
                entry.action,
                sanitizedOldValues ? JSON.stringify(sanitizedOldValues) : null,
                sanitizedNewValues ? JSON.stringify(sanitizedNewValues) : null,
                entry.performedBy,
                entry.ipAddress
            ]
        );
    } catch (error) {
        // Audit log hatası ana işlemi durdurmak
        // Sadece konsola yaz ve devam et
        console.error('Audit log kayıt hatası:', error instanceof Error ? error.message : error);
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
 */
export const getAuditHistory = async (
    tableName: string,
    recordId: string
): Promise<AuditLogEntry[]> => {
    const result = await pool.query(
        `SELECT 
            table_name as "tableName",
            record_id as "recordId",
            action,
            old_values as "oldValues",
            new_values as "newValues",
            changed_by as "performedBy",
            ip_address as "ipAddress",
            changed_at as "createdAt"
        FROM audit_log 
        WHERE table_name = $1 AND record_id = $2 
        ORDER BY changed_at DESC
        LIMIT 100`,
        [tableName, recordId]
    );

    return result.rows;
};

/**
 * Belirli bir kullanıcının son aktivitelerini getir
 */
export const getUserActivity = async (
    userId: string,
    limit: number = 50
): Promise<AuditLogEntry[]> => {
    const result = await pool.query(
        `SELECT 
            table_name as "tableName",
            record_id as "recordId",
            action,
            old_values as "oldValues",
            new_values as "newValues",
            changed_by as "performedBy",
            ip_address as "ipAddress",
            changed_at as "createdAt"
        FROM audit_log 
        WHERE changed_by = $1 
        ORDER BY changed_at DESC
        LIMIT $2`,
        [userId, limit]
    );

    return result.rows;
};

export default {
    createAuditLog,
    logLoginAttempt,
    logLogout,
    logDataChange,
    getAuditHistory,
    getUserActivity
};
