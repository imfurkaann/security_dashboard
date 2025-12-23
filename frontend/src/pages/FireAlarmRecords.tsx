import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import 'antd/dist/reset.css';
import api from '../utils/api';
import { formatDate, formatTime } from '../utils/dateUtils';

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
    created_at: string;
}

export default function FireAlarmRecords() {
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
                const res = await api.get('/fire-alarms/records');
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
        if (dates && dates[0] && dates[1]) {
            setAlarmDateRange([dates[0], dates[1]]);
            setAlarmDateStart(dates[0].format('YYYY-MM-DD'));
            setAlarmDateEnd(dates[1].format('YYYY-MM-DD'));
        } else {
            setAlarmDateRange(null);
            setAlarmDateStart('');
            setAlarmDateEnd('');
        }
    };

    const handleAlarmCalendarChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
        if (!dates || !dates[0] || !dates[1]) {
            setAlarmDateRange(null);
            setAlarmDateStart('');
            setAlarmDateEnd('');
        }
    };

    // Date handlers for resolution date
    const handleResolutionDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
        if (dates && dates[0] && dates[1]) {
            setResolutionDateRange([dates[0], dates[1]]);
            setResolutionDateStart(dates[0].format('YYYY-MM-DD'));
            setResolutionDateEnd(dates[1].format('YYYY-MM-DD'));
        } else {
            setResolutionDateRange(null);
            setResolutionDateStart('');
            setResolutionDateEnd('');
        }
    };

    const handleResolutionCalendarChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
        if (!dates || !dates[0] || !dates[1]) {
            setResolutionDateRange(null);
            setResolutionDateStart('');
            setResolutionDateEnd('');
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

            // Alarm date filtering
            if (alarmDateStart && alarmDateEnd) {
                const alarmDate = record.alarm_time.split('T')[0];
                if (alarmDate < alarmDateStart || alarmDate > alarmDateEnd) return false;
            }

            // Resolution date filtering
            if (resolutionDateStart && resolutionDateEnd && record.resolution_time) {
                const resolutionDate = record.resolution_time.split('T')[0];
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

    // Group records by month and day (only when no filters)
    const groupedRecords = useMemo(() => {
        if (hasActiveFilters) return {};

        const groups: { [key: string]: { [key: string]: FireAlarmRecord[] } } = {};

        filteredRecords.forEach(record => {
            const date = new Date(record.alarm_time);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

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
                    new Date(b.alarm_time).getTime() - new Date(a.alarm_time).getTime()
                );
            });
        });

        return groups;
    }, [filteredRecords, hasActiveFilters]);

    // Sorted records for filtered view
    const sortedFilteredRecords = useMemo(() => {
        if (!hasActiveFilters) return [];
        return [...filteredRecords].sort((a, b) =>
            new Date(b.alarm_time).getTime() - new Date(a.alarm_time).getTime()
        );
    }, [filteredRecords, hasActiveFilters]);

    // Get month name in Turkish
    const getMonthName = (monthKey: string) => {
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' });
    };

    // Get day name in Turkish
    const getDayName = (dayKey: string) => {
        const [year, month, day] = dayKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });
    };

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
                                onCalendarChange={handleAlarmCalendarChange}
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
                                onCalendarChange={handleResolutionCalendarChange}
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
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
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
                                        <tr key={record.id} className="hover:bg-gray-50">
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
                                                <div className="text-sm text-gray-900 max-w-xs truncate">{record.resolution_notes || '-'}</div>
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
                                            <div className="bg-red-50 px-6 py-2 border-b border-red-100">
                                                <h4 className="text-sm font-medium text-red-800">{getDayName(dayKey)}</h4>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full">
                                                    <thead className="bg-gray-50">
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
                                                        {groupedRecords[monthKey][dayKey].map(record => (
                                                            <tr key={record.id} className="hover:bg-gray-50">
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
                                                                    <div className="text-sm text-gray-900 max-w-xs truncate">{record.resolution_notes || '-'}</div>
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
