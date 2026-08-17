import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker, message } from 'antd';
import dayjs from '../utils/dayjsConfig';
import 'antd/dist/reset.css';
import api from '../utils/api';
import { formatDate, formatTime } from '../utils/dateUtils';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import { useReliableInfiniteScroll } from '../hooks/useReliableInfiniteScroll';
import { hasNextApiPage } from '../utils/pagination';
import { INCIDENT_CATEGORY_OPTIONS, getIncidentCategoryLabels } from '../utils/incidentCategories';
import { refreshLoadedPages } from '../utils/refreshLoadedPages';
import InfiniteScrollStatus from '../components/InfiniteScrollStatus';

interface CompactActionButtonProps {
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    variant?: 'primary' | 'success' | 'danger' | 'neutral';
    title?: string;
    disabled?: boolean;
    className?: string;
}

const actionVariantClasses = {
    primary: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30',
    danger: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30',
    neutral: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700/50'
};

function CompactActionButton({
    onClick,
    icon,
    label,
    variant = 'neutral',
    title,
    disabled = false,
    className = ''
}: CompactActionButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title || label}
            className={`compact-btn inline-flex items-center justify-center h-8 min-w-[32px] px-2 hover:px-3 rounded-full border transition-all duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${actionVariantClasses[variant]} ${className}`.trim()}
        >
            <span className="flex items-center justify-center shrink-0">
                {icon}
            </span>
            <span className="compact-btn-text text-[11px] font-bold">
                {label}
            </span>
        </button>
    );
}

const { RangePicker } = DatePicker;

interface IncidentRecord {
    id: string;
    description: string;
    incident_type: string;
    severity: string | null;
    location: string | null;
    categories?: Record<string, boolean> | null;
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
    deleted_at?: string | null;
}

export default function IncidentRecords() {
    const [records, setRecords] = useState<IncidentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showReportModal, setShowReportModal] = useState(false);
    const [selectedReport, setSelectedReport] = useState<IncidentRecord | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [textPreview, setTextPreview] = useState<{ title: string; value: string } | null>(null);
    const [scrollbarSpacerWidth, setScrollbarSpacerWidth] = useState(0);
    const navigate = useNavigate();

    const tableScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 200;
    const requestVersionRef = useRef(0);
    const loadMoreInFlightRef = useRef(false);
    const nextOffsetRef = useRef(0);

    const isScrollingTable = useRef(false);
    const isScrollingBar = useRef(false);

    const syncTableScroll = () => {
        if (isScrollingBar.current) return;
        const tableNode = tableScrollRef.current;
        const barNode = bottomScrollRef.current;
        if (!tableNode || !barNode) return;

        isScrollingTable.current = true;
        barNode.scrollLeft = tableNode.scrollLeft;
        requestAnimationFrame(() => {
            isScrollingTable.current = false;
        });
    };

    const syncBottomScroll = () => {
        if (isScrollingTable.current) return;
        const tableNode = tableScrollRef.current;
        const barNode = bottomScrollRef.current;
        if (!tableNode || !barNode) return;

        isScrollingBar.current = true;
        tableNode.scrollLeft = barNode.scrollLeft;
        requestAnimationFrame(() => {
            isScrollingBar.current = false;
        });
    };

    

    // Filter states
    const [reportedBy, setReportedBy] = useState('');
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');
    const [selectedGate, setSelectedGate] = useState('');
    const [keyword, setKeyword] = useState('');
    const [category, setCategory] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [severityFilter, setSeverityFilter] = useState('');

    // Kayıtlardaki kapılar öneri olarak sunulur; yeni tanımlanan kapılar da yazılarak filtrelenebilir.
    const uniqueGates = useMemo(() => Array.from(new Set(
        records.map((record) => record.gate).filter((gate): gate is string => Boolean(gate))
    )).sort((a, b) => a.localeCompare(b, 'tr-TR')), [records]);

    const fetchData = useCallback(async (offset = 0, append = false, requestVersion = requestVersionRef.current) => {
        try {
            const params: Record<string, string | number | boolean> = {
                includeDeleted: true,
                limit: PAGE_SIZE,
                offset,
                _t: Date.now()
            };

            if (reportedBy) params.reported_by = reportedBy;
            if (selectedGate) params.gate = selectedGate;
            if (keyword) params.keyword = keyword;
            if (category) params.category = category;
            if (statusFilter !== 'all') params.status = statusFilter;
            if (severityFilter) params.severity = severityFilter;
            if (dateStart) params.dateStart = dateStart;
            if (dateEnd) params.dateEnd = dateEnd;

            const res = await api.get('/incidents/records', { params });
            if (requestVersion !== requestVersionRef.current) return;
            const fetched = res.data?.data || [];

            if (append) {
                setRecords(prev => {
                    const merged = new Map(prev.map(record => [record.id, record]));
                    fetched.forEach((record: IncidentRecord) => merged.set(record.id, record));
                    return Array.from(merged.values());
                });
                nextOffsetRef.current = offset + fetched.length;
            } else {
                setRecords(fetched);
                nextOffsetRef.current = fetched.length;
            }

            setHasMore(hasNextApiPage(res, offset + fetched.length, fetched.length, PAGE_SIZE));
        } catch (error) {
            if (requestVersion !== requestVersionRef.current) return;
            console.error('Veriler yüklenemedi:', error);
            message.error('Veriler yüklenemedi');
        } finally {
            if (requestVersion === requestVersionRef.current) {
                setLoading(false);
                setLoadingMore(false);
                loadMoreInFlightRef.current = false;
            }
        }
    }, [reportedBy, dateStart, dateEnd, selectedGate, keyword, category, statusFilter, severityFilter]);

    useEffect(() => {
        const requestVersion = ++requestVersionRef.current;
        setLoading(true);
        setHasMore(true);
        nextOffsetRef.current = 0;
        loadMoreInFlightRef.current = false;
        void fetchData(0, false, requestVersion);
    }, [fetchData]);

    const renderPreviewText = (value: string | null | undefined, title: string) => {
        const text = (value || '-').toString();
        const isLong = text.length > 15;

        if (!isLong) {
            return <div className="text-xs text-gray-900 block max-w-[140px] truncate whitespace-nowrap overflow-hidden" title={text}>{text}</div>;
        }

        return (
            <button
                type="button"
                onClick={() => setTextPreview({ title, value: text })}
                className="text-xs text-blue-700 hover:text-blue-900 underline text-left block max-w-[140px] truncate whitespace-nowrap overflow-hidden"
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
    }, [records.length, loading]);

    useReliableInfiniteScroll({
        containerRef: tableScrollRef,
        loading,
        loadingMore,
        hasMore,
        itemCount: records.length,
        onLoadMore: () => {
            if (loadMoreInFlightRef.current) return;
            loadMoreInFlightRef.current = true;
            setLoadingMore(true);
            void fetchData(nextOffsetRef.current, true);
        },
    });

    useRealtimeRefetch({
        topics: ['incidents'],
        onMutation: async () => {
            const loadedItemCount = nextOffsetRef.current;
            const requestVersion = ++requestVersionRef.current;
            loadMoreInFlightRef.current = false;
            await refreshLoadedPages(loadedItemCount, PAGE_SIZE, (offset, append) =>
                fetchData(offset, append, requestVersion));
        },
        enabled: true,
    });

    // The records are filtered server-side
    const filteredRecords = records;

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
        setKeyword('');
        setCategory('');
        setStatusFilter('all');
        setSeverityFilter('');
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
            message.warning('Lütfen bir tarih aralığı seçin.');
            return;
        }

        setIsExporting(true);

        try {
            const exportRes = await api.post('/incidents/records/export', {
                dateStart,
                dateEnd,
                reported_by: reportedBy || undefined,
                gate: selectedGate || undefined,
                keyword: keyword || undefined,
                category: category || undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                severity: severityFilter || undefined,
            }, { responseType: 'blob' });

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
            message.error('Raporlar indirilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
        } finally {
            setIsExporting(false);
        }
    }, [dateStart, dateEnd, reportedBy, selectedGate, keyword, category, statusFilter, severityFilter, isExporting]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 sm:py-2">
                    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <button
                                onClick={() => navigate('/incidents')}
                                className="p-1.5 hover:bg-slate-800 rounded-lg transition shrink-0"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-lg sm:text-xl font-bold text-white leading-tight break-words">Olay Kayıtları</h1>
                                <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">Tüm geçmiş kayıtları görüntüleyin ve filtreleyin</p>
                            </div>
                        </div>
                        <button
                            onClick={handleDownloadRecords}
                            disabled={isExporting || loading || filteredRecords.length === 0}
                            className="flex w-full lg:w-auto items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition shadow-sm text-xs sm:text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {isExporting ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    İndiriliyor...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Rapor İndir
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-3 pb-14 flex flex-col gap-3 overflow-hidden">
                {/* Filters Panel */}
                <div className="bg-white rounded-lg shadow px-3 py-1.5 mb-2.5 w-full">
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
                        <div className="lg:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">İçerik / Konum Arama</label>
                            <input
                                type="text"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="Hırsızlık, kişi, oda, problem veya konum..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Olay Kategorisi</label>
                            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md">
                                <option value="">Tüm kategoriler</option>
                                {INCIDENT_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Durum</label>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md">
                                <option value="all">Tümü</option>
                                <option value="open">Açık</option>
                                <option value="resolved">Çözüldü</option>
                                <option value="deleted">Silinen Kayıtlar</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Önem Derecesi</label>
                            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md">
                                <option value="">Tümü</option>
                                <option value="low">Düşük</option>
                                <option value="medium">Orta</option>
                                <option value="high">Yüksek</option>
                                <option value="critical">Kritik</option>
                            </select>
                        </div>
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
                            <input
                                list="incident-gate-options"
                                type="text"
                                value={selectedGate}
                                onChange={(e) => setSelectedGate(e.target.value)}
                                placeholder="Tüm kapılar"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <datalist id="incident-gate-options">
                                {uniqueGates.map((gate) => (
                                    <option key={gate} value={gate}>
                                        {gate}
                                    </option>
                                ))}
                            </datalist>
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
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-hidden flex-1 min-h-0 w-full">
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
                        <div ref={tableScrollRef} onScroll={syncTableScroll} className="h-full min-h-0 overflow-x-auto scrollbar-hide overflow-y-auto pb-2">
                            {groupedByDay.map((dayGroup) => (
                                <div key={dayGroup.dayKey} className="mb-4 last:mb-0">
                                    <div className="sticky top-0 bg-gray-100 px-4 py-2 border-l-4 border-blue-500 z-10 shadow-sm">
                                        <h3 className="text-sm font-semibold text-gray-800">{dayGroup.dayLabel}</h3>
                                    </div>

                                    <table className="w-full min-w-[1000px] table-fixed divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-10 z-10">
                                            <tr>
                                                <th className="w-[130px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                                                <th className="w-[120px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Vardiya</th>
                                                <th className="w-[100px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Kapı</th>
                                                <th className="w-[370px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Açıklama</th>
                                                <th className="w-[160px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Kaydeden</th>
                                                <th className="w-[120px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {dayGroup.records.map((record) => (
                                                <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{formatDate(record.report_date || record.created_at)}</div>
                                                        <div className="text-[10px] text-gray-500 mt-0.5">{formatTime(record.incident_time || record.created_at)}</div>
                                                        {record.deleted_at && (
                                                            <span className="mt-1 px-2 py-0.5 inline-flex whitespace-nowrap text-[10px] leading-5 font-semibold rounded-full bg-red-100 text-red-700">Silindi</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.shift_label || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.gate || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 align-top">
                                                        <div className="text-xs text-gray-900 break-words whitespace-pre-wrap">
                                                            {record.description || '-'}
                                                        </div>
                                                        {getIncidentCategoryLabels(record.categories).length > 0 && (
                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                {getIncidentCategoryLabels(record.categories).map((label) => (
                                                                    <span key={label} className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">{label}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.reported_by}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 align-top whitespace-nowrap">
                                                        <CompactActionButton
                                                            onClick={() => openReportModal(record)}
                                                            variant="primary"
                                                            label="Kayıt Aç"
                                                            icon={
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                                </svg>
                                                            }
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                            <InfiniteScrollStatus loadingMore={loadingMore} hasMore={hasMore} itemCount={filteredRecords.length} />
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
                                    <p className="text-gray-900">{selectedReport.gate || '-'}</p>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-500 mb-1">Olay Kategorileri</label>
                                    <p className="text-gray-900">{getIncidentCategoryLabels(selectedReport.categories).join(', ') || '-'}</p>
                                </div>
                            </div>

                            {/* Report Content */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Rapor İçeriği</label>
                                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-sm text-gray-900 whitespace-pre-wrap max-w-none">
                                    {selectedReport.report_content || 'Rapor içeriği bulunamadı'}
                                </div>
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
