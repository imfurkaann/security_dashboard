import { Request, Response } from 'express';
import pool from '../config/database';

/**
 * Search active frequent visitors by full_name (Personnel & Admin)
 * GET /api/predefined-visitors/search
 */
export const searchPredefinedVisitors = async (req: Request, res: Response): Promise<void> => {
    try {
        const { q } = req.query;

        if (!q || typeof q !== 'string' || q.trim().length === 0) {
            res.status(200).json({ success: true, data: [] });
            return;
        }

        // EDRF (Exponentially Decayed Recency-Frequency) scoring query.
        // Calculates score = SUM(EXP(-0.05 * (CURRENT_DATE - entry_date))) for matching visitors.
        // Filters by name first using the functional index to maximize performance.
        const searchQuery = `
            WITH visitor_scores AS (
                SELECT 
                    LOWER(TRIM(full_name)) as normalized_name,
                    SUM(EXP(-0.05 * (CURRENT_DATE - entry_date))) as score,
                    (array_agg(id ORDER BY entry_date DESC, entry_time DESC))[1] as latest_record_id
                FROM visitor_records
                WHERE deleted_at IS NULL 
                  AND entry_date >= CURRENT_DATE - INTERVAL '90 days'
                  AND full_name IS NOT NULL AND TRIM(full_name) != ''
                  AND LOWER(translate(full_name, 'IİĞÜŞÖÇ', 'ıiğüşöç')) LIKE LOWER(translate($1, 'IİĞÜŞÖÇ', 'ıiğüşöç'))
                GROUP BY LOWER(TRIM(full_name))
                HAVING SUM(EXP(-0.05 * (CURRENT_DATE - entry_date))) >= 0.5
            )
            SELECT 
                vr.id,
                vr.full_name,
                vr.company_name,
                vr.phone,
                vr.vehicle_plate,
                vr.visiting_person,
                vr.notes,
                vr.highlight_color,
                vr.subcontractor_worker,
                vr.for_electric_station,
                vr.daily_guest,
                vr.entry_tag,
                vr.exit_tag,
                vr.tour_entry,
                vr.tour_exit,
                vr.meeting,
                vr.delivery,
                s.score
            FROM visitor_scores s
            JOIN visitor_records vr ON s.latest_record_id = vr.id
            ORDER BY s.score DESC
            LIMIT 10
        `;

        const result = await pool.query(searchQuery, [`%${q.trim()}%`]);

        const decodeStoredHtmlEntities = (value: string | null | undefined): string | null => {
            if (value === null || value === undefined) return null;
            return String(value)
                .replace(/&#x2F;/g, '/')
                .replace(/&#x27;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&gt;/g, '>')
                .replace(/&lt;/g, '<')
                .replace(/&amp;/g, '&');
        };

        const formattedData = result.rows.map((row: any) => ({
            id: row.id,
            full_name: decodeStoredHtmlEntities(row.full_name),
            company_name: decodeStoredHtmlEntities(row.company_name),
            phone: row.phone,
            vehicle_plate: row.vehicle_plate,
            visiting_person: decodeStoredHtmlEntities(row.visiting_person),
            notes: decodeStoredHtmlEntities(row.notes),
            subcontractor_worker: row.subcontractor_worker,
            for_electric_station: row.for_electric_station,
            daily_guest: row.daily_guest,
            entry_tag: row.entry_tag,
            exit_tag: row.exit_tag,
            tour_entry: row.tour_entry,
            tour_exit: row.tour_exit,
            meeting: row.meeting,
            delivery: row.delivery,
            score: Number(row.score)
        }));

        res.status(200).json({
            success: true,
            data: formattedData
        });
    } catch (error) {
        console.error('Search predefined visitors error:', error);
        res.status(500).json({ success: false, message: 'Ziyaretçi araması sırasında hata oluştu' });
    }
};
