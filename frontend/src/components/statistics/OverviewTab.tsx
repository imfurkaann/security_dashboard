import { useState, useEffect } from 'react';
import {
    BarChart, Bar, AreaChart, Area, PieChart, Pie,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { Users, Car, Flame, TrendingUp, TrendingDown } from 'lucide-react';
import api from '../../utils/api';

const CHART_COLORS = {
    primary: '#3B82F6',
    secondary: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6'
};

interface OverviewTabProps {
    startDate: string;
    endDate: string;
    refetchKey: number;
    getDaysLabel: () => string;
    getComparisonLabel: () => { current: string; previous: string; type: string };
    getRangeDays: () => number;
    formatDate: (dateStr: string) => string;
    CustomTooltip: any;
}

export default function OverviewTab({
    startDate,
    endDate,
    refetchKey,
    getDaysLabel,
    getComparisonLabel,
    getRangeDays,
    formatDate,
    CustomTooltip
}: OverviewTabProps) {
    const [loading, setLoading] = useState(true);
    const [generalStats, setGeneralStats] = useState<any>(null);
    const [visitorTrends, setVisitorTrends] = useState<any>({ trend: [], tagTrends: [] });
    const [vehicleStats, setVehicleStats] = useState<any>({ trend: [] });
    const [incidentStats, setIncidentStats] = useState<any>({ categoryStats: {} });
    const [fireAlarmStats, setFireAlarmStats] = useState<any>({ dailyTrend: [] });
    const [comparison, setComparison] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchOverviewData = async () => {
            setLoading(true);
            try {
                const [generalRes, compRes, visitorRes, vehicleRes, incidentRes, fireRes] = await Promise.all([
                    api.get('/statistics/general'),
                    api.get('/statistics/comparison'),
                    api.get(`/statistics/visitors?period=daily&startDate=${startDate}&endDate=${endDate}`),
                    api.get(`/statistics/vehicles?period=daily&startDate=${startDate}&endDate=${endDate}`),
                    api.get(`/statistics/incidents?startDate=${startDate}&endDate=${endDate}`),
                    api.get(`/statistics/fire-alarms?startDate=${startDate}&endDate=${endDate}`)
                ]);

                if (isMounted) {
                    setGeneralStats(generalRes.data.data);
                    setComparison(compRes.data.data);
                    setVisitorTrends(visitorRes.data.data);
                    setVehicleStats(vehicleRes.data.data);
                    setIncidentStats(incidentRes.data.data);
                    setFireAlarmStats(fireRes.data.data);
                }
            } catch (error) {
                console.error('Genel bakış istatistik yükleme hatası:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchOverviewData();
        return () => {
            isMounted = false;
        };
    }, [startDate, endDate, refetchKey]);

    const getChangePercent = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    };

    if (loading && !generalStats) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <>
            {/* Dönem Bazlı Değişim Kartları */}
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm text-slate-600">📅 <strong className="text-slate-900">{getDaysLabel()}</strong> verilerini görüntülüyorsunuz</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Ziyaretçi Değişimi */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-3 bg-blue-100 rounded-xl">
                            <Users size={24} className="text-blue-600" />
                        </div>
                        {(() => {
                            const comparisonType = getComparisonLabel().type;
                            const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                            const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                            const previousKey = comparisonType === 'weekly' ? 'previous_week' : 'previous_month';
                            const record = comparisonArray?.find((c: any) => c.category === 'visitors');
                            const current = parseInt(record?.[currentKey]) || 0;
                            const previous = parseInt(record?.[previousKey]) || 0;
                            const change = getChangePercent(current, previous);
                            return (
                                <span className={`flex items-center text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {change >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                                    {change >= 0 ? '+' : ''}{change}%
                                </span>
                            );
                        })()}
                    </div>
                    <p className="text-2xl font-bold text-gray-800">
                        {(() => {
                            const comparisonType = getComparisonLabel().type;
                            const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                            const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                            const record = comparisonArray?.find((c: any) => c.category === 'visitors');
                            return parseInt(record?.[currentKey]) || 0;
                        })()}
                    </p>
                    <p className="text-sm text-gray-500">{getComparisonLabel().current} Ziyaretçi</p>
                    <p className="text-xs text-gray-400 mt-1">
                        {getComparisonLabel().previous}: {(() => {
                            const comparisonType = getComparisonLabel().type;
                            const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                            const previousKey = comparisonType === 'weekly' ? 'previous_week' : 'previous_month';
                            const record = comparisonArray?.find((c: any) => c.category === 'visitors');
                            return parseInt(record?.[previousKey]) || 0;
                        })()}
                    </p>
                </div>

                {/* Araç Değişimi */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-3 bg-green-100 rounded-xl">
                            <Car size={24} className="text-green-600" />
                        </div>
                        {(() => {
                            const comparisonType = getComparisonLabel().type;
                            const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                            const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                            const previousKey = comparisonType === 'weekly' ? 'previous_week' : 'previous_month';
                            const record = comparisonArray?.find((c: any) => c.category === 'vehicles');
                            const current = parseInt(record?.[currentKey]) || 0;
                            const previous = parseInt(record?.[previousKey]) || 0;
                            const change = getChangePercent(current, previous);
                            return (
                                <span className={`flex items-center text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {change >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                                    {change >= 0 ? '+' : ''}{change}%
                                </span>
                            );
                        })()}
                    </div>
                    <p className="text-2xl font-bold text-gray-800">
                        {(() => {
                            const comparisonType = getComparisonLabel().type;
                            const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                            const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                            const record = comparisonArray?.find((c: any) => c.category === 'vehicles');
                            return parseInt(record?.[currentKey]) || 0;
                        })()}
                    </p>
                    <p className="text-sm text-gray-500">{getComparisonLabel().current} Araç</p>
                    <p className="text-xs text-gray-400 mt-1">
                        {getComparisonLabel().previous}: {(() => {
                            const comparisonType = getComparisonLabel().type;
                            const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                            const previousKey = comparisonType === 'weekly' ? 'previous_week' : 'previous_month';
                            const record = comparisonArray?.find((c: any) => c.category === 'vehicles');
                            return parseInt(record?.[previousKey]) || 0;
                        })()}
                    </p>
                </div>

                {/* Alarm Değişimi */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="p-3 bg-red-100 rounded-xl">
                            <Flame size={24} className="text-red-600" />
                        </div>
                        {(() => {
                            const comparisonType = getComparisonLabel().type;
                            const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                            const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                            const previousKey = comparisonType === 'weekly' ? 'previous_week' : 'previous_month';
                            const record = comparisonArray?.find((c: any) => c.category === 'fire_alarms');
                            const current = parseInt(record?.[currentKey]) || 0;
                            const previous = parseInt(record?.[previousKey]) || 0;
                            const change = getChangePercent(current, previous);
                            return (
                                <span className={`flex items-center text-sm font-medium ${change <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {change >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                                    {change >= 0 ? '+' : ''}{change}%
                                </span>
                            );
                        })()}
                    </div>
                    <p className="text-2xl font-bold text-gray-800">
                        {(() => {
                            const comparisonType = getComparisonLabel().type;
                            const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                            const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                            const record = comparisonArray?.find((c: any) => c.category === 'fire_alarms');
                            return parseInt(record?.[currentKey]) || 0;
                        })()}
                    </p>
                    <p className="text-sm text-gray-500">{getComparisonLabel().current} Alarm</p>
                    <p className="text-xs text-gray-400 mt-1">
                        {getComparisonLabel().previous}: {(() => {
                            const comparisonType = getComparisonLabel().type;
                            const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                            const previousKey = comparisonType === 'weekly' ? 'previous_week' : 'previous_month';
                            const record = comparisonArray?.find((c: any) => c.category === 'fire_alarms');
                            return parseInt(record?.[previousKey]) || 0;
                        })()}
                    </p>
                </div>
            </div>

            {/* Dönemsel Karşılaştırma */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm mb-6" data-chart-id="comparison">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Dönemsel Karşılaştırma ({getDaysLabel()})</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={(() => {
                        const daysCount = getRangeDays();
                        const comparisonData = daysCount <= 14 ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                        const currentKey = daysCount <= 14 ? 'current_week' : 'current_month';
                        const previousKey = daysCount <= 14 ? 'previous_week' : 'previous_month';

                        return (comparisonData || []).filter((item: any) => ['visitors', 'vehicles', 'fire_alarms'].includes(item.category)).map((item: any) => ({
                            ...item,
                            current: parseInt(item[currentKey]) || 0,
                            previous: parseInt(item[previousKey]) || 0
                        }));
                    })()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                            dataKey="category"
                            tickFormatter={(v) => {
                                const labels: Record<string, string> = {
                                    visitors: 'Ziyaretçi',
                                    vehicles: 'Araç',
                                    fire_alarms: 'Alarm'
                                };
                                return labels[v] || v;
                            }}
                        />
                        <YAxis />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="current" name={getComparisonLabel().current} fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="previous" name={getComparisonLabel().previous} fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Tüm Kategoriler Trendi */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Ziyaretçi Trendi */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-trend">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">👥 Ziyaretçi Trendi ({getDaysLabel()})</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={visitorTrends.trend}>
                            <defs>
                                <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="total_persons"
                                name="Kişi Sayısı"
                                stroke={CHART_COLORS.primary}
                                fillOpacity={1}
                                fill="url(#colorVisitors)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Araç Trendi */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="vehicle-trend">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">🚗 Araç Kullanım Trendi ({getDaysLabel()})</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={vehicleStats.trend}>
                            <defs>
                                <linearGradient id="colorVehiclesOverview" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="count"
                                name="Kullanım Sayısı"
                                stroke={CHART_COLORS.secondary}
                                fillOpacity={1}
                                fill="url(#colorVehiclesOverview)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Olay Kategori Dağılımı Pasta Grafiği */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-distribution">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">🚨 Olay Kategori Dağılımı ({getDaysLabel()})</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={[
                                    { name: 'Hırsızlık', value: parseInt(incidentStats?.categoryStats?.theft_total) || 0 },
                                    { name: 'Saldırı/Kavga', value: parseInt(incidentStats?.categoryStats?.assault_total) || 0 },
                                    { name: 'Tıbbi Acil', value: parseInt(incidentStats?.categoryStats?.medical_total) || 0 },
                                    { name: 'Vandalizm', value: parseInt(incidentStats?.categoryStats?.vandalism_total) || 0 },
                                    { name: 'Kaza', value: parseInt(incidentStats?.categoryStats?.accident_total) || 0 },
                                    { name: 'Madde Kullanımı', value: parseInt(incidentStats?.categoryStats?.substance_total) || 0 }
                                ].filter(item => item.value > 0)}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => (percent && percent > 0.05) ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                                outerRadius={100}
                                dataKey="value"
                            >
                                <Cell fill="#EF4444" />
                                <Cell fill="#F59E0B" />
                                <Cell fill="#3B82F6" />
                                <Cell fill="#8B5CF6" />
                                <Cell fill="#10B981" />
                                <Cell fill="#EC4899" />
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Dönem Özeti */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">📅 {getDaysLabel()} Toplam</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <p className="text-3xl font-bold text-blue-600">
                                {(() => {
                                    const comparisonType = getComparisonLabel().type;
                                    const comparisonData = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                    const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                                    const visitorData = comparisonData?.find((c: any) => c.category === 'visitors');
                                    return parseInt(visitorData?.[currentKey]) || 0;
                                })()}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">Ziyaretçi</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                            <p className="text-3xl font-bold text-green-600">
                                {(() => {
                                    const comparisonType = getComparisonLabel().type;
                                    const comparisonData = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                    const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                                    const vehicleData = comparisonData?.find((c: any) => c.category === 'vehicles');
                                    return parseInt(vehicleData?.[currentKey]) || 0;
                                })()}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">Araç Kullanımı</p>
                        </div>
                        <div className="text-center p-4 bg-red-50 rounded-lg">
                            <p className="text-3xl font-bold text-red-600">
                                {(() => {
                                    const comparisonType = getComparisonLabel().type;
                                    const comparisonData = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                    const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                                    const alarmData = comparisonData?.find((c: any) => c.category === 'fire_alarms');
                                    return parseInt(alarmData?.[currentKey]) || 0;
                                })()}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">Yangın Alarmı</p>
                        </div>
                    </div>
                    {visitorTrends.tagTrends && visitorTrends.tagTrends.length > 0 && (() => {
                        const tags = [
                            { key: 'entry_tag', label: 'Giriş Etiketi', color: '#3b82f6', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
                            { key: 'exit_tag', label: 'Çıkış Etiketi', color: '#6366f1', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
                            { key: 'subcontractor_worker', label: 'Taşeron İşçi', color: '#8b5cf6', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
                            { key: 'for_electric_station', label: 'Şarj İstasyonu', color: '#eab308', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
                            { key: 'daily_guest', label: 'Günübirlik Misafir', color: '#14b8a6', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
                            { key: 'tour_entry', label: 'Tur Giriş', color: '#f97316', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
                            { key: 'tour_exit', label: 'Tur Çıkış', color: '#ef4444', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
                            { key: 'meeting', label: 'Görüşme', color: '#ec4899', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
                            { key: 'delivery', label: 'Teslimat', color: '#22c55e', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
                            { key: 'guide', label: 'Rehber', color: '#a855f7', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' }
                        ];

                        const tagTotals = tags.map(tag => {
                            const total = visitorTrends.tagTrends.reduce((sum: number, day: any) => sum + (parseInt(String(day[tag.key] || 0)) || 0), 0);
                            return { ...tag, total };
                        }).filter(t => t.total > 0);

                        if (tagTotals.length === 0) return null;

                        return (
                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">🏷️ Aktif Etiket Toplamları ({getDaysLabel()})</h4>
                                <div className="flex flex-wrap gap-2.5">
                                    {tagTotals.map((tag) => (
                                        <div 
                                            key={tag.key} 
                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${tag.bg} ${tag.text} ${tag.border} text-xs font-semibold shadow-sm transition-all duration-200 hover:scale-105`}
                                        >
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                                            <span>{tag.label}:</span>
                                            <span className="text-sm font-extrabold">{tag.total}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* En Yoğun Günler */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Ziyaretçi En Yoğun */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="busy-days-visitor">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 Ziyaretçi - En Yoğun Günler ({getDaysLabel()})</h3>
                    {visitorTrends.trend && visitorTrends.trend.length > 0 && (
                        <div className="space-y-2">
                            {[...visitorTrends.trend]
                                .sort((a: any, b: any) => parseInt(String(b.total_persons || 0)) - parseInt(String(a.total_persons || 0)))
                                .slice(0, 5)
                                .map((day: any, index: number) => (
                                    <div key={index} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                                                }`}>
                                                {index + 1}
                                            </span>
                                            <span className="text-sm text-gray-700 truncate">{formatDate(day.date)}</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-800">{parseInt(day.total_persons || 0)} kişi</span>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                {/* Araç En Yoğun */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="busy-days-vehicle">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">🚗 Araç - En Yoğun Günler ({getDaysLabel()})</h3>
                    {vehicleStats.trend && vehicleStats.trend.length > 0 && (
                        <div className="space-y-2">
                            {[...vehicleStats.trend]
                                .sort((a: any, b: any) => parseInt(String(b.count || 0)) - parseInt(String(a.count || 0)))
                                .slice(0, 5)
                                .map((day: any, index: number) => (
                                    <div key={index} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                                                }`}>
                                                {index + 1}
                                            </span>
                                            <span className="text-sm text-gray-700 truncate">{formatDate(day.date)}</span>
                                        </div>
                                        <span className="text-sm font-bold text-gray-800">{parseInt(day.count || 0)} araç</span>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                {/* Günlük Ortalamalar */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="daily-averages">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Günlük Ortalamalar ({getDaysLabel()})</h3>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                            <span className="text-gray-600 text-sm">Ziyaretçi</span>
                            <span className="text-xl font-bold text-blue-600">
                                {visitorTrends.trend && visitorTrends.trend.length > 0
                                    ? Math.round(visitorTrends.trend.reduce((a: number, b: any) => a + parseInt(String(b.total_persons || 0)), 0) / visitorTrends.trend.length)
                                    : 0}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                            <span className="text-gray-600 text-sm">Araç</span>
                            <span className="text-xl font-bold text-green-600">
                                {vehicleStats.trend && vehicleStats.trend.length > 0
                                    ? Math.round(vehicleStats.trend.reduce((a: number, b: any) => a + parseInt(String(b.count || 0)), 0) / vehicleStats.trend.length)
                                    : 0}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                            <span className="text-gray-600 text-sm">Alarm</span>
                            <span className="text-xl font-bold text-red-600">
                                {fireAlarmStats.dailyTrend && fireAlarmStats.dailyTrend.length > 0
                                    ? (fireAlarmStats.dailyTrend.reduce((a: number, b: any) => a + parseInt(String(b.count || 0)), 0) / fireAlarmStats.dailyTrend.length).toFixed(1)
                                    : 0}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Etiket Analizleri (Günlük) */}
            {visitorTrends.tagTrends && visitorTrends.tagTrends.length > 0 && (() => {
                const tags = [
                    { key: 'entry_tag', label: 'Giriş Etiketi', color: '#3b82f6' },
                    { key: 'exit_tag', label: 'Çıkış Etiketi', color: '#6366f1' },
                    { key: 'subcontractor_worker', label: 'Taşeron İşçi', color: '#8b5cf6' },
                    { key: 'for_electric_station', label: 'Şarj İstasyonu', color: '#eab308' },
                    { key: 'daily_guest', label: 'Günübirlik Misafir', color: '#14b8a6' },
                    { key: 'tour_entry', label: 'Tur Giriş', color: '#f97316' },
                    { key: 'tour_exit', label: 'Tur Çıkış', color: '#ef4444' },
                    { key: 'meeting', label: 'Görüşme', color: '#ec4899' },
                    { key: 'delivery', label: 'Teslimat', color: '#22c55e' },
                    { key: 'guide', label: 'Rehber', color: '#a855f7' }
                ];

                const activeTags = tags.filter(tag => 
                    visitorTrends.tagTrends.some((d: any) => parseInt(String(d[tag.key] || 0)) > 0)
                );

                if (activeTags.length === 0) return null;

                return (
                    <div className="space-y-6 mt-6">
                        <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-800">🏷️ Günlük Etiket Dağılımları ({getDaysLabel()})</h3>
                            <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                                {activeTags.length} Aktif Etiket
                            </span>
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                            {activeTags.map((tag) => (
                                <div key={tag.key} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: tag.color }}></span>
                                        {tag.label} Dağılımı (Günlük)
                                    </h4>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart data={visitorTrends.tagTrends}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Bar dataKey={tag.key} name={tag.label} fill={tag.color} radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </>
    );
}
