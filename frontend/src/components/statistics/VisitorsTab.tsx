import { useState, useEffect } from 'react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
    CartesianGrid, XAxis, YAxis, Tooltip, Legend
} from 'recharts';
import api from '../../utils/api';

const TAG_INFO = [
    { label: 'Taşeron İşçi', key: 'subcontractor_worker', color: '#8b5cf6', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', badge: 'bg-violet-100 text-violet-800' },
    { label: 'Şarj İstasyonu', key: 'for_electric_station', color: '#06b6d4', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', badge: 'bg-cyan-100 text-cyan-800' },
    { label: 'Günübirlik', key: 'daily_guest', color: '#6366f1', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-800' },
    { label: 'Giriş', key: 'entry_tag', color: '#10b981', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
    { label: 'Çıkış', key: 'exit_tag', color: '#f59e0b', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' },
    { label: 'Tur Giriş', key: 'tour_entry', color: '#3b82f6', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
    { label: 'Tur Çıkış', key: 'tour_exit', color: '#ec4899', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-800' },
    { label: 'Görüşme', key: 'meeting', color: '#0ea5e9', bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', badge: 'bg-sky-100 text-sky-800' },
    { label: 'Teslimat', key: 'delivery', color: '#f43f5e', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-800' }
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const SHORT_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

interface VisitorsTabProps {
    startDate: string;
    endDate: string;
    refetchKey: number;
}

export default function VisitorsTab({ startDate, endDate, refetchKey }: VisitorsTabProps) {
    const [loading, setLoading] = useState(true);
    const [visitorData, setVisitorData] = useState<any>({
        trend: [],
        hourlyHeatmap: [],
        avgDuration: {},
        durationDistribution: [],
        hostDistribution: [],
        tagTrends: [],
        vehicleVisitorStats: { with_vehicle: 0, without_vehicle: 0, total: 0 },
        topVisitorPlates: []
    });

    useEffect(() => {
        let isMounted = true;
        const fetchVisitorsData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/statistics/visitors?period=daily&startDate=${startDate}&endDate=${endDate}`);
                if (isMounted) setVisitorData(res.data.data);
            } catch (error) {
                console.error('Ziyaretçi verileri yüklenirken hata oluştu:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchVisitorsData();
        return () => { isMounted = false; };
    }, [startDate, endDate, refetchKey]);

    // Etiket toplamları — tagTrends üzerinden hesaplanır
    const tagTotals: Record<string, number> = {};
    TAG_INFO.forEach(tag => { tagTotals[tag.key] = 0; });
    (visitorData.tagTrends || []).forEach((row: any) => {
        TAG_INFO.forEach(tag => {
            tagTotals[tag.key] += parseInt(row[tag.key]) || 0;
        });
    });

    const formatDateLabel = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('-') && dateStr.length === 10) {
            const [, month, day] = dateStr.split('-');
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

    if (loading && !visitorData.trend?.length) {
        return (
            <div className="flex items-center justify-center h-64 bg-white border border-slate-200 rounded-xl">
                <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                    <span className="text-xs font-bold text-slate-500">Ziyaretçi Verileri Yükleniyor...</span>
                </div>
            </div>
        );
    }

    // Araçlı/araçsız donut verisi
    const vehicleDonutData = [
        { name: 'Araçla Gelen', value: parseInt(visitorData.vehicleVisitorStats?.with_vehicle) || 0, color: '#3b82f6' },
        { name: 'Araçsız Gelen', value: parseInt(visitorData.vehicleVisitorStats?.without_vehicle) || 0, color: '#e2e8f0' },
    ].filter(d => d.value > 0);
    const totalVisitorRecords = parseInt(visitorData.vehicleVisitorStats?.total) || 0;
    const withVehiclePct = totalVisitorRecords > 0
        ? Math.round((parseInt(visitorData.vehicleVisitorStats?.with_vehicle) || 0) / totalVisitorRecords * 100)
        : 0;

    // Heatmap
    const heatmapMax = Math.max(...((visitorData.hourlyHeatmap || []).map((h: any) => parseInt(h.total_persons || h.visit_count || 0))), 1);
    const heatmapMatrix = DAYS.map((_, dayIdx) =>
        Array.from({ length: 24 }, (_, hour) => {
            const entry = (visitorData.hourlyHeatmap || []).find(
                (h: any) => parseInt(h.day_of_week) === dayIdx && parseInt(h.hour) === hour
            );
            const count = entry ? parseInt(entry.total_persons || entry.visit_count || 0) : 0;
            return { count, intensity: count / heatmapMax };
        })
    );

    return (
        <div className="flex flex-col gap-3">

            {/* ═══════════════════════════════════════════════════════
                BLOK 1: ETİKET TOPLAM KARTLARI (en üst)
                tagTotals üzerinden — her etiket için toplam kişi/kayıt
            ═══════════════════════════════════════════════════════ */}
            <div id="visitors-tag-cards">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    🏷️ Etiket Toplamları
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {TAG_INFO.map((tag) => {
                        const val = tagTotals[tag.key] || 0;
                        return (
                            <div
                                key={tag.key}
                                className={`flex flex-col gap-1.5 p-3 rounded-xl border ${tag.bg} ${tag.border} shadow-sm hover:shadow-md transition-shadow`}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: tag.color }}
                                    />
                                    <span className={`text-[10px] font-bold uppercase tracking-wide ${tag.text}`}>
                                        {tag.label}
                                    </span>
                                </div>
                                <span className={`text-xl font-extrabold ${tag.text}`}>
                                    {val.toLocaleString('tr-TR')}
                                </span>

                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                BLOK 2: ARAÇLI vs ARAÇSIZ DONUT + EN SIK GELEN PLAKALAR
            ═══════════════════════════════════════════════════════ */}
            <div id="visitors-vehicle-section" className="grid grid-cols-1 lg:grid-cols-5 gap-3">

                {/* Araçlı vs Araçsız Donut */}
                <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                        🚗 Araçla Giriş Oranı
                    </h3>
                    {vehicleDonutData.length > 0 ? (
                        <div className="flex flex-col items-center gap-4 flex-1 justify-center">
                            <div className="relative w-[150px] h-[150px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={vehicleDonutData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={45}
                                            outerRadius={68}
                                            paddingAngle={3}
                                            dataKey="value"
                                        >
                                            {vehicleDonutData.map((entry, i) => (
                                                <Cell key={i} fill={entry.color} strokeWidth={0} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(val: any) => [`${val} kayıt`, '']} />
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Merkez */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-2xl font-extrabold text-slate-800">%{withVehiclePct}</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">araçlı</span>
                                </div>
                            </div>
                            {/* Legend */}
                            <div className="flex flex-col gap-2 w-full max-w-[180px]">
                                {vehicleDonutData.map((d, i) => (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                                            <span className="font-semibold text-slate-600">{d.name}</span>
                                        </div>
                                        <span className="font-extrabold text-slate-800">{d.value}</span>
                                    </div>
                                ))}
                                <div className="border-t border-slate-100 pt-1 flex items-center justify-between text-xs">
                                    <span className="font-semibold text-slate-500">Toplam Kayıt</span>
                                    <span className="font-extrabold text-slate-700">{totalVisitorRecords}</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-xs text-slate-400 font-bold">
                            Bu dönemde veri bulunamadı.
                        </div>
                    )}
                </div>

                {/* En Sık Gelen Plakalar Top 10 */}
                <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                        🔢 En Sık Gelen Plakalar (Top 10)
                    </h3>
                    {visitorData.topVisitorPlates && visitorData.topVisitorPlates.length > 0 ? (
                        <div className="flex flex-col gap-1.5 flex-1 justify-center">
                            {/* Max değeri bul */}
                            {(() => {
                                const maxCount = Math.max(...visitorData.topVisitorPlates.map((p: any) => parseInt(p.visit_count) || 0), 1);
                                return visitorData.topVisitorPlates.map((plate: any, index: number) => {
                                    const count = parseInt(plate.visit_count) || 0;
                                    const pct = Math.round((count / maxCount) * 100);
                                    const lastVisit = plate.last_visit
                                        ? (() => { const [,m,d] = plate.last_visit.split('-'); return `${d}/${m}`; })()
                                        : '';
                                    return (
                                        <div key={index} className="flex items-center gap-2">
                                            {/* Sıra numarası */}
                                            <span className={`w-5 text-center text-[10px] font-extrabold shrink-0 ${
                                                index === 0 ? 'text-amber-500' :
                                                index === 1 ? 'text-slate-400' :
                                                index === 2 ? 'text-orange-400' : 'text-slate-300'
                                            }`}>
                                                {index + 1}
                                            </span>
                                            {/* Plaka */}
                                            <span className="w-[90px] shrink-0 font-extrabold text-[11px] text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                                {plate.plate}
                                            </span>
                                            {/* Progress bar */}
                                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{
                                                        width: `${pct}%`,
                                                        backgroundColor: COLORS[index % COLORS.length]
                                                    }}
                                                />
                                            </div>
                                            {/* Sayı */}
                                            <span className="w-8 text-right text-[11px] font-extrabold text-slate-700 shrink-0">
                                                {count}
                                            </span>
                                            {/* Son ziyaret */}
                                            <span className="w-[34px] text-right text-[9px] text-slate-400 font-semibold shrink-0 hidden sm:block">
                                                {lastVisit}
                                            </span>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-xs text-slate-400 font-bold">
                            Bu dönemde araçla giriş kaydı bulunamadı.
                        </div>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                BLOK 3: TOPLAM ZİYARETÇİ TRAFİĞİ
                total_persons: Şarj→1, Taşeron/Günübirlik/Görüşme→refakatçi dahil
                count: form/kayıt sayısı
            ═══════════════════════════════════════════════════════ */}
            <div id="visitors-traffic-chart" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>👥 Giriş Trafiği Zaman Serisi</span>
                    <span className="text-[10px] text-slate-400 font-medium">toplam kişi ve kayıt sayısı</span>
                </h3>
                <div className="w-full h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={visitorData.trend}>
                            <defs>
                                <linearGradient id="colorVisitorPersons" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 9, fill: '#64748b' }} />
                            <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#64748b' }} width={30} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#64748b' }} width={30} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 9, fontWeight: 600 }} />
                            <Area
                                yAxisId="right"
                                type="monotone"
                                dataKey="total_persons"
                                name="Gelen Toplam Kişi"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorVisitorPersons)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                BLOK 4: ZİYARET SÜRESİ İSTATİSTİKLERİ
            ═══════════════════════════════════════════════════════ */}
            <div id="visitors-duration-chart" className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col justify-between">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                        ⏱️ Ziyaret Süresi Analizi
                    </h3>
                    <div className="space-y-1.5 flex-1 flex flex-col justify-center">
                        <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                            <span className="font-semibold text-slate-600">Ortalama Süre</span>
                            <span className="font-extrabold text-blue-600">
                                {visitorData.avgDuration?.avg_hours ? `${Number(visitorData.avgDuration.avg_hours).toFixed(1)} saat` : '-'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                            <span className="font-semibold text-slate-600">En Kısa Ziyaret</span>
                            <span className="font-extrabold text-slate-700">
                                {visitorData.avgDuration?.min_hours ? `${(Number(visitorData.avgDuration.min_hours) * 60).toFixed(0)} dk` : '-'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                            <span className="font-semibold text-slate-600">En Uzun Ziyaret</span>
                            <span className="font-extrabold text-slate-700">
                                {visitorData.avgDuration?.max_hours ? `${Number(visitorData.avgDuration.max_hours).toFixed(1)} saat` : '-'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                            <span className="font-semibold text-slate-600">Tamamlanan Ziyaret</span>
                            <span className="font-extrabold text-slate-700">{visitorData.avgDuration?.completed_visits || 0}</span>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                        📊 Süre Dağılımı
                    </h3>
                    <div className="w-full h-[160px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[...visitorData.durationDistribution].sort((a: any, b: any) => {
                                const order = ['0-30 dk', '30-60 dk', '1-2 saat', '2-4 saat', '4+ saat'];
                                return order.indexOf(a.duration_range) - order.indexOf(b.duration_range);
                            })}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="duration_range" tick={{ fontSize: 9, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                                <Tooltip />
                                <Bar dataKey="count" name="Ziyaret Sayısı" radius={[3, 3, 0, 0]} barSize={20}>
                                    {visitorData.durationDistribution.map((_: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                BLOK 5: GİRİŞ SAATİ YOĞUNLUĞU - Modern Heatmap
                total_persons: Şarj→1, diğerleri refakatçi dahil
            ═══════════════════════════════════════════════════════ */}
            {visitorData.hourlyHeatmap && visitorData.hourlyHeatmap.length > 0 && (
                <div id="visitors-heatmap" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            🔥 Giriş Saati Yoğunluğu
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                            <span>Az</span>
                            <div className="flex gap-0.5">
                                {['#e0f2fe', '#7dd3fc', '#38bdf8', '#0284c7', '#0c4a6e'].map((c, i) => (
                                    <div key={i} className="w-4 h-2.5 rounded-sm" style={{ backgroundColor: c }} />
                                ))}
                            </div>
                            <span>Çok</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <div className="flex gap-1 mb-1 pl-[52px] min-w-[700px]">
                            {Array.from({ length: 24 }, (_, i) => (
                                <div key={i} className="flex-1 text-center text-[9px] font-bold text-slate-500">
                                    {String(i).padStart(2, '0')}
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col gap-1 min-w-[700px]">
                            {DAYS.map((day, dayIdx) => {
                                const dayTotal = heatmapMatrix[dayIdx].reduce((s, c) => s + c.count, 0);
                                return (
                                    <div key={dayIdx} className="flex items-center gap-1">
                                        <div className="w-12 shrink-0 text-right text-[10px] font-bold text-slate-500 pr-1">
                                            {SHORT_DAYS[dayIdx]}
                                        </div>
                                        {heatmapMatrix[dayIdx].map(({ count, intensity }, hour) => {
                                            const bg = count === 0 ? '#f8fafc'
                                                : intensity < 0.2 ? '#e0f2fe'
                                                : intensity < 0.4 ? '#7dd3fc'
                                                : intensity < 0.6 ? '#38bdf8'
                                                : intensity < 0.8 ? '#0284c7' : '#0c4a6e';
                                            const textCol = intensity > 0.5 ? 'white' : intensity > 0.2 ? '#0369a1' : '#94a3b8';
                                            return (
                                                <div
                                                    key={hour}
                                                    title={`${day} ${String(hour).padStart(2, '0')}:00 — ${count} kişi`}
                                                    className="flex-1 h-7 flex items-center justify-center rounded text-[9px] font-bold cursor-default transition-transform duration-100 hover:scale-110 hover:shadow-md"
                                                    style={{ backgroundColor: bg, color: textCol }}
                                                >
                                                    {count > 0 ? count : ''}
                                                </div>
                                            );
                                        })}
                                        <div className="w-8 shrink-0 text-center text-[9px] font-extrabold text-slate-400">
                                            {dayTotal > 0 ? dayTotal : ''}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex gap-1 mt-1 pl-[52px] min-w-[700px]">
                            {Array.from({ length: 24 }, (_, hour) => {
                                const total = DAYS.reduce((s, _, dIdx) => s + heatmapMatrix[dIdx][hour].count, 0);
                                return (
                                    <div key={hour} className="flex-1 text-center text-[9px] font-bold text-slate-400">
                                        {total > 0 ? total : ''}
                                    </div>
                                );
                            })}
                            <div className="w-8 shrink-0" />
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                BLOK 6: EN ÇOK ZİYARET EDİLEN KİŞİLER
            ═══════════════════════════════════════════════════════ */}
            {visitorData.hostDistribution && visitorData.hostDistribution.length > 0 && (
                <div id="visitors-host-chart" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        👤 En Çok Ziyaret Edilen Kişiler (Top 10)
                    </h3>
                    <div className="w-full h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={visitorData.hostDistribution} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} />
                                <YAxis dataKey="host" type="category" width={110} tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }} />
                                <Tooltip />
                                <Bar dataKey="visit_count" name="Ziyaret Sayısı" radius={[0, 3, 3, 0]} barSize={12}>
                                    {visitorData.hostDistribution.map((_: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}
