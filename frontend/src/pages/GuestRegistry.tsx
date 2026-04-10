import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ActionButton from '../components/ActionButton';
import api from '../utils/api';
import type { GuestRegistryRecord } from '../types';

interface ImportSummary {
    totalRows: number;
    insertedRows: number;
    skippedRows: number;
    failedRows: number;
}

const INITIAL_FILTERS = {
    adi: '',
    soyadi: '',
    acenta: '',
    giris_tarihi: '',
    giris_saati: ''
};

export default function GuestRegistry() {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);

    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [scrollbarSpacerWidth, setScrollbarSpacerWidth] = useState(0);
    const [records, setRecords] = useState<GuestRegistryRecord[]>([]);
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [dateInputValue, setDateInputValue] = useState('');
    const [timeInputValue, setTimeInputValue] = useState('');
    const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const [debouncedFilters, setDebouncedFilters] = useState(INITIAL_FILTERS);

    const fetchRecords = async (activeFilters = INITIAL_FILTERS) => {
        setLoading(true);
        try {
            const response = await api.get('/guest-registry/records', {
                params: {
                    ...activeFilters,
                    page: 1,
                    limit: 300
                }
            });

            setRecords(response.data?.data || []);
        } catch (error) {
            console.error('Misafir kayitlari yuklenemedi:', error);
            alert('Misafir kayitlari yuklenemedi');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedFilters(filters);
        }, 300);

        return () => clearTimeout(timer);
    }, [filters]);

    useEffect(() => {
        const hasActive = Object.values(debouncedFilters).some((value) => value.trim() !== '');
        setHasSearched(hasActive);
        fetchRecords(debouncedFilters);
    }, [debouncedFilters]);

    const onReset = async () => {
        setHasSearched(false);
        setFilters(INITIAL_FILTERS);
        setDateInputValue('');
        setTimeInputValue('');
    };

    const onUploadClick = () => {
        fileInputRef.current?.click();
    };

    const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;

        const fileName = selectedFile.name.toLowerCase();
        if (!fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
            alert('Sadece Excel dosyalari (.xls, .xlsx) yuklenebilir');
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

            alert('Excel yukleme tamamlandi');
            await fetchRecords(filters);
        } catch (error: any) {
            console.error('Excel yuklenemedi:', error);
            const apiMessage = error?.response?.data?.message;
            alert(apiMessage || 'Excel yukleme sirasinda hata olustu');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const hasActiveFilters = useMemo(() => {
        return Object.values(filters).some((value) => value.trim() !== '');
    }, [filters]);

    const existenceMessage = useMemo(() => {
        if (!hasSearched) return null;
        if (records.length > 0) {
            return `${records.length} kayit bulundu`;
        }
        return 'Aranan kriterlere gore kayit bulunamadi';
    }, [hasSearched, records.length]);

    const formatDisplayDate = (value: string | null | undefined): string => {
        if (!value) return '-';

        const text = String(value).trim();
        const parsedDate = new Date(text);
        if (!Number.isNaN(parsedDate.getTime())) {
            const day = String(parsedDate.getDate()).padStart(2, '0');
            const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
            const year = parsedDate.getFullYear();
            return `${day}.${month}.${year}`;
        }

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

        return text;
    };

    const formatDisplayTime = (value: string | null | undefined): string => {
        if (!value) return '-';

        const text = String(value).trim();
        const hhmmssMatch = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (hhmmssMatch) {
            const hour = hhmmssMatch[1].padStart(2, '0');
            const minute = hhmmssMatch[2];
            return `${hour}:${minute}`;
        }

        const dotTimeMatch = text.match(/^(\d{1,2})\.(\d{2})(?:\.\d{2})?$/);
        if (dotTimeMatch) {
            const hour = dotTimeMatch[1].padStart(2, '0');
            const minute = dotTimeMatch[2];
            return `${hour}:${minute}`;
        }

        return text;
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
    }, [records.length, loading]);

    const syncTableScroll = () => {
        const tableNode = tableScrollRef.current;
        const barNode = bottomScrollRef.current;

        if (!tableNode || !barNode) return;
        if (barNode.scrollLeft !== tableNode.scrollLeft) {
            barNode.scrollLeft = tableNode.scrollLeft;
        }
    };

    const syncBottomScroll = () => {
        const tableNode = tableScrollRef.current;
        const barNode = bottomScrollRef.current;

        if (!tableNode || !barNode) return;
        if (tableNode.scrollLeft !== barNode.scrollLeft) {
            tableNode.scrollLeft = barNode.scrollLeft;
        }
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
                    Toplam: <span className="font-bold text-gray-900">{records.length}</span> kayit
                </div>

                {lastSummary && (
                    <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        Toplam satir: {lastSummary.totalRows} | Eklenen: {lastSummary.insertedRows} | Atlanan: {lastSummary.skippedRows} | Hatali: {lastSummary.failedRows}
                    </div>
                )}

                <div className="w-full bg-white rounded-lg shadow-md p-4 sm:p-5 mb-2">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-base font-bold text-gray-900">Filtreler</h2>
                        <button
                            onClick={onReset}
                            disabled={loading || uploading || !hasActiveFilters}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                            Temizle
                        </button>
                    </div>

                    <div className="flex flex-nowrap items-end gap-3 overflow-x-auto">
                        <div className="min-w-[170px] sm:min-w-[180px] flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Isim</label>
                            <input
                                type="text"
                                value={filters.adi}
                                onChange={(e) => setFilters((prev) => ({ ...prev, adi: e.target.value }))}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="min-w-[170px] sm:min-w-[180px] flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Soyisim</label>
                            <input
                                type="text"
                                value={filters.soyadi}
                                onChange={(e) => setFilters((prev) => ({ ...prev, soyadi: e.target.value }))}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="min-w-[170px] sm:min-w-[180px] flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Acenta</label>
                            <input
                                type="text"
                                value={filters.acenta}
                                onChange={(e) => setFilters((prev) => ({ ...prev, acenta: e.target.value }))}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="min-w-[170px] sm:min-w-[180px] flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Giris Tarihi</label>
                            <input
                                type="date"
                                value={dateInputValue}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setDateInputValue(value);
                                    setFilters((prev) => ({ ...prev, giris_tarihi: value }));
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="min-w-[170px] sm:min-w-[180px] flex-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Giris Saati</label>
                            <input
                                type="time"
                                value={timeInputValue}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setTimeInputValue(value);
                                    setFilters((prev) => ({ ...prev, giris_saati: value }));
                                }}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
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
                        <div className="text-center py-12 text-gray-500">Kayit bulunamadi</div>
                    ) : (
                        <div
                            ref={tableScrollRef}
                            onScroll={syncTableScroll}
                            className="h-full min-h-0 overflow-x-scroll overflow-y-auto pb-2"
                        >
                            <div className="min-h-full">
                                <table className="w-full min-w-[1900px] table-auto divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hitap</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adi</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Soyadi</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giris Tarihi</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giris Saati</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cikis Tarihi</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yetiskin</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cocuk</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Free</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konaklama</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Oda</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Geceleme</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Istenen</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verilen</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Voucher</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acenta</th>
                                            <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ulke</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {records.map((record) => (
                                            <tr key={record.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.hitap || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.adi || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.soyadi || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDisplayDate(record.giris_tarihi)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDisplayTime(record.giris_saati)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{formatDisplayDate(record.cikis_tarihi)}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.yetiskin || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.cocuk || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.free || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.konaklama || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.oda || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.geceleme || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.istenen || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.verilen || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{record.voucher || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.acenta || '-'}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{record.ulke || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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
