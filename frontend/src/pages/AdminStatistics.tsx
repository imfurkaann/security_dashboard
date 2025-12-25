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
    const [activeTab, setActiveTab] = useState<'overview' | 'visitors' | 'vehicles' | 'managers' | 'incidents'>('overview');

    // Data states
    const [generalStats, setGeneralStats] = useState<any>(null);
    const [visitorTrends, setVisitorTrends] = useState<TrendData[]>([]);
    const [vehicleStats, setVehicleStats] = useState<any>(null);
    const [managerStats, setManagerStats] = useState<any>(null);
    const [incidentStats, setIncidentStats] = useState<any>(null);
    const [fireAlarmStats, setFireAlarmStats] = useState<any>(null);
    const [comparison, setComparison] = useState<any>(null);

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
                                { key: 'managers', label: 'Yöneticiler' },
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
                            title="Bugün Yönetici"
                            value={parseInt(generalStats.today?.today_managers) || 0}
                            icon={<UserCheck size={24} className="text-white" />}
                            color="bg-amber-500"
                        />
                        <StatCardComponent
                            title="Bugün Alarm"
                            value={parseInt(generalStats.today?.today_alarms) || 0}
                            icon={<Flame size={24} className="text-white" />}
                            color="bg-red-500"
                        />
                        <StatCardComponent
                            title="Bugün Olay"
                            value={parseInt(generalStats.today?.today_incidents) || 0}
                            icon={<FileText size={24} className="text-white" />}
                            color="bg-purple-500"
                        />
                    </div>

                    {/* Aktif Durumlar */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl p-6 text-white">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-amber-100 text-sm">Şu An İçeride</p>
                                    <p className="text-4xl font-bold mt-1">{parseInt(generalStats.active?.active_managers) || 0}</p>
                                    <p className="text-amber-100 text-sm mt-1">Yönetici</p>
                                </div>
                                <UserCheck size={48} className="text-amber-200 opacity-50" />
                            </div>
                        </div>
                    </div>

                    {/* Karşılaştırma Grafikleri */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        {/* Aylık Karşılaştırma */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Aylık Karşılaştırma</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={comparison?.monthlyComparison || []}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis
                                        dataKey="category"
                                        tickFormatter={(v) => {
                                            const labels: Record<string, string> = {
                                                visitors: 'Ziyaretçi',
                                                vehicles: 'Araç',
                                                managers: 'Yönetici',
                                                fire_alarms: 'Alarm',
                                                incidents: 'Olay'
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
                                <AreaChart data={visitorTrends}>
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
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="text-center p-4 bg-blue-50 rounded-lg">
                                <p className="text-3xl font-bold text-blue-600">{parseInt(generalStats.month?.month_visitors) || 0}</p>
                                <p className="text-sm text-gray-600 mt-1">Ziyaretçi</p>
                            </div>
                            <div className="text-center p-4 bg-green-50 rounded-lg">
                                <p className="text-3xl font-bold text-green-600">{parseInt(generalStats.month?.month_vehicles) || 0}</p>
                                <p className="text-sm text-gray-600 mt-1">Araç Kullanımı</p>
                            </div>
                            <div className="text-center p-4 bg-amber-50 rounded-lg">
                                <p className="text-3xl font-bold text-amber-600">{parseInt(generalStats.month?.month_managers) || 0}</p>
                                <p className="text-sm text-gray-600 mt-1">Yönetici Girişi</p>
                            </div>
                            <div className="text-center p-4 bg-red-50 rounded-lg">
                                <p className="text-3xl font-bold text-red-600">{fireAlarmStats?.monthlyTrend?.reduce((a: number, b: any) => a + parseInt(b.total), 0) || 0}</p>
                                <p className="text-sm text-gray-600 mt-1">Yangın Alarmı</p>
                            </div>
                            <div className="text-center p-4 bg-purple-50 rounded-lg">
                                <p className="text-3xl font-bold text-purple-600">{incidentStats?.monthlyTrend?.reduce((a: number, b: any) => a + parseInt(b.count), 0) || 0}</p>
                                <p className="text-sm text-gray-600 mt-1">Olay Kaydı</p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Visitors Tab */}
            {activeTab === 'visitors' && (
                <div className="space-y-6">
                    {/* Ziyaretçi Trend Grafiği */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">👥 Ziyaretçi Giriş Trendi</h3>
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={visitorTrends}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tickFormatter={formatDate} />
                                <YAxis yAxisId="left" />
                                <YAxis yAxisId="right" orientation="right" />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Line
                                    yAxisId="left"
                                    type="monotone"
                                    dataKey="count"
                                    name="Kayıt Sayısı"
                                    stroke={CHART_COLORS.primary}
                                    strokeWidth={2}
                                    dot={{ fill: CHART_COLORS.primary }}
                                />
                                <Line
                                    yAxisId="right"
                                    type="monotone"
                                    dataKey="total_persons"
                                    name="Toplam Kişi"
                                    stroke={CHART_COLORS.secondary}
                                    strokeWidth={2}
                                    dot={{ fill: CHART_COLORS.secondary }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Ziyaretçi İstatistikleri */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Günlük Ortalamalar</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <span className="text-gray-600">Günlük Ortalama Kayıt</span>
                                    <span className="text-2xl font-bold text-blue-600">
                                        {visitorTrends.length > 0
                                            ? Math.round(visitorTrends.reduce((a, b) => a + parseInt(String(b.count)), 0) / visitorTrends.length)
                                            : 0}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <span className="text-gray-600">Toplam Ziyaretçi</span>
                                    <span className="text-2xl font-bold text-green-600">
                                        {visitorTrends.reduce((a, b) => a + parseInt(String(b.count)), 0)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                    <span className="text-gray-600">Toplam Kişi Sayısı</span>
                                    <span className="text-2xl font-bold text-purple-600">
                                        {visitorTrends.reduce((a, b) => a + parseInt(String(b.total_persons || 0)), 0)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 En Yoğun Günler</h3>
                            <div className="space-y-3">
                                {[...visitorTrends]
                                    .sort((a, b) => parseInt(String(b.count)) - parseInt(String(a.count)))
                                    .slice(0, 5)
                                    .map((day, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                                                    }`}>
                                                    {index + 1}
                                                </span>
                                                <span className="text-gray-700">{formatDate(day.date)}</span>
                                            </div>
                                            <span className="font-bold text-gray-800">{day.count} kayıt</span>
                                        </div>
                                    ))}
                            </div>
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

                    {/* Araç Durumu Dağılımı */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Araç Durumu Dağılımı</h3>
                        <div className="flex items-center justify-center">
                            <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                    <Pie
                                        data={vehicleStats.statusDistribution.map((s: any) => ({
                                            ...s,
                                            name: s.status === 'in_use' ? 'Kullanımda' : s.status === 'returned' ? 'İade Edildi' : s.status
                                        }))}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="count"
                                        nameKey="name"
                                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                    >
                                        {vehicleStats.statusDistribution.map((_: any, index: number) => (
                                            <Cell key={index} fill={index === 0 ? CHART_COLORS.warning : CHART_COLORS.secondary} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {/* Managers Tab */}
            {activeTab === 'managers' && managerStats && (
                <div className="space-y-6">
                    {/* Yönetici Giriş Trendi */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">👔 Yönetici Giriş Trendi</h3>
                        <ResponsiveContainer width="100%" height={350}>
                            <LineChart data={managerStats.trend}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tickFormatter={formatDate} />
                                <YAxis />
                                <Tooltip content={<CustomTooltip />} />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    name="Giriş Sayısı"
                                    stroke={CHART_COLORS.warning}
                                    strokeWidth={3}
                                    dot={{ fill: CHART_COLORS.warning, r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* En Sık Gelen Yöneticiler */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 En Sık Gelen Yöneticiler</h3>
                            <div className="space-y-3">
                                {managerStats.topManagers.map((manager: any, index: number) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold`}
                                                style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                                                {index + 1}
                                            </span>
                                            <span className="text-gray-700 font-medium">{manager.manager_name}</span>
                                        </div>
                                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                                            {manager.visit_count} ziyaret
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Saat Bazlı Dağılım */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">⏰ Saat Bazlı Giriş Dağılımı</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={managerStats.hourlyDistribution}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis
                                        dataKey="hour"
                                        tickFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
                                    />
                                    <YAxis />
                                    <Tooltip
                                        labelFormatter={(h) => `Saat: ${String(h).padStart(2, '0')}:00`}
                                    />
                                    <Bar dataKey="count" name="Giriş Sayısı" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]}>
                                        {managerStats.hourlyDistribution.map((_: any, index: number) => (
                                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
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
