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

    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
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

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4">
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

                <div className="bg-white rounded-lg shadow overflow-hidden w-full flex-1 min-h-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">Kayit bulunamadi</div>
                    ) : (
                        <div className="h-full min-h-0 overflow-x-auto overflow-y-auto">
                            <div className="min-h-full">
                                <table className="w-full min-w-full table-fixed divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="w-[70px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Hitap</th>
                                            <th className="w-[130px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Adi</th>
                                            <th className="w-[130px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Soyadi</th>
                                            <th className="w-[110px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Giris Tarihi</th>
                                            <th className="w-[90px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Giris Saati</th>
                                            <th className="w-[110px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Cikis Tarihi</th>
                                            <th className="w-[70px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Yetiskin</th>
                                            <th className="w-[60px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Cocuk</th>
                                            <th className="w-[60px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Free</th>
                                            <th className="w-[110px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Konaklama</th>
                                            <th className="w-[90px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Oda</th>
                                            <th className="w-[90px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Geceleme</th>
                                            <th className="w-[90px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Istenen</th>
                                            <th className="w-[90px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Verilen</th>
                                            <th className="w-[90px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Voucher</th>
                                            <th className="w-[120px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Acenta</th>
                                            <th className="w-[100px] px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 border-r border-gray-200 last:border-r-0">Ulke</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {records.map((record) => (
                                            <tr key={record.id} className="hover:bg-blue-50/40 even:bg-gray-50/40">
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0 break-words">{record.hitap || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0 break-words">{record.adi || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0 break-words">{record.soyadi || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0">{formatDisplayDate(record.giris_tarihi)}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0">{formatDisplayTime(record.giris_saati)}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0">{formatDisplayDate(record.cikis_tarihi)}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0">{record.yetiskin || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0">{record.cocuk || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0">{record.free || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0 break-words">{record.konaklama || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0 break-words">{record.oda || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0 break-words">{record.geceleme || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0 break-words">{record.istenen || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0 break-words">{record.verilen || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-gray-900 border-r border-gray-100 last:border-r-0 break-words">{record.voucher || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0 break-words">{record.acenta || '-'}</td>
                                                <td className="px-3 py-3 text-sm text-gray-700 border-r border-gray-100 last:border-r-0 break-words">{record.ulke || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
