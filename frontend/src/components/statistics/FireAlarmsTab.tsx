import { useState, useEffect } from 'react';
import {
    BarChart, Bar, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Cell
} from 'recharts';
import { Flame, TrendingUp } from 'lucide-react';
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

interface FireAlarmsTabProps {
    startDate: string;
    endDate: string;
    refetchKey: number;
    getDaysLabel: () => string;
    formatDate: (dateStr: string) => string;
    CustomTooltip: any;
}

export default function FireAlarmsTab({
    startDate,
    endDate,
    refetchKey,
    getDaysLabel,
    formatDate,
    CustomTooltip
}: FireAlarmsTabProps) {
    const [loading, setLoading] = useState(true);
    const [isMobileViewport, setIsMobileViewport] = useState(false);
    const [fireAlarmStats, setFireAlarmStats] = useState<any>({
        dailyTrend: [],
        monthlyTrend: [],
        locationDistribution: [],
        resolutionStats: [],
        hourlyTrend: []
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
        const fetchFireAlarmData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/statistics/fire-alarms?startDate=${startDate}&endDate=${endDate}`);
                if (isMounted) {
                    setFireAlarmStats(res.data.data);
                }
            } catch (error) {
                console.error('Yangın alarmı istatistik yükleme hatası:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchFireAlarmData();
        return () => {
            isMounted = false;
        };
    }, [startDate, endDate, refetchKey]);

    const getWordCloudWidth = () => {
        if (typeof window === 'undefined') return 320;
        return Math.max(window.innerWidth - (isMobileViewport ? 40 : 120), 280);
    };

    if (loading && !fireAlarmStats.dailyTrend.length) {
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

            {/* Özet Kartlar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="fire-alarm-daily-trend">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Alarm Sayısı ({getDaysLabel()})</h3>
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
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="fire-alarm-hourly-trend">
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
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="fire-alarm-locations-cloud">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">☁️ Alarm Lokasyonları ({getDaysLabel()})</h3>
                    <div className="w-full flex justify-center overflow-auto">
                        <div className="w-full" style={{ minWidth: '100%', maxWidth: '100%' }}>
                            <WordCloud
                                data={fireAlarmStats.locationDistribution.map((item: any) => ({
                                    text: item.location,
                                    value: item.count
                                }))}
                                width={getWordCloudWidth()}
                                height={300}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Lokasyon Bar Chart */}
            {fireAlarmStats.locationDistribution && fireAlarmStats.locationDistribution.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="fire-alarm-locations-chart">
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
    );
}
