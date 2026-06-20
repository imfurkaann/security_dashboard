import { Request, Response } from 'express';
import pool from '../config/database';

const resolveDateRange = (query: any) => {
    let start: string;
    let end: string;
    if (query.startDate && query.endDate) {
        start = query.startDate as string;
        end = query.endDate as string;
    } else {
        const days = parseInt(query.days as string) || 30;
        const endObj = new Date();
        const startObj = new Date();
        startObj.setDate(endObj.getDate() - days);
        start = startObj.toISOString().split('T')[0];
        end = endObj.toISOString().split('T')[0];
    }
    return { start, end };
};

// Genel istatistikleri getir
export const getGeneralStats = async (_req: Request, res: Response) => {
    try {
        const client = await pool.connect();

        try {
            const [todayStats, monthStats, activeStats] = await Promise.all([
                // Bugünkü istatistikler
                client.query(`
                    SELECT 
                        (SELECT COALESCE(SUM(COALESCE(person_count, 0) + 1), 0) FROM visitor_records WHERE entry_date = CURRENT_DATE AND deleted_at IS NULL) as today_visitors,
                        (SELECT COUNT(*) FROM vehicle_records WHERE given_date = CURRENT_DATE AND deleted_at IS NULL) as today_vehicles,
                        (SELECT COUNT(*) FROM managers_records WHERE entry_date = CURRENT_DATE AND deleted_at IS NULL) as today_managers,
                        (SELECT COUNT(*) FROM fire_alarms WHERE alarm_time::date = CURRENT_DATE AND deleted_at IS NULL) as today_alarms,
                        (SELECT COUNT(*) FROM incidents WHERE report_date = CURRENT_DATE AND deleted_at IS NULL) as today_incidents
                `),
                // Bu ayki istatistikler
                client.query(`
                    SELECT 
                        (SELECT COALESCE(SUM(COALESCE(person_count, 0) + 1), 0) FROM visitor_records WHERE EXTRACT(MONTH FROM entry_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM entry_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND deleted_at IS NULL) as month_visitors,
                        (SELECT COUNT(*) FROM vehicle_records WHERE EXTRACT(MONTH FROM given_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM given_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND deleted_at IS NULL) as month_vehicles,
                        (SELECT COUNT(*) FROM managers_records WHERE EXTRACT(MONTH FROM entry_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM entry_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND deleted_at IS NULL) as month_managers
                `),
                // Aktif durumlar
                client.query(`
                    SELECT 
                        (SELECT COALESCE(SUM(COALESCE(person_count, 0) + 1), 0) FROM visitor_records WHERE status = 'inside' AND deleted_at IS NULL) as active_visitors,
                        (SELECT COUNT(*) FROM vehicle_records WHERE status = 'in_use' AND deleted_at IS NULL) as active_vehicles,
                        (SELECT COUNT(*) FROM managers_records WHERE status = 'inside' AND deleted_at IS NULL) as active_managers
                `)
            ]);

            res.json({
                success: true,
                data: {
                    today: todayStats.rows[0],
                    month: monthStats.rows[0],
                    active: activeStats.rows[0]
                }
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Genel istatistik hatası:', error);
        res.status(500).json({ success: false, message: 'İstatistikler alınamadı' });
    }
};

// Ziyaretçi trend verileri
export const getVisitorTrends = async (req: Request, res: Response) => {
    try {
        const { period = 'daily' } = req.query;
        const { start, end } = resolveDateRange(req.query);
        const client = await pool.connect();

        try {
            let query = '';

            if (period === 'daily') {
                query = `
                    SELECT 
                        entry_date::text as date,
                        COUNT(*) as count,
                        SUM(CASE WHEN for_electric_station = true THEN 1 ELSE COALESCE(person_count, 0) + 1 END) as total_persons
                    FROM visitor_records 
                    WHERE entry_date >= $1 AND entry_date <= $2
                      AND deleted_at IS NULL
                    GROUP BY entry_date
                    ORDER BY entry_date ASC
                `;
            } else if (period === 'weekly') {
                query = `
                    SELECT 
                        DATE_TRUNC('week', entry_date)::date::text as date,
                        COUNT(*) as count,
                        SUM(CASE WHEN for_electric_station = true THEN 1 ELSE COALESCE(person_count, 0) + 1 END) as total_persons
                    FROM visitor_records 
                    WHERE entry_date >= $1 AND entry_date <= $2
                      AND deleted_at IS NULL
                    GROUP BY DATE_TRUNC('week', entry_date)
                    ORDER BY date ASC
                `;
            } else if (period === 'monthly') {
                query = `
                    SELECT 
                        TO_CHAR(entry_date, 'YYYY-MM') as date,
                        COUNT(*) as count,
                        SUM(CASE WHEN for_electric_station = true THEN 1 ELSE COALESCE(person_count, 0) + 1 END) as total_persons
                    FROM visitor_records 
                    WHERE entry_date >= $1 AND entry_date <= $2
                      AND deleted_at IS NULL
                    GROUP BY TO_CHAR(entry_date, 'YYYY-MM')
                    ORDER BY date ASC
                `;
            }

            const [
                result,
                hourlyHeatmap,
                avgDuration,
                durationDistribution,
                hostDistribution,
                electricStationVisitors,
                subcontractorVisitors,
                categoryComparison,
                tagTrends,
                vehicleVisitorStats,
                topVisitorPlates
            ] = await Promise.all([
                client.query(query, [start, end]),
                client.query(`
                    SELECT 
                        TO_CHAR(entry_date, 'Day') as day_name,
                        EXTRACT(DOW FROM entry_date) as day_of_week,
                        EXTRACT(HOUR FROM entry_time::time) as hour,
                        COUNT(*) as visit_count,
                        SUM(CASE WHEN for_electric_station = true THEN 1 ELSE COALESCE(person_count, 0) + 1 END) as total_persons
                    FROM visitor_records 
                    WHERE entry_date >= $1 AND entry_date <= $2
                      AND deleted_at IS NULL
                      AND entry_time IS NOT NULL
                    GROUP BY TO_CHAR(entry_date, 'Day'), EXTRACT(DOW FROM entry_date), EXTRACT(HOUR FROM entry_time::time)
                    ORDER BY day_of_week, hour
                `, [start, end]),
                client.query(`
                    SELECT 
                        AVG(EXTRACT(EPOCH FROM (exit_time::time - entry_time::time)) / 3600) as avg_hours,
                        MIN(EXTRACT(EPOCH FROM (exit_time::time - entry_time::time)) / 3600) as min_hours,
                        MAX(EXTRACT(EPOCH FROM (exit_time::time - entry_time::time)) / 3600) as max_hours,
                        COUNT(*) as completed_visits
                    FROM visitor_records 
                    WHERE entry_date >= $1 AND entry_date <= $2
                      AND deleted_at IS NULL
                      AND entry_time IS NOT NULL
                      AND exit_time IS NOT NULL
                      AND exit_time::time > entry_time::time
                `, [start, end]),
                client.query(`
                    SELECT 
                        CASE 
                            WHEN EXTRACT(EPOCH FROM (exit_time::time - entry_time::time)) / 3600 < 0.5 THEN '0-30 dk'
                            WHEN EXTRACT(EPOCH FROM (exit_time::time - entry_time::time)) / 3600 < 1 THEN '30-60 dk'
                            WHEN EXTRACT(EPOCH FROM (exit_time::time - entry_time::time)) / 3600 < 2 THEN '1-2 saat'
                            WHEN EXTRACT(EPOCH FROM (exit_time::time - entry_time::time)) / 3600 < 4 THEN '2-4 saat'
                            ELSE '4+ saat'
                        END as duration_range,
                        COUNT(*) as count
                    FROM visitor_records 
                    WHERE entry_date >= $1 AND entry_date <= $2
                      AND deleted_at IS NULL
                      AND entry_time IS NOT NULL
                      AND exit_time IS NOT NULL
                      AND exit_time::time > entry_time::time
                    GROUP BY duration_range
                    ORDER BY duration_range
                `, [start, end]),
                client.query(`
                    SELECT 
                        COALESCE(visiting_person, 'Belirtilmemiş') as host,
                        COUNT(*) as visit_count,
                        SUM(CASE WHEN for_electric_station = true THEN 1 ELSE COALESCE(person_count, 0) + 1 END) as total_persons
                    FROM visitor_records 
                    WHERE entry_date >= $1 AND entry_date <= $2
                      AND deleted_at IS NULL
                    GROUP BY visiting_person
                    ORDER BY visit_count DESC
                    LIMIT 15
                `, [start, end]),
                client.query(`
                    SELECT 
                        entry_date::text as date,
                        COUNT(*) as count,
                        COUNT(*) as total_persons
                    FROM visitor_records 
                    WHERE entry_date >= $1 AND entry_date <= $2
                      AND deleted_at IS NULL
                      AND for_electric_station = true
                    GROUP BY entry_date
                    ORDER BY entry_date ASC
                `, [start, end]),
                client.query(`
                    SELECT 
                        entry_date::text as date,
                        COUNT(*) as count,
                        SUM(COALESCE(person_count, 0) + 1) as total_persons
                    FROM visitor_records 
                    WHERE entry_date >= $1 AND entry_date <= $2
                      AND deleted_at IS NULL
                      AND subcontractor_worker = true
                    GROUP BY entry_date
                    ORDER BY entry_date ASC
                `, [start, end]),
                client.query(`
                    SELECT 
                        CASE 
                            WHEN for_electric_station = true THEN 'Şarj İstasyonu'
                            WHEN subcontractor_worker = true THEN 'Taşeron İşçi'
                            ELSE 'Diğer'
                        END as category,
                        COUNT(*) as count,
                        SUM(CASE WHEN for_electric_station = true THEN 1 ELSE COALESCE(person_count, 0) + 1 END) as total_persons
                    FROM visitor_records 
                    WHERE entry_date >= $1 AND entry_date <= $2
                      AND deleted_at IS NULL
                    GROUP BY 
                        CASE 
                            WHEN for_electric_station = true THEN 'Şarj İstasyonu'
                            WHEN subcontractor_worker = true THEN 'Taşeron İşçi'
                            ELSE 'Diğer'
                        END
                    ORDER BY count DESC
                `, [start, end]),
                client.query(`
                    SELECT 
                        entry_date::text as date,
                        SUM(CASE WHEN subcontractor_worker = true THEN COALESCE(person_count, 0) + 1 ELSE 0 END) as subcontractor_worker,
                        SUM(CASE WHEN for_electric_station = true THEN 1 ELSE 0 END) as for_electric_station,
                        SUM(CASE WHEN daily_guest = true THEN COALESCE(person_count, 0) + 1 ELSE 0 END) as daily_guest,
                        SUM(CASE WHEN entry_tag = true THEN 1 ELSE 0 END) as entry_tag,
                        SUM(CASE WHEN exit_tag = true THEN 1 ELSE 0 END) as exit_tag,
                        SUM(CASE WHEN tour_entry = true THEN 1 ELSE 0 END) as tour_entry,
                        SUM(CASE WHEN tour_exit = true THEN 1 ELSE 0 END) as tour_exit,
                        SUM(CASE WHEN meeting = true THEN COALESCE(person_count, 0) + 1 ELSE 0 END) as meeting,
                        SUM(CASE WHEN delivery = true THEN 1 ELSE 0 END) as delivery
                    FROM visitor_records
                    WHERE entry_date >= $1 AND entry_date <= $2
                      AND deleted_at IS NULL
                    GROUP BY entry_date
                    ORDER BY entry_date ASC
                `, [start, end]),
                // Araçlı vs Araçsız ziyaretçi sayısı — sadece geçerli Türk plakası formatı sayılır
                // Türk plaka formatı: il kodu (01-81) + 1-3 harf + 2-4 rakam (boşluksuz)
                client.query(`
                    SELECT
                        SUM(CASE 
                            WHEN vehicle_plate IS NOT NULL 
                             AND vehicle_plate != ''
                             AND vehicle_plate !~* 'yaya'
                             AND REPLACE(vehicle_plate, ' ', '') ~* '^(0[1-9]|[1-7][0-9]|8[01])[A-Z]{1,3}[0-9]{2,4}$'
                            THEN 1 ELSE 0 
                        END) as with_vehicle,
                        SUM(CASE 
                            WHEN vehicle_plate IS NULL 
                              OR vehicle_plate = ''
                              OR vehicle_plate ~* 'yaya'
                              OR REPLACE(vehicle_plate, ' ', '') !~* '^(0[1-9]|[1-7][0-9]|8[01])[A-Z]{1,3}[0-9]{2,4}$'
                            THEN 1 ELSE 0 
                        END) as without_vehicle,
                        COUNT(*) as total
                    FROM visitor_records
                    WHERE entry_date >= $1 AND entry_date <= $2
                      AND deleted_at IS NULL
                `, [start, end]),
                // En sık gelen plakalar (Top 10) — sadece geçerli Türk plakası formatı
                client.query(`
                    SELECT
                        vehicle_plate as plate,
                        COUNT(*) as visit_count,
                        MAX(entry_date::text) as last_visit
                    FROM visitor_records
                    WHERE entry_date >= $1 AND entry_date <= $2
                      AND deleted_at IS NULL
                      AND vehicle_plate IS NOT NULL
                      AND vehicle_plate != ''
                      AND vehicle_plate !~* 'yaya'
                      AND REPLACE(vehicle_plate, ' ', '') ~* '^(0[1-9]|[1-7][0-9]|8[01])[A-Z]{1,3}[0-9]{2,4}$'
                    GROUP BY vehicle_plate
                    ORDER BY visit_count DESC
                    LIMIT 10
                `, [start, end])
            ]);

            res.json({
                success: true,
                data: {
                    trend: result.rows,
                    hourlyHeatmap: hourlyHeatmap.rows,
                    avgDuration: avgDuration.rows[0],
                    durationDistribution: durationDistribution.rows,
                    hostDistribution: hostDistribution.rows,
                    electricStationVisitors: electricStationVisitors.rows,
                    subcontractorVisitors: subcontractorVisitors.rows,
                    categoryComparison: categoryComparison.rows,
                    tagTrends: tagTrends.rows,
                    vehicleVisitorStats: vehicleVisitorStats.rows[0] || { with_vehicle: 0, without_vehicle: 0, total: 0 },
                    topVisitorPlates: topVisitorPlates.rows
                }
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Ziyaretçi trend hatası:', error);
        res.status(500).json({ success: false, message: 'Trend verileri alınamadı' });
    }
};

// Araç kullanım istatistikleri
export const getVehicleStats = async (req: Request, res: Response) => {
    try {
        const { period = 'daily' } = req.query;
        const { start, end } = resolveDateRange(req.query);
        const client = await pool.connect();

        try {
            // Günlük/haftalık/aylık araç kullanım trendi
            let trendQuery = '';
            if (period === 'daily') {
                trendQuery = `
                    SELECT 
                        given_date::text as date,
                        COUNT(*) as count
                    FROM vehicle_records 
                    WHERE given_date >= $1 AND given_date <= $2
                      AND deleted_at IS NULL
                    GROUP BY given_date
                    ORDER BY given_date ASC
                `;
            } else if (period === 'weekly') {
                trendQuery = `
                    SELECT 
                        DATE_TRUNC('week', given_date)::date::text as date,
                        COUNT(*) as count
                    FROM vehicle_records 
                    WHERE given_date >= $1 AND given_date <= $2
                      AND deleted_at IS NULL
                    GROUP BY DATE_TRUNC('week', given_date)
                    ORDER BY date ASC
                `;
            } else if (period === 'monthly') {
                trendQuery = `
                    SELECT 
                        TO_CHAR(given_date, 'YYYY-MM') as date,
                        COUNT(*) as count
                    FROM vehicle_records 
                    WHERE given_date >= $1 AND given_date <= $2
                      AND deleted_at IS NULL
                    GROUP BY TO_CHAR(given_date, 'YYYY-MM')
                    ORDER BY date ASC
                `;
            }

            const [
                trendResult,
                topVehicles,
                topManagers,
                statusDistribution,
                topDestinations,
                hourlyUsage,
                hourlyHeatmap,
                personnelVehicleUsage
            ] = await Promise.all([
                client.query(trendQuery, [start, end]),
                client.query(`
                    SELECT 
                        v.plate,
                        v.brand,
                        COUNT(vr.id) as usage_count
                    FROM vehicles v
                    LEFT JOIN vehicle_records vr ON v.id = vr.vehicle_id AND vr.deleted_at IS NULL AND vr.given_date >= $1 AND vr.given_date <= $2
                    WHERE v.deleted_at IS NULL
                    GROUP BY v.id, v.plate, v.brand
                    ORDER BY usage_count DESC
                    LIMIT 10
                `, [start, end]),
                client.query(`
                    SELECT 
                        COALESCE(m.first_name || ' ' || m.last_name, vr.manager_name) as manager_name,
                        COUNT(vr.id) as usage_count
                    FROM vehicle_records vr
                    LEFT JOIN managers m ON vr.manager_id = m.id
                    WHERE vr.deleted_at IS NULL
                      AND vr.given_date >= $1 AND vr.given_date <= $2
                    GROUP BY COALESCE(m.first_name || ' ' || m.last_name, vr.manager_name)
                    HAVING COALESCE(m.first_name || ' ' || m.last_name, vr.manager_name) IS NOT NULL
                    ORDER BY usage_count DESC
                    LIMIT 10
                `, [start, end]),
                client.query(`
                    SELECT 
                        status,
                        COUNT(*) as count
                    FROM vehicle_records 
                    WHERE deleted_at IS NULL
                      AND given_date >= $1 AND given_date <= $2
                    GROUP BY status
                `, [start, end]),
                client.query(`
                    SELECT 
                        destination,
                        COUNT(*) as count
                    FROM vehicle_records 
                    WHERE deleted_at IS NULL
                      AND destination IS NOT NULL
                      AND destination != ''
                      AND given_date >= $1 AND given_date <= $2
                    GROUP BY destination
                    ORDER BY count DESC
                    LIMIT 10
                `, [start, end]),
                client.query(`
                    SELECT 
                        EXTRACT(HOUR FROM given_time::time) as hour,
                        COUNT(*) as count
                    FROM vehicle_records 
                    WHERE deleted_at IS NULL
                      AND given_time IS NOT NULL
                      AND given_date >= $1 AND given_date <= $2
                    GROUP BY EXTRACT(HOUR FROM given_time::time)
                    ORDER BY hour ASC
                `, [start, end]),
                client.query(`
                    SELECT 
                        TO_CHAR(given_date, 'Day') as day_name,
                        EXTRACT(DOW FROM given_date) as day_of_week,
                        EXTRACT(HOUR FROM given_time::time) as hour,
                        COUNT(*) as count
                    FROM vehicle_records 
                    WHERE given_date >= $1 AND given_date <= $2
                      AND deleted_at IS NULL
                      AND given_time IS NOT NULL
                    GROUP BY TO_CHAR(given_date, 'Day'), EXTRACT(DOW FROM given_date), EXTRACT(HOUR FROM given_time::time)
                    ORDER BY day_of_week, hour
                `, [start, end]),
                client.query(`
                    SELECT 
                        COALESCE(p.first_name || ' ' || p.last_name, 'Belirtilmemiş') as personnel_name,
                        v.plate as vehicle_plate,
                        COUNT(*) as usage_count
                    FROM vehicle_records vr
                    LEFT JOIN vehicles v ON vr.vehicle_id = v.id
                    LEFT JOIN personnel p ON vr.given_by = p.id
                    WHERE vr.deleted_at IS NULL
                      AND vr.given_date >= $1 AND vr.given_date <= $2
                    GROUP BY p.first_name, p.last_name, v.plate
                    ORDER BY usage_count DESC
                    LIMIT 20
                `, [start, end])
            ]);

            res.json({
                success: true,
                data: {
                    trend: trendResult.rows,
                    topVehicles: topVehicles.rows,
                    topManagers: topManagers.rows,
                    statusDistribution: statusDistribution.rows,
                    topDestinations: topDestinations.rows,
                    hourlyUsage: hourlyUsage.rows,
                    hourlyHeatmap: hourlyHeatmap.rows,
                    personnelVehicleUsage: personnelVehicleUsage.rows
                }
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Araç istatistik hatası:', error);
        res.status(500).json({ success: false, message: 'Araç istatistikleri alınamadı' });
    }
};

// Yönetici giriş-çıkış istatistikleri
export const getManagerStats = async (req: Request, res: Response) => {
    try {
        const { period = 'daily', days = 30 } = req.query;
        const client = await pool.connect();

        try {
            // Günlük/haftalık/aylık trend
            let trendQuery = '';
            if (period === 'daily') {
                trendQuery = `
                    SELECT 
                        entry_date::text as date,
                        COUNT(*) as count
                    FROM managers_records 
                    WHERE entry_date >= CURRENT_DATE - $1::integer
                      AND deleted_at IS NULL
                    GROUP BY entry_date
                    ORDER BY entry_date ASC
                `;
            } else if (period === 'weekly') {
                trendQuery = `
                    SELECT 
                        DATE_TRUNC('week', entry_date)::date::text as date,
                        COUNT(*) as count
                    FROM managers_records 
                    WHERE entry_date >= CURRENT_DATE - $1::integer
                      AND deleted_at IS NULL
                    GROUP BY DATE_TRUNC('week', entry_date)
                    ORDER BY date ASC
                `;
            } else if (period === 'monthly') {
                trendQuery = `
                    SELECT 
                        TO_CHAR(entry_date, 'YYYY-MM') as date,
                        COUNT(*) as count
                    FROM managers_records 
                    WHERE entry_date >= CURRENT_DATE - $1::integer
                      AND deleted_at IS NULL
                    GROUP BY TO_CHAR(entry_date, 'YYYY-MM')
                    ORDER BY date ASC
                `;
            }

            const [trendResult, topManagers, hourlyDistribution] = await Promise.all([
                client.query(trendQuery, [days]),
                client.query(`
                    SELECT 
                        COALESCE(m.first_name || ' ' || m.last_name, mr.manager_name) as manager_name,
                        COUNT(mr.id) as visit_count
                    FROM managers_records mr
                    LEFT JOIN managers m ON mr.manager_id = m.id
                    WHERE mr.deleted_at IS NULL
                      AND mr.entry_date >= CURRENT_DATE - $1::integer
                    GROUP BY COALESCE(m.first_name || ' ' || m.last_name, mr.manager_name)
                    HAVING COALESCE(m.first_name || ' ' || m.last_name, mr.manager_name) IS NOT NULL
                    ORDER BY visit_count DESC
                    LIMIT 10
                `, [days]),
                client.query(`
                    SELECT 
                        EXTRACT(HOUR FROM entry_time) as hour,
                        COUNT(*) as count
                    FROM managers_records 
                    WHERE deleted_at IS NULL
                      AND entry_date >= CURRENT_DATE - $1::integer
                    GROUP BY EXTRACT(HOUR FROM entry_time)
                    ORDER BY hour ASC
                `, [days])
            ]);

            res.json({
                success: true,
                data: {
                    trend: trendResult.rows,
                    topManagers: topManagers.rows,
                    hourlyDistribution: hourlyDistribution.rows
                }
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Yönetici istatistik hatası:', error);
        res.status(500).json({ success: false, message: 'Yönetici istatistikleri alınamadı' });
    }
};

// Yangın alarmı istatistikleri
export const getFireAlarmStats = async (req: Request, res: Response) => {
    try {
        const { start, end } = resolveDateRange(req.query);
        const client = await pool.connect();

        try {
            // Günlük alarm trendi
            const [
                dailyTrend,
                monthlyTrend,
                locationDistribution,
                resolutionStats,
                hourlyTrend,
                avgResolutionTime
            ] = await Promise.all([
                client.query(`
                    SELECT 
                        alarm_time::date::text as date,
                        COUNT(*) as count
                    FROM fire_alarms 
                    WHERE alarm_time >= $1::timestamp AND alarm_time < ($2::date + INTERVAL '1 day')
                      AND deleted_at IS NULL
                    GROUP BY alarm_time::date
                    ORDER BY alarm_time::date ASC
                `, [start, end]),
                client.query(`
                    SELECT 
                        TO_CHAR(alarm_time, 'YYYY-MM') as date,
                        COUNT(*) as total,
                        SUM(CASE WHEN false_alarm = true THEN 1 ELSE 0 END) as false_alarms,
                        SUM(CASE WHEN false_alarm = false OR false_alarm IS NULL THEN 1 ELSE 0 END) as real_alarms
                    FROM fire_alarms 
                    WHERE alarm_time >= $1::timestamp AND alarm_time < ($2::date + INTERVAL '1 day')
                      AND deleted_at IS NULL
                    GROUP BY TO_CHAR(alarm_time, 'YYYY-MM')
                    ORDER BY date ASC
                `, [start, end]),
                client.query(`
                    SELECT 
                        COALESCE(location, 'Belirtilmemiş') as location,
                        COUNT(*) as count
                    FROM fire_alarms 
                    WHERE deleted_at IS NULL
                      AND alarm_time >= $1::timestamp AND alarm_time < ($2::date + INTERVAL '1 day')
                    GROUP BY location
                    ORDER BY count DESC
                    LIMIT 10
                `, [start, end]),
                client.query(`
                    SELECT 
                        CASE WHEN resolved = true THEN 'Çözüldü' ELSE 'Beklemede' END as status,
                        COUNT(*) as count
                    FROM fire_alarms 
                    WHERE deleted_at IS NULL
                      AND alarm_time >= $1::timestamp AND alarm_time < ($2::date + INTERVAL '1 day')
                    GROUP BY resolved
                `, [start, end]),
                client.query(`
                    SELECT 
                        EXTRACT(HOUR FROM alarm_time) as hour,
                        COUNT(*) as count,
                        SUM(CASE WHEN false_alarm = true THEN 1 ELSE 0 END) as false_alarms,
                        SUM(CASE WHEN false_alarm = false OR false_alarm IS NULL THEN 1 ELSE 0 END) as real_alarms
                    FROM fire_alarms 
                    WHERE deleted_at IS NULL
                      AND alarm_time >= $1::timestamp AND alarm_time < ($2::date + INTERVAL '1 day')
                    GROUP BY EXTRACT(HOUR FROM alarm_time)
                    ORDER BY hour ASC
                `, [start, end]),
                client.query(`
                    SELECT 
                        EXTRACT(EPOCH FROM AVG(resolution_time - created_at))::integer as avg_seconds
                    FROM fire_alarms 
                    WHERE deleted_at IS NULL 
                      AND resolved = true 
                      AND resolution_time IS NOT NULL
                      AND alarm_time >= $1::timestamp AND alarm_time < ($2::date + INTERVAL '1 day')
                `, [start, end])
            ]);

            res.json({
                success: true,
                data: {
                    dailyTrend: dailyTrend.rows,
                    monthlyTrend: monthlyTrend.rows,
                    locationDistribution: locationDistribution.rows,
                    resolutionStats: resolutionStats.rows,
                    hourlyTrend: hourlyTrend.rows,
                    avgResolutionTime: avgResolutionTime.rows[0]?.avg_seconds || 0
                }
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Yangın alarmı istatistik hatası:', error);
        res.status(500).json({ success: false, message: 'Alarm istatistikleri alınamadı' });
    }
};

// Olay istatistikleri
export const getIncidentStats = async (req: Request, res: Response) => {
    try {
        const { start, end } = resolveDateRange(req.query);
        const client = await pool.connect();

        try {
            // Aylık olay trendi
            const [
                monthlyTrend,
                typeDistribution,
                severityDistribution,
                categoryStats,
                categoryTrend
            ] = await Promise.all([
                client.query(`
                    SELECT 
                        TO_CHAR(incident_time::date, 'YYYY-MM') as date,
                        COUNT(*) as count
                    FROM incidents 
                    WHERE incident_time >= $1::timestamp AND incident_time < ($2::date + INTERVAL '1 day')
                      AND deleted_at IS NULL
                    GROUP BY TO_CHAR(incident_time::date, 'YYYY-MM')
                    ORDER BY date ASC
                `, [start, end]),
                client.query(`
                    SELECT 
                        COALESCE(incident_type, 'Genel') as type,
                        COUNT(*) as count
                    FROM incidents 
                    WHERE deleted_at IS NULL
                      AND incident_time >= $1::timestamp AND incident_time < ($2::date + INTERVAL '1 day')
                    GROUP BY incident_type
                    ORDER BY count DESC
                `, [start, end]),
                client.query(`
                    SELECT 
                        COALESCE(severity, 'Belirtilmemiş') as severity,
                        COUNT(*) as count
                    FROM incidents 
                    WHERE deleted_at IS NULL
                      AND incident_time >= $1::timestamp AND incident_time < ($2::date + INTERVAL '1 day')
                    GROUP BY severity
                    ORDER BY count DESC
                `, [start, end]),
                client.query(`
                    SELECT 
                        -- Alt kategoriler
                        SUM(CASE WHEN theft_guest_property THEN 1 ELSE 0 END) as theft_guest_property,
                        SUM(CASE WHEN theft_hotel_property THEN 1 ELSE 0 END) as theft_hotel_property,
                        SUM(CASE WHEN theft_personnel THEN 1 ELSE 0 END) as theft_personnel,
                        SUM(CASE WHEN assault_physical THEN 1 ELSE 0 END) as assault_physical,
                        SUM(CASE WHEN assault_verbal THEN 1 ELSE 0 END) as assault_verbal,
                        SUM(CASE WHEN assault_mass_fight THEN 1 ELSE 0 END) as assault_mass_fight,
                        SUM(CASE WHEN substance_personnel THEN 1 ELSE 0 END) as substance_personnel,
                        SUM(CASE WHEN substance_property THEN 1 ELSE 0 END) as substance_property,
                        SUM(CASE WHEN vandalism_room THEN 1 ELSE 0 END) as vandalism_room,
                        SUM(CASE WHEN vandalism_common_area THEN 1 ELSE 0 END) as vandalism_common_area,
                        SUM(CASE WHEN unauthorized_room THEN 1 ELSE 0 END) as unauthorized_room,
                        SUM(CASE WHEN unauthorized_restricted_area THEN 1 ELSE 0 END) as unauthorized_restricted_area,
                        SUM(CASE WHEN accident_slip_fall THEN 1 ELSE 0 END) as accident_slip_fall,
                        SUM(CASE WHEN accident_equipment THEN 1 ELSE 0 END) as accident_equipment,
                        SUM(CASE WHEN accident_work THEN 1 ELSE 0 END) as accident_work,
                        SUM(CASE WHEN medical_serious THEN 1 ELSE 0 END) as medical_serious,
                        SUM(CASE WHEN medical_first_aid THEN 1 ELSE 0 END) as medical_first_aid,
                        SUM(CASE WHEN medical_ambulance THEN 1 ELSE 0 END) as medical_ambulance,
                        SUM(CASE WHEN fire_real THEN 1 ELSE 0 END) as fire_real,
                        SUM(CASE WHEN fire_false_alarm THEN 1 ELSE 0 END) as fire_false_alarm,
                        SUM(CASE WHEN fire_evacuation THEN 1 ELSE 0 END) as fire_evacuation,
                        SUM(CASE WHEN security_cctv_malfunction THEN 1 ELSE 0 END) as security_cctv_malfunction,
                        SUM(CASE WHEN other THEN 1 ELSE 0 END) as other,
                        -- Ana kategori toplamları
                        COUNT(DISTINCT CASE WHEN (theft_guest_property OR theft_hotel_property OR theft_personnel) THEN ic.incident_id END) as theft_total,
                        COUNT(DISTINCT CASE WHEN (assault_physical OR assault_verbal OR assault_mass_fight) THEN ic.incident_id END) as assault_total,
                        COUNT(DISTINCT CASE WHEN (substance_personnel OR substance_property) THEN ic.incident_id END) as substance_total,
                        COUNT(DISTINCT CASE WHEN (vandalism_room OR vandalism_common_area) THEN ic.incident_id END) as vandalism_total,
                        COUNT(DISTINCT CASE WHEN (unauthorized_room OR unauthorized_restricted_area) THEN ic.incident_id END) as unauthorized_total,
                        COUNT(DISTINCT CASE WHEN (accident_slip_fall OR accident_equipment OR accident_work) THEN ic.incident_id END) as accident_total,
                        COUNT(DISTINCT CASE WHEN (medical_serious OR medical_first_aid OR medical_ambulance) THEN ic.incident_id END) as medical_total,
                        COUNT(DISTINCT CASE WHEN (fire_real OR fire_false_alarm OR fire_evacuation) THEN ic.incident_id END) as fire_total,
                        COUNT(DISTINCT CASE WHEN security_cctv_malfunction THEN ic.incident_id END) as security_total,
                        COUNT(DISTINCT CASE WHEN other THEN ic.incident_id END) as other_total
                    FROM incident_categories ic
                    INNER JOIN incidents i ON ic.incident_id = i.id
                    WHERE i.incident_time >= $1::timestamp AND i.incident_time < ($2::date + INTERVAL '1 day')
                      AND i.deleted_at IS NULL
                `, [start, end]),
                client.query(`
                    SELECT 
                        TO_CHAR(i.incident_time::date, 'YYYY-MM') as date,
                        SUM(CASE WHEN theft_guest_property OR theft_hotel_property OR theft_personnel THEN 1 ELSE 0 END) as theft_count,
                        SUM(CASE WHEN assault_physical OR assault_verbal OR assault_mass_fight THEN 1 ELSE 0 END) as assault_count,
                        SUM(CASE WHEN substance_personnel OR substance_property THEN 1 ELSE 0 END) as substance_count,
                        SUM(CASE WHEN vandalism_room OR vandalism_common_area THEN 1 ELSE 0 END) as vandalism_count,
                        SUM(CASE WHEN unauthorized_room OR unauthorized_restricted_area THEN 1 ELSE 0 END) as unauthorized_count,
                        SUM(CASE WHEN accident_slip_fall OR accident_equipment OR accident_work THEN 1 ELSE 0 END) as accident_count,
                        SUM(CASE WHEN medical_serious OR medical_first_aid OR medical_ambulance THEN 1 ELSE 0 END) as medical_count,
                        SUM(CASE WHEN fire_real OR fire_false_alarm OR fire_evacuation THEN 1 ELSE 0 END) as fire_count,
                        SUM(CASE WHEN security_cctv_malfunction THEN 1 ELSE 0 END) as security_count,
                        SUM(CASE WHEN other THEN 1 ELSE 0 END) as other_count
                    FROM incident_categories ic
                    INNER JOIN incidents i ON ic.incident_id = i.id
                    WHERE i.incident_time >= $1::timestamp AND i.incident_time < ($2::date + INTERVAL '1 day')
                      AND i.deleted_at IS NULL
                    GROUP BY TO_CHAR(i.incident_time::date, 'YYYY-MM')
                    ORDER BY date ASC
                `, [start, end])
            ]);

            res.json({
                success: true,
                data: {
                    monthlyTrend: monthlyTrend.rows,
                    typeDistribution: typeDistribution.rows,
                    severityDistribution: severityDistribution.rows,
                    categoryStats: categoryStats.rows[0] || {},
                    categoryTrend: categoryTrend.rows
                }
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Olay istatistik hatası:', error);
        res.status(500).json({ success: false, message: 'Olay istatistikleri alınamadı' });
    }
};

// Karşılaştırmalı analiz
export const getComparativeAnalysis = async (req: Request, res: Response) => {
    try {
        const { start, end } = resolveDateRange(req.query);
        const client = await pool.connect();

        try {
            const [comparison, weeklyComparison] = await Promise.all([
                client.query(`
                    SELECT 
                        'visitors' as category,
                        (SELECT COALESCE(SUM(COALESCE(person_count, 0) + 1), 0) FROM visitor_records WHERE EXTRACT(MONTH FROM entry_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM entry_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND deleted_at IS NULL) as current_month,
                        (SELECT COALESCE(SUM(COALESCE(person_count, 0) + 1), 0) FROM visitor_records WHERE EXTRACT(MONTH FROM entry_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(YEAR FROM entry_date) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND deleted_at IS NULL) as previous_month
                    UNION ALL
                    SELECT 
                        'vehicles' as category,
                        (SELECT COUNT(*) FROM vehicle_records WHERE EXTRACT(MONTH FROM given_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM given_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND deleted_at IS NULL) as current_month,
                        (SELECT COUNT(*) FROM vehicle_records WHERE EXTRACT(MONTH FROM given_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(YEAR FROM given_date) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND deleted_at IS NULL) as previous_month
                    UNION ALL
                    SELECT 
                        'managers' as category,
                        (SELECT COUNT(*) FROM managers_records WHERE EXTRACT(MONTH FROM entry_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM entry_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND deleted_at IS NULL) as current_month,
                        (SELECT COUNT(*) FROM managers_records WHERE EXTRACT(MONTH FROM entry_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(YEAR FROM entry_date) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND deleted_at IS NULL) as previous_month
                    UNION ALL
                    SELECT 
                        'fire_alarms' as category,
                        (SELECT COUNT(*) FROM fire_alarms WHERE EXTRACT(MONTH FROM alarm_time) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM alarm_time) = EXTRACT(YEAR FROM CURRENT_DATE) AND deleted_at IS NULL) as current_month,
                        (SELECT COUNT(*) FROM fire_alarms WHERE EXTRACT(MONTH FROM alarm_time) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(YEAR FROM alarm_time) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND deleted_at IS NULL) as previous_month
                    UNION ALL
                    SELECT 
                        'incidents' as category,
                        (SELECT COUNT(*) FROM incidents WHERE EXTRACT(MONTH FROM report_date) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM report_date) = EXTRACT(YEAR FROM CURRENT_DATE) AND deleted_at IS NULL) as current_month,
                        (SELECT COUNT(*) FROM incidents WHERE EXTRACT(MONTH FROM report_date) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month') AND EXTRACT(YEAR FROM report_date) = EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month') AND deleted_at IS NULL) as previous_month
                `),
                client.query(`
                    SELECT 
                        'visitors' as category,
                        (SELECT COALESCE(SUM(COALESCE(person_count, 0) + 1), 0) FROM visitor_records WHERE entry_date >= $1::date AND entry_date <= $2::date AND deleted_at IS NULL) as current_week,
                        (SELECT COALESCE(SUM(COALESCE(person_count, 0) + 1), 0) FROM visitor_records WHERE entry_date >= ($1::date - ($2::date - $1::date + 1)) AND entry_date < $1::date AND deleted_at IS NULL) as previous_week
                    UNION ALL
                    SELECT 
                        'vehicles' as category,
                        (SELECT COUNT(*) FROM vehicle_records WHERE given_date >= $1::date AND given_date <= $2::date AND deleted_at IS NULL) as current_week,
                        (SELECT COUNT(*) FROM vehicle_records WHERE given_date >= ($1::date - ($2::date - $1::date + 1)) AND given_date < $1::date AND deleted_at IS NULL) as previous_week
                    UNION ALL
                    SELECT 
                        'managers' as category,
                        (SELECT COUNT(*) FROM managers_records WHERE entry_date >= $1::date AND entry_date <= $2::date AND deleted_at IS NULL) as current_week,
                        (SELECT COUNT(*) FROM managers_records WHERE entry_date >= ($1::date - ($2::date - $1::date + 1)) AND entry_date < $1::date AND deleted_at IS NULL) as previous_week
                    UNION ALL
                    SELECT 
                        'fire_alarms' as category,
                        (SELECT COUNT(*) FROM fire_alarms WHERE alarm_time >= $1::timestamp AND alarm_time < ($2::date + INTERVAL '1 day') AND deleted_at IS NULL) as current_week,
                        (SELECT COUNT(*) FROM fire_alarms WHERE alarm_time >= ($1::date - ($2::date - $1::date + 1))::timestamp AND alarm_time < $1::timestamp AND deleted_at IS NULL) as previous_week
                `, [start, end])
            ]);

            res.json({
                success: true,
                data: {
                    monthlyComparison: comparison.rows,
                    weeklyComparison: weeklyComparison.rows
                }
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Karşılaştırma hatası:', error);
        res.status(500).json({ success: false, message: 'Karşılaştırma verileri alınamadı' });
    }
};

// Personel bazlı kayıt performansı (haftalık/aylık/yıllık)
export const getPersonnelPerformanceStats = async (req: Request, res: Response) => {
    try {
        const periodRaw = typeof req.query.period === 'string' ? req.query.period : 'weekly';
        const period = periodRaw.toLowerCase();

        if (!['weekly', 'monthly', 'yearly'].includes(period)) {
            res.status(400).json({
                success: false,
                message: 'Geçersiz dönem parametresi. weekly, monthly veya yearly olmalıdır'
            });
            return;
        }

        const client = await pool.connect();

        try {
            const result = await client.query(
                `WITH period_window AS (
                    SELECT
                        CASE
                            WHEN $1 = 'weekly' THEN date_trunc('week', CURRENT_DATE)::date
                            WHEN $1 = 'monthly' THEN date_trunc('month', CURRENT_DATE)::date
                            ELSE date_trunc('year', CURRENT_DATE)::date
                        END AS start_date,
                        (CURRENT_DATE + INTERVAL '1 day')::date AS end_date
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
                )
                SELECT
                    pb.id,
                    pb.first_name,
                    pb.last_name,
                    pb.username,
                    COALESCE(vc.vehicle_count, 0)::int AS vehicle_count,
                    COALESCE(vic.visitor_count, 0)::int AS visitor_count,
                    COALESCE(mc.manager_count, 0)::int AS manager_count,
                    COALESCE(fac.fire_alarm_count, 0)::int AS fire_alarm_count,
                    COALESCE(sc.sgk_count, 0)::int AS sgk_count,
                    (
                        COALESCE(vc.vehicle_count, 0)
                        + COALESCE(vic.visitor_count, 0)
                        + COALESCE(mc.manager_count, 0)
                        + COALESCE(fac.fire_alarm_count, 0)
                        + COALESCE(sc.sgk_count, 0)
                    )::int AS total_count,
                    (SELECT start_date FROM period_window) AS start_date,
                    ((SELECT end_date FROM period_window) - INTERVAL '1 day')::date AS end_date
                FROM personnel_base pb
                LEFT JOIN vehicle_counts vc ON vc.personnel_id = pb.id
                LEFT JOIN visitor_counts vic ON vic.personnel_id = pb.id
                LEFT JOIN manager_counts mc ON mc.personnel_id = pb.id
                LEFT JOIN fire_alarm_counts fac ON fac.personnel_id = pb.id
                LEFT JOIN sgk_counts sc ON sc.personnel_id = pb.id
                ORDER BY total_count DESC, pb.first_name ASC, pb.last_name ASC`,
                [period]
            );

            const rangeStart = result.rows[0]?.start_date || null;
            const rangeEnd = result.rows[0]?.end_date || null;

            res.json({
                success: true,
                data: {
                    period,
                    startDate: rangeStart,
                    endDate: rangeEnd,
                    rows: result.rows.map((row) => ({
                        id: row.id,
                        firstName: row.first_name,
                        lastName: row.last_name,
                        username: row.username,
                        vehicleCount: row.vehicle_count,
                        visitorCount: row.visitor_count,
                        managerCount: row.manager_count,
                        fireAlarmCount: row.fire_alarm_count,
                        sgkCount: row.sgk_count,
                        totalCount: row.total_count,
                    })),
                },
            });
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('Personel performans istatistik hatası:', error);
        res.status(500).json({ success: false, message: 'Personel istatistikleri alınamadı' });
    }
};
