import { useState, useEffect } from 'react';
import {
    AreaChart, Area, Line, BarChart, Bar, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell
} from 'recharts';
import api from '../../utils/api';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
const CHART_COLORS = {
    primary: '#3B82F6',
    secondary: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6'
};

interface VisitorsTabProps {
    startDate: string;
    endDate: string;
    refetchKey: number;
    getDaysLabel: () => string;
    formatDate: (dateStr: string) => string;
    CustomTooltip: any;
}

export default function VisitorsTab({
    startDate,
    endDate,
    refetchKey,
    getDaysLabel,
    formatDate,
    CustomTooltip
}: VisitorsTabProps) {
    const [loading, setLoading] = useState(true);
    const [visitorTrends, setVisitorTrends] = useState<any>({
        trend: [],
        hourlyHeatmap: [],
        avgDuration: {},
        durationDistribution: [],
        hostDistribution: [],
        electricStationVisitors: [],
        subcontractorVisitors: [],
        categoryComparison: []
    });

    useEffect(() => {
        let isMounted = true;
        const fetchVisitorsData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/statistics/visitors?period=daily&startDate=${startDate}&endDate=${endDate}`);
                if (isMounted) {
                    setVisitorTrends(res.data.data);
                }
            } catch (error) {
                console.error('Ziyaretçi istatistik yükleme hatası:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchVisitorsData();
        return () => {
            isMounted = false;
        };
    }, [startDate, endDate, refetchKey]);

    if (loading && !visitorTrends.trend.length) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Dönem Bilgisi Başlık */}
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm font-medium text-slate-600">📅 {getDaysLabel()} verilerini görüntülüyorsunuz</p>
            </div>

            {/* 1. Toplam İnsan Trafiği - Zaman Serisi */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-daily-trend">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">👥 Toplam İnsan Trafiği ({getDaysLabel()})</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={visitorTrends.trend}>
                        <defs>
                            <linearGradient id="colorPersons" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8} />
                                <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tickFormatter={formatDate} />
                        <YAxis yAxisId="left" label={{ value: 'Kayıt Sayısı', angle: -90, position: 'insideLeft' }} />
                        <YAxis yAxisId="right" orientation="right" label={{ value: 'Toplam Kişi', angle: 90, position: 'insideRight' }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Area
                            yAxisId="right"
                            type="monotone"
                            dataKey="total_persons"
                            name="Toplam Kişi Sayısı"
                            stroke={CHART_COLORS.primary}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorPersons)"
                        />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="count"
                            name="Kayıt Sayısı"
                            stroke={CHART_COLORS.secondary}
                            strokeWidth={2}
                            dot={{ fill: CHART_COLORS.secondary, r: 4 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* 2. Giriş Saati Yoğunluğu - Isı Haritası */}
            {visitorTrends.hourlyHeatmap && visitorTrends.hourlyHeatmap.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-hourly-distribution">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">🔥 Giriş Saati Yoğunluğu ({getDaysLabel()} - Gün x Saat)</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="border border-gray-300 px-2 sm:px-4 py-2 bg-gray-50 text-xs sm:text-sm">Gün \\ Saat</th>
                                    {Array.from({ length: 24 }, (_, i) => (
                                        <th key={i} className="border border-gray-300 px-1.5 sm:px-2 py-2 bg-gray-50 text-[10px] sm:text-xs">{String(i).padStart(2, '0')}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'].map((day, dayIndex) => {
                                    const dayData = visitorTrends.hourlyHeatmap.filter((h: any) => parseInt(h.day_of_week) === dayIndex);
                                    const maxCount = Math.max(...visitorTrends.hourlyHeatmap.map((h: any) => parseInt(h.total_persons || h.visit_count || 0)), 1);

                                    return (
                                        <tr key={dayIndex}>
                                            <td className="border border-gray-300 px-2 sm:px-4 py-2 font-medium bg-gray-50 text-xs sm:text-sm whitespace-nowrap">{day}</td>
                                            {Array.from({ length: 24 }, (_, hour) => {
                                                const hourData = dayData.find((h: any) => parseInt(h.hour) === hour);
                                                const count = hourData ? parseInt(hourData.total_persons || hourData.visit_count || 0) : 0;
                                                const intensity = count / maxCount;
                                                const bgColor = count === 0 ? '#f3f4f6' :
                                                    intensity < 0.25 ? '#dbeafe' :
                                                        intensity < 0.5 ? '#93c5fd' :
                                                            intensity < 0.75 ? '#3b82f6' : '#1e40af';
                                                const textColor = intensity > 0.5 ? 'white' : 'black';

                                                return (
                                                    <td
                                                        key={hour}
                                                        className="border border-gray-300 px-2 py-2 text-center text-xs cursor-pointer hover:opacity-80 transition-opacity"
                                                        style={{ backgroundColor: bgColor, color: textColor }}
                                                        title={`${day} ${String(hour).padStart(2, '0')}:00 - ${count} kişi`}
                                                    >
                                                        {count > 0 ? count : ''}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                        <span>Daha az</span>
                        <div className="flex gap-1">
                            <div className="w-4 h-4 border" style={{ backgroundColor: '#f3f4f6' }}></div>
                            <div className="w-4 h-4 border" style={{ backgroundColor: '#dbeafe' }}></div>
                            <div className="w-4 h-4 border" style={{ backgroundColor: '#93c5fd' }}></div>
                            <div className="w-4 h-4 border" style={{ backgroundColor: '#3b82f6' }}></div>
                            <div className="w-4 h-4 border" style={{ backgroundColor: '#1e40af' }}></div>
                        </div>
                        <span>Daha çok</span>
                    </div>
                </div>
            )}

            {/* 3. Ortalama Ziyaret Süresi & Dağılım */}
            {visitorTrends.avgDuration && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Süre İstatistikleri */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-duration-stats">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">⏱️ Ziyaret Süresi İstatistikleri ({getDaysLabel()})</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                <span className="text-gray-700">Ortalama Süre</span>
                                <span className="text-2xl font-bold text-blue-600">
                                    {visitorTrends.avgDuration?.avg_hours ?
                                        `${Number(visitorTrends.avgDuration.avg_hours).toFixed(1)} saat` : 'N/A'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                                <span className="text-gray-700">En Kısa Ziyaret</span>
                                <span className="text-xl font-bold text-green-600">
                                    {visitorTrends.avgDuration?.min_hours ?
                                        `${(Number(visitorTrends.avgDuration.min_hours) * 60).toFixed(0)} dk` : 'N/A'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                                <span className="text-gray-700">En Uzun Ziyaret</span>
                                <span className="text-xl font-bold text-amber-600">
                                    {visitorTrends.avgDuration?.max_hours ?
                                        `${Number(visitorTrends.avgDuration.max_hours).toFixed(1)} saat` : 'N/A'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                                <span className="text-gray-700">Tamamlanan Ziyaret</span>
                                <span className="text-xl font-bold text-purple-600">
                                    {visitorTrends.avgDuration?.completed_visits || 0}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Süre Dağılımı */}
                    {visitorTrends.durationDistribution && visitorTrends.durationDistribution.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-duration-distribution">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Ziyaret Süresi Dağılımı ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={[...visitorTrends.durationDistribution].sort((a: any, b: any) => {
                                    const order = ['0-1 saat', '1-2 saat', '2-4 saat', '4-8 saat', '8+ saat'];
                                    return order.indexOf(a.duration_range) - order.indexOf(b.duration_range);
                                })}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="duration_range" tick={{ fontSize: 12 }} />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="count" name="Ziyaret Sayısı" fill={CHART_COLORS.purple} radius={[8, 8, 0, 0]}>
                                        {[...visitorTrends.durationDistribution].sort((a: any, b: any) => {
                                            const order = ['0-1 saat', '1-2 saat', '2-4 saat', '4-8 saat', '8+ saat'];
                                            return order.indexOf(a.duration_range) - order.indexOf(b.duration_range);
                                        }).map((_: any, index: number) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* 5. Kime Gelindiği Bazlı Analizler */}
            {visitorTrends.hostDistribution && visitorTrends.hostDistribution.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Host Dağılımı */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-top-managers">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">👤 En Çok Ziyaret Edilen Kişiler ({getDaysLabel()})</h3>
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={visitorTrends.hostDistribution} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis type="number" />
                                <YAxis dataKey="host" type="category" width={150} tick={{ fontSize: 11 }} />
                                <Tooltip />
                                <Bar dataKey="visit_count" name="Ziyaret Sayısı" fill={CHART_COLORS.primary} radius={[0, 8, 8, 0]}>
                                    {visitorTrends.hostDistribution.map((_: any, index: number) => (
                                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Kategori Karşılaştırması */}
                    {visitorTrends.categoryComparison && visitorTrends.categoryComparison.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-category-comparison">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Ziyaretçi Kategori Dağılımı ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={visitorTrends.categoryComparison}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="category" />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Bar dataKey="count" name="Ziyaret Sayısı" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="total_persons" name="Gelen Kişi Sayısı" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Şarj İstasyonu Ziyaretleri */}
                    {visitorTrends.electricStationVisitors && visitorTrends.electricStationVisitors.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">⚡ Şarj İstasyonu Ziyaretleri ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={visitorTrends.electricStationVisitors}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tickFormatter={formatDate} />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Bar dataKey="count" name="Araç Sayısı" fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Taşeron İşçi Ziyaretleri */}
                    {visitorTrends.subcontractorVisitors && visitorTrends.subcontractorVisitors.length > 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">👷 Taşeron İşçi Ziyaretleri ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={visitorTrends.subcontractorVisitors}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tickFormatter={formatDate} />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Bar dataKey="total_persons" name="Kişi Sayısı" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* Özet Kartlar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Günlük Ortalamalar ({getDaysLabel()})</h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-600 text-sm">Günlük Ort. Kayıt</span>
                            <span className="text-xl font-bold text-blue-600">
                                {visitorTrends.trend && visitorTrends.trend.length > 0
                                    ? Math.round(visitorTrends.trend.reduce((a: number, b: any) => a + parseInt(String(b.count)), 0) / visitorTrends.trend.length)
                                    : 0}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-600 text-sm">Günlük Ort. Kişi</span>
                            <span className="text-xl font-bold text-green-600">
                                {visitorTrends.trend && visitorTrends.trend.length > 0
                                    ? Math.round(visitorTrends.trend.reduce((a: number, b: any) => a + parseInt(String(b.total_persons || 0)), 0) / visitorTrends.trend.length)
                                    : 0}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-total-stats">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Toplam İstatistikler ({getDaysLabel()})</h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-600 text-sm">Toplam Kayıt</span>
                            <span className="text-xl font-bold text-purple-600">
                                {visitorTrends.trend ? visitorTrends.trend.reduce((a: number, b: any) => a + parseInt(String(b.count)), 0) : 0}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-gray-600 text-sm">Toplam Kişi</span>
                            <span className="text-xl font-bold text-indigo-600">
                                {visitorTrends.trend ? visitorTrends.trend.reduce((a: number, b: any) => a + parseInt(String(b.total_persons || 0)), 0) : 0}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-busy-days">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 En Yoğun Gün ({getDaysLabel()})</h3>
                    {visitorTrends.trend && visitorTrends.trend.length > 0 && (
                        <div className="space-y-2">
                            {[...visitorTrends.trend]
                                .sort((a: any, b: any) => parseInt(String(b.total_persons || 0)) - parseInt(String(a.total_persons || 0)))
                                .slice(0, 3)
                                .map((day: any, index: number) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                                                }`}>
                                                {index + 1}
                                            </span>
                                            <span className="text-sm text-gray-700">{formatDate(day.date)}</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-800">{day.total_persons} kişi</span>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
