import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import 'antd/dist/reset.css';
import api from '../utils/api';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';

const { RangePicker } = DatePicker;

type PeriodType = 'custom';

interface PersonnelStatRow {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    vehicleCount: number;
    visitorCount: number;
    managerCount: number;
    fireAlarmCount: number;
    sgkCount: number;
    totalCount: number;
}

interface PersonnelStatsResponse {
    success: boolean;
    data: {
        period: PeriodType;
        startDate: string | null;
        endDate: string | null;
        rows: PersonnelStatRow[];
    };
}

const formatDisplayDate = (value: string | null): string => {
    if (!value) return '-';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Europe/Istanbul',
    }).format(parsed);
};

const renderWrappedNameTick = ({
    x,
    y,
    payload,
    maxLineLength = 18,
}: {
    x?: number;
    y?: number;
    payload?: { value?: string };
    maxLineLength?: number;
}) => {
    const value = payload?.value ? String(payload.value) : '';

    const lines: string[] = [];
    if (value.length <= maxLineLength) {
        lines.push(value);
    } else {
        const words = value.split(' ');
        let currentLine = '';

        words.forEach((word) => {
            const nextLine = currentLine ? `${currentLine} ${word}` : word;
            if (nextLine.length <= maxLineLength || currentLine === '') {
                currentLine = nextLine;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        });

        if (currentLine) lines.push(currentLine);
    }

    return (
        <g transform={`translate(${x ?? 0},${y ?? 0})`}>
            {lines.slice(0, 2).map((line, index) => (
                <text key={`${line}-${index}`} x={0} y={index === 0 ? 0 : 14} textAnchor="end" fill="#334155" fontSize={12}>
                    {line}
                </text>
            ))}
        </g>
    );
};

export default function AdminPersonnelStatistics() {
    const navigate = useNavigate();
    const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
        dayjs().subtract(30, 'day'),
        dayjs()
    ]);
    const [rows, setRows] = useState<PersonnelStatRow[]>([]);
    const [startDate, setStartDate] = useState<string | null>(null);
    const [endDate, setEndDate] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));

    useEffect(() => {
        const handleResize = () => setViewportWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchStats = useCallback(async (start: dayjs.Dayjs | null, end: dayjs.Dayjs | null) => {
        setLoading(true);
        setError('');

        try {
            const startStr = start ? start.format('YYYY-MM-DD') : '';
            const endStr = end ? end.format('YYYY-MM-DD') : '';
            const response = await api.get<PersonnelStatsResponse>(`/statistics/personnel-performance?startDate=${startStr}&endDate=${endStr}`);
            const data = response.data?.data;
            setRows(data?.rows || []);
            setStartDate(data?.startDate || null);
            setEndDate(data?.endDate || null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Personel istatistikleri alınamadı');
            setRows([]);
            setStartDate(null);
            setEndDate(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchStats(dateRange[0], dateRange[1]);
    }, [dateRange, fetchStats]);

    const refreshStatsRealtime = useCallback(() => fetchStats(dateRange[0], dateRange[1]), [fetchStats, dateRange]);

    useRealtimeRefetch({
        topics: ['dashboard', 'incidents', 'sgk', 'personnel'],
        onMutation: refreshStatsRealtime,
        enabled: true,
    });

    const chartData = useMemo(() => rows
        .filter((row) => row.totalCount > 0)
        .sort((a, b) => b.totalCount - a.totalCount)
        .slice(0, 10)
        .map((row) => ({ ...row, fullName: `${row.firstName} ${row.lastName}`.trim() })), [rows]);

    const chartHeight = useMemo(() => {
        const isCompact = viewportWidth < 1024;
        return Math.max(isCompact ? 180 : 220, chartData.length * (isCompact ? 42 : 54));
    }, [chartData.length, viewportWidth]);

    const chartConfig = useMemo(() => {
        const isCompact = viewportWidth < 1024;
        return {
            leftMargin: isCompact ? 0 : 8,
            rightMargin: isCompact ? 12 : 16,
            yAxisWidth: isCompact ? 110 : 140,
            xAxisFontSize: isCompact ? 11 : 12,
            tickMaxLength: isCompact ? 14 : 18,
            barSize: isCompact ? 18 : 22,
        };
    }, [viewportWidth]);

    const chartColors = ['#1D4ED8', '#2563EB', '#0F766E', '#0284C7', '#334155', '#475569', '#14B8A6', '#3B82F6', '#60A5FA', '#93C5FD'];

    const totals = useMemo(() => ({
        vehicleCount: rows.reduce((acc, row) => acc + row.vehicleCount, 0),
        visitorCount: rows.reduce((acc, row) => acc + row.visitorCount, 0),
        managerCount: rows.reduce((acc, row) => acc + row.managerCount, 0),
        fireAlarmCount: rows.reduce((acc, row) => acc + row.fireAlarmCount, 0),
        sgkCount: rows.reduce((acc, row) => acc + row.sgkCount, 0),
        totalCount: rows.reduce((acc, row) => acc + row.totalCount, 0),
    }), [rows]);

    const periodRangeText = useMemo(() => {
        if (!startDate || !endDate) return '-';
        return `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;
    }, [startDate, endDate]);

    const statsCards = useMemo(() => {
        const topPerson = chartData[0];
        return [
            {
                title: 'Toplam Kayıt Sayısı',
                value: totals.totalCount,
                subtitle: 'Sistemdeki toplam kayıt',
                gradient: 'from-blue-600 to-indigo-700',
                icon: (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                )
            },
            {
                title: 'En Aktif Personel',
                value: topPerson ? `${topPerson.firstName} ${topPerson.lastName}` : '-',
                subtitle: topPerson ? `${topPerson.totalCount} kayıt` : 'Kayıt bulunamadı',
                gradient: 'from-purple-600 to-indigo-700',
                icon: (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                )
            },
            {
                title: 'Yangın Alarmları',
                value: totals.fireAlarmCount,
                subtitle: 'Toplam yangın alarmı',
                gradient: 'from-rose-500 to-red-700',
                icon: (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                )
            },
            {
                title: 'Ziyaretçi Girişleri',
                value: totals.visitorCount,
                subtitle: 'Otel ziyaretçi kayıtları',
                gradient: 'from-emerald-500 to-teal-700',
                icon: (
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                )
            }
        ];
    }, [totals, chartData]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="p-2 hover:bg-slate-800 rounded-lg transition shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Admin Paneli</p>
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Personel İstatistiği</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Personel bazlı kayıt performansı</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap text-sm text-slate-600">
                                <span className="font-medium text-slate-500">Tarih Aralığı Seçin</span>
                                <RangePicker
                                    value={dateRange}
                                    onChange={(dates) => {
                                        if (dates) {
                                            setDateRange([dates[0], dates[1]]);
                                        } else {
                                            setDateRange([null, null]);
                                        }
                                    }}
                                    format="DD/MM/YYYY"
                                    placeholder={['Başlangıç', 'Bitiş']}
                                    size="small"
                                />
                            </div>

                            <button
                                onClick={() => fetchStats(dateRange[0], dateRange[1])}
                                disabled={loading}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                                Yenile
                            </button>
                        </div>

                        <div className="xl:ml-auto text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                            <span className="text-slate-500">Tarih Aralığı:</span>{' '}
                            <span className="font-semibold text-slate-900">{periodRangeText}</span>
                        </div>
                    </div>
                </div>



                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-3 sm:px-4 pt-4 pb-3 border-b border-gray-100">
                        <h2 className="text-base font-bold text-gray-900 mb-4">Personel Toplam Kayıt Grafiği</h2>

                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={chartHeight}>
                                <BarChart
                                    data={chartData}
                                    layout="vertical"
                                    margin={{ top: 10, right: chartConfig.rightMargin, left: chartConfig.leftMargin, bottom: 10 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis
                                        type="number"
                                        allowDecimals={false}
                                        tick={{ fill: '#475569', fontSize: chartConfig.xAxisFontSize }}
                                        axisLine={{ stroke: '#cbd5e1' }}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="fullName"
                                        width={chartConfig.yAxisWidth}
                                        tick={(props) => renderWrappedNameTick({ ...props, maxLineLength: chartConfig.tickMaxLength })}
                                        tickLine={false}
                                        axisLine={{ stroke: '#cbd5e1' }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: '1px solid #e2e8f0',
                                            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                                        }}
                                        formatter={(value: number | undefined, name: string | undefined) => [
                                            Number(value ?? 0).toLocaleString('tr-TR'),
                                            name === 'totalCount' ? 'Toplam Kayıt' : String(name ?? ''),
                                        ]}
                                        labelFormatter={(label) => `Personel: ${label}`}
                                    />
                                    <Bar dataKey="totalCount" radius={[0, 10, 10, 0]} barSize={chartConfig.barSize}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={entry.id} fill={chartColors[index % chartColors.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                Seçilen dönemde kaydı olan personel bulunamadı.
                            </div>
                        )}
                    </div>

                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
                        <h2 className="text-base font-bold text-gray-900">Personel Performans Tablosu</h2>
                        {loading && <span className="text-sm text-gray-500">Yükleniyor...</span>}
                    </div>

                    {error && <div className="px-4 py-4 bg-red-50 border-b border-red-100 text-red-700 text-sm">{error}</div>}

                    <div className="w-full overflow-x-auto">
                        <table className="w-full min-w-full lg:min-w-[920px] table-fixed text-xs sm:text-sm">
                            <thead className="bg-slate-50/80 sticky top-0 border-b border-slate-100">
                                <tr>
                                    <th className="w-14 px-2 py-3 text-left font-semibold text-slate-700">#</th>
                                    <th className="px-2 py-3 text-left font-semibold text-slate-700">Personel</th>
                                    <th className="w-24 px-2 py-3 text-right font-semibold text-slate-700">Araç</th>
                                    <th className="w-24 px-2 py-3 text-right font-semibold text-slate-700">Ziyaretçi</th>
                                    <th className="w-24 px-2 py-3 text-right font-semibold text-slate-700">Müdür</th>
                                    <th className="w-24 px-2 py-3 text-right font-semibold text-slate-700">Yangın</th>
                                    <th className="w-24 px-2 py-3 text-right font-semibold text-slate-700">SGK</th>
                                    <th className="w-24 px-2 py-3 text-right font-semibold text-slate-700">Toplam</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!loading && rows.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                                            Seçilen dönem için kayıt bulunamadı.
                                        </td>
                                    </tr>
                                )}

                                {rows.map((row, index) => {
                                    let rankBadge = null;
                                    if (index === 0) {
                                        rankBadge = <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300 shadow-sm">1</span>;
                                    } else if (index === 1) {
                                        rankBadge = <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold border border-slate-400 shadow-sm">2</span>;
                                    } else if (index === 2) {
                                        rankBadge = <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold border border-orange-300 shadow-sm">3</span>;
                                    } else {
                                        rankBadge = <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-medium border border-slate-200">{index + 1}</span>;
                                    }

                                    return (
                                        <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors">
                                            <td className="px-2 py-3 text-slate-700">{rankBadge}</td>
                                            <td className="px-2 py-3 min-w-0">
                                                <div className="font-bold text-slate-850 text-xs sm:text-sm truncate">{row.firstName} {row.lastName}</div>
                                                <div className="text-xs text-slate-500 truncate">@{row.username}</div>
                                            </td>
                                            <td className="px-2 py-3 text-right text-slate-800 whitespace-nowrap font-medium">{row.vehicleCount}</td>
                                            <td className="px-2 py-3 text-right text-slate-800 whitespace-nowrap font-medium">{row.visitorCount}</td>
                                            <td className="px-2 py-3 text-right text-slate-800 whitespace-nowrap font-medium">{row.managerCount}</td>
                                            <td className="px-2 py-3 text-right text-slate-800 whitespace-nowrap font-medium">{row.fireAlarmCount}</td>
                                            <td className="px-2 py-3 text-right text-slate-800 whitespace-nowrap font-medium">{row.sgkCount}</td>
                                            <td className="px-2 py-3 text-right font-bold text-blue-700 whitespace-nowrap">{row.totalCount}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-200">
                                <tr>
                                    <td className="px-2 py-3" colSpan={2}>
                                        <span className="font-bold text-slate-800">Genel Toplam</span>
                                    </td>
                                    <td className="px-2 py-3 text-right font-bold text-slate-900 whitespace-nowrap">{totals.vehicleCount}</td>
                                    <td className="px-2 py-3 text-right font-bold text-slate-900 whitespace-nowrap">{totals.visitorCount}</td>
                                    <td className="px-2 py-3 text-right font-bold text-slate-900 whitespace-nowrap">{totals.managerCount}</td>
                                    <td className="px-2 py-3 text-right font-bold text-slate-900 whitespace-nowrap">{totals.fireAlarmCount}</td>
                                    <td className="px-2 py-3 text-right font-bold text-slate-900 whitespace-nowrap">{totals.sgkCount}</td>
                                    <td className="px-2 py-3 text-right font-extrabold text-blue-800 whitespace-nowrap">{totals.totalCount}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
