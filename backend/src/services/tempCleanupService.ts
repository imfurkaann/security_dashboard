import pool from '../config/database';
import { deleteFile } from '../utils/fileUpload';
import { logDataChange } from '../utils/auditLog';
import { emitApiMutation, resolveMutationTopics } from '../realtime/socket';

/**
 * Periodically cleans up expired pending QR SGK records (older than 24 hours).
 * It changes their status to 'rejected', deletes their physical files from disk, and sends a realtime update.
 */
export const cleanupExpiredPendingSgkRecords = async (): Promise<void> => {
    const client = await pool.connect();
    try {
        // Find pending QR SGK records older than 24 hours
        const findQuery = `
            SELECT id, full_name, company_name 
            FROM pending_qr_sgk 
            WHERE status = 'pending' 
              AND created_at < NOW() - INTERVAL '24 hours'
        `;
        const expiredRecords = await client.query(findQuery);
        
        if (expiredRecords.rows.length === 0) {
            return;
        }

        console.log(`[TempCleanupService] Found ${expiredRecords.rows.length} expired pending SGK records. Starting cleanup...`);

        for (const record of expiredRecords.rows) {
            const { id } = record;

            // Start transaction for this record's cleanup
            await client.query('BEGIN');

            // Get all files associated with this record
            const filesQuery = `
                SELECT stored_file_name 
                FROM pending_qr_sgk_files 
                WHERE pending_sgk_id = $1
            `;
            const filesResult = await client.query(filesQuery, [id]);
            const fileNames = filesResult.rows.map((row: any) => row.stored_file_name);

            // Update status to rejected
            await client.query(
                `UPDATE pending_qr_sgk SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
                [id]
            );

            await client.query('COMMIT');

            // Delete physical files from disk
            for (const fileName of fileNames) {
                try {
                    deleteFile(fileName);
                    console.log(`[TempCleanupService] Deleted expired file: ${fileName}`);
                } catch (err) {
                    console.error(`[TempCleanupService] Error deleting physical file ${fileName}:`, err);
                }
            }

            // Log the change
            try {
                await logDataChange(
                    'pending_qr_sgk',
                    id,
                    'UPDATE',
                    { status: 'pending' },
                    { status: 'rejected', reason: 'expired_24h' },
                    null, // System action, no personnel_id
                    '127.0.0.1'
                );
            } catch (auditError) {
                console.error('[TempCleanupService] Failed to write audit log:', auditError);
            }

            // Emit socket event to notify operators' dashboards to remove from queue
            emitApiMutation({
                method: 'POST',
                path: '/api/sgk/pending-qr',
                statusCode: 200,
                timestamp: new Date().toISOString(),
                clientId: null,
                topics: resolveMutationTopics('/api/sgk/records'),
                payload: { id, status: 'rejected' }
            });
        }

        console.log(`[TempCleanupService] Completed cleanup of ${expiredRecords.rows.length} expired SGK records.`);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[TempCleanupService] Error during expired SGK records cleanup:', error);
    } finally {
        client.release();
    }
};

/**
 * Periodically cleans up expired pending QR visitor records (older than 24 hours).
 * It changes their status to 'rejected' and sends a realtime update.
 */
export const cleanupExpiredPendingVisitorRecords = async (): Promise<void> => {
    try {
        const findQuery = `
            SELECT id 
            FROM pending_qr_visitors 
            WHERE status = 'pending' 
              AND created_at < NOW() - INTERVAL '24 hours'
        `;
        const expiredRecords = await pool.query(findQuery);
        
        if (expiredRecords.rows.length === 0) {
            return;
        }

        console.log(`[TempCleanupService] Found ${expiredRecords.rows.length} expired pending visitor records. Starting cleanup...`);

        for (const record of expiredRecords.rows) {
            const { id } = record;

            await pool.query(
                `UPDATE pending_qr_visitors SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
                [id]
            );

            // Log the change
            try {
                await logDataChange(
                    'pending_qr_visitors',
                    id,
                    'UPDATE',
                    { status: 'pending' },
                    { status: 'rejected', reason: 'expired_24h' },
                    null,
                    '127.0.0.1'
                );
            } catch (auditError) {
                console.error('[TempCleanupService] Failed to write visitor audit log:', auditError);
            }

            // Emit socket event to notify operators' dashboards to remove from queue
            emitApiMutation({
                method: 'POST',
                path: '/api/visitors/pending-qr',
                statusCode: 200,
                timestamp: new Date().toISOString(),
                clientId: null,
                topics: resolveMutationTopics('/api/visitors/records'),
                payload: { id, status: 'rejected' }
            });
        }

        console.log(`[TempCleanupService] Completed cleanup of ${expiredRecords.rows.length} expired visitor records.`);
    } catch (error) {
        console.error('[TempCleanupService] Error during expired visitor records cleanup:', error);
    }
};

/**
 * Initializes the background periodic cleanup service.
 * Runs once immediately on start, then every hour.
 */
export const initTempCleanupService = (): void => {
    console.log('[TempCleanupService] Initializing temporary file and record cleanup task...');
    
    // Run immediately on startup
    cleanupExpiredPendingSgkRecords();
    cleanupExpiredPendingVisitorRecords();

    // Run every hour (60 minutes * 60 seconds * 1000 ms)
    const intervalMs = 60 * 60 * 1000;
    setInterval(() => {
        cleanupExpiredPendingSgkRecords();
        cleanupExpiredPendingVisitorRecords();
    }, intervalMs);
};
