import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from '../utils/dayjsConfig';
import 'antd/dist/reset.css';
import api from '../utils/api';
import { formatDate, formatTime } from '../utils/dateUtils';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';

const { RangePicker } = DatePicker;

const normalizeSearchText = (value: string | null | undefined): string => {
    return (value || '').toLocaleLowerCase('tr-TR').normalize('NFC');
};

interface FireAlarmRecord {
    id: string;
    alarm_number: string | null;
    location: string;
    gate?: string | null;
    alarm_time: string;
    resolved: boolean;
    resolution_time: string | null;
    resolution_notes: string | null;
    false_alarm: boolean;
    recorded_by_name: string;
    resolved_by_name: string | null;
    deleted_at?: string | null;
    created_at: string;
}

export default function FireAlarmRecords() {
    const [records, setRecords] = useState<FireAlarmRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [textPreview, setTextPreview] = useState<{ title: string; value: string } | null>(null);
    const [scrollbarSpacerWidth, setScrollbarSpacerWidth] = useState(0);
    const latestFetchId = useRef(0);
    const navigate = useNavigate();
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);

    // Filter states
    const [alarmNumber, setAlarmNumber] = useState('');
    const [location, setLocation] = useState('');
    const [recordedBy, setRecordedBy] = useState('');
    const [resolvedBy, setResolvedBy] = useState('');
    const [status, setStatus] = useState('all');
    const [gateFilter, setGateFilter] = useState('all');
    const [falseAlarmFilter, setFalseAlarmFilter] = useState('all');
    const [alarmDateStart, setAlarmDateStart] = useState('');
    const [alarmDateEnd, setAlarmDateEnd] = useState('');
    const [resolutionDateStart, setResolutionDateStart] = useState('');
    const [resolutionDateEnd, setResolutionDateEnd] = useState('');

    const fetchData = useCallback(async () => {
        const fetchId = ++latestFetchId.current;
        try {
            const res = await api.get(`/fire-alarms/records?includeDeleted=true&_t=${Date.now()}`);
            if (fetchId !== latestFetchId.current) return;
            setRecords(res.data?.data || []);
        } catch (error) {
            if (fetchId !== latestFetchId.current) return;
            console.error('Veriler yüklenemedi:', error);
        } finally {
            if (fetchId !== latestFetchId.current) return;
            setLoading(false);
        }
    }, []);

    // Fetch all records + periodic refresh to keep list in sync
    useEffect(() => {
        fetchData();
        const refreshInterval = window.setInterval(fetchData, 15000);
        return () => window.clearInterval(refreshInterval);
    }, [fetchData]);

    useRealtimeRefetch({
        topics: ['fire-alarms'],
        onMutation: fetchData,
        enabled: true,
    });

    useEffect(() => {
        const handleFocus = () => {
            fetchData();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchData();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchData]);

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            if (alarmNumber && !normalizeSearchText(record.alarm_number).includes(normalizeSearchText(alarmNumber))) return false;
            if (location && !normalizeSearchText(record.location).includes(normalizeSearchText(location))) return false;
            if (recordedBy && !normalizeSearchText(record.recorded_by_name).includes(normalizeSearchText(recordedBy))) return false;
            if (resolvedBy && !normalizeSearchText(record.resolved_by_name).includes(normalizeSearchText(resolvedBy))) return false;
            if (status === 'deleted' && !record.deleted_at) return false;
            if (status === 'active' && (record.resolved || Boolean(record.deleted_at))) return false;
            if (status === 'resolved' && (!record.resolved || Boolean(record.deleted_at))) return false;
            if (gateFilter !== 'all' && (record.gate || '') !== gateFilter) return false;
            if (falseAlarmFilter === 'true' && !record.false_alarm) return false;
            if (falseAlarmFilter === 'false' && record.false_alarm) return false;

            // Alarm date filtering - dayjs ile yerel tarihe çevir
            if (alarmDateStart && alarmDateEnd) {
                const alarmDate = dayjs(record.alarm_time).format('YYYY-MM-DD');
                if (alarmDate < alarmDateStart || alarmDate > alarmDateEnd) return false;
            }

            // Resolution date filtering - dayjs ile yerel tarihe çevir
            if (resolutionDateStart && resolutionDateEnd && record.resolution_time) {
                const resolutionDate = dayjs(record.resolution_time).format('YYYY-MM-DD');
                if (resolutionDate < resolutionDateStart || resolutionDate > resolutionDateEnd) return false;
            }

            return true;
        });
    }, [records, alarmNumber, location, recordedBy, resolvedBy, status, gateFilter, falseAlarmFilter, alarmDateStart, alarmDateEnd, resolutionDateStart, resolutionDateEnd]);

    // Group by day for both default and filtered views (newest day first)
    const groupedByDay = useMemo(() => {
        const dayGroups = new Map<string, FireAlarmRecord[]>();

        filteredRecords.forEach((record) => {
            const dayKey = dayjs(record.alarm_time).format('YYYY-MM-DD');
            if (!dayGroups.has(dayKey)) {
                dayGroups.set(dayKey, []);
            }
            dayGroups.get(dayKey)!.push(record);
        });

        return Array.from(dayGroups.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([dayKey, items]) => ({
                dayKey,
                dayLabel: dayjs(dayKey).format('DD MMMM YYYY dddd'),
                records: [...items].sort((a, b) => {
                    return dayjs(a.alarm_time).valueOf() - dayjs(b.alarm_time).valueOf();
                })
            }));
    }, [filteredRecords]);

    // Clear all filters
    const clearFilters = () => {
        setAlarmNumber('');
        setLocation('');
        setRecordedBy('');
        setResolvedBy('');
        setStatus('all');
        setGateFilter('all');
        setFalseAlarmFilter('all');
        setAlarmDateStart('');
        setAlarmDateEnd('');
        setResolutionDateStart('');
        setResolutionDateEnd('');
    };

    const handleDeleteRecord = async (id: string) => {
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

        try {
            await api.delete(`/fire-alarms/records/${id}`);
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: new Date().toISOString() } : record));
        } catch (error) {
            console.error('Kayıt silinemedi:', error);
            alert('Kayıt silinirken bir hata oluştu');
        }
    };

    const handleRestoreRecord = async (id: string) => {
        try {
            await api.post(`/fire-alarms/records/${id}/restore`);
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: null } : record));
        } catch (error) {
            console.error('Kayıt geri alınamadı:', error);
            alert('Kayıt geri alınırken bir hata oluştu');
        }
    };

    const renderPreviewText = (value: string | null | undefined, title: string) => {
        const text = (value || '-').toString();
        const isLong = text.length > 15;

        if (!isLong) {
            return <div className="text-sm text-gray-900 block max-w-[240px] truncate whitespace-nowrap overflow-hidden" title={text}>{text}</div>;
        }

        return (
            <button
                type="button"
                onClick={() => setTextPreview({ title, value: text })}
                className="text-sm text-blue-700 hover:text-blue-900 underline text-left block max-w-[240px] truncate whitespace-nowrap overflow-hidden"
                title="Tamamını görmek için tıklayın"
            >
                {text}
            </button>
        );
    };

    useEffect(() => {
        const updateScrollbarWidth = () => {
            const tableScrollWidth = tableScrollRef.current?.scrollWidth ?? 0;
            const tableClientWidth = tableScrollRef.current?.clientWidth ?? 0;
            const barClientWidth = bottomScrollRef.current?.clientWidth ?? 0;
            const normalizedWidth = Math.max(
                tableScrollWidth - tableClientWidth + barClientWidth,
                barClientWidth + 1
            );
            setScrollbarSpacerWidth(normalizedWidth);
        };

        updateScrollbarWidth();

        const resizeObserver = new ResizeObserver(updateScrollbarWidth);
        if (tableScrollRef.current) resizeObserver.observe(tableScrollRef.current);
        if (bottomScrollRef.current) resizeObserver.observe(bottomScrollRef.current);
        window.addEventListener('resize', updateScrollbarWidth);

        return () => {
            window.removeEventListener('resize', updateScrollbarWidth);
            resizeObserver.disconnect();
        };
    }, [filteredRecords.length, loading]);

    const syncBottomScroll = () => {
        const tableNode = tableScrollRef.current;
        const barNode = bottomScrollRef.current;

        if (!tableNode || !barNode) return;
        tableNode.scrollLeft = barNode.scrollLeft;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/fire-alarms')}
                                className="p-2 hover:bg-slate-800 rounded-lg transition shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Yangın Alarm Kayıtları</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Tüm alarm kayıtlarını filtreleyin ve inceleyin</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 pb-14 flex flex-col gap-4 overflow-hidden">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow px-3 py-2 mb-3 w-full">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-base font-bold text-gray-900">Filtreler</h2>
                        <button
                            onClick={clearFilters}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Temizle
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Alarm Numarası</label>
                            <input
                                type="text"
                                value={alarmNumber}
                                onChange={(e) => setAlarmNumber(e.target.value)}
                                placeholder="Alarm numarası ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Konum</label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Konum ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Kaydeden</label>
                            <input
                                type="text"
                                value={recordedBy}
                                onChange={(e) => setRecordedBy(e.target.value)}
                                placeholder="Kaydeden ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Çözümleyen</label>
                            <input
                                type="text"
                                value={resolvedBy}
                                onChange={(e) => setResolvedBy(e.target.value)}
                                placeholder="Çözümleyen ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Durum</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="active">Aktif</option>
                                <option value="resolved">Çözüldü</option>
                                <option value="deleted">Silinen Kayıtlar</option>
                            </select>
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Kapı</label>
                            <select
                                value={gateFilter}
                                onChange={(e) => setGateFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="Ana Kapı">Ana Kapı</option>
                                <option value="Sahil Kapı">Sahil Kapı</option>
                            </select>
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Yanlış Alarm</label>
                            <select
                                value={falseAlarmFilter}
                                onChange={(e) => setFalseAlarmFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="true">Yanlış Alarm</option>
                                <option value="false">Gerçek Alarm</option>
                            </select>
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Alarm Tarihi</label>
                            <RangePicker
                                value={[
                                    alarmDateStart ? dayjs(alarmDateStart) : null,
                                    alarmDateEnd ? dayjs(alarmDateEnd) : null
                                ]}
                                onChange={(dates) => {
                                    if (!dates || (!dates[0] && !dates[1])) {
                                        setAlarmDateStart('');
                                        setAlarmDateEnd('');
                                    } else if (dates[0] && dates[1]) {
                                        setAlarmDateStart(dates[0].format('YYYY-MM-DD'));
                                        setAlarmDateEnd(dates[1].format('YYYY-MM-DD'));
                                    } else if (dates[0] && !dates[1]) {
                                        const singleDate = dates[0].format('YYYY-MM-DD');
                                        setAlarmDateStart(singleDate);
                                        setAlarmDateEnd(singleDate);
                                    }
                                }}
                                allowEmpty={[false, true]}
                                format="DD/MM/YYYY"
                                placeholder={['Başlangıç', 'Bitiş']}
                                className="w-full"
                                size="small"
                            />
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Çözüm Tarihi</label>
                            <RangePicker
                                value={[
                                    resolutionDateStart ? dayjs(resolutionDateStart) : null,
                                    resolutionDateEnd ? dayjs(resolutionDateEnd) : null
                                ]}
                                onChange={(dates) => {
                                    if (!dates || (!dates[0] && !dates[1])) {
                                        setResolutionDateStart('');
                                        setResolutionDateEnd('');
                                    } else if (dates[0] && dates[1]) {
                                        setResolutionDateStart(dates[0].format('YYYY-MM-DD'));
                                        setResolutionDateEnd(dates[1].format('YYYY-MM-DD'));
                                    } else if (dates[0] && !dates[1]) {
                                        const singleDate = dates[0].format('YYYY-MM-DD');
                                        setResolutionDateStart(singleDate);
                                        setResolutionDateEnd(singleDate);
                                    }
                                }}
                                allowEmpty={[false, true]}
                                format="DD/MM/YYYY"
                                placeholder={['Başlangıç', 'Bitiş']}
                                className="w-full"
                                size="small"
                            />
                        </div>
                    </div>
                </div>

                {/* Records */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-hidden flex-1 min-h-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-gray-500">Filtrelere uygun kayıt bulunamadı</p>
                        </div>
                    ) : (
                        <div
                            ref={tableScrollRef}
                            className="h-full min-h-0 overflow-x-hidden overflow-y-auto pb-2"
                        >
                            {groupedByDay.map((dayGroup) => (
                                <div key={dayGroup.dayKey} className="mb-4 last:mb-0">
                                    <div className="sticky top-0 bg-gray-100 px-4 py-2 border-l-4 border-blue-500 z-10 shadow-sm">
                                        <h3 className="text-sm font-semibold text-gray-800">{dayGroup.dayLabel}</h3>
                                    </div>

                                    <table className="w-full min-w-[1550px] table-fixed divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-10 z-10">
                                            <tr>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alarm No</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konum</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kapı</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alarm Zamanı</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çözüm Zamanı</th>
                                                <th className="w-[250px] px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notlar</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaydeden</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çözümleyen</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {dayGroup.records.map((record) => (
                                                <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm font-medium text-gray-900">{record.alarm_number || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm font-bold text-gray-900 whitespace-nowrap">{record.location}</div>
                                                        {record.false_alarm && <span className="text-xs text-red-600 font-medium">Yanlış Alarm</span>}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{record.gate || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{formatDate(record.alarm_time)}</div>
                                                        <div className="text-xs text-gray-600">{formatTime(record.alarm_time)}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {record.resolution_time ? (
                                                            <>
                                                                <div className="text-sm text-gray-900">{formatDate(record.resolution_time)}</div>
                                                                <div className="text-xs text-gray-600">{formatTime(record.resolution_time)}</div>
                                                            </>
                                                        ) : (
                                                            <span className="text-sm text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="w-[250px] px-4 py-3 pr-6">
                                                        {renderPreviewText(record.resolution_notes, 'Notlar')}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {record.resolved ? (
                                                            <span className="px-2 py-1 inline-flex whitespace-nowrap text-xs font-medium rounded-full bg-green-100 text-green-800">Çözüldü</span>
                                                        ) : (
                                                            <span className="px-2 py-1 inline-flex whitespace-nowrap text-xs font-medium rounded-full bg-red-100 text-red-800">Aktif</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{record.recorded_by_name || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{record.resolved_by_name || '-'}</div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <div className="fixed bottom-0 left-0 right-0 lg:left-[var(--sidebar-width)] z-40 border-t border-gray-200 bg-white/95 backdrop-blur shadow-[0_-8px_20px_rgba(15,23,42,0.08)]">
                <div ref={bottomScrollRef} onScroll={syncBottomScroll} className="h-5 overflow-x-scroll overflow-y-hidden">
                    <div style={{ width: `${scrollbarSpacerWidth}px`, height: 1 }} />
                </div>
            </div>

            {textPreview && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900">{textPreview.title}</h3>
                            <button
                                type="button"
                                onClick={() => setTextPreview(null)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                Kapat
                            </button>
                        </div>
                        <div className="px-4 py-4">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{textPreview.value}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
