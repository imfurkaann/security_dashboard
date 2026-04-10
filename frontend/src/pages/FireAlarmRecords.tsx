import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from '../utils/dayjsConfig';
import type { Dayjs } from 'dayjs';
import 'antd/dist/reset.css';
import api from '../utils/api';
import { formatDate, formatTime } from '../utils/dateUtils';
import ActionButton from '../components/ActionButton';

const { RangePicker } = DatePicker;

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
    const latestFetchId = useRef(0);
    const navigate = useNavigate();

    // Filter states
    const [alarmNumber, setAlarmNumber] = useState('');
    const [location, setLocation] = useState('');
    const [recordedBy, setRecordedBy] = useState('');
    const [resolvedBy, setResolvedBy] = useState('');
    const [status, setStatus] = useState('all');
    const [gateFilter, setGateFilter] = useState('all');
    const [falseAlarmFilter, setFalseAlarmFilter] = useState('all');
    const [alarmDateRange, setAlarmDateRange] = useState<[Dayjs, Dayjs] | null>(null);
    const [resolutionDateRange, setResolutionDateRange] = useState<[Dayjs, Dayjs] | null>(null);
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

    // Date handlers for alarm date
    const handleAlarmDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
        if (!dates || (!dates[0] && !dates[1])) {
            // Takvim temizlendi
            setAlarmDateRange(null);
            setAlarmDateStart('');
            setAlarmDateEnd('');
        } else if (dates[0] && dates[1]) {
            // İki tarih de seçildi
            setAlarmDateRange([dates[0], dates[1]]);
            setAlarmDateStart(dates[0].format('YYYY-MM-DD'));
            setAlarmDateEnd(dates[1].format('YYYY-MM-DD'));
        } else if (dates[0] && !dates[1]) {
            // Sadece başlangıç tarihi seçili - tek gün olarak kullan
            const singleDate = dates[0].format('YYYY-MM-DD');
            setAlarmDateRange([dates[0], dates[0]]);
            setAlarmDateStart(singleDate);
            setAlarmDateEnd(singleDate);
        }
    };

    // Date handlers for resolution date
    const handleResolutionDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
        if (!dates || (!dates[0] && !dates[1])) {
            // Takvim temizlendi
            setResolutionDateRange(null);
            setResolutionDateStart('');
            setResolutionDateEnd('');
        } else if (dates[0] && dates[1]) {
            // İki tarih de seçildi
            setResolutionDateRange([dates[0], dates[1]]);
            setResolutionDateStart(dates[0].format('YYYY-MM-DD'));
            setResolutionDateEnd(dates[1].format('YYYY-MM-DD'));
        } else if (dates[0] && !dates[1]) {
            // Sadece başlangıç tarihi seçili - tek gün olarak kullan
            const singleDate = dates[0].format('YYYY-MM-DD');
            setResolutionDateRange([dates[0], dates[0]]);
            setResolutionDateStart(singleDate);
            setResolutionDateEnd(singleDate);
        }
    };

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            if (alarmNumber && !record.alarm_number?.toLowerCase().includes(alarmNumber.toLowerCase())) return false;
            if (location && !record.location.toLowerCase().includes(location.toLowerCase())) return false;
            if (recordedBy && !record.recorded_by_name?.toLowerCase().includes(recordedBy.toLowerCase())) return false;
            if (resolvedBy && !record.resolved_by_name?.toLowerCase().includes(resolvedBy.toLowerCase())) return false;
            if (status === 'active' && record.resolved) return false;
            if (status === 'resolved' && !record.resolved) return false;
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

    // Check if any filter is active
    const hasActiveFilters = useMemo(() => {
        return !!(
            alarmNumber ||
            location ||
            recordedBy ||
            resolvedBy ||
            status !== 'all' ||
            gateFilter !== 'all' ||
            falseAlarmFilter !== 'all' ||
            alarmDateStart ||
            resolutionDateStart
        );
    }, [alarmNumber, location, recordedBy, resolvedBy, status, gateFilter, falseAlarmFilter, alarmDateStart, resolutionDateStart]);

    // Group records by month and day (only when no filters)
    // Group records by month and day (only when no filters)
    const groupedRecords = useMemo(() => {
        if (hasActiveFilters) return {};

        const groups: { [key: string]: { [key: string]: FireAlarmRecord[] } } = {};

        filteredRecords.forEach(record => {
            const date = dayjs(record.alarm_time);
            const monthKey = date.format('YYYY-MM');
            const dayKey = date.format('YYYY-MM-DD');

            if (!groups[monthKey]) {
                groups[monthKey] = {};
            }
            if (!groups[monthKey][dayKey]) {
                groups[monthKey][dayKey] = [];
            }
            groups[monthKey][dayKey].push(record);
        });

        // Sort records within each day (newest first)
        Object.keys(groups).forEach(monthKey => {
            Object.keys(groups[monthKey]).forEach(dayKey => {
                groups[monthKey][dayKey].sort((a, b) =>
                    dayjs(b.alarm_time).valueOf() - dayjs(a.alarm_time).valueOf()
                );
            });
        });

        return groups;
    }, [filteredRecords, hasActiveFilters]);

    // Sorted records for filtered view
    const sortedFilteredRecords = useMemo(() => {
        if (!hasActiveFilters) return [];
        return [...filteredRecords].sort((a, b) =>
            dayjs(b.alarm_time).valueOf() - dayjs(a.alarm_time).valueOf()
        );
    }, [filteredRecords, hasActiveFilters]);

    // Get month name in Turkish
    const getMonthName = (monthKey: string) => {
        return dayjs(monthKey + '-01').format('MMMM YYYY');
    };

    // Get day name in Turkish
    const getDayName = (dayKey: string) => {
        return dayjs(dayKey).format('DD MMMM YYYY dddd');
    };

    // Clear all filters
    const clearFilters = () => {
        setAlarmNumber('');
        setLocation('');
        setRecordedBy('');
        setResolvedBy('');
        setStatus('all');
        setGateFilter('all');
        setFalseAlarmFilter('all');
        setAlarmDateRange(null);
        setResolutionDateRange(null);
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

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/fire-alarms')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-3">
                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Yangın Alarm Kayıtları</h1>
                                <p className="text-gray-600 mt-1">Tüm alarm kayıtlarını filtreleyin ve inceleyin</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">Filtreler</h2>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={fetchData}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Yenile
                            </button>
                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                                >
                                    Filtreleri Temizle
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alarm Numarası</label>
                            <input
                                type="text"
                                value={alarmNumber}
                                onChange={(e) => setAlarmNumber(e.target.value)}
                                placeholder="Alarm numarası ara..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Konum</label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Konum ara..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Kaydeden</label>
                            <input
                                type="text"
                                value={recordedBy}
                                onChange={(e) => setRecordedBy(e.target.value)}
                                placeholder="Kaydeden ara..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Çözümleyen</label>
                            <input
                                type="text"
                                value={resolvedBy}
                                onChange={(e) => setResolvedBy(e.target.value)}
                                placeholder="Çözümleyen ara..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="active">Aktif</option>
                                <option value="resolved">Çözüldü</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Kapı</label>
                            <select
                                value={gateFilter}
                                onChange={(e) => setGateFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="Ana Kapı">Ana Kapı</option>
                                <option value="Sahil Kapı">Sahil Kapı</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Yanlış Alarm</label>
                            <select
                                value={falseAlarmFilter}
                                onChange={(e) => setFalseAlarmFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="true">Yanlış Alarm</option>
                                <option value="false">Gerçek Alarm</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alarm Tarihi</label>
                            <RangePicker
                                value={alarmDateRange}
                                onChange={handleAlarmDateChange}
                                allowEmpty={[false, true]}
                                format="DD/MM/YYYY"
                                placeholder={['Başlangıç', 'Bitiş']}
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Çözüm Tarihi</label>
                            <RangePicker
                                value={resolutionDateRange}
                                onChange={handleResolutionDateChange}
                                allowEmpty={[false, true]}
                                format="DD/MM/YYYY"
                                placeholder={['Başlangıç', 'Bitiş']}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                            Toplam <span className="font-semibold text-gray-900">{filteredRecords.length}</span> kayıt bulundu
                        </p>
                    </div>
                </div>

                {/* Records */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-gray-500 text-lg">Kayıt bulunamadı</p>
                        </div>
                    ) : hasActiveFilters ? (
                        // Flat table view when filters are active
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1550px] table-auto divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alarm No</th>
                                        <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konum</th>
                                        <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kapı</th>
                                        <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alarm Zamanı</th>
                                        <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çözüm Zamanı</th>
                                        <th className="px-6 py-3 whitespace-nowrap w-[260px] text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notlar</th>
                                        <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                        <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaydeden</th>
                                        <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çözümleyen</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {sortedFilteredRecords.map(record => (
                                        <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{record.alarm_number || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-900 whitespace-nowrap">{record.location}</div>
                                                {record.false_alarm && <span className="text-xs text-red-600 font-medium">Yanlış Alarm</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{record.gate || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{formatDate(record.alarm_time)}</div>
                                                <div className="text-xs text-gray-600">{formatTime(record.alarm_time)}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {record.resolution_time ? (
                                                    <>
                                                        <div className="text-sm text-gray-900">{formatDate(record.resolution_time)}</div>
                                                        <div className="text-xs text-gray-600">{formatTime(record.resolution_time)}</div>
                                                    </>
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap w-[260px]">
                                                {renderPreviewText(record.resolution_notes, 'Notlar')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {record.resolved ? (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Çözüldü</span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Aktif</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{record.recorded_by_name || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">{record.resolved_by_name || '-'}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        // Grouped view by month and day
                        <div className="divide-y divide-gray-200">
                            {Object.keys(groupedRecords).sort().reverse().map(monthKey => (
                                <div key={monthKey}>
                                    <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-3">
                                        <h3 className="text-lg font-semibold text-white">{getMonthName(monthKey)}</h3>
                                    </div>
                                    {Object.keys(groupedRecords[monthKey]).sort().reverse().map(dayKey => (
                                        <div key={dayKey} className="border-b border-gray-100 last:border-b-0">
                                            <div className="sticky top-14 bg-red-50 px-6 py-2 border-b border-red-100 z-9 shadow-sm">
                                                <h4 className="text-sm font-medium text-red-800">{getDayName(dayKey)}</h4>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full min-w-[1550px] table-auto divide-y divide-gray-200">
                                                    <thead className="bg-gray-50 sticky top-14 z-10">
                                                        <tr>
                                                            <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alarm No</th>
                                                            <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konum</th>
                                                            <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kapı</th>
                                                            <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alarm Zamanı</th>
                                                            <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çözüm Zamanı</th>
                                                            <th className="px-6 py-3 whitespace-nowrap w-[260px] text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notlar</th>
                                                            <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                                            <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaydeden</th>
                                                            <th className="px-6 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çözümleyen</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {groupedRecords[monthKey][dayKey].map(record => (
                                                            <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm font-medium text-gray-900">{record.alarm_number || '-'}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm font-bold text-gray-900 whitespace-nowrap">{record.location}</div>
                                                                    {record.false_alarm && <span className="text-xs text-red-600 font-medium">Yanlış Alarm</span>}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.gate || '-'}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{formatDate(record.alarm_time)}</div>
                                                                    <div className="text-xs text-gray-600">{formatTime(record.alarm_time)}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    {record.resolution_time ? (
                                                                        <>
                                                                            <div className="text-sm text-gray-900">{formatDate(record.resolution_time)}</div>
                                                                            <div className="text-xs text-gray-600">{formatTime(record.resolution_time)}</div>
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-sm text-gray-400">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap w-[260px]">
                                                                    {renderPreviewText(record.resolution_notes, 'Notlar')}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    {record.resolved ? (
                                                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Çözüldü</span>
                                                                    ) : (
                                                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Aktif</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.recorded_by_name || '-'}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.resolved_by_name || '-'}</div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>

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
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
