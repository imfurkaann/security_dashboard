import pool from '../config/database';

export interface TopPerformerRow {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    totalCount: number;
    rank: number;
}

interface LoginSessionResult {
    personnelRecordId: number;
    weeklyLoginCount: number;
}

/**
 * Creates the personnel session row and updates the weekly counter atomically.
 * A partial login record must not be left behind if either write fails.
 */
export const createLoginSession = async (
    userId: string,
    clientIp: string
): Promise<LoginSessionResult> => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const personnelRecordResult = await client.query<{ id: number }>(
            `INSERT INTO personnel_records (personnel_id, login_time, login_ip)
             VALUES ($1, CURRENT_TIMESTAMP, $2)
             RETURNING id`,
            [userId, clientIp]
        );

        const weeklyCounterResult = await client.query<{ weekly_login_count: number }>(
            `UPDATE personnel
             SET weekly_login_count = CASE
                     WHEN weekly_login_week_start IS DISTINCT FROM date_trunc('week', CURRENT_DATE)::date THEN 1
                     ELSE weekly_login_count + 1
                 END,
                 weekly_login_week_start = date_trunc('week', CURRENT_DATE)::date,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $1
               AND deleted_at IS NULL
               AND is_active = TRUE
             RETURNING weekly_login_count`,
            [userId]
        );

        if (weeklyCounterResult.rows.length !== 1) {
            throw new Error('Active personnel record was not found while creating login session');
        }

        await client.query('COMMIT');

        return {
            personnelRecordId: personnelRecordResult.rows[0].id,
            weeklyLoginCount: Number(weeklyCounterResult.rows[0].weekly_login_count || 0),
        };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

export const getWeeklyTopPerformers = async (): Promise<TopPerformerRow[]> => {
    const rankingResult = await pool.query(
        `WITH period_window AS (
            SELECT
                (date_trunc('week', CURRENT_DATE)::date - INTERVAL '7 day')::date AS start_date,
                date_trunc('week', CURRENT_DATE)::date AS end_date
        ),
        personnel_base AS (
            SELECT p.id, p.first_name, p.last_name, p.username
            FROM personnel p
            WHERE p.deleted_at IS NULL
              AND p.is_active = TRUE
              AND p.role = 'personnel'
        ),
        vehicle_counts AS (
            SELECT vr.given_by AS personnel_id, COUNT(*)::int AS vehicle_count
            FROM vehicle_records vr
            CROSS JOIN period_window pw
            WHERE vr.deleted_at IS NULL
              AND vr.given_by IS NOT NULL
              AND vr.given_date >= pw.start_date
              AND vr.given_date < pw.end_date
            GROUP BY vr.given_by
        ),
        visitor_counts AS (
            SELECT vr.entry_by AS personnel_id, COUNT(*)::int AS visitor_count
            FROM visitor_records vr
            CROSS JOIN period_window pw
            WHERE vr.deleted_at IS NULL
              AND vr.entry_by IS NOT NULL
              AND vr.entry_date >= pw.start_date
              AND vr.entry_date < pw.end_date
            GROUP BY vr.entry_by
        ),
        manager_counts AS (
            SELECT mr.entry_by AS personnel_id, COUNT(*)::int AS manager_count
            FROM managers_records mr
            CROSS JOIN period_window pw
            WHERE mr.deleted_at IS NULL
              AND mr.entry_by IS NOT NULL
              AND mr.entry_date >= pw.start_date
              AND mr.entry_date < pw.end_date
            GROUP BY mr.entry_by
        ),
        fire_alarm_counts AS (
            SELECT fa.recorded_by AS personnel_id, COUNT(*)::int AS fire_alarm_count
            FROM fire_alarms fa
            CROSS JOIN period_window pw
            WHERE fa.deleted_at IS NULL
              AND fa.recorded_by IS NOT NULL
              AND fa.alarm_time::date >= pw.start_date
              AND fa.alarm_time::date < pw.end_date
            GROUP BY fa.recorded_by
        ),
        sgk_counts AS (
            SELECT sr.personnel_id AS personnel_id, COUNT(*)::int AS sgk_count
            FROM sgk_records sr
            CROSS JOIN period_window pw
            WHERE sr.deleted_at IS NULL
              AND sr.personnel_id IS NOT NULL
              AND sr.upload_date::date >= pw.start_date
              AND sr.upload_date::date < pw.end_date
            GROUP BY sr.personnel_id
        ),
        ranked AS (
            SELECT
                pb.id,
                pb.first_name,
                pb.last_name,
                pb.username,
                (
                    COALESCE(vc.vehicle_count, 0)
                    + COALESCE(vic.visitor_count, 0)
                    + COALESCE(mc.manager_count, 0)
                    + COALESCE(fac.fire_alarm_count, 0)
                    + COALESCE(sc.sgk_count, 0)
                )::int AS total_count,
                DENSE_RANK() OVER (
                    ORDER BY
                        (
                            COALESCE(vc.vehicle_count, 0)
                            + COALESCE(vic.visitor_count, 0)
                            + COALESCE(mc.manager_count, 0)
                            + COALESCE(fac.fire_alarm_count, 0)
                            + COALESCE(sc.sgk_count, 0)
                        ) DESC,
                        pb.first_name ASC,
                        pb.last_name ASC
                )::int AS ranking
            FROM personnel_base pb
            LEFT JOIN vehicle_counts vc ON vc.personnel_id = pb.id
            LEFT JOIN visitor_counts vic ON vic.personnel_id = pb.id
            LEFT JOIN manager_counts mc ON mc.personnel_id = pb.id
            LEFT JOIN fire_alarm_counts fac ON fac.personnel_id = pb.id
            LEFT JOIN sgk_counts sc ON sc.personnel_id = pb.id
        )
        SELECT id, first_name, last_name, username, total_count, ranking
        FROM ranked
        WHERE total_count > 0
        ORDER BY ranking ASC, first_name ASC, last_name ASC
        LIMIT 3`
    );

    return rankingResult.rows.map((row) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        username: row.username,
        totalCount: Number(row.total_count),
        rank: Number(row.ranking),
    }));
};
