import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker, message, Modal } from 'antd';
import dayjs from '../utils/dayjsConfig';
import 'antd/dist/reset.css';
import api from '../utils/api';
import { formatDate, formatTime } from '../utils/dateUtils';
import type { ManagerRecord } from '../types';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import { exportRecordsToExcelAndZip } from '../utils/exportHelper';

const { RangePicker } = DatePicker;

export default function ManagerRecords() {
    const [records, setRecords] = useState<ManagerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [textPreview, setTextPreview] = useState<{ title: string; value: string } | null>(null);
    const [scrollbarSpacerWidth, setScrollbarSpacerWidth] = useState(0);
    const navigate = useNavigate();
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);

    const [filters, setFilters] = useState({
        manager_name: '',
        entry_by: '',
        exit_by: '',
        status: 'all',
        entryDateStart: '',
        entryDateEnd: '',
        exitDateStart: '',
        exitDateEnd: '',
        gate: 'all'
    });

    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 200;

    const fetchData = useCallback(async (offset = 0, append = false) => {
        try {
            const params = new URLSearchParams();
            params.append('includeDeleted', 'true');
            params.append('limit', String(PAGE_SIZE));
            params.append('offset', String(offset));

            if (filters.manager_name) params.append('manager_name', filters.manager_name);
            if (filters.entry_by) params.append('entry_by', filters.entry_by);
            if (filters.exit_by) params.append('exit_by', filters.exit_by);
            if (filters.status) params.append('status', filters.status);
            if (filters.gate) params.append('gate', filters.gate);
            if (filters.entryDateStart) params.append('entryDateStart', filters.entryDateStart);
            if (filters.entryDateEnd) params.append('entryDateEnd', filters.entryDateEnd);
            if (filters.exitDateStart) params.append('exitDateStart', filters.exitDateStart);
            if (filters.exitDateEnd) params.append('exitDateEnd', filters.exitDateEnd);

            const res = await api.get(`/managers/records?${params.toString()}`);
            const fetchedRecords = res.data || [];

            if (append) {
                setRecords(prev => [...prev, ...fetchedRecords]);
            } else {
                setRecords(fetchedRecords);
            }

            setHasMore(fetchedRecords.length === PAGE_SIZE);
        } catch (error) {
            message.error('Veriler yüklenemedi');
            console.error('Veriler yüklenemedi:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filters]);

    useEffect(() => {
        setLoading(true);
        void fetchData(0, false);
    }, [fetchData]);

    useRealtimeRefetch({
        topics: ['managers'],
        onMutation: () => void fetchData(0, false),
        enabled: true,
    });

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

    // Filtered records are handled on backend now
    const filteredRecords = records;

    // Group by day for both default and filtered views (newest day first)
    const groupedByDay = useMemo(() => {
        const dayGroups = new Map<string, ManagerRecord[]>();

        filteredRecords.forEach((record) => {
            const dayKey = dayjs(record.entry_date).format('YYYY-MM-DD');
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
                    const dateCompare = (a.entry_date || '').localeCompare(b.entry_date || '');
                    if (dateCompare !== 0) return dateCompare;
                    return (a.entry_time || '').localeCompare(b.entry_time || '');
                })
            }));
    }, [filteredRecords]);

    const handleDownloadRecords = useCallback(async () => {
        // Race condition guard
        if (isExporting) {
            return;
        }

        const entryRangeSelected = !!(filters.entryDateStart || filters.entryDateEnd);
        const exitRangeSelected = !!(filters.exitDateStart || filters.exitDateEnd);

        if (!entryRangeSelected && !exitRangeSelected) {
            message.warning('Lütfen giriş veya çıkış tarih aralığı seçin.');
            return;
        }

        let rangeStart: string | null = null;
        let rangeEnd: string | null = null;
        let filterBy: 'entry' | 'exit' = 'entry';

        if (entryRangeSelected) {
            filterBy = 'entry';
            rangeStart = filters.entryDateStart || filters.entryDateEnd || null;
            rangeEnd = filters.entryDateEnd || filters.entryDateStart || null;
        } else {
            filterBy = 'exit';
            rangeStart = filters.exitDateStart || filters.exitDateEnd || null;
            rangeEnd = filters.exitDateEnd || filters.exitDateStart || null;
        }

        if (!rangeStart || !rangeEnd) {
            message.warning('Lütfen geçerli bir tarih aralığı seçin.');
            return;
        }

        setIsExporting(true);

        try {
            // Fetch filtered records for download (unlimited)
            const params = new URLSearchParams();
            params.append('includeDeleted', 'true');
            params.append('unlimited', 'true');
            if (filters.manager_name) params.append('manager_name', filters.manager_name);
            if (filters.entry_by) params.append('entry_by', filters.entry_by);
            if (filters.exit_by) params.append('exit_by', filters.exit_by);
            if (filters.status) params.append('status', filters.status);
            if (filters.gate) params.append('gate', filters.gate);
            if (filters.entryDateStart) params.append('entryDateStart', filters.entryDateStart);
            if (filters.entryDateEnd) params.append('entryDateEnd', filters.entryDateEnd);
            if (filters.exitDateStart) params.append('exitDateStart', filters.exitDateStart);
            if (filters.exitDateEnd) params.append('exitDateEnd', filters.exitDateEnd);

            const res = await api.get(`/managers/records?${params.toString()}`);
            const allRecords: ManagerRecord[] = res.data || [];

            const exportableRecords = allRecords
                .filter((record) => {
                    const dateValue = filterBy === 'entry' ? record.entry_date : record.exit_date;
                    if (!dateValue) return false;
                    const d = dayjs(dateValue);
                    const start = dayjs(rangeStart).startOf('day');
                    const end = dayjs(rangeEnd).endOf('day');
                    return d.isBetween(start, end, 'millisecond', '[]');
                })
                .filter(record => !record.deleted_at);

            if (exportableRecords.length === 0) {
                message.warning('Seçilen tarih aralığında indirilecek kayıt bulunamadı.');
                return;
            }

            const exportGroupsMap = new Map<string, ManagerRecord[]>();

            exportableRecords.forEach((record) => {
                const dayKey = dayjs(record.entry_date).format('YYYY-MM-DD');
                if (!exportGroupsMap.has(dayKey)) {
                    exportGroupsMap.set(dayKey, []);
                }
                exportGroupsMap.get(dayKey)!.push(record);
            });

            const exportGroups = Array.from(exportGroupsMap.entries())
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([dayKey, items]) => ({
                    dayKey,
                    dayLabel: dayjs(dayKey).format('DD MMMM YYYY dddd'),
                    records: [...items].sort((a, b) => {
                        const dateCompare = (a.entry_date || '').localeCompare(b.entry_date || '');
                        if (dateCompare !== 0) return dateCompare;
                        return (a.entry_time || '').localeCompare(b.entry_time || '');
                    })
                }));

            const headerRow = [
                'Müdür Adı',
                'Kapı',
                'Giriş Tarihi',
                'Giriş Saati',
                'Çıkış Tarihi',
                'Çıkış Saati',
                'Durum',
                'Giriş Yapan',
                'Çıkış Yapan',
                'Açıklama'
            ];

            const worksheetColumnWidths = [18, 12, 14, 12, 14, 12, 12, 16, 16, 32];

            await exportRecordsToExcelAndZip<ManagerRecord>({
                exportGroups,
                headerRow,
                columnWidths: worksheetColumnWidths,
                mapRecordToRow: (record) => [
                    record.manager || '-',
                    record.gate || '-',
                    formatDate(record.entry_date),
                    formatTime(record.entry_time),
                    record.exit_date ? formatDate(record.exit_date) : '-',
                    record.exit_time ? formatTime(record.exit_time) : '-',
                    record.status || '-',
                    record.entry_by || '-',
                    record.exit_by || '-',
                    record.notes || '-'
                ],
                sheetName: 'Müdür Kayıtları',
                filePrefix: 'Mudir_Kayitlari_',
                zipNamePrefix: 'Mudir_Kayitlari'
            });

            message.success('Kayıtlar başarıyla indirildi');
        } catch (error) {
            console.error('Export hatası:', error);
            message.error('Kayıtlar indirilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
        } finally {
            setIsExporting(false);
        }
    }, [filters, isExporting]);

    // Clear all filters
    const clearFilters = () => {
        setFilters({
            manager_name: '',
            entry_by: '',
            exit_by: '',
            status: 'all',
            entryDateStart: '',
            entryDateEnd: '',
            exitDateStart: '',
            exitDateEnd: '',
            gate: 'all'
        });
    };

    const handleDeleteRecord = async (id: string) => {
        Modal.confirm({
            title: 'Kaydı Sil',
            content: 'Bu kaydı silmek istediğinize emin misiniz?',
            okText: 'Evet',
            cancelText: 'Hayır',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await api.delete(`/managers/records/${id}`);
                    setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: new Date().toISOString() } : record));
                    message.success('Kayıt silindi');
                } catch (error) {
                    console.error('Kayıt silinemedi:', error);
                    message.error('Kayıt silinirken bir hata oluştu');
                }
            }
        });
    };

    const handleRestoreRecord = async (id: string) => {
        try {
            await api.post(`/managers/records/${id}/restore`);
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: null } : record));
            message.success('Kayıt geri alındı');
        } catch (error) {
            console.error('Kayıt geri alınamadı:', error);
            message.error('Kayıt geri alınırken bir hata oluştu');
        }
    };

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
    }, [filteredRecords.length, loading]);

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

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 sm:py-2">
                    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <button
                                onClick={() => navigate('/managers')}
                                className="p-1.5 hover:bg-slate-800 rounded-lg transition shrink-0"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-lg sm:text-xl font-bold text-white leading-tight break-words">Müdür Kayıtları</h1>
                                <p className="text-[11px] sm:text-xs text-slate-350 mt-0.5">Tüm geçmiş kayıtları görüntüleyin ve filtreleyin</p>
                            </div>
                        </div>
                        <button
                            onClick={handleDownloadRecords}
                            disabled={isExporting || loading || filteredRecords.length === 0}
                            className="flex w-full lg:w-auto items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition shadow-sm text-xs sm:text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
                                    Kayıt İndir
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Müdür Adı</label>
                            <input
                                type="text"
                                value={filters.manager_name}
                                onChange={(e) => setFilters({ ...filters, manager_name: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Giriş Yapan</label>
                            <input
                                type="text"
                                value={filters.entry_by}
                                onChange={(e) => setFilters({ ...filters, entry_by: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Çıkış Yapan</label>
                            <input
                                type="text"
                                value={filters.exit_by}
                                onChange={(e) => setFilters({ ...filters, exit_by: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Durum</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="inside">İçeride</option>
                                <option value="exited">Çıkış Yapıldı</option>
                                <option value="deleted">Silinen Kayıtlar</option>
                            </select>
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Kapı</label>
                            <select
                                value={filters.gate}
                                onChange={(e) => setFilters({ ...filters, gate: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="Ana Kapı">Ana Kapı</option>
                                <option value="Sahil Kapı">Sahil Kapı</option>
                            </select>
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Giriş Tarihi</label>
                            <RangePicker
                                value={[
                                    filters.entryDateStart ? dayjs(filters.entryDateStart) : null,
                                    filters.entryDateEnd ? dayjs(filters.entryDateEnd) : null
                                ]}
                                onChange={(dates) => {
                                    if (!dates || (!dates[0] && !dates[1])) {
                                        setFilters({
                                            ...filters,
                                            entryDateStart: '',
                                            entryDateEnd: ''
                                        });
                                    } else if (dates[0] && dates[1]) {
                                        setFilters({
                                            ...filters,
                                            entryDateStart: dates[0].format('YYYY-MM-DD'),
                                            entryDateEnd: dates[1].format('YYYY-MM-DD')
                                        });
                                    } else if (dates[0] && !dates[1]) {
                                        const singleDate = dates[0].format('YYYY-MM-DD');
                                        setFilters({
                                            ...filters,
                                            entryDateStart: singleDate,
                                            entryDateEnd: singleDate
                                        });
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

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Çıkış Tarihi</label>
                            <RangePicker
                                value={[
                                    filters.exitDateStart ? dayjs(filters.exitDateStart) : null,
                                    filters.exitDateEnd ? dayjs(filters.exitDateEnd) : null
                                ]}
                                onChange={(dates) => {
                                    if (!dates || (!dates[0] && !dates[1])) {
                                        setFilters({
                                            ...filters,
                                            exitDateStart: '',
                                            exitDateEnd: ''
                                        });
                                    } else if (dates[0] && dates[1]) {
                                        setFilters({
                                            ...filters,
                                            exitDateStart: dates[0].format('YYYY-MM-DD'),
                                            exitDateEnd: dates[1].format('YYYY-MM-DD')
                                        });
                                    } else if (dates[0] && !dates[1]) {
                                        const singleDate = dates[0].format('YYYY-MM-DD');
                                        setFilters({
                                            ...filters,
                                            exitDateStart: singleDate,
                                            exitDateEnd: singleDate
                                        });
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
                            onScroll={syncTableScroll}
                            className="h-full min-h-0 overflow-x-auto scrollbar-hide overflow-y-auto pb-2"
                        >
                            {groupedByDay.map((dayGroup) => (
                                <div key={dayGroup.dayKey} className="mb-4 last:mb-0">
                                    <div className="sticky top-0 bg-gray-100 px-4 py-2 border-l-4 border-blue-500 z-10 shadow-sm">
                                        <h3 className="text-sm font-semibold text-gray-800">{dayGroup.dayLabel}</h3>
                                    </div>

                                    <table className="w-full min-w-[1000px] table-fixed divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-10 z-10">
                                            <tr>
                                                <th className="w-[170px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">İsim Soyisim</th>
                                                <th className="w-[80px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Kapı</th>
                                                <th className="w-[130px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Giriş Tarihi</th>
                                                <th className="w-[130px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Çıkış Tarihi</th>
                                                <th className="w-[140px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Açıklama</th>
                                                <th className="w-[120px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Giriş Yapan</th>
                                                <th className="w-[120px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Çıkış Yapan</th>
                                                <th className="w-[110px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {dayGroup.records.map((record) => (
                                                <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                                                        <div className="text-xs font-bold text-gray-900">{record.manager || '-'}</div>
                                                        {record.manager_title && <div className="text-[10px] text-gray-500 mt-0.5">{record.manager_title}</div>}
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                                                        <div className="text-xs text-gray-900">{record.gate || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                                                        <div className="text-xs text-gray-900">{formatDate(record.entry_date)}</div>
                                                        <div className="text-[10px] text-gray-500 mt-0.5">{formatTime(record.entry_time)}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                                                        {record.exit_date ? (
                                                            <>
                                                                <div className="text-xs text-gray-900">{formatDate(record.exit_date)}</div>
                                                                <div className="text-[10px] text-gray-500 mt-0.5">{formatTime(record.exit_time)}</div>
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 align-top">
                                                        {renderPreviewText(record.notes, 'Açıklama')}
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                                                        <div className="text-xs text-gray-900">{record.entry_by || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                                                        <div className="text-xs text-gray-900">{record.exit_by || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                                                        {record.deleted_at ? (
                                                            <span className="px-2 py-0.5 inline-flex whitespace-nowrap text-[10px] leading-5 font-semibold rounded-full bg-red-100 text-red-700">
                                                                Silindi
                                                            </span>
                                                        ) : (
                                                            <span className={`px-2 py-0.5 inline-flex whitespace-nowrap text-[10px] leading-5 font-semibold rounded-full ${record.status === 'inside' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                                                {record.status === 'inside' ? 'İçeride' : 'Çıkış Yapıldı'}
                                                            </span>
                                                        )}
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
