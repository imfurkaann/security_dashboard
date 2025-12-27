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

    // Dinamik etiketler için yardımcı fonksiyonlar
    const getPeriodLabel = () => {
        switch (period) {
            case 'daily': return 'Günlük';
            case 'weekly': return 'Haftalık';
            case 'monthly': return 'Aylık';
            default: return 'Günlük';
        }
    };

    const getDaysLabel = () => {
        switch (days) {
            case 7: return 'Son 7 Gün';
            case 30: return 'Son 30 Gün';
            case 90: return 'Son 3 Ay';
            case 180: return 'Son 6 Ay';
            case 365: return 'Son 1 Yıl';
            default: return `Son ${days} Gün`;
        }
    };

    const getComparisonLabel = () => {
        if (days <= 14) return { current: 'Bu Hafta', previous: 'Geçen Hafta', type: 'weekly' };
        if (days <= 60) return { current: 'Bu Ay', previous: 'Geçen Ay', type: 'monthly' };
        if (days <= 180) return { current: 'Bu Dönem', previous: 'Önceki Dönem', type: 'quarterly' };
        return { current: 'Bu Yıl', previous: 'Geçen Yıl', type: 'yearly' };
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
                    {/* Dönem Bazlı Değişim Kartları */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-blue-700">📅 <strong>{getDaysLabel()}</strong> verilerini görüntülüyorsunuz ({getPeriodLabel()} bazında)</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        {/* Ziyaretçi Değişimi */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-3 bg-blue-100 rounded-xl">
                                    <Users size={24} className="text-blue-600" />
                                </div>
                                {(() => {
                                    const current = parseInt(comparison?.weeklyComparison?.find((c: any) => c.category === 'visitors')?.current_week) || 0;
                                    const previous = parseInt(comparison?.weeklyComparison?.find((c: any) => c.category === 'visitors')?.previous_week) || 0;
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
                                {parseInt(comparison?.weeklyComparison?.find((c: any) => c.category === 'visitors')?.current_week) || 0}
                            </p>
                            <p className="text-sm text-gray-500">{getComparisonLabel().current} Ziyaretçi</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {getComparisonLabel().previous}: {parseInt(comparison?.weeklyComparison?.find((c: any) => c.category === 'visitors')?.previous_week) || 0}
                            </p>
                        </div>

                        {/* Araç Değişimi */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-3 bg-green-100 rounded-xl">
                                    <Car size={24} className="text-green-600" />
                                </div>
                                {(() => {
                                    const current = parseInt(comparison?.weeklyComparison?.find((c: any) => c.category === 'vehicles')?.current_week) || 0;
                                    const previous = parseInt(comparison?.weeklyComparison?.find((c: any) => c.category === 'vehicles')?.previous_week) || 0;
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
                                {parseInt(comparison?.weeklyComparison?.find((c: any) => c.category === 'vehicles')?.current_week) || 0}
                            </p>
                            <p className="text-sm text-gray-500">{getComparisonLabel().current} Araç</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {getComparisonLabel().previous}: {parseInt(comparison?.weeklyComparison?.find((c: any) => c.category === 'vehicles')?.previous_week) || 0}
                            </p>
                        </div>

                        {/* Alarm Değişimi */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="p-3 bg-red-100 rounded-xl">
                                    <Flame size={24} className="text-red-600" />
                                </div>
                                {(() => {
                                    const current = parseInt(comparison?.weeklyComparison?.find((c: any) => c.category === 'fire_alarms')?.current_week) || 0;
                                    const previous = parseInt(comparison?.weeklyComparison?.find((c: any) => c.category === 'fire_alarms')?.previous_week) || 0;
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
                                {parseInt(comparison?.weeklyComparison?.find((c: any) => c.category === 'fire_alarms')?.current_week) || 0}
                            </p>
                            <p className="text-sm text-gray-500">{getComparisonLabel().current} Alarm</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {getComparisonLabel().previous}: {parseInt(comparison?.weeklyComparison?.find((c: any) => c.category === 'fire_alarms')?.previous_week) || 0}
                            </p>
                        </div>
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
                        {/* Haftalık Karşılaştırma */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Haftalık Karşılaştırma</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={(comparison?.weeklyComparison || []).filter((item: any) => ['visitors', 'vehicles', 'fire_alarms'].includes(item.category)).map((item: any) => ({
                                    ...item,
                                    current_week: parseInt(item.current_week) || 0,
                                    previous_week: parseInt(item.previous_week) || 0
                                }))}>
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
                                    <Bar dataKey="current_week" name={getComparisonLabel().current} fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="previous_week" name={getComparisonLabel().previous} fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Dönemsel Karşılaştırma */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Dönemsel Karşılaştırma ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={(() => {
                                    // Eğer 7 gün seçiliyse weekly, diğerleri için monthly kullan
                                    const comparisonData = days === 7 ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                    const currentKey = days === 7 ? 'current_week' : 'current_month';
                                    const previousKey = days === 7 ? 'previous_week' : 'previous_month';

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
                    </div>

                    {/* Tüm Kategoriler Trendi */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* Ziyaretçi Trendi */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">👥 Ziyaretçi Trendi ({getDaysLabel()} - {getPeriodLabel()})</h3>
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
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🚗 Araç Kullanım Trendi ({getDaysLabel()} - {getPeriodLabel()})</h3>
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
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
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
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📅 {getDaysLabel()} Toplam</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-blue-50 rounded-lg">
                                    <p className="text-3xl font-bold text-blue-600">
                                        {(() => {
                                            const comparisonData = days === 7 ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                            const currentKey = days === 7 ? 'current_week' : 'current_month';
                                            const visitorData = comparisonData?.find((c: any) => c.category === 'visitors');
                                            return parseInt(visitorData?.[currentKey]) || 0;
                                        })()}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">Ziyaretçi</p>
                                </div>
                                <div className="text-center p-4 bg-green-50 rounded-lg">
                                    <p className="text-3xl font-bold text-green-600">
                                        {(() => {
                                            const comparisonData = days === 7 ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                            const currentKey = days === 7 ? 'current_week' : 'current_month';
                                            const vehicleData = comparisonData?.find((c: any) => c.category === 'vehicles');
                                            return parseInt(vehicleData?.[currentKey]) || 0;
                                        })()}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">Araç Kullanımı</p>
                                </div>
                                <div className="text-center p-4 bg-red-50 rounded-lg">
                                    <p className="text-3xl font-bold text-red-600">
                                        {(() => {
                                            const comparisonData = days === 7 ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                            const currentKey = days === 7 ? 'current_week' : 'current_month';
                                            const alarmData = comparisonData?.find((c: any) => c.category === 'fire_alarms');
                                            return parseInt(alarmData?.[currentKey]) || 0;
                                        })()}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">Yangın Alarmı</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* En Yoğun Günler */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Ziyaretçi En Yoğun */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 Ziyaretçi - En Yoğun Günler ({getDaysLabel()})</h3>
                            {visitorTrends.trend && visitorTrends.trend.length > 0 && (
                                <div className="space-y-2">
                                    {[...visitorTrends.trend]
                                        .sort((a: any, b: any) => parseInt(String(b.total_persons || 0)) - parseInt(String(a.total_persons || 0)))
                                        .slice(0, 5)
                                        .map((day: any, index: number) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                                                        }`}>
                                                        {index + 1}
                                                    </span>
                                                    <span className="text-sm text-gray-700">{formatDate(day.date)}</span>
                                                </div>
                                                <span className="text-sm font-bold text-gray-800">{parseInt(day.total_persons || 0)} kişi</span>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Araç En Yoğun */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🚗 Araç - En Yoğun Günler ({getDaysLabel()})</h3>
                            {vehicleStats.trend && vehicleStats.trend.length > 0 && (
                                <div className="space-y-2">
                                    {[...vehicleStats.trend]
                                        .sort((a: any, b: any) => parseInt(String(b.count || 0)) - parseInt(String(a.count || 0)))
                                        .slice(0, 5)
                                        .map((day: any, index: number) => (
                                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                                                        }`}>
                                                        {index + 1}
                                                    </span>
                                                    <span className="text-sm text-gray-700">{formatDate(day.date)}</span>
                                                </div>
                                                <span className="text-sm font-bold text-gray-800">{parseInt(day.count || 0)} araç</span>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Günlük Ortalamalar */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 {getPeriodLabel()} Ortalamalar</h3>
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
                </>
            )}

            {/* Visitors Tab */}
            {activeTab === 'visitors' && visitorTrends && (
                <div className="space-y-6">
                    {/* Dönem Bilgisi Başlık */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <p className="text-blue-700 text-sm font-medium">📅 {getDaysLabel()} verilerini görüntülüyorsunuz ({getPeriodLabel()} bazında)</p>
                    </div>

                    {/* 1. Toplam İnsan Trafiği - Zaman Serisi */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">👥 Toplam İnsan Trafiği ({getDaysLabel()} - {getPeriodLabel()})</h3>
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
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🔥 Giriş Saati Yoğunluğu ({getDaysLabel()} - Gün x Saat)</h3>
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
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
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
                            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
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
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
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

                            {/* Elektrik İstasyonu Ziyaretleri */}
                            {visitorTrends.electricStationVisitors && visitorTrends.electricStationVisitors.length > 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">⚡ Elektrik İstasyonu Ziyaretleri ({getDaysLabel()} - {getPeriodLabel()})</h3>
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
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">👷 Taşeron İşçi Ziyaretleri ({getDaysLabel()} - {getPeriodLabel()})</h3>
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
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 {getPeriodLabel()} Ortalamalar ({getDaysLabel()})</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-gray-600 text-sm">{getPeriodLabel()} Ort. Kayıt</span>
                                    <span className="text-xl font-bold text-blue-600">
                                        {visitorTrends.trend && visitorTrends.trend.length > 0
                                            ? Math.round(visitorTrends.trend.reduce((a: number, b: any) => a + parseInt(String(b.count)), 0) / visitorTrends.trend.length)
                                            : 0}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-gray-600 text-sm">{getPeriodLabel()} Ort. Kişi</span>
                                    <span className="text-xl font-bold text-green-600">
                                        {visitorTrends.trend && visitorTrends.trend.length > 0
                                            ? Math.round(visitorTrends.trend.reduce((a: number, b: any) => a + parseInt(String(b.total_persons || 0)), 0) / visitorTrends.trend.length)
                                            : 0}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
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

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 En Yoğun Gün ({getDaysLabel()})</h3>
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
                    {/* Dönem Bilgisi Başlık */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <p className="text-blue-700 text-sm font-medium">📅 {getDaysLabel()} verilerini görüntülüyorsunuz ({getPeriodLabel()} bazında)</p>
                    </div>

                    {/* Araç Kullanım Trendi */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">🚗 Araç Kullanım Trendi ({getDaysLabel()} - {getPeriodLabel()})</h3>
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
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 En Çok Kullanılan Araçlar ({getDaysLabel()})</h3>
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
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">👤 En Çok Araç Alan Yöneticiler ({getDaysLabel()})</h3>
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
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📍 En Çok Gidilen Yerler ({getDaysLabel()})</h3>
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
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🔥 Araç Kullanım Yoğunluğu ({getDaysLabel()} - Gün x Saat)</h3>
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
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">☁️ Hedef Lokasyonlar ({getDaysLabel()})</h3>
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
                    {/* Dönem Bilgisi Başlık */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <p className="text-blue-700 text-sm font-medium">📅 {getDaysLabel()} verilerini görüntülüyorsunuz ({getPeriodLabel()} bazında)</p>
                    </div>

                    {/* Özet Kartlar */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm">Toplam Alarm ({getDaysLabel()})</p>
                                    <p className="text-3xl font-bold text-red-600 mt-2">
                                        {fireAlarmStats.dailyTrend?.reduce((a: number, b: any) => a + parseInt(b.count || 0), 0) || 0}
                                    </p>
                                </div>
                                <Flame size={32} className="text-red-500" />
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm">Gerçek Alarm ({getDaysLabel()})</p>
                                    <p className="text-3xl font-bold text-orange-600 mt-2">
                                        {fireAlarmStats.dailyTrend?.reduce((a: number, b: any) => a + parseInt(b.real_alarms || 0), 0) || 0}
                                    </p>
                                </div>
                                <Flame size={32} className="text-orange-500" />
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm">Yanlış Alarm ({getDaysLabel()})</p>
                                    <p className="text-3xl font-bold text-green-600 mt-2">
                                        {fireAlarmStats.dailyTrend?.reduce((a: number, b: any) => a + parseInt(b.false_alarms || 0), 0) || 0}
                                    </p>
                                </div>
                                <Flame size={32} className="text-green-500" />
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-gray-600 text-sm">Doğruluk Oranı ({getDaysLabel()})</p>
                                    <p className="text-3xl font-bold text-blue-600 mt-2">
                                        {(() => {
                                            const total = fireAlarmStats.dailyTrend?.reduce((a: number, b: any) => a + parseInt(b.count || 0), 0) || 0;
                                            const real = fireAlarmStats.dailyTrend?.reduce((a: number, b: any) => a + parseInt(b.real_alarms || 0), 0) || 0;
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
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 {getPeriodLabel()} Alarm Sayısı ({getDaysLabel()})</h3>
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
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🕔 Saatlik Alarm Çalma Trendi ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={350}>
                                <BarChart data={fireAlarmStats.hourlyTrend.map((item: any) => ({
                                    ...item,
                                    total: (parseInt(item.real_alarms || 0) + parseInt(item.false_alarms || 0))
                                }))}>
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
                                    <Bar dataKey="total" name="Toplam Alarm" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Lokasyon Kelime Bulutu */}
                    {fireAlarmStats.locationDistribution && fireAlarmStats.locationDistribution.length > 0 && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">☁️ Alarm Lokasyonları ({getDaysLabel()})</h3>
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
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📍 En Çok Alarm Olan Lokasyonlar ({getDaysLabel()})</h3>
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

                </div>
            )}

            {/* Incidents Tab */}
            {activeTab === 'incidents' && (
                <div className="space-y-6">
                    {/* Dönem Bilgisi Başlık */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <p className="text-blue-700 text-sm font-medium">📅 {getDaysLabel()} verilerini görüntülüyorsunuz</p>
                    </div>

                    {/* Kategori İstatistikleri - Ana Kartlar */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-red-100 rounded-lg">
                                    <span className="text-2xl">🚨</span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Hırsızlık</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {parseInt(incidentStats?.categoryStats?.theft_total) || 0}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                    <span className="text-2xl">👊</span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Saldırı/Kavga</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {parseInt(incidentStats?.categoryStats?.assault_total) || 0}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-yellow-100 rounded-lg">
                                    <span className="text-2xl">⚕️</span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Tıbbi Acil</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {parseInt(incidentStats?.categoryStats?.medical_total) || 0}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-purple-100 rounded-lg">
                                    <span className="text-2xl">🔨</span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Vandalizm</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {parseInt(incidentStats?.categoryStats?.vandalism_total) || 0}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <span className="text-2xl">🚑</span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Kaza</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {parseInt(incidentStats?.categoryStats?.accident_total) || 0}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-pink-100 rounded-lg">
                                    <span className="text-2xl">💊</span>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Madde Kullanımı</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {parseInt(incidentStats?.categoryStats?.substance_total) || 0}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Ana Kategori Dağılımı - Pasta Grafiği */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Kategori Bazlı Olay Dağılımı ({getDaysLabel()})</h3>
                        <ResponsiveContainer width="100%" height={400}>
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Hırsızlık', value: parseInt(incidentStats?.categoryStats?.theft_total) || 0 },
                                        { name: 'Saldırı/Kavga', value: parseInt(incidentStats?.categoryStats?.assault_total) || 0 },
                                        { name: 'Tıbbi Acil', value: parseInt(incidentStats?.categoryStats?.medical_total) || 0 },
                                        { name: 'Vandalizm', value: parseInt(incidentStats?.categoryStats?.vandalism_total) || 0 },
                                        { name: 'Kaza/Yaralanma', value: parseInt(incidentStats?.categoryStats?.accident_total) || 0 },
                                        { name: 'Madde Kullanımı', value: parseInt(incidentStats?.categoryStats?.substance_total) || 0 }
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => (percent && percent > 0) ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                                    outerRadius={120}
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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Hırsızlık Detayı */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🚨 Hırsızlık Kategorileri ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={[
                                    { name: 'Misafir Eşyası', count: parseInt(incidentStats?.categoryStats?.theft_guest_property) || 0 },
                                    { name: 'Otel Mülkiyeti', count: parseInt(incidentStats?.categoryStats?.theft_hotel_property) || 0 },
                                    { name: 'Personel Hırsızlığı', count: parseInt(incidentStats?.categoryStats?.theft_personnel) || 0 }
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" name="Olay Sayısı" fill="#EF4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Saldırı/Kavga Detayı */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">👊 Saldırı & Kavga Kategorileri ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={[
                                    { name: 'Fiziksel Saldırı', count: parseInt(incidentStats?.categoryStats?.assault_physical) || 0 },
                                    { name: 'Sözlü Taciz', count: parseInt(incidentStats?.categoryStats?.assault_verbal) || 0 },
                                    { name: 'Toplu Kavga', count: parseInt(incidentStats?.categoryStats?.assault_mass_fight) || 0 }
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" name="Olay Sayısı" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Tıbbi Acil Detayı */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">⚕️ Tıbbi Acil Kategorileri ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Ciddi Tıbbi Durum', value: parseInt(incidentStats?.categoryStats?.medical_serious) || 0 },
                                            { name: 'İlk Yardım', value: parseInt(incidentStats?.categoryStats?.medical_first_aid) || 0 },
                                            { name: 'Ambulans Çağrısı', value: parseInt(incidentStats?.categoryStats?.medical_ambulance) || 0 }
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        dataKey="value"
                                        labelLine={false}
                                        label={({ name, percent }) => (percent && percent > 0) ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                                    >
                                        <Cell fill="#3B82F6" />
                                        <Cell fill="#10B981" />
                                        <Cell fill="#F59E0B" />
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Vandalizm Kategorileri */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🔨 Vandalizm & Hasar Kategorileri ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={[
                                    { name: 'Oda Hasarı', count: parseInt(incidentStats?.categoryStats?.vandalism_room) || 0 },
                                    { name: 'Ortak Alan Hasarı', count: parseInt(incidentStats?.categoryStats?.vandalism_common_area) || 0 }
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="name" />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" name="Olay Sayısı" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Madde Kullanımı Kategorileri */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">💊 Madde Kullanımı Kategorileri ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Personel (Görevde)', value: parseInt(incidentStats?.categoryStats?.substance_personnel) || 0 },
                                            { name: 'Mülkte Bulunma', value: parseInt(incidentStats?.categoryStats?.substance_property) || 0 }
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        dataKey="value"
                                        labelLine={false}
                                        label={({ name, percent }) => (percent && percent > 0) ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                                    >
                                        <Cell fill="#EC4899" />
                                        <Cell fill="#F472B6" />
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Kaza/Yaralanma Detayı */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🚑 Kaza & Yaralanma Kategorileri ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={[
                                    { name: 'Kayma/Düşme', count: parseInt(incidentStats?.categoryStats?.accident_slip_fall) || 0 },
                                    { name: 'Ekipman Kazası', count: parseInt(incidentStats?.categoryStats?.accident_equipment) || 0 },
                                    { name: 'İş Kazası', count: parseInt(incidentStats?.categoryStats?.accident_work) || 0 }
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="count" name="Olay Sayısı" fill="#10B981" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Diğer Kategoriler */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Diğer Kategoriler ({getDaysLabel()})</h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-pink-100 rounded-xl border border-pink-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">💊</span>
                                        <span className="text-sm font-medium text-gray-700">Madde (Personel)</span>
                                    </div>
                                    <span className="text-lg font-bold text-pink-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.substance_personnel) || 0}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-pink-100 rounded-xl border border-pink-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">💊</span>
                                        <span className="text-sm font-medium text-gray-700">Madde (Mülk)</span>
                                    </div>
                                    <span className="text-lg font-bold text-pink-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.substance_property) || 0}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">🔨</span>
                                        <span className="text-sm font-medium text-gray-700">Vandalizm (Oda)</span>
                                    </div>
                                    <span className="text-lg font-bold text-purple-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.vandalism_room) || 0}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">🔨</span>
                                        <span className="text-sm font-medium text-gray-700">Vandalizm (Alan)</span>
                                    </div>
                                    <span className="text-lg font-bold text-purple-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.vandalism_common_area) || 0}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">🚪</span>
                                        <span className="text-sm font-medium text-gray-700">İzinsiz Giriş (Oda)</span>
                                    </div>
                                    <span className="text-lg font-bold text-amber-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.unauthorized_room) || 0}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">🚪</span>
                                        <span className="text-sm font-medium text-gray-700">İzinsiz (Kısıtlı)</span>
                                    </div>
                                    <span className="text-lg font-bold text-amber-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.unauthorized_restricted_area) || 0}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">📹</span>
                                        <span className="text-sm font-medium text-gray-700">CCTV Arızası</span>
                                    </div>
                                    <span className="text-lg font-bold text-blue-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.security_cctv_malfunction) || 0}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">📝</span>
                                        <span className="text-sm font-medium text-gray-700">Diğer</span>
                                    </div>
                                    <span className="text-lg font-bold text-gray-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.other) || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminStatistics;
