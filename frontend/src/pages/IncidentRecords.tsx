import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from '../utils/dayjsConfig';
import 'antd/dist/reset.css';
import DOMPurify from 'dompurify';
import api from '../utils/api';
import { formatDate, formatTime } from '../utils/dateUtils';
import ActionButton from '../components/ActionButton';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import JSZip from 'jszip';

const { RangePicker } = DatePicker;

const normalizeSearchText = (value: string | null | undefined): string => {
    return (value || '').toLocaleLowerCase('tr-TR').normalize('NFC');
};

interface IncidentRecord {
    id: string;
    description: string;
    incident_type: string;
    shift_label: string | null;
    report_content: string | null;
    report_date: string;
    gate?: string | null;
    status: string;
    created_at: string;
    incident_time: string;
    resolved: boolean;
    resolution_notes: string | null;
    resolved_at: string | null;
    reported_by: string;
}

export default function IncidentRecords() {
    const [records, setRecords] = useState<IncidentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showReportModal, setShowReportModal] = useState(false);
    const [selectedReport, setSelectedReport] = useState<IncidentRecord | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const navigate = useNavigate();

    const tableScrollRef = useRef<HTMLDivElement>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 200;

    

    // Filter states
    const [reportedBy, setReportedBy] = useState('');
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');
    const [selectedGate, setSelectedGate] = useState('');

    // Get unique gates from records
    const uniqueGates = useMemo(() => {
        const gates = new Set<string>();
        records.forEach(record => {
            if (record.gate) {
                gates.add(record.gate);
            }
        });
        return Array.from(gates).sort();
    }, [records]);

    const fetchData = useCallback(async (offset = 0, append = false) => {
        try {
            const anyFilterApplied = (
                reportedBy !== '' ||
                dateStart !== '' ||
                dateEnd !== '' ||
                selectedGate !== ''
            );

            let res;
            if (anyFilterApplied) {
                res = await api.get(`/incidents/records?includeDeleted=true&unlimited=true&_t=${Date.now()}`);
            } else {
                res = await api.get(`/incidents/records?includeDeleted=true&limit=${PAGE_SIZE}&offset=${offset}&_t=${Date.now()}`);
            }

            const fetched = res.data?.data || [];
            if (append) {
                setRecords(prev => [...prev, ...fetched]);
            } else {
                setRecords(fetched);
            }

            setHasMore(anyFilterApplied ? false : fetched.length === PAGE_SIZE);
        } catch (error) {
            console.error('Veriler yüklenemedi:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [reportedBy, dateStart, dateEnd, selectedGate]);

    useEffect(() => {
        setLoading(true);
        void fetchData(0, false);
    }, [fetchData]);

    // Infinite scroll: load more on scroll near bottom
    useEffect(() => {
        const node = tableScrollRef.current;
        if (!node) return;

        const onScroll = () => {
            if (loadingMore || !hasMore) return;
            const threshold = 300;
            const remaining = node.scrollHeight - node.clientHeight - node.scrollTop;
            if (remaining < threshold) {
                setLoadingMore(true);
                void fetchData(records.length, true);
            }
        };

        node.addEventListener('scroll', onScroll);

        const onWindowScroll = () => {
            if (loadingMore || !hasMore) return;
            const threshold = 400;
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const windowHeight = window.innerHeight || document.documentElement.clientHeight;
            const docHeight = document.documentElement.scrollHeight;
            const remaining = docHeight - windowHeight - scrollTop;
            if (remaining < threshold) {
                setLoadingMore(true);
                void fetchData(records.length, true);
            }
        };

        window.addEventListener('scroll', onWindowScroll);

        return () => {
            node.removeEventListener('scroll', onScroll);
            window.removeEventListener('scroll', onWindowScroll);
        };
    }, [fetchData, loadingMore, hasMore, records.length]);

    useRealtimeRefetch({
        topics: ['incidents'],
        onMutation: fetchData,
        enabled: true,
    });

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            if (reportedBy && !normalizeSearchText(record.reported_by).includes(normalizeSearchText(reportedBy))) return false;
            if (selectedGate && record.gate !== selectedGate) return false;

            // Date filtering - inclusive dayjs comparison
            if (dateStart && dateEnd) {
                const dateStr = record.report_date || record.created_at;
                if (!dateStr) return false;
                const d = dayjs(dateStr);
                const start = dayjs(dateStart).startOf('day');
                const end = dayjs(dateEnd).endOf('day');
                if (!d.isBetween(start, end, 'millisecond', '[]')) return false;
            }

            return true;
        });
    }, [records, reportedBy, selectedGate, dateStart, dateEnd]);

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
        setSelectedGate('');
    };

    // Open report modal
    const openReportModal = (record: IncidentRecord) => {
        setSelectedReport(record);
        setShowReportModal(true);
    };

    // Export handler: require date range, fetch full dataset, filter inclusively, then POST to backend export
    const handleDownloadRecords = useCallback(async () => {
        if (isExporting) return;

        if (!dateStart || !dateEnd) {
            alert('Lütfen bir tarih aralığı seçin.');
            return;
        }

        setIsExporting(true);

        try {
            const res = await api.get('/incidents/records?includeDeleted=true&unlimited=true');
            const allRecords: IncidentRecord[] = res.data?.data || [];

            const start = dayjs(dateStart).startOf('day');
            const end = dayjs(dateEnd).endOf('day');

            const exportableRecords = allRecords.filter((record) => {
                const dateStr = record.report_date || record.created_at;
                if (!dateStr) return false;
                const d = dayjs(dateStr);
                return d.isBetween(start, end, 'millisecond', '[]');
            });

            if (exportableRecords.length === 0) {
                alert('Seçilen tarih aralığında indirilecek rapor bulunamadı.');
                return;
            }

            const exportRes = await api.post('/incidents/records/export', { records: exportableRecords }, { responseType: 'blob' });

            const blob = new Blob([exportRes.data], { type: 'application/zip' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'Vardiya_Raporlari_Export.zip';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }, 500);
        } catch (error) {
            console.error('Export hatası:', error);
            alert('Raporlar indirilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
        } finally {
            setIsExporting(false);
        }
    }, [dateStart, dateEnd, isExporting]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/incidents')}
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
                        <button
                            onClick={handleDownloadRecords}
                            disabled={isExporting || loading || filteredRecords.length === 0}
                            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg transition shadow-md hover:shadow-lg text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {isExporting ? (
                                <>
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    İndiriliyor...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Rapor İndir
                                </>
                            )}
                        </button>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Raporu Kaydeden</label>
                            <input
                                type="text"
                                value={reportedBy}
                                onChange={(e) => setReportedBy(e.target.value)}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Kapı</label>
                            <select
                                value={selectedGate}
                                onChange={(e) => setSelectedGate(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Tümü</option>
                                {uniqueGates.map((gate) => (
                                    <option key={gate} value={gate}>
                                        {gate}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="lg:col-span-2">
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
                        <div ref={tableScrollRef} className="h-full min-h-0 overflow-x-auto overflow-y-auto">
                            {groupedByDay.map((dayGroup) => (
                                <div key={dayGroup.dayKey} className="mb-4 last:mb-0">
                                    <div className="sticky top-0 bg-gray-100 px-4 py-2 border-l-4 border-blue-500 z-10 shadow-sm">
                                        <h3 className="text-sm font-semibold text-gray-800">{dayGroup.dayLabel}</h3>
                                    </div>

                                    <table className="w-full min-w-[1300px] table-auto divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-10 z-10">
                                            <tr>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vardiya</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kapı</th>
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
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{record.gate || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="text-sm text-gray-900 max-w-[400px] truncate">{record.description}</div>
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
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">Raporu Kaydeden</label>
                                    <p className="text-gray-900">{selectedReport.reported_by}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-500 mb-1">Kapı</label>
                                    <p className="text-gray-900">{(selectedReport as any).gate || '-'}</p>
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
