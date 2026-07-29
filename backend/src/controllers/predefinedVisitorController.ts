import { Request, Response } from 'express';
import pool from '../config/database';

type VisitorSuggestionField = 'full_name' | 'company_name' | 'vehicle_plate';

const SEARCH_EXPRESSIONS: Record<VisitorSuggestionField, string> = {
    full_name: `LOWER(translate(vr.full_name, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`,
    company_name: `LOWER(translate(vr.company_name, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`,
    vehicle_plate: `LOWER(translate(vr.vehicle_plate, 'IİĞÜŞÖÇ', 'ıiğüşöç'))`
};

// Git geçmişindeki özgün EDRF (Exponentially Decayed Recency-Frequency) ayarları.
// Her giriş ayrı sayılır; aynı gün içindeki tekrarlar da sıklık puanını artırır.
const VISITOR_HEAT_CONFIG = Object.freeze({
    scoringWindowDays: 90,
    decayRate: 0.05,
    minimumHeatScore: 0.5,
    resultLimit: 10
});

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

/**
 * Search frequent visitors with the original recency-frequency heat algorithm.
 * Every matching entry contributes to the score, including multiple entries on
 * the same day. Recent entries contribute more; old occasional entries decay.
 * GET /api/predefined-visitors/search
 */
export const searchPredefinedVisitors = async (req: Request, res: Response): Promise<void> => {
    try {
        const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const requestedField = typeof req.query.field === 'string' ? req.query.field : 'full_name';

        if (rawQuery.length < 2) {
            res.status(200).json({ success: true, data: [] });
            return;
        }

        if (rawQuery.length > 100) {
            res.status(400).json({ success: false, message: 'Arama metni en fazla 100 karakter olabilir' });
            return;
        }

        if (!Object.prototype.hasOwnProperty.call(SEARCH_EXPRESSIONS, requestedField)) {
            res.status(400).json({ success: false, message: 'Geçersiz arama alanı' });
            return;
        }

        const searchField = requestedField as VisitorSuggestionField;
        const searchExpression = SEARCH_EXPRESSIONS[searchField];
        const escapedQuery = rawQuery.replace(/[\\%_]/g, '\\$&');
        const searchPattern = `%${escapedQuery}%`;

        // Özgün sorgu davranışı korunur: isim bazında gruplanır, her kayıt puana
        // eklenir ve formu doldurmak için en güncel eşleşen kayıt döndürülür.
        const searchQuery = `
            WITH visitor_scores AS (
                SELECT
                    LOWER(TRIM(vr.full_name)) AS normalized_name,
                    SUM(EXP(-$4::double precision * (CURRENT_DATE - vr.entry_date))) AS score,
                    COUNT(*) AS visit_count,
                    (ARRAY_AGG(
                        vr.id
                        ORDER BY vr.entry_date DESC, vr.entry_time DESC, vr.created_at DESC, vr.id DESC
                    ))[1] AS latest_record_id
                FROM visitor_records vr
                WHERE vr.deleted_at IS NULL
                  AND vr.entry_date >= CURRENT_DATE - ($3::int - 1)
                  AND vr.full_name IS NOT NULL
                  AND TRIM(vr.full_name) != ''
                  AND ${searchExpression} LIKE LOWER(translate($2, 'IİĞÜŞÖÇ', 'ıiğüşöç')) ESCAPE '\\'
                GROUP BY LOWER(TRIM(vr.full_name))
                HAVING SUM(EXP(-$4::double precision * (CURRENT_DATE - vr.entry_date))) >= $5::double precision
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
                s.visit_count,
                ROUND(s.score::numeric, 3) AS heat_score,
                CASE
                    WHEN ${searchExpression} = LOWER(translate($1, 'IİĞÜŞÖÇ', 'ıiğüşöç')) THEN 0
                    WHEN ${searchExpression} LIKE LOWER(translate($1, 'IİĞÜŞÖÇ', 'ıiğüşöç')) || '%' THEN 1
                    ELSE 2
                END AS match_rank
            FROM visitor_scores s
            JOIN visitor_records vr ON vr.id = s.latest_record_id
            ORDER BY match_rank ASC, s.score DESC, vr.entry_date DESC, vr.entry_time DESC, vr.id DESC
            LIMIT $6::int
        `;

        const result = await pool.query(searchQuery, [
            rawQuery,
            searchPattern,
            VISITOR_HEAT_CONFIG.scoringWindowDays,
            VISITOR_HEAT_CONFIG.decayRate,
            VISITOR_HEAT_CONFIG.minimumHeatScore,
            VISITOR_HEAT_CONFIG.resultLimit
        ]);

        const formattedData = result.rows.map((row: any) => ({
            id: row.id,
            full_name: decodeStoredHtmlEntities(row.full_name),
            company_name: decodeStoredHtmlEntities(row.company_name),
            phone: row.phone,
            vehicle_plate: row.vehicle_plate,
            visiting_person: decodeStoredHtmlEntities(row.visiting_person),
            notes: decodeStoredHtmlEntities(row.notes),
            highlight_color: row.highlight_color,
            subcontractor_worker: row.subcontractor_worker,
            for_electric_station: row.for_electric_station,
            daily_guest: row.daily_guest,
            entry_tag: row.entry_tag,
            exit_tag: row.exit_tag,
            tour_entry: row.tour_entry,
            tour_exit: row.tour_exit,
            meeting: row.meeting,
            delivery: row.delivery,
            visit_count: Number(row.visit_count),
            score: Number(row.heat_score),
            heat_score: Number(row.heat_score)
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
