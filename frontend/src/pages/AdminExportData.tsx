import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker, message } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import api from '../utils/api';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import { ArrowLeft, Calendar, FileText, Check, AlertTriangle, ShieldCheck, Download, Users, Car, Flame, FileDown } from 'lucide-react';

const { RangePicker } = DatePicker;

dayjs.locale('tr');

interface RecordCounts {
    managers: number;
    vehicles: number;
    visitors: number;
    fireAlarms: number;
    incidents: number;
}

interface PreviewData {
    counts: RecordCounts;
    totalDays: number;
    totalRecords: number;
}

export default function AdminExportData() {
    const navigate = useNavigate();
    const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>([dayjs().subtract(7, 'day'), dayjs()]);
    const [loading, setLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);

    const startDate = dateRange?.[0] || null;
    const endDate = dateRange?.[1] || null;

    // Rapor seçimleri
    const [selectedReports, setSelectedReports] = useState({
        managers: true,
        vehicles: true,
        visitors: true,
        fireAlarms: true,
        incidents: true
    });

    const reportMetadata = {
        managers: {
            label: 'Müdür Giriş/Çıkış Kayıtları',
            icon: ShieldCheck,
            colorClass: 'text-indigo-600 border-indigo-200 bg-indigo-50/50',
            activeColorClass: 'border-blue-500 bg-blue-50/40 text-blue-900 ring-1 ring-blue-500/10'
        },
        vehicles: {
            label: 'Araç Kayıtları',
            icon: Car,
            colorClass: 'text-blue-600 border-blue-200 bg-blue-50/50',
            activeColorClass: 'border-blue-500 bg-blue-50/40 text-blue-900 ring-1 ring-blue-500/10'
        },
        visitors: {
            label: 'Ziyaretçi Kayıtları',
            icon: Users,
            colorClass: 'text-emerald-600 border-emerald-200 bg-emerald-50/50',
            activeColorClass: 'border-blue-500 bg-blue-50/40 text-blue-900 ring-1 ring-blue-500/10'
        },
        fireAlarms: {
            label: 'Yangın Alarm Kayıtları',
            icon: Flame,
            colorClass: 'text-rose-600 border-rose-200 bg-rose-50/50',
            activeColorClass: 'border-blue-500 bg-blue-50/40 text-blue-900 ring-1 ring-blue-500/10'
        },
        incidents: {
            label: 'Olay / Vardiya Kayıtları',
            icon: FileText,
            colorClass: 'text-amber-600 border-amber-200 bg-amber-50/50',
            activeColorClass: 'border-blue-500 bg-blue-50/40 text-blue-900 ring-1 ring-blue-500/10'
        }
    };

    // Önizleme getir
    const fetchPreview = useCallback(async () => {
        if (!startDate || !endDate) {
            message.warning('Lütfen tarih aralığı seçin');
            return;
        }

        setPreviewLoading(true);
        setPreviewError(null);
        try {
            const response = await api.get('/export/preview', {
                params: {
                    startDate: startDate.format('YYYY-MM-DD'),
                    endDate: endDate.format('YYYY-MM-DD')
                }
            });

            if (response.data.success) {
                setPreview(response.data.data);
            }
        } catch (error: any) {
            console.error('Preview error:', error);
            const errorMessage = error.response?.data?.message || 'Önizleme verileri yüklenirken hata oluştu.';
            setPreviewError(errorMessage);
        } finally {
            setPreviewLoading(false);
        }
    }, [startDate, endDate]);

    useRealtimeRefetch({
        topics: ['dashboard', 'incidents', 'sgk', 'export'],
        onMutation: async () => {
            if (preview) {
                await fetchPreview();
            }
        },
    });

    // Export indir
    const handleExport = async () => {
        if (!startDate || !endDate) {
            message.warning('Lütfen tarih aralığı seçin');
            return;
        }

        const hasSelectedReport = Object.values(selectedReports).some(v => v);
        if (!hasSelectedReport) {
            message.warning('Lütfen en az bir rapor türü seçin');
            return;
        }

        setDownloading(true);
        setDownloadProgress(0);
        setError(null);

        try {
            const response = await api.post(
                '/export/generate',
                {
                    startDate: startDate.format('YYYY-MM-DD'),
                    endDate: endDate.format('YYYY-MM-DD'),
                    reports: selectedReports
                },
                {
                    responseType: 'blob',
                    timeout: 300000,
                    onDownloadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            setDownloadProgress(progress);
                        } else {
                            setDownloadProgress(prev => Math.min(prev + 5, 90));
                        }
                    }
                }
            );

            if (response.data.type === 'application/json') {
                const text = await response.data.text();
                const json = JSON.parse(text);
                throw new Error(json.message || 'Sunucu hatası');
            }

            const blob = new Blob([response.data], { type: 'application/zip' });

            if (blob.size < 100) {
                const text = await blob.text();
                try {
                    const json = JSON.parse(text);
                    throw new Error(json.message || 'İndirme başarısız');
                } catch (e) {
                    // Ignore syntax errors
                }
            }

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Guvenlik_Kayitlari_${startDate.format('DD-MM-YYYY')}_${endDate.format('DD-MM-YYYY')}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            setDownloadProgress(100);
            setTimeout(() => {
                message.success('İndirme başarıyla tamamlandı!');
            }, 500);
        } catch (error: any) {
            console.error('Export error:', error);
            let errorMessage = 'İndirme sırasında bir hata oluştu.';

            if (error.code === 'ECONNABORTED') {
                errorMessage = 'İstek zaman aşımına uğradı. Daha kısa bir tarih aralığı deneyin.';
            } else if (error.response?.data instanceof Blob) {
                try {
                    const text = await error.response.data.text();
                    const json = JSON.parse(text);
                    errorMessage = json.message || 'Sunucu hatası oluştu.';
                } catch {
                    errorMessage = 'Sunucu hatası oluştu. Lütfen tekrar deneyin.';
                }
            } else if (error.message) {
                errorMessage = error.message;
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            }

            setError(errorMessage);
            setDownloadProgress(0);
        } finally {
            setDownloading(false);
        }
    };

    const handleReportToggle = (key: string) => {
        setSelectedReports(prev => ({
            ...prev,
            [key]: !prev[key as keyof typeof prev]
        }));
    };

    const handleSelectAll = (selectAll: boolean) => {
        setSelectedReports({
            managers: selectAll,
            vehicles: selectAll,
            visitors: selectAll,
            fireAlarms: selectAll,
            incidents: selectAll
        });
    };

    const allSelected = Object.values(selectedReports).every(v => v);
    const noneSelected = Object.values(selectedReports).every(v => !v);

    // Hızlı tarih presets
    const applyPreset = (days: number) => {
        setDateRange([dayjs().subtract(days, 'day'), dayjs()]);
        setPreview(null);
    };

    const applyMonthPreset = () => {
        setDateRange([dayjs().startOf('month'), dayjs()]);
        setPreview(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
                    <div className="flex items-center gap-4 min-w-0">
                        <button
                            type="button"
                            onClick={() => navigate('/admin/dashboard')}
                            className="p-2.5 hover:bg-slate-800 rounded-xl transition shrink-0 border border-slate-700/60 bg-slate-800/45 text-slate-300 hover:text-white"
                            title="Geri Dön"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="min-w-0">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight break-words">
                                Veri Dışa Aktarma Merkezi
                            </h1>
                            <p className="text-sm text-slate-300 mt-1">
                                Belirtilen tarih aralığındaki tüm güvenlik kayıtlarını Excel (XLSX) formatında paketlenmiş olarak indirin.
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 max-w-5xl mx-auto">
                
                {/* Tarih Seçimi Kartı */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 shadow-sm">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                        <Calendar className="w-4.5 h-4.5 text-blue-500" />
                        Tarih Filtresi & Zaman Aralığı
                    </h2>
                    
                    <div className="space-y-4">
                        <div className="flex flex-col gap-3">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tarih Aralığı Seçin</label>
                            <div className="custom-range-picker-wrapper">
                                <RangePicker
                                    value={dateRange}
                                    onChange={(dates) => {
                                        if (dates && dates[0] && dates[1]) {
                                            setDateRange([dates[0], dates[1]]);
                                        } else {
                                            setDateRange(null);
                                        }
                                        setPreview(null);
                                    }}
                                    format="DD.MM.YYYY"
                                    placeholder={['Başlangıç Tarihi', 'Bitiş Tarihi']}
                                    className="w-full bg-white border-gray-300 hover:border-gray-400 text-gray-900 rounded-xl py-2.5 focus:border-blue-500"
                                    disabledDate={(current) => current && current > dayjs().endOf('day')}
                                />
                            </div>
                        </div>

                        {/* Hızlı Seçim Preset Butonları */}
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                            <span className="text-xs text-gray-400 mr-1">Hızlı Seçim:</span>
                            <button
                                type="button"
                                onClick={() => applyPreset(7)}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-250 border border-gray-200 hover:border-gray-300 rounded-lg text-xs font-medium text-gray-700 transition-all"
                            >
                                Son 7 Gün
                            </button>
                            <button
                                type="button"
                                onClick={() => applyPreset(30)}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-250 border border-gray-200 hover:border-gray-300 rounded-lg text-xs font-medium text-gray-700 transition-all"
                            >
                                Son 30 Gün
                            </button>
                            <button
                                type="button"
                                onClick={() => applyPreset(90)}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-250 border border-gray-200 hover:border-gray-300 rounded-lg text-xs font-medium text-gray-700 transition-all"
                            >
                                Son 90 Gün
                            </button>
                            <button
                                type="button"
                                onClick={applyMonthPreset}
                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-250 border border-gray-200 hover:border-gray-300 rounded-lg text-xs font-medium text-gray-700 transition-all"
                            >
                                Bu Ay
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end border-t border-gray-150 pt-4">
                        <button
                            onClick={fetchPreview}
                            disabled={previewLoading || !startDate || !endDate}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors text-sm shadow-sm"
                        >
                            {previewLoading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Önizleme Yükleniyor...
                                </>
                            ) : (
                                <>
                                    Veri Önizleme Getir
                                </>
                            )}
                        </button>
                    </div>

                    {/* Önizleme Hata Bildirimi */}
                    {previewError && (
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3.5 text-red-800">
                            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <span className="font-bold text-red-800 block text-sm">Önizleme Alınamadı</span>
                                <p className="text-red-750 text-xs mt-1 leading-relaxed">{previewError}</p>
                            </div>
                            <button
                                onClick={() => setPreviewError(null)}
                                className="text-red-500 hover:text-red-700"
                            >
                                &times;
                            </button>
                        </div>
                    )}
                </div>

                {/* Rapor Seçimi Kartı */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 border-b border-gray-150 pb-3">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                            <FileText className="w-4.5 h-4.5 text-blue-500" />
                            İndirilecek Kayıt Türleri
                        </h2>
                        
                        <div className="flex items-center gap-3 text-xs">
                            <button
                                type="button"
                                onClick={() => handleSelectAll(true)}
                                disabled={allSelected}
                                className="font-semibold text-blue-600 hover:text-blue-700 disabled:text-gray-400 transition"
                            >
                                Tümünü Seç
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                                type="button"
                                onClick={() => handleSelectAll(false)}
                                disabled={noneSelected}
                                className="font-semibold text-red-650 hover:text-red-750 disabled:text-gray-400 transition"
                            >
                                Tümünü Temizle
                            </button>
                        </div>
                    </div>

                    {/* Report Types Card Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {Object.entries(reportMetadata).map(([key, meta]) => {
                            const isSelected = selectedReports[key as keyof typeof selectedReports];
                            const IconComponent = meta.icon;
                            const count = preview?.counts[key as keyof RecordCounts] ?? null;

                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => handleReportToggle(key)}
                                    className={`text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between gap-4 group cursor-pointer ${
                                        isSelected 
                                            ? meta.activeColorClass 
                                            : 'border-gray-250 bg-white hover:border-gray-300 hover:bg-gray-50/50 text-gray-600'
                                    }`}
                                >
                                    <div className="flex items-center gap-3.5 min-w-0">
                                        <div className={`p-2.5 rounded-lg border shrink-0 transition-transform group-hover:scale-105 ${
                                            isSelected ? 'bg-blue-100 border-blue-200 text-blue-600' : 'bg-gray-50 border-gray-200 text-gray-400'
                                        }`}>
                                            <IconComponent className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className={`block font-semibold text-sm ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                                                {meta.label}
                                            </span>
                                            <span className="text-[10px] text-gray-400 block mt-0.5">XLSX formatında dışa aktarma</span>
                                        </div>
                                    </div>

                                    {/* Record counts badges */}
                                    <div className="shrink-0 flex items-center gap-2">
                                        {count !== null && (
                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                                                isSelected 
                                                    ? 'bg-blue-100 border-blue-250 text-blue-800' 
                                                    : 'bg-gray-105 border-gray-200 text-gray-500'
                                            }`}>
                                                {count} kayıt
                                            </span>
                                        )}
                                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                            isSelected 
                                                ? 'bg-blue-500 border-blue-400 text-white' 
                                                : 'border-gray-300 bg-white'
                                        }`}>
                                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Önizleme İstatistik Paneli */}
                {preview && (
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm animate-fadeIn">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
                            Önizleme & Dosya Analizi
                        </h2>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="bg-gray-50 border border-gray-150 rounded-xl p-4 text-center">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Zaman Dilimi</span>
                                <span className="block text-2xl font-extrabold text-slate-800 mt-1">{preview.totalDays} Gün</span>
                            </div>
                            
                            <div className="bg-gray-50 border border-gray-150 rounded-xl p-4 text-center">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Veritabanı Toplam</span>
                                <span className="block text-2xl font-extrabold text-blue-700 mt-1">{preview.totalRecords}</span>
                            </div>

                            <div className="bg-gray-50 border border-gray-150 rounded-xl p-4 text-center">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seçili Dosyalar</span>
                                <span className="block text-2xl font-extrabold text-indigo-700 mt-1">
                                    {Object.values(selectedReports).filter(v => v).length} / 5
                                </span>
                            </div>

                            <div className="bg-gray-50 border border-gray-150 rounded-xl p-4 text-center">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">İndirilecek Toplam Satır</span>
                                <span className="block text-2xl font-extrabold text-emerald-700 mt-1">
                                    {Object.entries(selectedReports)
                                        .filter(([_, selected]) => selected)
                                        .reduce((sum, [key]) => sum + preview.counts[key as keyof RecordCounts], 0)}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* İndirme Aksiyon Kartı */}
                <div className="bg-white border border-gray-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-4">
                    
                    {/* Hata Bildirimi */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3.5 text-red-800 animate-fadeIn">
                            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
                            <div className="flex-1">
                                <span className="font-bold text-red-800 block text-sm">İndirme İşlemi Başarısız</span>
                                <p className="text-red-750 text-xs mt-1 leading-relaxed">{error}</p>
                                <p className="text-red-400/80 text-[10px] mt-2">Daha küçük bir tarih aralığı seçip tekrar deneyin veya sunucu durumunu kontrol edin.</p>
                            </div>
                            <button
                                onClick={() => setError(null)}
                                className="text-red-500 hover:text-red-755 shrink-0"
                            >
                                &times;
                            </button>
                        </div>
                    )}

                    {/* Progress Bar */}
                    {downloading && (
                        <div className="bg-slate-50 border border-gray-150 rounded-xl p-4 animate-pulse">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold text-slate-500">Veritabanı arşivleniyor ve sıkıştırılıyor...</span>
                                <span className="text-sm font-bold text-blue-600">%{downloadProgress}</span>
                            </div>
                            <div className="w-full bg-gray-205 rounded-full h-2.5 overflow-hidden p-0.5 border border-gray-200">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-300 shadow-sm"
                                    style={{ width: `${downloadProgress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleExport}
                        disabled={downloading || !startDate || !endDate || noneSelected}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-base disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2.5 shadow-sm"
                    >
                        {downloading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Paket Dosyası Hazırlanıyor...
                            </>
                        ) : (
                            <>
                                <Download className="w-5 h-5" />
                                Seçili Raporları ZIP Olarak İndir (Excel)
                            </>
                        )}
                    </button>
                    <p className="text-center text-xs text-gray-500">
                        Seçilen tablolar ayrı ayrı Excel sayfaları haline getirilip tek bir <span className="font-mono text-gray-600">.zip</span> arşivi olarak sunulur.
                    </p>
                </div>
            </main>
        </div>
    );
}
