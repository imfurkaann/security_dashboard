import { useState, useEffect } from 'react';
import {
    AreaChart, Area, BarChart, Bar, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Cell
} from 'recharts';
import api from '../../utils/api';
import WordCloud from '../WordCloud';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
const CHART_COLORS = {
    primary: '#3B82F6',
    secondary: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6'
};

interface VehiclesTabProps {
    startDate: string;
    endDate: string;
    refetchKey: number;
    getDaysLabel: () => string;
    formatDate: (dateStr: string) => string;
    CustomTooltip: any;
}

export default function VehiclesTab({
    startDate,
    endDate,
    refetchKey,
    getDaysLabel,
    formatDate,
    CustomTooltip
}: VehiclesTabProps) {
    const [loading, setLoading] = useState(true);
    const [isMobileViewport, setIsMobileViewport] = useState(false);
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
        if (typeof window === 'undefined') return;
        const updateViewport = () => setIsMobileViewport(window.innerWidth < 768);
        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, []);

    useEffect(() => {
        let isMounted = true;
        const fetchVehiclesData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/statistics/vehicles?period=daily&startDate=${startDate}&endDate=${endDate}`);
                if (isMounted) {
                    setVehicleStats(res.data.data);
                }
            } catch (error) {
                console.error('Araç istatistik yükleme hatası:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchVehiclesData();
        return () => {
            isMounted = false;
        };
    }, [startDate, endDate, refetchKey]);

    const getWordCloudWidth = () => {
        if (typeof window === 'undefined') return 320;
        return Math.max(window.innerWidth - (isMobileViewport ? 40 : 120), 280);
    };

    if (loading && !vehicleStats.trend.length) {
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

            {/* Araç Kullanım Trendi */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="vehicle-daily-trend">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">🚗 Araç Kullanım Trendi ({getDaysLabel()})</h3>
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
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="vehicle-top-vehicles">
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
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="vehicle-top-managers">
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
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="vehicle-top-destinations">
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
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="vehicle-hourly-heatmap">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">🔥 Araç Kullanım Yoğunluğu ({getDaysLabel()} - Gün x Saat)</h3>
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
                                    const dayData = vehicleStats.hourlyHeatmap.filter((h: any) => parseInt(h.day_of_week) === dayIndex);
                                    const maxCount = Math.max(...vehicleStats.hourlyHeatmap.map((h: any) => parseInt(h.count || 0)), 1);

                                    return (
                                        <tr key={dayIndex}>
                                            <td className="border border-gray-300 px-2 sm:px-4 py-2 font-medium bg-gray-50 text-xs sm:text-sm whitespace-nowrap">{day}</td>
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
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="vehicle-destinations-cloud">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">☁️ Hedef Lokasyonlar ({getDaysLabel()})</h3>
                    <div className="w-full flex justify-center overflow-auto">
                        <div className="w-full" style={{ minWidth: '100%', maxWidth: '100%' }}>
                            <WordCloud
                                data={vehicleStats.topDestinations.map((item: any) => ({
                                    text: item.destination,
                                    value: item.count
                                }))}
                                width={getWordCloudWidth()}
                                height={300}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
