/**
 * Database Security Configuration
 * GÜVENLİK: Veritabanı güvenlik ayarları ve yardımcı fonksiyonlar
 */

import pool from './database';

/**
 * Veritabanı bağlantı güvenlik ayarları
 */
export const DB_SECURITY_CONFIG = {
    // Maksimum sorgu süresi (ms) - DoS koruması
    statementTimeout: 30000, // 30 saniye

    // Maksimum satır sayısı - Memory overflow koruması
    maxRowsPerQuery: 10000,

    // Bağlantı başına maksimum sorgu sayısı
    maxQueriesPerConnection: 1000,

    // Transaction timeout (ms)
    transactionTimeout: 60000, // 1 dakika

    // Idle transaction timeout (ms)
    idleInTransactionTimeout: 30000, // 30 saniye
};

/**
 * Güvenli sorgu çalıştırıcı - timeout ve hata yakalama ile
 */
export const safeQuery = async <T = unknown>(
    query: string,
    params: unknown[] = [],
    options: { timeout?: number; maxRows?: number } = {}
): Promise<{ rows: T[]; rowCount: number }> => {
    const client = await pool.connect();

    try {
        // Statement timeout ayarla
        const timeout = options.timeout || DB_SECURITY_CONFIG.statementTimeout;
        await client.query(`SET statement_timeout = ${timeout}`);

        // Sorguyu çalıştır
        const result = await client.query(query, params);

        // Maksimum satır kontrolü
        const maxRows = options.maxRows || DB_SECURITY_CONFIG.maxRowsPerQuery;
        if (result.rows.length > maxRows) {
            console.warn(`Query returned ${result.rows.length} rows, truncating to ${maxRows}`);
            result.rows = result.rows.slice(0, maxRows);
        }

        return {
            rows: result.rows as T[],
            rowCount: result.rowCount || 0
        };
    } finally {
        client.release();
    }
};

/**
 * Güvenli transaction çalıştırıcı
 */
export const safeTransaction = async <T>(
    callback: (client: typeof pool) => Promise<T>
): Promise<T> => {
    const client = await pool.connect();

    try {
        // Transaction timeout ayarla
        await client.query(`SET idle_in_transaction_session_timeout = ${DB_SECURITY_CONFIG.idleInTransactionTimeout}`);

        await client.query('BEGIN');

        const result = await callback(client as unknown as typeof pool);

        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Parametreli sorgu oluşturucu - SQL injection koruması
 * Dikkat: Bu fonksiyon sadece güvenilir kolon isimlerini kabul eder
 */
export const buildSafeQuery = (
    table: string,
    columns: string[],
    conditions: { column: string; operator: string; paramIndex: number }[]
): string => {
    // Tablo ve kolon isimlerini doğrula (sadece alfanumerik ve alt çizgi)
    const safeNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

    if (!safeNameRegex.test(table)) {
        throw new Error('Geçersiz tablo adı');
    }

    for (const col of columns) {
        if (!safeNameRegex.test(col)) {
            throw new Error(`Geçersiz kolon adı: ${col}`);
        }
    }

    // Güvenli operatörler
    const safeOperators = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'ILIKE', 'IS NULL', 'IS NOT NULL', 'IN'];

    for (const cond of conditions) {
        if (!safeNameRegex.test(cond.column)) {
            throw new Error(`Geçersiz koşul kolonu: ${cond.column}`);
        }
        if (!safeOperators.includes(cond.operator.toUpperCase())) {
            throw new Error(`Geçersiz operatör: ${cond.operator}`);
        }
    }

    // Sorguyu oluştur
    const columnList = columns.join(', ');
    const whereClause = conditions
        .map(c => `${c.column} ${c.operator} $${c.paramIndex}`)
        .join(' AND ');

    return `SELECT ${columnList} FROM ${table}${whereClause ? ' WHERE ' + whereClause : ''}`;
};

/**
 * Hassas veri maskeleme
 */
export const maskSensitiveColumns = <T extends Record<string, unknown>>(
    row: T,
    sensitiveColumns: string[] = ['password', 'password_hash', 'tc_kimlik', 'credit_card']
): Record<string, unknown> => {
    const masked: Record<string, unknown> = { ...row };

    for (const col of sensitiveColumns) {
        if (col in masked) {
            masked[col] = '***MASKED***';
        }
    }

    return masked;
};

/**
 * Veritabanı sağlık kontrolü
 */
export const checkDatabaseHealth = async (): Promise<{
    connected: boolean;
    latency: number;
    poolStats: {
        total: number;
        idle: number;
        waiting: number;
    };
}> => {
    const startTime = Date.now();

    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();

        const latency = Date.now() - startTime;

        return {
            connected: true,
            latency,
            poolStats: {
                total: pool.totalCount,
                idle: pool.idleCount,
                waiting: pool.waitingCount
            }
        };
    } catch (error) {
        return {
            connected: false,
            latency: -1,
            poolStats: {
                total: 0,
                idle: 0,
                waiting: 0
            }
        };
    }
};

/**
 * SQL Injection tehlikeli pattern kontrolü
 */
export const containsSqlInjectionPattern = (input: string): boolean => {
    const dangerousPatterns = [
        /('|(\\')|(;)|(--)|(\*\/)|(\/\*))/gi,
        /(union\s+select)/gi,
        /(drop\s+table)/gi,
        /(delete\s+from)/gi,
        /(insert\s+into)/gi,
        /(update\s+\w+\s+set)/gi,
        /(exec\s*\()/gi,
        /(execute\s*\()/gi,
        /(xp_)/gi,
        /(0x[0-9a-fA-F]+)/gi
    ];

    return dangerousPatterns.some(pattern => pattern.test(input));
};

export default {
    DB_SECURITY_CONFIG,
    safeQuery,
    safeTransaction,
    buildSafeQuery,
    maskSensitiveColumns,
    checkDatabaseHealth,
    containsSqlInjectionPattern
};
