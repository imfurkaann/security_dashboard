import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import 'antd/dist/reset.css';
import api from '../utils/api';
import type { GuestRegistryColumn, GuestRegistryRecord, GuestRegistrySchema } from '../types';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';

interface ImportSummary {
    totalRows: number;
    insertedRows: number;
    skippedRows: number;
    failedRows: number;
}

const EMPTY_SCHEMA: GuestRegistrySchema = { columns: [] };

export default function GuestRegistry() {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);
    const hasMountedRef = useRef(false);

    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [scrollbarSpacerWidth, setScrollbarSpacerWidth] = useState(0);
    const [records, setRecords] = useState<GuestRegistryRecord[]>([]);
    const [schema, setSchema] = useState<GuestRegistrySchema>(EMPTY_SCHEMA);
    const [searchText, setSearchText] = useState('');
    const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null);
    const [debouncedSearchText, setDebouncedSearchText] = useState('');

    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 100;

    const columns = schema.columns;

    const fetchRecords = useCallback(async (searchValue = '', pageNumber = 1, append = false, options?: { silent?: boolean }) => {
        const silent = options?.silent ?? false;
        if (!silent && !append) {
            setLoading(true);
        }
        try {
            const params: Record<string, string | number> = { page: pageNumber, limit: PAGE_SIZE, _t: Date.now() };

            if (searchValue.trim()) {
                params.search = searchValue.trim();
            }

            const response = await api.get('/guest-registry/records', { params });
            const nextSchema: GuestRegistrySchema = response.data?.schema || EMPTY_SCHEMA;

            setSchema(nextSchema);
            const fetchedData = response.data?.data || [];

            if (append) {
                setRecords(prev => [...prev, ...fetchedData]);
            } else {
                setRecords(fetchedData);
            }

            setHasMore(fetchedData.length === PAGE_SIZE);
        } catch (error) {
            console.error('Misafir kayitlari yuklenemedi:', error);
            message.error('Misafir kayıtları yüklenemedi');
        } finally {
            if (!silent) {
                setLoading(false);
            }
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        void fetchRecords('', 1, false);
    }, [fetchRecords]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchText(searchText);
        }, 250);

        return () => clearTimeout(timer);
    }, [searchText]);

    useEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            return;
        }

        void fetchRecords(debouncedSearchText, 1, false, { silent: true });
    }, [debouncedSearchText, fetchRecords]);

    // Infinite scroll listener
    useEffect(() => {
        const node = tableScrollRef.current;
        if (!node) return;

        const onScroll = () => {
            if (loadingMore || !hasMore) return;
            const threshold = 300;
            const remaining = node.scrollHeight - node.clientHeight - node.scrollTop;
            if (remaining < threshold) {
                setLoadingMore(true);
                const nextPage = Math.floor(records.length / PAGE_SIZE) + 1;
                void fetchRecords(debouncedSearchText, nextPage, true);
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
                const nextPage = Math.floor(records.length / PAGE_SIZE) + 1;
                void fetchRecords(debouncedSearchText, nextPage, true);
            }
        };

        window.addEventListener('scroll', onWindowScroll);

        return () => {
            node.removeEventListener('scroll', onScroll);
            window.removeEventListener('scroll', onWindowScroll);
        };
    }, [fetchRecords, loadingMore, hasMore, records.length, debouncedSearchText]);

    const refreshGuestRegistryRealtime = useCallback(() => {
        return fetchRecords(debouncedSearchText, 1, false, { silent: true });
    }, [fetchRecords, debouncedSearchText]);

    useRealtimeRefetch({
        topics: ['guest-registry'],
        onMutation: refreshGuestRegistryRealtime,
        enabled: true,
    });

    const onReset = async () => {
        setSearchText('');
        setDebouncedSearchText('');
        await fetchRecords('', 1, false);
    };

    const onUploadClick = () => {
        fileInputRef.current?.click();
    };

    const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;

        const fileName = selectedFile.name.toLowerCase();
        if (!fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
            message.error('Sadece Excel dosyaları (.xls, .xlsx) yüklenebilir');
            event.target.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            setUploading(true);
            const response = await api.post('/guest-registry/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            const summary = response.data?.summary as ImportSummary | undefined;
            if (summary) {
                setLastSummary(summary);
            }

            message.success('Excel yükleme tamamlandı');
            setSearchText('');
            setDebouncedSearchText('');
            await fetchRecords('', 1, false);
        } catch (error: any) {
            console.error('Excel yuklenemedi:', error);
            const apiMessage = error?.response?.data?.message;
            message.error(apiMessage || 'Excel yükleme sırasında hata oluştu');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const hasActiveFilters = useMemo(() => {
        return searchText.trim() !== '';
    }, [searchText]);

    const existenceMessage = useMemo(() => {
        if (!hasActiveFilters) return null;
        if (records.length > 0) {
            return `${records.length} kayıt bulundu`;
        }
        return 'Aranan kriterlere göre kayıt bulunamadı';
    }, [hasActiveFilters, records.length]);

    const formatCellValue = (value: unknown, columnType: GuestRegistryColumn['type']): string => {
        if (value === null || value === undefined) return '-';

        const text = String(value).trim();
        if (!text) return '-';

        if (columnType === 'date') {
            const isoDateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (isoDateMatch) {
                const [, year, month, day] = isoDateMatch;
                return `${day}.${month}.${year}`;
            }

            const dmyMatch = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
            if (dmyMatch) {
                const day = dmyMatch[1].padStart(2, '0');
                const month = dmyMatch[2].padStart(2, '0');
                const year = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
                return `${day}.${month}.${year}`;
            }
        }

        if (columnType === 'time') {
            const hhmmssMatch = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
            if (hhmmssMatch) {
                return `${hhmmssMatch[1].padStart(2, '0')}:${hhmmssMatch[2]}`;
            }

            const dotTimeMatch = text.match(/^(\d{1,2})\.(\d{2})(?:\.\d{2})?$/);
            if (dotTimeMatch) {
                return `${dotTimeMatch[1].padStart(2, '0')}:${dotTimeMatch[2]}`;
            }
        }

        return text;
    };

    const getRowCellValue = (record: GuestRegistryRecord, columnKey: string): unknown => {
        return record.row_data?.[columnKey];
    };

    useEffect(() => {
        const updateScrollbarWidth = () => {
            const tableWidth = tableScrollRef.current?.scrollWidth ?? 0;
            const barWidth = bottomScrollRef.current?.clientWidth ?? 0;
            setScrollbarSpacerWidth(Math.max(tableWidth, barWidth + 1));
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
    }, [records.length, columns.length, loading]);

    const syncBottomScroll = () => {
        const tableNode = tableScrollRef.current;
        const barNode = bottomScrollRef.current;

        if (!tableNode || !barNode) return;
        tableNode.scrollLeft = barNode.scrollLeft;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="p-2 hover:bg-slate-800 rounded-lg transition shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Otel Misafir Kayıt Sayfası</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Otel misafir kayıtlarını yönetin.</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 w-full lg:w-auto">
                            <button
                                onClick={onUploadClick}
                                disabled={uploading}
                                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg transition shadow-md hover:shadow-lg text-sm sm:text-base w-full sm:w-auto"
                            >
                                {uploading ? 'Yukleniyor...' : 'Dosya Yukle'}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xls,.xlsx"
                                className="hidden"
                                onChange={onFileSelected}
                            />
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 pb-14 flex flex-col gap-4 overflow-hidden">
                <div className="text-sm text-gray-600">
                    Toplam: <span className="font-bold text-gray-900">{records.length}</span> kayıt
                </div>

                {lastSummary && (
                    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Toplam satır: {lastSummary.totalRows} | Eklenen: {lastSummary.insertedRows} | Atlanan: {lastSummary.skippedRows} | Hatalı: {lastSummary.failedRows}
                    </div>
                )}

                <div className="w-full bg-white rounded-lg shadow-md p-4 sm:p-5 mb-2">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-base font-bold text-gray-900">Arama</h2>
                        <button
                            onClick={onReset}
                            disabled={loading || uploading || !hasActiveFilters}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            Temizle
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Exceldeki tüm kolonlarda ara</label>
                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Örn: Mustafa, Nektar, 201, FB..."
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="text-xs text-gray-500">
                            Arama; Excel satırındaki tüm kolon değerleri içinde çalışır.
                        </div>
                    </div>
                </div>

                {existenceMessage && (
                    <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${records.length > 0 ? 'border border-emerald-200 bg-emerald-50 text-emerald-800' : 'border border-red-200 bg-red-50 text-red-700'}`}>
                        {existenceMessage}
                    </div>
                )}

                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-hidden flex-1 min-h-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">Kayıt bulunamadı</div>
                    ) : (
                        <div
                            ref={tableScrollRef}
                            className="h-full min-h-0 overflow-x-hidden overflow-y-auto pb-2"
                            tabIndex={0}
                            role="region"
                            aria-label="Misafir kayit tablosu"
                        >
                            <div className="min-h-full w-max min-w-full">
                                <table className="table-auto divide-y divide-gray-200" style={{ width: 'max-content', minWidth: '100%' }}>
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            {columns.map((column) => (
                                                <th
                                                    key={column.key}
                                                    className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                                >
                                                    {column.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {records.map((record) => (
                                            <tr key={record.id} className="hover:bg-gray-50">
                                                {columns.map((column) => {
                                                    const value = getRowCellValue(record, column.key);
                                                    return (
                                                        <td
                                                            key={column.key}
                                                            className="px-4 py-3 whitespace-nowrap text-sm text-gray-700"
                                                        >
                                                            {formatCellValue(value, column.type)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {loadingMore && (
                                    <div className="flex items-center justify-center py-4">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <div className="fixed bottom-0 left-0 right-0 lg:left-[var(--sidebar-width)] z-40 border-t border-gray-200 bg-white/95 backdrop-blur shadow-[0_-8px_20px_rgba(15,23,42,0.08)]">
                <div ref={bottomScrollRef} onScroll={syncBottomScroll} className="h-5 overflow-x-scroll overflow-y-hidden">
                    <div style={{ width: `${scrollbarSpacerWidth}px`, height: 1 }} />
                </div>
            </div>
        </div>
    );
}
