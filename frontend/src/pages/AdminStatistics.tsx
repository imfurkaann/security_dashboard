import { useState, useEffect, useCallback } from 'react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import {
    Users, Car, UserCheck, Flame, FileText, TrendingUp, TrendingDown,
    Calendar, RefreshCw, ChevronDown
} from 'lucide-react';
import api from '../utils/api';
import WordCloud from '../components/WordCloud';
import CalendarHeatmap from '../components/CalendarHeatmap';

// Renk paleti
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
const CHART_COLORS = {
    primary: '#3B82F6',
    secondary: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6'
};

interface StatCard {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    change?: number;
}

interface TrendData {
    date: string;
    count: number;
    total_persons?: number;
}

const AdminStatistics = () => {
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [days, setDays] = useState(30);
    const [activeTab, setActiveTab] = useState<'overview' | 'visitors' | 'vehicles' | 'managers' | 'incidents' | 'fire-alarms'>('overview');

    // Data states
    const [generalStats, setGeneralStats] = useState<any>(null);
    const [visitorTrends, setVisitorTrends] = useState<any>({ trend: [], hourlyHeatmap: [], avgDuration: {}, durationDistribution: [], hostDistribution: [], electricStationVisitors: [], subcontractorVisitors: [], categoryComparison: [] });
    const [vehicleStats, setVehicleStats] = useState<any>({ trend: [], topVehicles: [], topManagers: [], statusDistribution: [], topDestinations: [], hourlyUsage: [], hourlyHeatmap: [], personnelVehicleUsage: [] });
    const [managerStats, setManagerStats] = useState<any>({ trend: [], topManagers: [], hourlyDistribution: [] });
    const [incidentStats, setIncidentStats] = useState<any>({ monthlyTrend: [], typeDistribution: [], severityDistribution: [] });
    const [fireAlarmStats, setFireAlarmStats] = useState<any>({ dailyTrend: [], monthlyTrend: [], locationDistribution: [], resolutionStats: [], hourlyTrend: [] });
    const [comparison, setComparison] = useState<any>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [generalRes, visitorRes, vehicleRes, managerRes, incidentRes, fireRes, compRes] = await Promise.all([
                api.get('/statistics/general'),
                api.get(`/statistics/visitors?period=${period}&days=${days}`),
                api.get(`/statistics/vehicles?period=${period}&days=${days}`),
                api.get(`/statistics/managers?period=${period}&days=${days}`),
                api.get(`/statistics/incidents?days=${days}`),
                api.get(`/statistics/fire-alarms?days=${days}`),
                api.get('/statistics/comparison')
            ]);

            setGeneralStats(generalRes.data.data);
            setVisitorTrends(visitorRes.data.data);
            setVehicleStats(vehicleRes.data.data);
            setManagerStats(managerRes.data.data);
            setIncidentStats(incidentRes.data.data);
            setFireAlarmStats(fireRes.data.data);
            setComparison(compRes.data.data);
        } catch (error) {
            console.error('İstatistik yükleme hatası:', error);
        } finally {
            setLoading(false);
        }
    }, [period, days]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('-') && dateStr.length === 10) {
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}`;
        }
        if (dateStr.length === 7) {
            const [year, month] = dateStr.split('-');
            const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
            return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
        }
        return dateStr;
    };

    const getChangePercent = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    };

    const StatCardComponent = ({ title, value, icon, color, change }: StatCard) => (
        <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500 mb-1">{title}</p>
                    <p className="text-3xl font-bold text-gray-800">{value.toLocaleString('tr-TR')}</p>
                    {change !== undefined && (
                        <div className={`flex items-center mt-2 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {change >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                            <span>{change >= 0 ? '+' : ''}{change}% geçen aya göre</span>
                        </div>
                    )}
                </div>
                <div className={`p-4 rounded-xl ${color}`}>
                    {icon}
                </div>
            </div>
        </div>
    );

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-700">{formatDate(label)}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm" style={{ color: entry.color }}>
                            {entry.name}: {entry.value.toLocaleString('tr-TR')}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (loading && !generalStats) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">📊 İstatistikler & Grafikler</h1>
                <p className="text-gray-500">Güvenlik verilerinizin detaylı analizi</p>
            </div>

            {/* Kontroller */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Periyot Seçimi */}
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-gray-400" />
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value as any)}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="daily">Günlük</option>
                            <option value="weekly">Haftalık</option>
                            <option value="monthly">Aylık</option>
                        </select>
                    </div>

                    {/* Gün Aralığı */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">Son</span>
                        <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value={7}>7 gün</option>
                            <option value={30}>30 gün</option>
                            <option value={90}>3 ay</option>
                            <option value={180}>6 ay</option>
                            <option value={365}>1 yıl</option>
                        </select>
                    </div>

                    {/* Yenile Butonu */}
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Yenile
                    </button>

                    {/* Tab Seçimi */}
                    <div className="flex-1 flex justify-end">
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            {[
                                { key: 'overview', label: 'Genel Bakış' },
                                { key: 'visitors', label: 'Ziyaretçiler' },
                                { key: 'vehicles', label: 'Araçlar' },
                                { key: 'fire-alarms', label: 'Yangın Alarmları' },
                                { key: 'incidents', label: 'Olaylar' }
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key as any)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && generalStats && (
                <>
                    {/* Özet Kartlar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <StatCardComponent
                            title="Bugün Ziyaretçi"
                            value={parseInt(generalStats.today?.today_visitors) || 0}
                            icon={<Users size={24} className="text-white" />}
                            color="bg-blue-500"
                            change={comparison?.weeklyComparison?.find((c: any) => c.category === 'visitors')
                                ? getChangePercent(
                                    parseInt(comparison.weeklyComparison.find((c: any) => c.category === 'visitors').current_week),
                                    parseInt(comparison.weeklyComparison.find((c: any) => c.category === 'visitors').previous_week)
                                ) : undefined}
                        />
                        <StatCardComponent
                            title="Bugün Araç"
                            value={parseInt(generalStats.today?.today_vehicles) || 0}
                            icon={<Car size={24} className="text-white" />}
                            color="bg-green-500"
                        />
                        <StatCardComponent
                            title="Bugün Alarm"
                            value={parseInt(generalStats.today?.today_alarms) || 0}
                            icon={<Flame size={24} className="text-white" />}
                            color="bg-red-500"
                        />
                    </div>

                    {/* Aktif Durumlar */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-blue-100 text-sm">Şu An İçeride</p>
                                    <p className="text-4xl font-bold mt-1">{parseInt(generalStats.active?.active_visitors) || 0}</p>
                                    <p className="text-blue-100 text-sm mt-1">Ziyaretçi</p>
                                </div>
                                <Users size={48} className="text-blue-200 opacity-50" />
                            </div>
                        </div>
                        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-green-100 text-sm">Kullanımda</p>
                                    <p className="text-4xl font-bold mt-1">{parseInt(generalStats.active?.active_vehicles) || 0}</p>
                                    <p className="text-green-100 text-sm mt-1">Araç</p>
                                </div>
                                <Car size={48} className="text-green-200 opacity-50" />
                            </div>
                        </div>
                    </div>

                    {/* Karşılaştırma Grafikleri */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* Aylık Karşılaştırma */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Aylık Karşılaştırma</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={(comparison?.monthlyComparison || []).filter((item: any) =>
                                    item.category !== 'managers' && item.category !== 'incidents'
                                )}>
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
                                    <Bar dataKey="current_month" name="Bu Ay" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="previous_month" name="Geçen Ay" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Genel Trend */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Ziyaretçi Trendi</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={visitorTrends.trend}>
                                    <defs>
                                        <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tickFormatter={formatDate} />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="count"
                                        name="Kayıt Sayısı"
                                        stroke={CHART_COLORS.primary}
                                        fillOpacity={1}
                                        fill="url(#colorVisitors)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Bu Ayki Özet */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">📅 Bu Ayki Toplam</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                                <p className="text-3xl font-bold text-blue-600">{parseInt(generalStats.month?.month_visitors) || 0}</p>
                                <p className="text-sm text-gray-600 mt-1">Ziyaretçi</p>
                            </div>
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                                <p className="text-3xl font-bold text-green-600">{parseInt(generalStats.month?.month_vehicles) || 0}</p>
                                <p className="text-sm text-gray-600 mt-1">Araç Kullanımı</p>
                            </div>
                            <div className="text-center p-4 bg-red-50 rounded-lg">
                                <p className="text-3xl font-bold text-red-600">{fireAlarmStats?.monthlyTrend?.reduce((a: number, b: any) => a + parseInt(b.total), 0) || 0}</p>
                                <p className="text-sm text-gray-600 mt-1">Yangın Alarmı</p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Visitors Tab */}
            {activeTab === 'visitors' && visitorTrends && (
                <div className="space-y-6">
                    {/* 1. Toplam İnsan Trafiği - Zaman Serisi */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">👥 Toplam İnsan Trafiği (Zaman Serisi)</h3>
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
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🔥 Giriş Saati Yoğunluğu (Gün x Saat Isı Haritası)</h3>
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="border border-gray-300 px-4 py-2 bg-gray-50">Gün \\ Saat</th>
                                            {Array.from({ length: 24 }, (_, i) => (
                                                <th key={i} className="border border-gray-300 px-2 py-2 bg-gray-50 text-xs">{String(i).padStart(2, '0')}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'].map((day, dayIndex) => {
                                            const dayData = visitorTrends.hourlyHeatmap.filter((h: any) => parseInt(h.day_of_week) === dayIndex);
                                            const maxCount = Math.max(...visitorTrends.hourlyHeatmap.map((h: any) => parseInt(h.total_persons || h.visit_count || 0)), 1);

                                            return (
                                                <tr key={dayIndex}>
                                                    <td className="border border-gray-300 px-4 py-2 font-medium bg-gray-50">{day}</td>
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
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">⏱️ Ziyaret Süresi İstatistikleri</h3>
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
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Ziyaret Süresi Dağılımı</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={visitorTrends.durationDistribution}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="duration_range" angle={-15} textAnchor="end" height={60} />
                                            <YAxis />
                                            <Tooltip />
                                            <Bar dataKey="count" name="Ziyaret Sayısı" fill={CHART_COLORS.purple} radius={[8, 8, 0, 0]}>
                                                {visitorTrends.durationDistribution.map((_: any, index: number) => (
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
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">👤 En Çok Ziyaret Edilen Kişiler</h3>
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
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Ziyaretçi Kategori Dağılımı</h3>
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

                            {/* Elektrik İstasyonu Ziyaretleri */}
                            {visitorTrends.electricStationVisitors && visitorTrends.electricStationVisitors.length > 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">⚡ Elektrik İstasyonu Ziyaretleri</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={visitorTrends.electricStationVisitors}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis dataKey="date" tickFormatter={formatDate} />
                                            <YAxis />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                            <Bar dataKey="total_persons" name="Kişi Sayısı" fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            {/* Taşeron İşçi Ziyaretleri */}
                            {visitorTrends.subcontractorVisitors && visitorTrends.subcontractorVisitors.length > 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">👷 Taşeron İşçi Ziyaretleri</h3>
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
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Günlük Ortalamalar</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-gray-600 text-sm">Günlük Ortalama Kayıt</span>
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

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Toplam İstatistikler</h3>
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

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 En Yoğun Gün</h3>
                            {visitorTrends.trend && visitorTrends.trend.length > 0 && (
                                <div className="space-y-2">
                                    {[...visitorTrends.trend]
                                        .sort((a: any, b: any) => parseInt(String(b.total_persons || 0)) - parseInt(String(a.total_persons || 0)))
                                        .slice(0, 3)
                                        .map((day: any, index: number) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
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
            )}

            {/* Vehicles Tab */}
            {activeTab === 'vehicles' && vehicleStats && (
                <div className="space-y-6">
                    {/* Araç Kullanım Trendi */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">🚗 Araç Kullanım Trendi</h3>
                        <ResponsiveContainer width="100%" height={350}>
                            <AreaChart data={vehicleStats.trend}>
                                <defs>
                                    <linearGradient id="colorVehicles" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tickFormatter={formatDate} />
                                <YAxis />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    name="Kullanım Sayısı"
                                    stroke={CHART_COLORS.secondary}
                                    fillOpacity={1}
                                    fill="url(#colorVehicles)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* En Çok Kullanılan Araçlar */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 En Çok Kullanılan Araçlar</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={vehicleStats.topVehicles} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis type="number" />
                                    <YAxis
                                        dataKey="plate"
                                        type="category"
                                        width={100}
                                        tick={{ fontSize: 12 }}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="usage_count" name="Kullanım" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]}>
                                        {vehicleStats.topVehicles.map((_: any, index: number) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* En Çok Araç Alan Yöneticiler */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">👤 En Çok Araç Alan Yöneticiler</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={vehicleStats.topManagers} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis type="number" />
                                    <YAxis
                                        dataKey="manager_name"
                                        type="category"
                                        width={120}
                                        tick={{ fontSize: 11 }}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="usage_count" name="Kullanım" fill={CHART_COLORS.warning} radius={[0, 4, 4, 0]}>
                                        {vehicleStats.topManagers.map((_: any, index: number) => (
                                            <Cell key={index} fill={COLORS[(index + 3) % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* En Çok Gidilen Lokasyonlar */}
                    {vehicleStats.topDestinations && vehicleStats.topDestinations.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📍 En Çok Gidilen Yerler</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={vehicleStats.topDestinations} layout="horizontal">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis type="category" dataKey="destination" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 10 }} />
                                    <YAxis type="number" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" name="Sefer Sayısı" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]}>
                                        {vehicleStats.topDestinations.map((_: any, index: number) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Gün x Saat Isı Haritası */}
                    {vehicleStats.hourlyHeatmap && vehicleStats.hourlyHeatmap.length > 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">🔥 Araç Kullanım Yoğunluğu (Gün x Saat Isı Haritası)</h3>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full border-collapse">
                                            <thead>
                                                <tr>
                                                    <th className="border border-gray-300 px-4 py-2 bg-gray-50">Gün \\ Saat</th>
                                                    {Array.from({ length: 24 }, (_, i) => (
                                                        <th key={i} className="border border-gray-300 px-2 py-2 bg-gray-50 text-xs">{String(i).padStart(2, '0')}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'].map((day, dayIndex) => {
                                                    const dayData = vehicleStats.hourlyHeatmap.filter((h: any) => parseInt(h.day_of_week) === dayIndex);
                                                    const maxCount = Math.max(...vehicleStats.hourlyHeatmap.map((h: any) => parseInt(h.count || 0)), 1);

                                                    return (
                                                        <tr key={dayIndex}>
                                                            <td className="border border-gray-300 px-4 py-2 font-medium bg-gray-50">{day}</td>
                                                            {Array.from({ length: 24 }, (_, hour) => {
                                                                const hourData = dayData.find((h: any) => parseInt(h.hour) === hour);
                                                                const count = hourData ? parseInt(hourData.count || 0) : 0;
                                                                const intensity = count / maxCount;
                                                                const bgColor = count === 0 ? '#f3f4f6' :
                                                                    intensity < 0.25 ? '#d1fae5' :
                                                                        intensity < 0.5 ? '#6ee7b7' :
                                                                            intensity < 0.75 ? '#10b981' : '#047857';
                                                                const textColor = intensity > 0.5 ? 'white' : 'black';

                                                                return (
                                                                    <td
                                                                        key={hour}
                                                                        className="border border-gray-300 px-2 py-2 text-center text-xs cursor-pointer hover:opacity-80 transition-opacity"
                                                                        style={{ backgroundColor: bgColor, color: textColor }}
                                                                        title={`${day} ${String(hour).padStart(2, '0')}:00 - ${count} araç`}
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
                                            <div className="w-4 h-4 border" style={{ backgroundColor: '#d1fae5' }}></div>
                                            <div className="w-4 h-4 border" style={{ backgroundColor: '#6ee7b7' }}></div>
                                            <div className="w-4 h-4 border" style={{ backgroundColor: '#10b981' }}></div>
                                            <div className="w-4 h-4 border" style={{ backgroundColor: '#047857' }}></div>
                                        </div>
                                        <span>Daha çok</span>
                                    </div>
                                </div>
                            )}

                    {/* Kelime Bulutu - En Çok Gidilen Yerler */}
                    {vehicleStats.topDestinations && vehicleStats.topDestinations.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">☁️ Hedef Lokasyonlar (Kelime Bulutu)</h3>
                            <div className="flex justify-center">
                                <WordCloud
                                    data={vehicleStats.topDestinations.map((item: any) => ({
                                        text: item.destination,
                                        value: item.count
                                    }))}
                                    width={800}
                                    height={400}
                                />
                            </div>
                        </div>
                    )}


                </div>
            )}

            {/* Managers Tab */}
            {/* Fire Alarms Tab */}
            {activeTab === 'fire-alarms' && (
                <div className="space-y-6">
                    {/* Özet Kartlar */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm">Toplam Alarm</p>
                                    <p className="text-3xl font-bold text-red-600 mt-2">
                                        {fireAlarmStats.monthlyTrend?.reduce((a: number, b: any) => a + parseInt(b.total || 0), 0) || 0}
                                    </p>
                                </div>
                                <Flame size={32} className="text-red-500" />
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm">Gerçek Alarm</p>
                                    <p className="text-3xl font-bold text-orange-600 mt-2">
                                        {fireAlarmStats.monthlyTrend?.reduce((a: number, b: any) => a + parseInt(b.real_alarms || 0), 0) || 0}
                                    </p>
                                </div>
                                <Flame size={32} className="text-orange-500" />
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm">Yanlış Alarm</p>
                                    <p className="text-3xl font-bold text-green-600 mt-2">
                                        {fireAlarmStats.monthlyTrend?.reduce((a: number, b: any) => a + parseInt(b.false_alarms || 0), 0) || 0}
                                    </p>
                                </div>
                                <Flame size={32} className="text-green-500" />
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm">Doğruluk Oranı</p>
                                    <p className="text-3xl font-bold text-blue-600 mt-2">
                                        {(() => {
                                            const total = fireAlarmStats.monthlyTrend?.reduce((a: number, b: any) => a + parseInt(b.total || 0), 0) || 0;
                                            const real = fireAlarmStats.monthlyTrend?.reduce((a: number, b: any) => a + parseInt(b.real_alarms || 0), 0) || 0;
                                            return total > 0 ? `${((real / total) * 100).toFixed(0)}%` : '0%';
                                        })()}
                                    </p>
                                </div>
                                <TrendingUp size={32} className="text-blue-500" />
                            </div>
                        </div>
                    </div>

                    {/* Günlük Alarm Sayısı - Bar Chart */}
                    {fireAlarmStats.dailyTrend && fireAlarmStats.dailyTrend.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Günlük Alarm Sayısı</h3>
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={fireAlarmStats.dailyTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tickFormatter={formatDate} />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" name="Toplam Alarm" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Saatlik Alarm Çalma Trendi */}
                    {fireAlarmStats.hourlyTrend && fireAlarmStats.hourlyTrend.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🕔 Saatlik Alarm Çalma Trendi</h3>
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={fireAlarmStats.hourlyTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis
                                        dataKey="hour"
                                        tickFormatter={(hour) => `${hour}:00`}
                                    />
                                    <YAxis />
                                    <Tooltip
                                        content={<CustomTooltip />}
                                        labelFormatter={(hour) => `Saat: ${hour}:00`}
                                    />
                                    <Legend />
                                    <Bar dataKey="real_alarms" name="Gerçek Alarm" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="false_alarms" name="Yanlış Alarm" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Alarm Türü Dağılımı - Pie Chart */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">🧩 Alarm Türü Dağılımı</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={[
                                        {
                                            name: 'Gerçek Alarm',
                                            value: fireAlarmStats.monthlyTrend?.reduce((a: number, b: any) => a + parseInt(b.real_alarms || 0), 0) || 0
                                        },
                                        {
                                            name: 'Yanlış Alarm',
                                            value: fireAlarmStats.monthlyTrend?.reduce((a: number, b: any) => a + parseInt(b.false_alarms || 0), 0) || 0
                                        }
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                                    outerRadius={100}
                                    dataKey="value"
                                >
                                    <Cell fill={CHART_COLORS.danger} />
                                    <Cell fill={CHART_COLORS.secondary} />
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Lokasyon Kelime Bulutu */}
                    {fireAlarmStats.locationDistribution && fireAlarmStats.locationDistribution.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">☁️ Alarm Lokasyonları (Kelime Bulutu)</h3>
                            <div className="flex justify-center">
                                <WordCloud
                                    data={fireAlarmStats.locationDistribution.map((item: any) => ({
                                        text: item.location,
                                        value: item.count
                                    }))}
                                    width={900}
                                    height={400}
                                />
                            </div>
                        </div>
                    )}

                    {/* Lokasyon Bar Chart */}
                    {fireAlarmStats.locationDistribution && fireAlarmStats.locationDistribution.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📍 En Çok Alarm Olan Lokasyonlar</h3>
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={fireAlarmStats.locationDistribution.slice(0, 10)} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis type="number" />
                                    <YAxis dataKey="location" type="category" width={150} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" name="Alarm Sayısı" fill={CHART_COLORS.danger} radius={[0, 4, 4, 0]}>
                                        {fireAlarmStats.locationDistribution.slice(0, 10).map((_: any, index: number) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Aylık Trend - Line Chart */}
                    {fireAlarmStats.monthlyTrend && fireAlarmStats.monthlyTrend.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📉 Alarm Eğilimi (Aylık)</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={fireAlarmStats.monthlyTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tickFormatter={formatDate} />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Line type="monotone" dataKey="total" name="Toplam Alarm" stroke={CHART_COLORS.danger} strokeWidth={2} dot={{ r: 4 }} />
                                    <Line type="monotone" dataKey="real_alarms" name="Gerçek" stroke={CHART_COLORS.warning} strokeWidth={2} dot={{ r: 4 }} />
                                    <Line type="monotone" dataKey="false_alarms" name="Yanlış" stroke={CHART_COLORS.secondary} strokeWidth={2} dot={{ r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* Incidents Tab */}
            {activeTab === 'incidents' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Olay Trendi */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Olay Kaydı Trendi</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <AreaChart data={incidentStats?.monthlyTrend || []}>
                                    <defs>
                                        <linearGradient id="colorIncidents" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CHART_COLORS.purple} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={CHART_COLORS.purple} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tickFormatter={formatDate} />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="count"
                                        name="Olay Sayısı"
                                        stroke={CHART_COLORS.purple}
                                        fillOpacity={1}
                                        fill="url(#colorIncidents)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Yangın Alarmı Trendi */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🔥 Yangın Alarmı Trendi</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={fireAlarmStats?.monthlyTrend || []}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tickFormatter={formatDate} />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Bar dataKey="real_alarms" name="Gerçek Alarm" fill={CHART_COLORS.danger} stackId="a" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="false_alarms" name="Yanlış Alarm" fill={CHART_COLORS.warning} stackId="a" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Olay Türü Dağılımı */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Olay Türü Dağılımı</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={incidentStats?.typeDistribution || []}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        dataKey="count"
                                        nameKey="type"
                                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                    >
                                        {(incidentStats?.typeDistribution || []).map((_: any, index: number) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Ciddiyet Dağılımı */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">⚠️ Ciddiyet Dağılımı</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={(incidentStats?.severityDistribution || []).map((s: any) => ({
                                            ...s,
                                            name: {
                                                'low': 'Düşük',
                                                'medium': 'Orta',
                                                'high': 'Yüksek',
                                                'critical': 'Kritik'
                                            }[s.severity] || s.severity
                                        }))}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        dataKey="count"
                                        nameKey="name"
                                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                    >
                                        {(incidentStats?.severityDistribution || []).map((s: any, index: number) => (
                                            <Cell
                                                key={index}
                                                fill={
                                                    s.severity === 'critical' ? '#EF4444' :
                                                        s.severity === 'high' ? '#F59E0B' :
                                                            s.severity === 'medium' ? '#3B82F6' :
                                                                '#10B981'
                                                }
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Vardiya Dağılımı */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🕐 Vardiya Dağılımı</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={incidentStats?.shiftDistribution || []}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={40}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="count"
                                        nameKey="shift"
                                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                                    >
                                        {(incidentStats?.shiftDistribution || []).map((_: any, index: number) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Alarm Lokasyon Dağılımı */}
                    {fireAlarmStats?.locationDistribution && fireAlarmStats.locationDistribution.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📍 Alarm Lokasyonları</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={fireAlarmStats.locationDistribution}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="location" />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" name="Alarm Sayısı" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]}>
                                        {fireAlarmStats.locationDistribution.map((_: any, index: number) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminStatistics;
