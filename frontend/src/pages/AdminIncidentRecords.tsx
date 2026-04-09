import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from '../utils/dayjsConfig';
import type { Dayjs } from 'dayjs';
import 'antd/dist/reset.css';
import DOMPurify from 'dompurify';
import axios from 'axios';
import { formatDate, formatTime } from '../utils/dateUtils';
import { API_URL } from '../constants';
import ActionButton from '../components/ActionButton';

const { RangePicker } = DatePicker;

interface IncidentRecord {
    id: string;
    description: string;
    incident_type: string;
    shift_label: string | null;
    report_content: string | null;
    report_date: string;
    status: string;
    created_at: string;
    incident_time: string;
    resolved: boolean;
    resolution_notes: string | null;
    resolved_at: string | null;
    reported_by: string;
}

export default function AdminIncidentRecords() {
    const [records, setRecords] = useState<IncidentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showReportModal, setShowReportModal] = useState(false);
    const [selectedReport, setSelectedReport] = useState<IncidentRecord | null>(null);
    const navigate = useNavigate();

    // Filter states
    const [reportedBy, setReportedBy] = useState('');
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');

    // Fetch all records with admin authentication
    useEffect(() => {
        const fetchData = async () => {
            try {
                const adminToken = localStorage.getItem('adminToken');
                const config = {
                    headers: {
                        Authorization: `Bearer ${adminToken}`
                    }
                };
                const res = await axios.get(`${API_URL}/incidents/records`, config);
                setRecords(res.data?.data || []);
            } catch (error) {
                console.error('Veriler yüklenemedi:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Date handlers
    const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
        if (!dates || (!dates[0] && !dates[1])) {
            // Takvim temizlendi
            setDateRange(null);
            setDateStart('');
            setDateEnd('');
        } else if (dates[0] && dates[1]) {
            // İki tarih de seçildi
            setDateRange([dates[0], dates[1]]);
            setDateStart(dates[0].format('YYYY-MM-DD'));
            setDateEnd(dates[1].format('YYYY-MM-DD'));
        } else if (dates[0] && !dates[1]) {
            // Sadece başlangıç tarihi seçili - tek gün olarak kullan
            const singleDate = dates[0].format('YYYY-MM-DD');
            setDateRange([dates[0], dates[0]]);
            setDateStart(singleDate);
            setDateEnd(singleDate);
        }
    };

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            if (reportedBy && !record.reported_by?.toLowerCase().includes(reportedBy.toLowerCase())) return false;

            // Date filtering - dayjs ile yerel tarihe çevir
            if (dateStart && dateEnd) {
                const recordDate = record.report_date ? dayjs(record.report_date).format('YYYY-MM-DD') : dayjs(record.created_at).format('YYYY-MM-DD');
                if (recordDate < dateStart || recordDate > dateEnd) return false;
            }

            return true;
        });
    }, [records, reportedBy, dateStart, dateEnd]);

    // Check if any filter is active
    const hasActiveFilters = useMemo(() => {
        return !!(reportedBy || dateStart);
    }, [reportedBy, dateStart]);

    // Group records by month and day (only when no filters)
    // Group records by month and day (only when no filters)
    const groupedRecords = useMemo(() => {
        if (hasActiveFilters) return {};

        const groups: { [key: string]: { [key: string]: IncidentRecord[] } } = {};

        filteredRecords.forEach(record => {
            const dateStr = record.report_date || record.created_at;
            const date = dayjs(dateStr);
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
                    dayjs(b.report_date || b.created_at).valueOf() - dayjs(a.report_date || a.created_at).valueOf()
                );
            });
        });

        return groups;
    }, [filteredRecords, hasActiveFilters]);

    // Sorted records for filtered view
    const sortedFilteredRecords = useMemo(() => {
        if (!hasActiveFilters) return [];
        return [...filteredRecords].sort((a, b) =>
            dayjs(b.report_date || b.created_at).valueOf() - dayjs(a.report_date || a.created_at).valueOf()
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
        setReportedBy('');
        setDateRange(null);
        setDateStart('');
        setDateEnd('');
    };

    // Open report modal
    const openReportModal = (record: IncidentRecord) => {
        setSelectedReport(record);
        setShowReportModal(true);
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight break-words">Olay Kayıtları</h1>
                                <p className="text-sm sm:text-base text-gray-600 mt-1">Tüm geçmiş kayıtları görüntüleyin ve filtreleyin</p>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600 sm:text-right">
                            Toplam: <span className="font-bold text-gray-900">{filteredRecords.length}</span> kayıt
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filters Panel */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                        <h2 className="text-base font-bold text-gray-900">Filtreler</h2>
                        <button
                            onClick={clearFilters}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Temizle
                        </button>
                    </div>

                    <div className="space-y-3">
                        {/* Filter Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Reported By Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Raporu Kaydeden
                                </label>
                                <input
                                    type="text"
                                    value={reportedBy}
                                    onChange={(e) => setReportedBy(e.target.value)}
                                    placeholder="Ara..."
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Date Range Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Rapor Tarihi
                                </label>
                                <RangePicker
                                    value={dateRange}
                                    onChange={handleDateChange}
                                    allowEmpty={[false, true]}
                                    format="DD/MM/YYYY"
                                    placeholder={['Başlangıç', 'Bitiş']}
                                    className="w-full"
                                    size="small"
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Records */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
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
                    ) : hasActiveFilters ? (
                        // Filtered view - simple table without grouping
                        <div className="overflow-x-auto">
                            <div className="max-h-[600px] overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vardiya</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaydeden</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sortedFilteredRecords.map((record) => (
                                            <tr key={record.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{formatDate(record.report_date || record.created_at)}</div>
                                                    <div className="text-xs text-gray-600">{formatTime(record.incident_time || record.created_at)}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.shift_label || '-'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-900 max-w-md truncate">{record.description}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.reported_by}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <ActionButton
                                                        onClick={() => openReportModal(record)}
                                                        variant="primary"
                                                        title="Raporu Görüntüle"
                                                    >
                                                        Kayıt Aç
                                                    </ActionButton>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        // Grouped view by month and day
                        <div>
                            {groupedRecords && Object.keys(groupedRecords).length > 0 ? (
                                Object.keys(groupedRecords).sort().reverse().map(monthKey => (
                                    <div key={monthKey} className="mb-6 last:mb-0">
                                        {/* Month Header */}
                                        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <h3 className="text-lg font-bold text-white">{getMonthName(monthKey)}</h3>
                                            </div>
                                            <div className="bg-blue-700 bg-opacity-40 px-3 py-1 rounded-full">
                                                <span className="text-white text-sm font-medium">
                                                    {Object.keys(groupedRecords[monthKey]).reduce((sum, dayKey) =>
                                                        sum + groupedRecords[monthKey][dayKey].length, 0
                                                    )} kayıt
                                                </span>
                                            </div>
                                        </div>

                                        {/* Day Groups */}
                                        {Object.keys(groupedRecords[monthKey]).sort().reverse().map(dayKey => (
                                            <div key={dayKey}>
                                                {/* Day Header */}
                                                <div className="bg-blue-50 px-6 py-2 border-b border-blue-100 flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <h4 className="text-sm font-semibold text-blue-900">{getDayName(dayKey)}</h4>
                                                    </div>
                                                    <span className="text-xs text-blue-600 font-medium">
                                                        {groupedRecords[monthKey][dayKey].length} kayıt
                                                    </span>
                                                </div>

                                                {/* Records Table */}
                                                <div className="overflow-x-auto">
                                                    <table className="min-w-full divide-y divide-gray-200">
                                                        <thead className="bg-gray-50">
                                                            <tr>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vardiya</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaydeden</th>
                                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y divide-gray-200">
                                                            {groupedRecords[monthKey][dayKey].map((record) => (
                                                                <tr key={record.id} className="hover:bg-gray-50">
                                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                                        <div className="text-sm text-gray-900">{formatDate(record.report_date || record.created_at)}</div>
                                                                        <div className="text-xs text-gray-600">{formatTime(record.incident_time || record.created_at)}</div>
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                                        <div className="text-sm text-gray-900">{record.shift_label || '-'}</div>
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <div className="text-sm text-gray-900 max-w-md truncate">{record.description}</div>
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                                        <div className="text-sm text-gray-900">{record.reported_by}</div>
                                                                    </td>
                                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                                        <ActionButton
                                                                            onClick={() => openReportModal(record)}
                                                                            variant="primary"
                                                                            title="Raporu Görüntüle"
                                                                        >
                                                                            Kayıt Aç
                                                                        </ActionButton>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-12">
                                    <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-gray-500">Kayıt bulunamadı</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Report View Modal */}
            {showReportModal && selectedReport && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-gray-900">Olay Raporu</h2>
                                <button
                                    onClick={() => setShowReportModal(false)}
                                    className="text-gray-400 hover:text-gray-600 transition"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div className="px-6 py-4">
                            {/* Report Metadata */}
                            <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">Rapor Tarihi</label>
                                    <p className="text-gray-900">{formatDate(selectedReport.report_date || selectedReport.created_at)}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">Vardiya</label>
                                    <p className="text-gray-900">{selectedReport.shift_label || '-'}</p>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-500 mb-1">Raporu Kaydeden</label>
                                    <p className="text-gray-900">{selectedReport.reported_by}</p>
                                </div>
                            </div>

                            {/* Report Content */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Rapor İçeriği</label>
                                <div
                                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedReport.report_content || '<p class="text-gray-500">Rapor içeriği bulunamadı</p>') }}
                                />
                            </div>

                            {/* Resolution Notes if exists */}
                            {selectedReport.resolved && selectedReport.resolution_notes && (
                                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                    <label className="block text-sm font-medium text-green-800 mb-2">Çözüm Notları</label>
                                    <p className="text-green-900">{selectedReport.resolution_notes}</p>
                                    <p className="text-xs text-green-700 mt-2">
                                        Çözüldü: {formatDate(selectedReport.resolved_at || '')}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
                            <button
                                onClick={() => setShowReportModal(false)}
                                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-medium transition"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
