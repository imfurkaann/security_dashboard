import { useState, useEffect } from 'react';
import {
    BarChart, Bar, PieChart, Pie, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Cell, Legend
} from 'recharts';
import api from '../../utils/api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

interface IncidentsTabProps {
    startDate: string;
    endDate: string;
    refetchKey: number;
}

export default function IncidentsTab({ startDate, endDate, refetchKey }: IncidentsTabProps) {
    const [loading, setLoading] = useState(true);
    const [incidentStats, setIncidentStats] = useState<any>({
        monthlyTrend: [],
        typeDistribution: [],
        severityDistribution: [],
        categoryStats: {}
    });

    useEffect(() => {
        let isMounted = true;
        const fetchIncidentsData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/statistics/incidents?startDate=${startDate}&endDate=${endDate}`);
                if (isMounted) {
                    setIncidentStats(res.data.data);
                }
            } catch (error) {
                console.error('Olay verileri yüklenirken hata oluştu:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchIncidentsData();
        return () => {
            isMounted = false;
        };
    }, [startDate, endDate, refetchKey]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border border-slate-200 shadow-md rounded-lg text-xs font-semibold text-slate-800">
                    {payload.map((entry: any, index: number) => (
                        <p key={index} className="flex items-center gap-1.5" style={{ color: entry.color || entry.payload?.fill }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color || entry.payload?.fill }} />
                            {entry.name || entry.payload?.name}: {entry.value}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (loading && !incidentStats.categoryStats) {
        return (
            <div className="flex items-center justify-center h-64 bg-white border border-slate-200 rounded-xl">
                <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                    <span className="text-xs font-bold text-slate-500">Olay Verileri Yükleniyor...</span>
                </div>
            </div>
        );
    }

    const stats = incidentStats.categoryStats || {};

    const summaryCards = [
        { label: 'Hırsızlık', value: parseInt(stats.theft_total) || 0, color: 'border-red-500 bg-gradient-to-br from-red-500 to-red-600 text-white', icon: '🚨' },
        { label: 'Saldırı/Kavga', value: parseInt(stats.assault_total) || 0, color: 'border-orange-500 bg-gradient-to-br from-orange-500 to-orange-600 text-white', icon: '👊' },
        { label: 'Tıbbi Acil', value: parseInt(stats.medical_total) || 0, color: 'border-amber-500 bg-gradient-to-br from-amber-500 to-amber-600 text-white', icon: '⚕️' },
        { label: 'Vandalizm', value: parseInt(stats.vandalism_total) || 0, color: 'border-purple-500 bg-gradient-to-br from-purple-500 to-purple-600 text-white', icon: '🔨' },
        { label: 'Kaza', value: parseInt(stats.accident_total) || 0, color: 'border-emerald-500 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white', icon: '🚑' },
        { label: 'Madde Kullanımı', value: parseInt(stats.substance_total) || 0, color: 'border-pink-500 bg-gradient-to-br from-pink-500 to-pink-600 text-white', icon: '💊' }
    ];

    const mainPieData = [
        { name: 'Hırsızlık', value: parseInt(stats.theft_total) || 0 },
        { name: 'Saldırı/Kavga', value: parseInt(stats.assault_total) || 0 },
        { name: 'Tıbbi Acil', value: parseInt(stats.medical_total) || 0 },
        { name: 'Vandalizm', value: parseInt(stats.vandalism_total) || 0 },
        { name: 'Kaza', value: parseInt(stats.accident_total) || 0 },
        { name: 'Madde Kullanımı', value: parseInt(stats.substance_total) || 0 }
    ].filter(item => item.value > 0);

    return (
        <div className="flex flex-col gap-3">
            {/* 1. Yatay Özet Kartları (UI Compaction) */}
            <div id="incident-stats-cards" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {summaryCards.map((card, i) => (
                    <div key={i} className={`rounded-xl shadow-sm p-2.5 border text-white ${card.color}`}>
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm shrink-0">{card.icon}</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider">{card.label}</span>
                            </div>
                            <span className="text-lg font-extrabold">{card.value}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* 2. Ana Dağılım Donut Grafiği */}
            <div id="incident-main-dist" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col items-center">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 self-start">
                    📊 Genel Olay Kategori Dağılımı
                </h3>
                {mainPieData.length > 0 ? (
                    <div className="w-full max-w-lg h-[180px] flex items-center justify-center relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={mainPieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    paddingAngle={3}
                                    dataKey="value"
                                >
                                    {mainPieData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 9, fontWeight: 600 }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute flex flex-col items-center justify-center">
                            <span className="text-xl font-extrabold text-slate-800">
                                {mainPieData.reduce((sum, item) => sum + item.value, 0)}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Olay</span>
                        </div>
                    </div>
                ) : (
                    <div className="w-full py-8 text-center text-xs font-bold text-slate-400 border border-dashed border-slate-200 rounded-lg">
                        Seçilen tarih aralığında olay kaydı bulunamadı.
                    </div>
                )}
            </div>

            {/* 3. Alt Kategori Detayları Grid'i */}
            {mainPieData.length > 0 && (
                <div id="incident-sub-charts" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Hırsızlık Detayı */}
                    {parseInt(stats.theft_total) > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">🚨 Hırsızlık Alt Detayları</h3>
                            <div className="w-full h-[140px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[
                                        { name: 'Misafir Eşyası', count: parseInt(stats.theft_guest_property) || 0 },
                                        { name: 'Otel Mülkiyeti', count: parseInt(stats.theft_hotel_property) || 0 },
                                        { name: 'Personel Hırsızlığı', count: parseInt(stats.theft_personnel) || 0 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} />
                                        <YAxis tick={{ fontSize: 8, fill: '#64748b' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name="Olay" fill="#ef4444" radius={[3, 3, 0, 0]} barSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Saldırı/Kavga Detayı */}
                    {parseInt(stats.assault_total) > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">👊 Saldırı & Kavga Alt Detayları</h3>
                            <div className="w-full h-[140px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[
                                        { name: 'Fiziksel Saldırı', count: parseInt(stats.assault_physical) || 0 },
                                        { name: 'Sözlü Taciz', count: parseInt(stats.assault_verbal) || 0 },
                                        { name: 'Toplu Kavga', count: parseInt(stats.assault_mass_fight) || 0 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} />
                                        <YAxis tick={{ fontSize: 8, fill: '#64748b' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name="Olay" fill="#f59e0b" radius={[3, 3, 0, 0]} barSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Tıbbi Acil Detayı */}
                    {parseInt(stats.medical_total) > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">⚕️ Tıbbi Acil Alt Detayları</h3>
                            <div className="w-full h-[140px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[
                                        { name: 'Ciddi Durum', count: parseInt(stats.medical_serious) || 0 },
                                        { name: 'İlk Yardım', count: parseInt(stats.medical_first_aid) || 0 },
                                        { name: 'Ambulans', count: parseInt(stats.medical_ambulance) || 0 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} />
                                        <YAxis tick={{ fontSize: 8, fill: '#64748b' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name="Olay" fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Vandalizm Detayı */}
                    {parseInt(stats.vandalism_total) > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">🔨 Vandalizm & Hasar Alt Detayları</h3>
                            <div className="w-full h-[140px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[
                                        { name: 'Oda Hasarı', count: parseInt(stats.vandalism_room) || 0 },
                                        { name: 'Ortak Alan Hasarı', count: parseInt(stats.vandalism_common_area) || 0 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} />
                                        <YAxis tick={{ fontSize: 8, fill: '#64748b' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name="Olay" fill="#8b5cf6" radius={[3, 3, 0, 0]} barSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Kaza Detayı */}
                    {parseInt(stats.accident_total) > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">🚑 Kaza & Yaralanma Alt Detayları</h3>
                            <div className="w-full h-[140px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[
                                        { name: 'Kayma/Düşme', count: parseInt(stats.accident_slip_fall) || 0 },
                                        { name: 'Ekipman', count: parseInt(stats.accident_equipment) || 0 },
                                        { name: 'İş Kazası', count: parseInt(stats.accident_work) || 0 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} />
                                        <YAxis tick={{ fontSize: 8, fill: '#64748b' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name="Olay" fill="#10b981" radius={[3, 3, 0, 0]} barSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Madde Kullanımı Detayı */}
                    {parseInt(stats.substance_total) > 0 && (
                        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">💊 Madde Kullanımı Alt Detayları</h3>
                            <div className="w-full h-[140px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={[
                                        { name: 'Personel (Görevde)', count: parseInt(stats.substance_personnel) || 0 },
                                        { name: 'Mülkte Bulunma', count: parseInt(stats.substance_property) || 0 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#64748b' }} />
                                        <YAxis tick={{ fontSize: 8, fill: '#64748b' }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name="Olay" fill="#ec4899" radius={[3, 3, 0, 0]} barSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
