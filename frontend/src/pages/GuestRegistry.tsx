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
    const [textPreview, setTextPreview] = useState<{ title: string; value: string } | null>(null);

    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 100;

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

    const renderCellValue = (value: unknown, column: GuestRegistryColumn) => {
        const formatted = formatCellValue(value, column.type);
        const text = formatted === '-' ? '-' : String(formatted);

        if (text === '-' || text.length <= 30) {
            return <span className="text-xs text-gray-700 select-all">{text}</span>;
        }

        return (
            <button
                type="button"
                onClick={() => setTextPreview({ title: column.label, value: text })}
                className="text-xs text-blue-700 hover:text-blue-900 underline text-left block max-w-[200px] truncate whitespace-nowrap overflow-hidden select-text"
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
    }, [records.length, columns.length, loading]);

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
                                className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2.5 rounded-lg transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm w-full sm:w-auto animate-fadeIn"
                            >
                                {uploading ? (
                                    <>
                                        <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Yükleniyor...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        Excel Yükle
                                    </>
                                )}
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

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-6 pb-16 flex flex-col gap-4 overflow-hidden">
                {lastSummary && (
                    <div className="mb-2 bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-4 shadow-sm animate-fadeIn">
                        <h3 className="text-xs font-semibold text-emerald-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Yükleme Özeti
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white/85 backdrop-blur border border-emerald-100 rounded-lg p-2.5 text-center shadow-xs">
                                <span className="block text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">Toplam Satır</span>
                                <span className="block text-base font-bold text-emerald-950 mt-0.5">{lastSummary.totalRows}</span>
                            </div>
                            <div className="bg-white/85 backdrop-blur border border-emerald-100 rounded-lg p-2.5 text-center shadow-xs">
                                <span className="block text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">Eklenen</span>
                                <span className="block text-base font-bold text-emerald-700 mt-0.5">{lastSummary.insertedRows}</span>
                            </div>
                            <div className="bg-white/85 backdrop-blur border border-emerald-100 rounded-lg p-2.5 text-center shadow-xs">
                                <span className="block text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">Atlanan</span>
                                <span className="block text-base font-bold text-amber-700 mt-0.5">{lastSummary.skippedRows}</span>
                            </div>
                            <div className="bg-white/85 backdrop-blur border border-emerald-100 rounded-lg p-2.5 text-center shadow-xs">
                                <span className="block text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">Hatalı</span>
                                <span className="block text-base font-bold text-red-700 mt-0.5">{lastSummary.failedRows}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 px-3 py-2.5 mb-1">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Arama ve Filtreleme</h2>
                        {hasActiveFilters && (
                            <button
                                onClick={onReset}
                                disabled={loading || uploading}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                            >
                                Temizle
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Excel kolonlarında ara (Örn: İsim, Oda No, Firma, Tarih vb...)"
                                className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition shadow-sm"
                            />
                        </div>
                        <div className="text-[10px] text-gray-500 ml-1">
                            Arama; Excel satırındaki tüm kolon değerleri içinde çalışır ve otomatik olarak filtrelenir.
                        </div>
                    </div>
                </div>

                {existenceMessage && (
                    <div className={`mb-2 rounded-lg px-4 py-2 text-xs font-medium border ${records.length > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
                        {existenceMessage}
                    </div>
                )}

                <div className="text-xs text-gray-500 font-medium ml-1">
                    Toplam: <span className="font-bold text-gray-900">{records.length}</span> kayıt listeleniyor
                </div>

                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-hidden flex-1 min-h-0 flex flex-col">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 flex-1">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-20 text-gray-500 flex-1 flex flex-col items-center justify-center gap-2">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v4.5m16 0h-1.5m-3 0h-3" />
                            </svg>
                            Kayıt bulunamadı
                        </div>
                    ) : (
                        <div
                            ref={tableScrollRef}
                            onScroll={syncTableScroll}
                            className="h-full min-h-0 overflow-x-auto scrollbar-hide overflow-y-auto pb-2 flex-1"
                            tabIndex={0}
                            role="region"
                            aria-label="Misafir kayıt tablosu"
                        >
                            <div className="min-h-full w-max min-w-full">
                                <table className="table-auto divide-y divide-gray-200" style={{ width: 'max-content', minWidth: '100%' }}>
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            {columns.map((column) => (
                                                <th
                                                    key={column.key}
                                                    className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider"
                                                >
                                                    {column.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {records.map((record) => (
                                            <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                                                {columns.map((column) => {
                                                    const value = getRowCellValue(record, column.key);
                                                    return (
                                                        <td
                                                            key={column.key}
                                                            className="px-3 py-2 whitespace-nowrap align-middle"
                                                        >
                                                            {renderCellValue(value, column)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {loadingMore && (
                                    <div className="flex items-center justify-center py-4">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
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

            {textPreview && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-scaleIn">
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900">{textPreview.title}</h3>
                            <button
                                type="button"
                                onClick={() => setTextPreview(null)}
                                className="text-gray-400 hover:text-gray-600 transition"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="px-4 py-4 max-h-[60vh] overflow-y-auto">
                            <p className="text-xs text-gray-800 whitespace-pre-wrap break-words select-text">{textPreview.value}</p>
                        </div>
                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setTextPreview(null)}
                                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-xs font-semibold transition"
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

