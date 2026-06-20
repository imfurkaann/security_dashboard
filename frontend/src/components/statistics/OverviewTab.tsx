import { useState, useEffect, useMemo } from 'react';
import {
    BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    LineChart, Line
} from 'recharts';
import { Users, Car, ShieldAlert, Flame, Calendar, Award } from 'lucide-react';
import api from '../../utils/api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const TAG_INFO = [
    { label: 'Taşeron İşçi', key: 'subcontractor_worker', color: '#8b5cf6', cardStyle: 'text-violet-600 border-violet-100 bg-violet-50' },
    { label: 'Şarj İstasyonu', key: 'for_electric_station', color: '#06b6d4', cardStyle: 'text-cyan-600 border-cyan-100 bg-cyan-50' },
    { label: 'Günübirlik Misafir', key: 'daily_guest', color: '#6366f1', cardStyle: 'text-indigo-600 border-indigo-100 bg-indigo-50' },
    { label: 'Giriş', key: 'entry_tag', color: '#10b981', cardStyle: 'text-emerald-600 border-emerald-100 bg-emerald-50' },
    { label: 'Çıkış', key: 'exit_tag', color: '#f59e0b', cardStyle: 'text-amber-600 border-amber-100 bg-amber-50' },
    { label: 'Tur Giriş', key: 'tour_entry', color: '#3b82f6', cardStyle: 'text-blue-600 border-blue-100 bg-blue-50' },
    { label: 'Tur Çıkış', key: 'tour_exit', color: '#ec4899', cardStyle: 'text-pink-600 border-pink-100 bg-pink-50' },
    { label: 'Görüşme', key: 'meeting', color: '#0ea5e9', cardStyle: 'text-sky-600 border-sky-100 bg-sky-50' },
    { label: 'Teslimat', key: 'delivery', color: '#f43f5e', cardStyle: 'text-rose-600 border-rose-100 bg-rose-50' }
];

interface OverviewTabProps {
    startDate: string;
    endDate: string;
    refetchKey: number;
}

export default function OverviewTab({ startDate, endDate, refetchKey }: OverviewTabProps) {
    const [loading, setLoading] = useState(true);
    const [generalStats, setGeneralStats] = useState<any>(null);
    const [visitorTrends, setVisitorTrends] = useState<any>({ trend: [], tagTrends: [] });
    const [vehicleStats, setVehicleStats] = useState<any>({ trend: [] });
    const [incidentStats, setIncidentStats] = useState<any>({ categoryStats: {} });
    const [fireAlarmStats, setFireAlarmStats] = useState<any>({ dailyTrend: [] });

    useEffect(() => {
        let isMounted = true;
        const fetchOverviewData = async () => {
            setLoading(true);
            try {
                const [generalRes, visitorRes, vehicleRes, incidentRes, fireRes] = await Promise.all([
                    api.get('/statistics/general'),
                    api.get(`/statistics/visitors?period=daily&startDate=${startDate}&endDate=${endDate}`),
                    api.get(`/statistics/vehicles?period=daily&startDate=${startDate}&endDate=${endDate}`),
                    api.get(`/statistics/incidents?startDate=${startDate}&endDate=${endDate}`),
                    api.get(`/statistics/fire-alarms?startDate=${startDate}&endDate=${endDate}`)
                ]);

                if (isMounted) {
                    setGeneralStats(generalRes.data.data);
                    setVisitorTrends(visitorRes.data.data);
                    setVehicleStats(vehicleRes.data.data);
                    setIncidentStats(incidentRes.data.data);
                    setFireAlarmStats(fireRes.data.data);
                }
            } catch (error) {
                console.error('Genel bakış verileri yüklenirken hata oluştu:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchOverviewData();
        return () => {
            isMounted = false;
        };
    }, [startDate, endDate, refetchKey]);

    const formatDateLabel = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('-') && dateStr.length === 10) {
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}`;
        }
        return dateStr;
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border border-slate-200 shadow-md rounded-lg text-xs font-semibold text-slate-800">
                    <p className="text-slate-500 mb-1">{formatDateLabel(label)}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} className="flex items-center gap-1.5" style={{ color: entry.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                            {entry.name}: {entry.value.toLocaleString('tr-TR')}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    // Toplam değerlerin hesaplanması (seçilen tarih aralığında - useMemo ile optimize edildi)
    // NOT: React hooks kuralı gereği tüm useMemo'lar erken return'den ÖNCE olmalıdır
    const totalVisitors = useMemo(() => {
        return visitorTrends.trend?.reduce((sum: number, r: any) => sum + (parseInt(r.total_persons) || 0), 0) || 0;
    }, [visitorTrends.trend]);

    const totalVehicles = useMemo(() => {
        return vehicleStats.trend?.reduce((sum: number, r: any) => sum + (parseInt(r.count) || 0), 0) || 0;
    }, [vehicleStats.trend]);

    const totalAlarms = useMemo(() => {
        return fireAlarmStats.dailyTrend?.reduce((sum: number, r: any) => sum + (parseInt(r.count) || 0), 0) || 0;
    }, [fireAlarmStats.dailyTrend]);

    const tagTotals = useMemo(() => {
        const totals = {
            subcontractor_worker: 0,
            for_electric_station: 0,
            daily_guest: 0,
            entry_tag: 0,
            exit_tag: 0,
            tour_entry: 0,
            tour_exit: 0,
            meeting: 0,
            delivery: 0
        };
        visitorTrends.tagTrends?.forEach((row: any) => {
            totals.subcontractor_worker += parseInt(row.subcontractor_worker) || 0;
            totals.for_electric_station += parseInt(row.for_electric_station) || 0;
            totals.daily_guest += parseInt(row.daily_guest) || 0;
            totals.entry_tag += parseInt(row.entry_tag) || 0;
            totals.exit_tag += parseInt(row.exit_tag) || 0;
            totals.tour_entry += parseInt(row.tour_entry) || 0;
            totals.tour_exit += parseInt(row.tour_exit) || 0;
            totals.meeting += parseInt(row.meeting) || 0;
            totals.delivery += parseInt(row.delivery) || 0;
        });
        return totals;
    }, [visitorTrends.tagTrends]);

    const tagChartData = useMemo(() => {
        return TAG_INFO.map(tag => ({
            name: tag.label,
            value: tagTotals[tag.key as keyof typeof tagTotals] || 0,
            color: tag.color
        })).filter(item => item.value > 0);
    }, [tagTotals]);

    const incidentData = useMemo(() => {
        return [
            { name: 'Hırsızlık', value: parseInt(incidentStats?.categoryStats?.theft_total) || 0 },
            { name: 'Saldırı/Kavga', value: parseInt(incidentStats?.categoryStats?.assault_total) || 0 },
            { name: 'Tıbbi Acil', value: parseInt(incidentStats?.categoryStats?.medical_total) || 0 },
            { name: 'Vandalizm', value: parseInt(incidentStats?.categoryStats?.vandalism_total) || 0 },
            { name: 'Kaza', value: parseInt(incidentStats?.categoryStats?.accident_total) || 0 },
            { name: 'Madde Kullanımı', value: parseInt(incidentStats?.categoryStats?.substance_total) || 0 }
        ].filter(item => item.value > 0);
    }, [incidentStats?.categoryStats]);

    if (loading && !generalStats) {
        return (
            <div className="flex items-center justify-center h-64 bg-white border border-slate-200 rounded-xl">
                <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                    <span className="text-xs font-bold text-slate-500">Veriler Yükleniyor...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {/* 1. Yatay İstatistik Kartları */}
            <div id="overview-stats-cards" className="flex flex-col gap-2.5">
                {/* Ana İstatistikler Grid (3 Sütun) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Toplam Ziyaretçi */}
                    <div className="rounded-xl shadow-sm p-2.5 border border-blue-500 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-400/30 rounded-lg border border-blue-300/40 shrink-0 text-white">
                                    <Users className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-white/90 uppercase tracking-wider">Toplam Ziyaretçi</span>
                            </div>
                            <span className="text-xl font-extrabold text-white">{totalVisitors}</span>
                        </div>
                    </div>

                    {/* Toplam Araç Verme */}
                    <div className="rounded-xl shadow-sm p-2.5 border border-emerald-500 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-emerald-400/30 rounded-lg border border-emerald-300/40 shrink-0 text-white">
                                    <Car className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-white/90 uppercase tracking-wider">Toplam Araç Verme</span>
                            </div>
                            <span className="text-xl font-extrabold text-white">{totalVehicles}</span>
                        </div>
                    </div>

                    {/* Toplam Yangın Alarmı */}
                    <div className="rounded-xl shadow-sm p-2.5 border border-rose-500 bg-gradient-to-br from-rose-500 to-rose-600 text-white">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-rose-400/30 rounded-lg border border-rose-300/40 shrink-0 text-white">
                                    <Flame className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-white/90 uppercase tracking-wider">Toplam Yangın Alarmı</span>
                            </div>
                            <span className="text-xl font-extrabold text-white">{totalAlarms}</span>
                        </div>
                    </div>
                </div>

                {/* Ziyaretçi Etiket Dağılımı Grid (Kompakt Açık Renkli Kartlar) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 border border-slate-200 bg-white p-2.5 rounded-xl shadow-sm">
                    {TAG_INFO.map((tag, idx) => (
                        <div key={idx} className={`flex items-center justify-between p-2 px-2.5 rounded-lg border text-xs font-semibold ${tag.cardStyle}`}>
                            <span className="opacity-90">{tag.label}</span>
                            <span className="font-extrabold text-[13px]">{tagTotals[tag.key as keyof typeof tagTotals] || 0}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Dağılımlar Grid'i */}
            <div id="overview-grid-1" className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                {/* Ziyaretçi Etiket Dağılımı (Sol / Geniş Pasta Grafiği) */}
                <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col justify-between">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                        👥 Ziyaretçi Etiket Dağılımı
                    </h3>
                    {tagChartData.length > 0 ? (
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                            {/* Pasta Grafiği */}
                            <div className="w-full sm:w-1/2 h-[180px] flex items-center justify-center relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={tagChartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={45}
                                            outerRadius={65}
                                            paddingAngle={2}
                                            dataKey="value"
                                        >
                                            {tagChartData.map((item, index) => (
                                                <Cell key={`cell-${index}`} fill={item.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => `${value} kişi`} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute flex flex-col items-center justify-center">
                                    <span className="text-lg font-extrabold text-slate-800">
                                        {tagChartData.reduce((sum, item) => sum + item.value, 0)}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Etiket</span>
                                </div>
                            </div>
                            {/* Legend Listesi (Detaylı yan menü) */}
                            <div className="w-full sm:w-1/2 grid grid-cols-2 gap-x-4 gap-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                                {tagChartData.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between text-[11px] font-semibold border-b border-slate-50 pb-1">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                            <span className="text-slate-600 truncate">{item.name}</span>
                                        </div>
                                        <span className="text-slate-800 font-bold ml-1">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center border border-dashed border-slate-200 rounded-lg py-12">
                            <span className="text-xs font-bold text-slate-400">Bu dönemde etiket kaydı bulunamadı.</span>
                        </div>
                    )}
                </div>

                {/* Olay Dağılımı (Sağ / Pasta Grafiği) */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col justify-between">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                        🚨 Olay Kategori Dağılımı
                    </h3>
                    {incidentData.length > 0 ? (
                        <div className="w-full h-[180px] flex items-center justify-center relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={incidentData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={65}
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {incidentData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Ortadaki Toplam Değeri */}
                            <div className="absolute flex flex-col items-center justify-center">
                                <span className="text-lg font-extrabold text-slate-800">
                                    {incidentData.reduce((sum, item) => sum + item.value, 0)}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Olay</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center border border-dashed border-slate-200 rounded-lg py-12">
                            <span className="text-xs font-bold text-slate-400">Bu dönemde olay kaydı bulunamadı.</span>
                        </div>
                    )}
                    {incidentData.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1.5 mt-2.5">
                            {incidentData.slice(0, 4).map((item, index) => (
                                <div key={index} className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                    <span className="text-[10px] font-semibold text-slate-600">{item.name} ({item.value})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 3. Trend Grafikleri (Ziyaretçi, Araç ve Yangın) */}
            <div id="overview-grid-2" className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Ziyaretçi Trendi */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>👥 Ziyaretçi Trendi</span>
                    </h3>
                    <div className="w-full h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={visitorTrends.trend}>
                                <defs>
                                    <linearGradient id="colorVisitorOverview" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 9, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="total_persons" name="Ziyaretçi Sayısı" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorVisitorOverview)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Araç Trendi */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>🚗 Araç Kullanım Trendi</span>
                    </h3>
                    <div className="w-full h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={vehicleStats.trend}>
                                <defs>
                                    <linearGradient id="colorVehicleOverview" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 9, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="count" name="Araç Girişi" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorVehicleOverview)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Yangın Alarmı Trendi */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>🔥 Yangın Alarmı Trendi</span>
                    </h3>
                    <div className="w-full h-[180px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={fireAlarmStats.dailyTrend}>
                                <defs>
                                    <linearGradient id="colorFireOverview" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 9, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="count" name="Alarm Sayısı" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorFireOverview)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 4. Etiket Kullanım Trendleri (Bireysel Sparkline Grafikler) */}
            <div id="overview-grid-tag-trends" className="flex flex-col gap-2.5">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🏷️ Bireysel Etiket Trendleri</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                    {TAG_INFO.map((tag) => {
                        const totalVal = tagTotals[tag.key as keyof typeof tagTotals] || 0;
                        return (
                            <div key={tag.key} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm flex flex-col justify-between min-h-[110px]">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                                    <span className="truncate pr-1">{tag.label}</span>
                                    <span className="shrink-0 text-slate-900">{totalVal}</span>
                                </div>
                                <div className="w-full h-[50px] mt-2">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={visitorTrends.tagTrends}>
                                            <defs>
                                                <linearGradient id={`colorTag_${tag.key}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={tag.color} stopOpacity={0.2} />
                                                    <stop offset="95%" stopColor={tag.color} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
                                            <XAxis dataKey="date" hide />
                                            <YAxis hide />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area
                                                type="monotone"
                                                dataKey={tag.key}
                                                name={tag.label}
                                                stroke={tag.color}
                                                strokeWidth={1.5}
                                                fillOpacity={1}
                                                fill={`url(#colorTag_${tag.key})`}
                                                dot={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 4. En Yoğun Günler (3 Sütun) */}
            <div id="overview-grid-3" className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Ziyaretçi En Yoğun */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-blue-500" />
                        <span>En Yoğun Ziyaretçi Günleri</span>
                    </h3>
                    {visitorTrends.trend && visitorTrends.trend.length > 0 ? (
                        <div className="space-y-1.5">
                            {[...visitorTrends.trend]
                                .sort((a: any, b: any) => parseInt(String(b.total_persons || 0)) - parseInt(String(a.total_persons || 0)))
                                .slice(0, 3)
                                .map((day: any, index: number) => (
                                    <div key={index} className="flex items-center justify-between p-1.5 px-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                                        <span className="font-semibold text-slate-600">{formatDateLabel(day.date)}</span>
                                        <span className="font-bold text-slate-800">{parseInt(day.total_persons || 0)} kişi</span>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <div className="py-6 text-center text-xs font-bold text-slate-400">Veri bulunmuyor</div>
                    )}
                </div>

                {/* Araç En Yoğun */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-emerald-500" />
                        <span>En Yoğun Araç Günleri</span>
                    </h3>
                    {vehicleStats.trend && vehicleStats.trend.length > 0 ? (
                        <div className="space-y-1.5">
                            {[...vehicleStats.trend]
                                .sort((a: any, b: any) => parseInt(String(b.count || 0)) - parseInt(String(a.count || 0)))
                                .slice(0, 3)
                                .map((day: any, index: number) => (
                                    <div key={index} className="flex items-center justify-between p-1.5 px-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                                        <span className="font-semibold text-slate-600">{formatDateLabel(day.date)}</span>
                                        <span className="font-bold text-slate-800">{parseInt(day.count || 0)} araç</span>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <div className="py-6 text-center text-xs font-bold text-slate-400">Veri bulunmuyor</div>
                    )}
                </div>

                {/* Yangın En Yoğun */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <Award className="w-3.5 h-3.5 text-rose-500" />
                        <span>En Yoğun Yangın Günleri</span>
                    </h3>
                    {fireAlarmStats.dailyTrend && fireAlarmStats.dailyTrend.length > 0 ? (
                        <div className="space-y-1.5">
                            {[...fireAlarmStats.dailyTrend]
                                .sort((a: any, b: any) => parseInt(String(b.count || 0)) - parseInt(String(a.count || 0)))
                                .slice(0, 3)
                                .map((day: any, index: number) => (
                                    <div key={index} className="flex items-center justify-between p-1.5 px-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                                        <span className="font-semibold text-slate-600">{formatDateLabel(day.date)}</span>
                                        <span className="font-bold text-slate-800">{parseInt(day.count || 0)} alarm</span>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <div className="py-6 text-center text-xs font-bold text-slate-400">Veri bulunmuyor</div>
                    )}
                </div>
            </div>

            {/* 5. Günlük Ortalamalar (Yatay Düzen) */}
            <div id="overview-daily-averages" className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm flex flex-col gap-3.5">
                <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>Günlük Ortalamalar</span>
                </h3>
                
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-center">
                    {/* Ana Metrikler Ortalamaları (3 Sütun) */}
                    <div className="xl:col-span-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full">
                        {/* Ziyaretçi */}
                        <div className="flex items-center justify-between p-2.5 px-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs font-bold text-blue-900 shadow-sm transition-all hover:bg-blue-50">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-blue-500 shrink-0" />
                                <span>Ziyaretçi</span>
                            </div>
                            <span className="font-extrabold text-sm text-blue-950 bg-blue-100/80 px-2 py-0.5 rounded-lg border border-blue-200">
                                {visitorTrends.trend && visitorTrends.trend.length > 0
                                    ? (visitorTrends.trend.reduce((a: number, b: any) => a + parseInt(String(b.total_persons || 0)), 0) / visitorTrends.trend.length).toFixed(1)
                                    : '0.0'}
                            </span>
                        </div>

                        {/* Araç */}
                        <div className="flex items-center justify-between p-2.5 px-3.5 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-900 shadow-sm transition-all hover:bg-emerald-50">
                            <div className="flex items-center gap-2">
                                <Car className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span>Araç</span>
                            </div>
                            <span className="font-extrabold text-sm text-emerald-950 bg-emerald-100/80 px-2 py-0.5 rounded-lg border border-emerald-200">
                                {vehicleStats.trend && vehicleStats.trend.length > 0
                                    ? (vehicleStats.trend.reduce((a: number, b: any) => a + parseInt(String(b.count || 0)), 0) / vehicleStats.trend.length).toFixed(1)
                                    : '0.0'}
                            </span>
                        </div>

                        {/* Yangın */}
                        <div className="flex items-center justify-between p-2.5 px-3.5 bg-rose-50/70 border border-rose-100 rounded-xl text-xs font-bold text-rose-900 shadow-sm transition-all hover:bg-rose-50">
                            <div className="flex items-center gap-2">
                                <Flame className="w-4 h-4 text-rose-500 shrink-0" />
                                <span>Yangın</span>
                            </div>
                            <span className="font-extrabold text-sm text-rose-950 bg-rose-100/80 px-2 py-0.5 rounded-lg border border-rose-200">
                                {fireAlarmStats.dailyTrend && fireAlarmStats.dailyTrend.length > 0
                                    ? (fireAlarmStats.dailyTrend.reduce((a: number, b: any) => a + parseInt(String(b.count || 0)), 0) / fireAlarmStats.dailyTrend.length).toFixed(1)
                                    : '0.0'}
                            </span>
                        </div>
                    </div>

                    {/* Dikey Ayrıcı Çizgi */}
                    <div className="hidden xl:flex xl:col-span-1 justify-center">
                        <div className="w-px h-8 bg-slate-200" />
                    </div>

                    {/* Etiket Ortalamaları Yatay Akışı */}
                    <div className="xl:col-span-6 flex flex-wrap gap-2">
                        {TAG_INFO.map((tag) => {
                            const total = tagTotals[tag.key as keyof typeof tagTotals] || 0;
                            const avg = (total / (visitorTrends.tagTrends?.length || 1)).toFixed(1);
                            return (
                                <div key={tag.key} className={`flex items-center gap-2 py-1.5 px-3 border rounded-xl text-xs font-bold shadow-sm transition-all duration-200 hover:scale-[1.02] ${tag.cardStyle}`}>
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                                    <span>{tag.label}</span>
                                    <span className="px-1.5 py-0.5 rounded bg-white/90 border border-current/10 font-extrabold text-[12px]">{avg}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
