import { useState, useEffect } from 'react';
import {
    AreaChart, Area, BarChart, Bar, ResponsiveContainer,
    CartesianGrid, XAxis, YAxis, Tooltip, Cell
} from 'recharts';
import api from '../../utils/api';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const SHORT_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

interface VehiclesTabProps {
    startDate: string;
    endDate: string;
    refetchKey: number;
}

export default function VehiclesTab({ startDate, endDate, refetchKey }: VehiclesTabProps) {
    const [loading, setLoading] = useState(true);
    const [vehicleStats, setVehicleStats] = useState<any>({
        trend: [],
        topVehicles: [],
        topManagers: [],
        statusDistribution: [],
        topDestinations: [],
        hourlyUsage: [],
        hourlyHeatmap: [],
        personnelVehicleUsage: []
    });

    useEffect(() => {
        let isMounted = true;
        const fetchVehiclesData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/statistics/vehicles?period=daily&startDate=${startDate}&endDate=${endDate}`);
                if (isMounted) setVehicleStats(res.data.data);
            } catch (error) {
                console.error('Araç verileri yüklenirken hata oluştu:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchVehiclesData();
        return () => { isMounted = false; };
    }, [startDate, endDate, refetchKey]);

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

    if (loading && !vehicleStats.trend?.length) {
        return (
            <div className="flex items-center justify-center h-64 bg-white border border-slate-200 rounded-xl">
                <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent"></div>
                    <span className="text-xs font-bold text-slate-500">Araç Verileri Yükleniyor...</span>
                </div>
            </div>
        );
    }

    // Heatmap için max değer ve matrix
    const heatmapMax = Math.max(
        ...((vehicleStats.hourlyHeatmap || []).map((h: any) => parseInt(h.count || 0))),
        1
    );
    const heatmapMatrix = DAYS.map((_, dayIdx) =>
        Array.from({ length: 24 }, (_, hour) => {
            const entry = (vehicleStats.hourlyHeatmap || []).find(
                (h: any) => parseInt(h.day_of_week) === dayIdx && parseInt(h.hour) === hour
            );
            const count = entry ? parseInt(entry.count || 0) : 0;
            return { count, intensity: count / heatmapMax };
        })
    );

    // Özet kartlar için toplam ve en yoğun araç
    const totalUsage = (vehicleStats.trend || []).reduce((s: number, r: any) => s + (parseInt(r.count) || 0), 0);
    const topVehicle = vehicleStats.topVehicles?.[0];
    const topManager = vehicleStats.topManagers?.[0];
    const topDest = vehicleStats.topDestinations?.[0];

    return (
        <div className="flex flex-col gap-3">

            {/* ═══════════════════════════════════════════════════════
                BLOK 1: ÖZET KARTLAR
            ═══════════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-3 shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Toplam Kullanım</span>
                    <span className="text-2xl font-extrabold">{totalUsage.toLocaleString('tr-TR')}</span>
                    <span className="text-[9px] opacity-70">seçili dönem</span>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">En Aktif Araç</span>
                    <span className="text-sm font-extrabold text-slate-800 truncate">{topVehicle?.plate || '-'}</span>
                    <span className="text-[9px] text-slate-500 font-semibold">{topVehicle ? `${topVehicle.usage_count} kez kullanıldı` : 'veri yok'}</span>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">En Aktif Yönetici</span>
                    <span className="text-sm font-extrabold text-slate-800 truncate">{topManager?.manager_name || '-'}</span>
                    <span className="text-[9px] text-slate-500 font-semibold">{topManager ? `${topManager.usage_count} araç aldı` : 'veri yok'}</span>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 p-3 shadow-sm flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">En Sık Lokasyon</span>
                    <span className="text-sm font-extrabold text-slate-800 truncate">{topDest?.destination || '-'}</span>
                    <span className="text-[9px] text-slate-500 font-semibold">{topDest ? `${topDest.count} sefer` : 'veri yok'}</span>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                BLOK 2: GÜNLÜK ARAÇ KULLANIM TRENDİ
            ═══════════════════════════════════════════════════════ */}
            <div id="vehicles-trend-chart" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>🚗 Günlük Araç Çıkış Trendi</span>
                    <span className="text-[10px] text-slate-400 font-medium">seçili dönem içindeki günlük toplam kayıt</span>
                </h3>
                <div className="w-full h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={vehicleStats.trend}>
                            <defs>
                                <linearGradient id="colorVehiclesTrend" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis dataKey="date" tickFormatter={formatDateLabel} tick={{ fontSize: 9, fill: '#64748b' }} />
                            <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="count"
                                name="Araç Çıkış Sayısı"
                                stroke="#10b981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorVehiclesTrend)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                BLOK 3: EN ÇOK KULLANILAN ARAÇLAR & YÖNETİCİLER
            ═══════════════════════════════════════════════════════ */}
            <div id="vehicles-grid-1" className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* En Çok Kullanılan Araçlar */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        🏆 En Çok Çıkış Yapılan Araçlar (İlk 10)
                    </h3>
                    {vehicleStats.topVehicles && vehicleStats.topVehicles.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                            {(() => {
                                const maxVal = Math.max(...vehicleStats.topVehicles.map((v: any) => parseInt(v.usage_count) || 0), 1);
                                return vehicleStats.topVehicles.map((v: any, index: number) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <span className={`w-5 text-center text-[10px] font-extrabold shrink-0 ${index === 0 ? 'text-amber-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-orange-400' : 'text-slate-300'}`}>
                                            {index + 1}
                                        </span>
                                        <span className="w-[80px] shrink-0 font-extrabold text-[11px] text-slate-800 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 truncate">
                                            {v.plate}
                                        </span>
                                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{ width: `${Math.round(((parseInt(v.usage_count) || 0) / maxVal) * 100)}%`, backgroundColor: COLORS[index % COLORS.length] }}
                                            />
                                        </div>
                                        <span className="w-7 text-right text-[11px] font-extrabold text-slate-700 shrink-0">
                                            {parseInt(v.usage_count) || 0}
                                        </span>
                                    </div>
                                ));
                            })()}
                        </div>
                    ) : (
                        <div className="h-[180px] flex items-center justify-center text-xs text-slate-400 font-bold">Veri bulunamadı.</div>
                    )}
                </div>

                {/* En Çok Araç Alan Yöneticiler */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        👤 En Çok Araç Alan Yöneticiler (İlk 10)
                    </h3>
                    {vehicleStats.topManagers && vehicleStats.topManagers.length > 0 ? (
                        <div className="w-full h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={vehicleStats.topManagers} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                    <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} />
                                    <YAxis dataKey="manager_name" type="category" width={110} tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }} />
                                    <Tooltip />
                                    <Bar dataKey="usage_count" name="Araç Kullanım Sayısı" radius={[0, 3, 3, 0]} barSize={12}>
                                        {vehicleStats.topManagers.map((_: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-xs text-slate-400 font-bold">Veri bulunamadı.</div>
                    )}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                BLOK 4: EN ÇOK GİDİLEN LOKASYONLAR
            ═══════════════════════════════════════════════════════ */}
            {vehicleStats.topDestinations && vehicleStats.topDestinations.length > 0 && (
                <div id="vehicles-destinations" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                        📍 En Sık Gidilen Lokasyonlar (İlk 10)
                    </h3>
                    <div className="flex flex-col gap-1">
                        {(() => {
                            const maxVal = Math.max(...vehicleStats.topDestinations.map((d: any) => parseInt(d.count) || 0), 1);
                            return vehicleStats.topDestinations.map((d: any, index: number) => {
                                const count = parseInt(d.count) || 0;
                                const pct = Math.round((count / maxVal) * 100);
                                return (
                                    <div key={index} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                                        {/* Sıra */}
                                        <span className={`w-4 text-center text-[10px] font-extrabold shrink-0 ${
                                            index === 0 ? 'text-amber-500' :
                                            index === 1 ? 'text-slate-400' :
                                            index === 2 ? 'text-orange-400' : 'text-slate-300'
                                        }`}>
                                            {index + 1}
                                        </span>
                                        {/* Lokasyon adı — sabit genişlik */}
                                        <span
                                            className="w-[120px] shrink-0 text-[11px] font-semibold text-slate-700 truncate"
                                            title={d.destination}
                                        >
                                            {d.destination}
                                        </span>
                                        {/* Bar + sayı yan yana */}
                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all duration-500"
                                                    style={{ width: `${pct}%`, backgroundColor: COLORS[(index + 4) % COLORS.length] }}
                                                />
                                            </div>
                                            <span className="w-6 text-right text-[11px] font-extrabold text-slate-700 shrink-0">
                                                {count}
                                            </span>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                BLOK 5: ARAÇ KULLANIM SAATİ YOĞUNLUĞU - Modern Heatmap
            ═══════════════════════════════════════════════════════ */}
            {vehicleStats.hourlyHeatmap && vehicleStats.hourlyHeatmap.length > 0 && (
                <div id="vehicles-heatmap" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            🔥 Araç Çıkış Saati Yoğunluğu
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                            <span>Az</span>
                            <div className="flex gap-0.5">
                                {['#d1fae5', '#6ee7b7', '#34d399', '#10b981', '#047857'].map((c, i) => (
                                    <div key={i} className="w-4 h-2.5 rounded-sm" style={{ backgroundColor: c }} />
                                ))}
                            </div>
                            <span>Çok</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        {/* Saat başlıkları */}
                        <div className="flex gap-1 mb-1 pl-[52px] min-w-[700px]">
                            {Array.from({ length: 24 }, (_, i) => (
                                <div key={i} className="flex-1 text-center text-[9px] font-bold text-slate-500">
                                    {String(i).padStart(2, '0')}
                                </div>
                            ))}
                        </div>
                        {/* Satırlar */}
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
                                                : intensity < 0.2 ? '#d1fae5'
                                                : intensity < 0.4 ? '#6ee7b7'
                                                : intensity < 0.6 ? '#34d399'
                                                : intensity < 0.8 ? '#10b981' : '#047857';
                                            const textCol = intensity > 0.5 ? 'white' : intensity > 0.2 ? '#065f46' : '#94a3b8';
                                            return (
                                                <div
                                                    key={hour}
                                                    title={`${day} ${String(hour).padStart(2, '0')}:00 — ${count} araç`}
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
                        {/* Saat toplamları */}
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
        </div>
    );
}
