import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from '../utils/dayjsConfig';
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

    // Group by day for both default and filtered views (newest day first)
    const groupedByDay = useMemo(() => {
        const dayGroups = new Map<string, IncidentRecord[]>();

        filteredRecords.forEach((record) => {
            const dateStr = record.report_date || record.created_at;
            const dayKey = dayjs(dateStr).format('YYYY-MM-DD');
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
                    return dayjs(a.report_date || a.created_at).valueOf() - dayjs(b.report_date || b.created_at).valueOf();
                })
            }));
    }, [filteredRecords]);

    // Clear all filters
    const clearFilters = () => {
        setReportedBy('');
        setDateStart('');
        setDateEnd('');
    };

    // Open report modal
    const openReportModal = (record: IncidentRecord) => {
        setSelectedReport(record);
        setShowReportModal(true);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
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
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Olay Kayıtları</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Tüm geçmiş kayıtları görüntüleyin ve filtreleyin</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4">
                {/* Filters Panel */}
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
                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Raporu Kaydeden</label>
                            <input
                                type="text"
                                value={reportedBy}
                                onChange={(e) => setReportedBy(e.target.value)}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Rapor Tarihi</label>
                            <RangePicker
                                value={[
                                    dateStart ? dayjs(dateStart) : null,
                                    dateEnd ? dayjs(dateEnd) : null
                                ]}
                                onChange={(dates) => {
                                    if (!dates || (!dates[0] && !dates[1])) {
                                        setDateStart('');
                                        setDateEnd('');
                                    } else if (dates[0] && dates[1]) {
                                        setDateStart(dates[0].format('YYYY-MM-DD'));
                                        setDateEnd(dates[1].format('YYYY-MM-DD'));
                                    } else if (dates[0] && !dates[1]) {
                                        const singleDate = dates[0].format('YYYY-MM-DD');
                                        setDateStart(singleDate);
                                        setDateEnd(singleDate);
                                    }
                                }}
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

                {/* Records */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-auto flex-1 min-h-0">
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
                        <div className="h-full min-h-0 overflow-x-auto overflow-y-auto">
                            {groupedByDay.map((dayGroup) => (
                                <div key={dayGroup.dayKey} className="mb-4 last:mb-0">
                                    <div className="sticky top-0 bg-gray-100 px-4 py-2 border-l-4 border-blue-500 z-10 shadow-sm">
                                        <h3 className="text-sm font-semibold text-gray-800">{dayGroup.dayLabel}</h3>
                                    </div>

                                    <table className="w-full min-w-[1150px] table-auto divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-10 z-10">
                                            <tr>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vardiya</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaydeden</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {dayGroup.records.map((record) => (
                                                <tr key={record.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{formatDate(record.report_date || record.created_at)}</div>
                                                        <div className="text-xs text-gray-600">{formatTime(record.incident_time || record.created_at)}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{record.shift_label || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-sm text-gray-900 max-w-[520px] truncate">{record.description}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{record.reported_by}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
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
                            ))}
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
