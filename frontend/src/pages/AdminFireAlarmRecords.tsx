import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from '../utils/dayjsConfig';
import type { Dayjs } from 'dayjs';
import 'antd/dist/reset.css';
import axios from 'axios';
import { formatDate, formatTime } from '../utils/dateUtils';
import { API_URL } from '../constants';
import ActionButton from '../components/ActionButton';

const { RangePicker } = DatePicker;

interface FireAlarmRecord {
    id: string;
    alarm_number: string | null;
    location: string;
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

export default function AdminFireAlarmRecords() {
    const [records, setRecords] = useState<FireAlarmRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Filter states
    const [alarmNumber, setAlarmNumber] = useState('');
    const [location, setLocation] = useState('');
    const [recordedBy, setRecordedBy] = useState('');
    const [resolvedBy, setResolvedBy] = useState('');
    const [status, setStatus] = useState('all');
    const [falseAlarmFilter, setFalseAlarmFilter] = useState('all');
    const [alarmDateRange, setAlarmDateRange] = useState<[Dayjs, Dayjs] | null>(null);
    const [resolutionDateRange, setResolutionDateRange] = useState<[Dayjs, Dayjs] | null>(null);
    const [alarmDateStart, setAlarmDateStart] = useState('');
    const [alarmDateEnd, setAlarmDateEnd] = useState('');
    const [resolutionDateStart, setResolutionDateStart] = useState('');
    const [resolutionDateEnd, setResolutionDateEnd] = useState('');

    // Fetch all records
    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('adminToken');
                const res = await axios.get(`${API_URL}/fire-alarms/records?includeDeleted=true`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setRecords(res.data?.data || []);
            } catch (error) {
                console.error('Veriler yüklenemedi:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

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
    }, [records, alarmNumber, location, recordedBy, resolvedBy, status, falseAlarmFilter, alarmDateStart, alarmDateEnd, resolutionDateStart, resolutionDateEnd]);

    // Check if any filter is active
    const hasActiveFilters = useMemo(() => {
        return !!(
            alarmNumber ||
            location ||
            recordedBy ||
            resolvedBy ||
            status !== 'all' ||
            falseAlarmFilter !== 'all' ||
            alarmDateStart ||
            resolutionDateStart
        );
    }, [alarmNumber, location, recordedBy, resolvedBy, status, falseAlarmFilter, alarmDateStart, resolutionDateStart]);

    const sortedFilteredRecords = useMemo(() => {
        return [...filteredRecords].sort((a, b) =>
            dayjs(b.alarm_time).valueOf() - dayjs(a.alarm_time).valueOf()
        );
    }, [filteredRecords, hasActiveFilters]);

    // Get month name in Turkish
    function getMonthName(monthKey: string) {
        return dayjs(monthKey + '-01').format('MMMM YYYY');
    }

    // Get day name in Turkish
    function getDayName(dayKey: string) {
        return dayjs(dayKey).format('DD MMMM YYYY dddd');
    }

    const groupedRecords = useMemo(() => {
        if (hasActiveFilters) return [] as Array<{
            monthKey: string;
            monthLabel: string;
            totalRecords: number;
            dayGroups: Array<{
                dayKey: string;
                dayLabel: string;
                records: FireAlarmRecord[];
            }>;
        }>;

        const monthMap = new Map<string, Map<string, FireAlarmRecord[]>>();

        filteredRecords.forEach((record) => {
            const date = dayjs(record.alarm_time);
            const monthKey = date.format('YYYY-MM');
            const dayKey = date.format('YYYY-MM-DD');

            if (!monthMap.has(monthKey)) {
                monthMap.set(monthKey, new Map());
            }

            const dayMap = monthMap.get(monthKey)!;
            if (!dayMap.has(dayKey)) {
                dayMap.set(dayKey, []);
            }

            dayMap.get(dayKey)!.push(record);
        });

        return Array.from(monthMap.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([monthKey, dayMap]) => {
                const dayGroups = Array.from(dayMap.entries())
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([dayKey, records]) => ({
                        dayKey,
                        dayLabel: getDayName(dayKey),
                        records: records.sort((a, b) => dayjs(b.alarm_time).valueOf() - dayjs(a.alarm_time).valueOf())
                    }));

                return {
                    monthKey,
                    monthLabel: getMonthName(monthKey),
                    totalRecords: dayGroups.reduce((sum, group) => sum + group.records.length, 0),
                    dayGroups
                };
            });
    }, [filteredRecords, hasActiveFilters]);

    // Clear all filters
    const clearFilters = () => {
        setAlarmNumber('');
        setLocation('');
        setRecordedBy('');
        setResolvedBy('');
        setStatus('all');
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
            const token = localStorage.getItem('adminToken');
            await axios.delete(`${API_URL}/fire-alarms/records/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: new Date().toISOString() } : record));
        } catch (error) {
            console.error('Kayıt silinemedi:', error);
            alert('Kayıt silinirken bir hata oluştu');
        }
    };

    const handleRestoreRecord = async (id: string) => {
        try {
            const token = localStorage.getItem('adminToken');
            await axios.post(`${API_URL}/fire-alarms/records/${id}/restore`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: null } : record));
        } catch (error) {
            console.error('Kayıt geri alınamadı:', error);
            alert('Kayıt geri alınırken bir hata oluştu');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            className="p-2 hover:bg-gray-100 rounded-lg transition shrink-0"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0">
                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight break-words">Yangın Alarm Kayıtları</h1>
                                <p className="text-sm sm:text-base text-gray-600 mt-1">Tüm alarm kayıtlarını filtreleyin ve inceleyin</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">Filtreler</h2>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-sm text-red-600 hover:text-red-800 font-medium"
                            >
                                Filtreleri Temizle
                            </button>
                        )}
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
                        <div className="overflow-x-auto">
                            <div className="max-h-[600px] overflow-y-auto">
                                <table className="min-w-full table-auto divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alarm No</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konum</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alarm Zamanı</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çözüm Zamanı</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notlar</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaydeden</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çözümleyen</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sortedFilteredRecords.map(record => (
                                            <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900">{record.alarm_number || '-'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-bold text-gray-900">{record.location}</div>
                                                    {record.false_alarm && <span className="text-xs text-red-600 font-medium">Yanlış Alarm</span>}
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
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-900 max-w-xs truncate" title={record.resolution_notes || '-'}>{record.resolution_notes || '-'}</div>
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
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-200">
                            {groupedRecords.map((monthGroup) => (
                                <div key={monthGroup.monthKey} className="mb-8 last:mb-0">
                                    <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-500 px-6 py-3 z-10 shadow-md">
                                        <h2 className="text-lg font-bold text-white">{monthGroup.monthLabel}</h2>
                                        <p className="text-sm text-red-100">{monthGroup.totalRecords} kayıt</p>
                                    </div>

                                    {monthGroup.dayGroups.map((dayGroup) => (
                                        <div key={dayGroup.dayKey} className="border-b border-gray-200 last:border-b-0">
                                            <div className="sticky top-14 bg-gray-100 px-6 py-2 border-l-4 border-red-500 z-10 shadow-sm">
                                                <h3 className="text-sm font-semibold text-gray-800">{dayGroup.dayLabel}</h3>
                                                <p className="text-xs text-gray-600">{dayGroup.records.length} kayıt</p>
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="min-w-full table-auto divide-y divide-gray-200">
                                                    <thead className="bg-gray-50 sticky top-14 z-10">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alarm No</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konum</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alarm Zamanı</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çözüm Zamanı</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notlar</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaydeden</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çözümleyen</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {dayGroup.records.map(record => (
                                                            <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm font-medium text-gray-900">{record.alarm_number || '-'}</div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm font-bold text-gray-900">{record.location}</div>
                                                                    {record.false_alarm && <span className="text-xs text-red-600 font-medium">Yanlış Alarm</span>}
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
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm text-gray-900 max-w-xs truncate" title={record.resolution_notes || '-'}>{record.resolution_notes || '-'}</div>
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
