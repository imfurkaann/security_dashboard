import pool from '../config/database';

export interface SessionIdentity {
    userId: string;
    personnelRecordId?: number;
}

export interface ActiveSessionUser {
    username: string;
    role: string;
}

/**
 * JWT imzası tek başına yeterli değildir. Her istek, token'ın temsil ettiği
 * oturumun hâlâ açık olduğunu ve kullanıcının etkin kaldığını doğrular.
 */
export const getActiveSessionUser = async (
    identity: SessionIdentity
): Promise<ActiveSessionUser | null> => {
    if (!identity.userId || !identity.personnelRecordId) return null;

    const result = await pool.query<ActiveSessionUser>(
        `SELECT p.username, p.role
         FROM personnel p
         INNER JOIN personnel_records pr
            ON pr.id = $2
           AND pr.personnel_id = p.id
           AND pr.logout_time IS NULL
         WHERE p.id = $1
           AND p.deleted_at IS NULL
           AND p.is_active = TRUE`,
        [identity.userId, identity.personnelRecordId]
    );

    return result.rows.length === 1 ? result.rows[0] : null;
};

