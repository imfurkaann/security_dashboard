import { useState, useEffect } from 'react';
import {
    AreaChart, Area, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip
} from 'recharts';
import { Flame, Clock } from 'lucide-react';
import api from '../../utils/api';

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

interface FireAlarmsTabProps {
    startDate: string;
    endDate: string;
    refetchKey: number;
}

export default function FireAlarmsTab({ startDate, endDate, refetchKey }: FireAlarmsTabProps) {
    const [loading, setLoading] = useState(true);
    const [fireAlarmStats, setFireAlarmStats] = useState<any>({
        dailyTrend: [],
        monthlyTrend: [],
        locationDistribution: [],
        resolutionStats: [],
        hourlyTrend: [],
        avgResolutionTime: 0
    });

    useEffect(() => {
        let isMounted = true;
        const fetchFireAlarmData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/statistics/fire-alarms?startDate=${startDate}&endDate=${endDate}`);
                if (isMounted) {
                    setFireAlarmStats(res.data.data);
                }
            } catch (error) {
                console.error('Yangın alarmı verileri yüklenirken hata oluştu:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchFireAlarmData();
        return () => {
            isMounted = false;
        };
    }, [startDate, endDate, refetchKey]);

    const formatDateLabel = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('-') && dateStr.length === 10) {
            const [, month, day] = dateStr.split('-');
            return `${day}/${month}`;
        }
        return dateStr;
    };

    const formatResolutionTime = (seconds: number) => {
        if (!seconds || seconds <= 0) return '0 sn';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hrs > 0) {
            return `${hrs} sa ${mins} dk`;
        }
        if (mins > 0) {
            return `${mins} dk ${secs} sn`;
        }
        return `${secs} sn`;
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

    if (loading && !fireAlarmStats.dailyTrend?.length) {
        return (
            <div className="flex items-center justify-center h-64 bg-white border border-slate-200 rounded-xl">
                <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
                    <span className="text-xs font-bold text-slate-500">Yangın Alarmı Verileri Yükleniyor...</span>
                </div>
            </div>
        );
    }

    const totalAlarms = fireAlarmStats.dailyTrend?.reduce((a: number, b: any) => a + parseInt(b.count || 0), 0) || 0;
    const avgResolutionSeconds = fireAlarmStats.avgResolutionTime || 0;

    return (
        <div className="flex flex-col gap-3">
            {/* 1. Yatay İstatistik Kartları */}
            <div id="fire-stats-cards" className="grid grid-cols-2 gap-3">
                {/* Kart 1: Toplam Alarm */}
                <div className="rounded-xl shadow-sm p-3 border border-red-500 bg-gradient-to-br from-red-500 to-red-600 text-white flex flex-col justify-between gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-85">Toplam Alarm</span>
                        <div className="p-1 bg-white/20 rounded-lg shrink-0 text-white">
                            <Flame className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <span className="text-2xl font-extrabold">{totalAlarms}</span>
                    <span className="text-[9px] opacity-70">seçili dönem toplamı</span>
                </div>

                {/* Kart 2: Ortalama Çözüm Süresi */}
                <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-sm flex flex-col justify-between gap-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ortalama Çözüm Süresi</span>
                        <div className="p-1 bg-slate-100 rounded-lg shrink-0 text-slate-500">
                            <Clock className="w-3.5 h-3.5" />
                        </div>
                    </div>
                    <span className="text-2xl font-extrabold text-slate-800">{formatResolutionTime(avgResolutionSeconds)}</span>
                    <span className="text-[9px] font-semibold text-slate-400">çözümlenen alarmlar</span>
                </div>
            </div>

            {/* 2. Günlük Alarm Grafiği (Üstte Büyük) */}
            <div id="fire-trends" className="w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    📈 Günlük Alarm Dağılımı
                </h3>
                <div className="w-full h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={fireAlarmStats.dailyTrend}>
                            <defs>
                                <linearGradient id="colorFireDaily" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 9, fill: '#64748b' }} />
                            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="count" name="Alarm Sayısı" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorFireDaily)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3. Saatlik Alarm Grafiği & En Çok Alarm Olan Lokasyonlar (Yan Yana Altta) */}
            <div id="fire-locations" className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Saatlik Alarm Grafiği */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        🕔 Saatlik Alarm Dağılımı
                    </h3>
                    <div className="w-full h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={fireAlarmStats.hourlyTrend.map((item: any) => ({
                                ...item,
                                total: (parseInt(item.real_alarms || 0) + parseInt(item.false_alarms || 0))
                            }))}>
                                <defs>
                                    <linearGradient id="colorFireHourly" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="hour" tickFormatter={(h) => `${h}:00`} tick={{ fontSize: 9, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    labelFormatter={(hour) => `Saat: ${hour}:00`}
                                />
                                <Area type="monotone" dataKey="total" name="Toplam Alarm" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorFireHourly)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* En Çok Alarm Olan Yerler */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            📍 En Sık Alarm Tetiklenen Lokasyonlar
                        </h3>
                        <div className="flex flex-col gap-1 mt-3">
                            {fireAlarmStats.locationDistribution && fireAlarmStats.locationDistribution.length > 0 ? (
                                (() => {
                                    const maxVal = Math.max(...fireAlarmStats.locationDistribution.map((d: any) => parseInt(d.count) || 0), 1);
                                    return fireAlarmStats.locationDistribution.slice(0, 8).map((d: any, index: number) => {
                                        const count = parseInt(d.count) || 0;
                                        const pct = Math.round((count / maxVal) * 100);
                                        return (
                                            <div key={index} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                                                {/* Sıra */}
                                                <span className={`w-4 text-center text-[10px] font-extrabold shrink-0 ${
                                                    index === 0 ? 'text-red-500' :
                                                    index === 1 ? 'text-amber-500' :
                                                    index === 2 ? 'text-orange-400' : 'text-slate-300'
                                                }`}>
                                                    {index + 1}
                                                </span>
                                                {/* Lokasyon adı */}
                                                <span
                                                    className="w-[120px] shrink-0 text-[11px] font-semibold text-slate-700 truncate"
                                                    title={d.location}
                                                >
                                                    {d.location}
                                                </span>
                                                {/* Bar + sayı yan yana */}
                                                <div className="flex-1 flex items-center gap-2 min-w-0">
                                                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-500"
                                                            style={{ width: `${pct}%`, backgroundColor: COLORS[index % COLORS.length] }}
                                                        />
                                                    </div>
                                                    <span className="w-6 text-right text-[11px] font-extrabold text-slate-700 shrink-0">
                                                        {count}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()
                            ) : (
                                <div className="flex items-center justify-center py-12">
                                    <span className="text-xs font-bold text-slate-400">Veri bulunamadı</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
