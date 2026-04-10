import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DatePicker } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import { API_URL } from '../constants';

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

    const reportLabels: Record<string, string> = {
        managers: 'Müdür Giriş/Çıkış Kayıtları',
        vehicles: 'Araç Kayıtları',
        visitors: 'Ziyaretçi Kayıtları',
        fireAlarms: 'Yangın Alarm Kayıtları',
        incidents: 'Vardiya Raporları (Olay Kayıtları)'
    };

    // Önizleme getir
    const fetchPreview = async () => {
        if (!startDate || !endDate) {
            alert('Lütfen tarih aralığı seçin');
            return;
        }

        setPreviewLoading(true);
        setPreviewError(null);
        try {
            const token = localStorage.getItem('adminToken');
            const response = await axios.get(`${API_URL}/export/preview`, {
                params: {
                    startDate: startDate.format('YYYY-MM-DD'),
                    endDate: endDate.format('YYYY-MM-DD')
                },
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setPreview(response.data.data);
            }
        } catch (error: any) {
            console.error('Preview error:', error);
            const errorMessage = error.response?.data?.message || 'Önizleme yüklenirken hata oluştu. Sunucu bağlantısını kontrol edin.';
            setPreviewError(errorMessage);
        } finally {
            setPreviewLoading(false);
        }
    };

    // Export indir
    const handleExport = async () => {
        if (!startDate || !endDate) {
            alert('Lütfen tarih aralığı seçin');
            return;
        }

        const hasSelectedReport = Object.values(selectedReports).some(v => v);
        if (!hasSelectedReport) {
            alert('Lütfen en az bir rapor türü seçin');
            return;
        }

        setDownloading(true);
        setDownloadProgress(0);
        setError(null);

        try {
            const token = localStorage.getItem('adminToken');

            const response = await axios.post(
                `${API_URL}/export/generate`,
                {
                    startDate: startDate.format('YYYY-MM-DD'),
                    endDate: endDate.format('YYYY-MM-DD'),
                    reports: selectedReports
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'blob',
                    timeout: 300000, // 5 dakika timeout
                    onDownloadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            setDownloadProgress(progress);
                        } else {
                            // Total bilinmiyorsa, yükleme yapıldığını göster
                            setDownloadProgress(prev => Math.min(prev + 5, 90));
                        }
                    }
                }
            );

            // Response'un error olup olmadığını kontrol et
            // Blob olarak gelen hata mesajını kontrol et
            if (response.data.type === 'application/json') {
                const text = await response.data.text();
                const json = JSON.parse(text);
                throw new Error(json.message || 'Sunucu hatası');
            }

            // Dosyayı indir
            const blob = new Blob([response.data], { type: 'application/zip' });

            // Blob boyutunu kontrol et - çok küçükse muhtemelen hata mesajı
            if (blob.size < 100) {
                const text = await blob.text();
                try {
                    const json = JSON.parse(text);
                    throw new Error(json.message || 'İndirme başarısız');
                } catch (e) {
                    if (e instanceof SyntaxError) {
                        // JSON değilse devam et
                    } else {
                        throw e;
                    }
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
                alert('İndirme başarıyla tamamlandı!');
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

    // Checkbox değişimi
    const handleReportToggle = (key: string) => {
        setSelectedReports(prev => ({
            ...prev,
            [key]: !prev[key as keyof typeof prev]
        }));
    };

    // Tümünü seç/kaldır
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

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
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
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Veri Dışa Aktarma</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Güvenlik kayıtlarını Excel formatında indirin</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4">
                {/* Tarih Seçimi */}
                <div className="bg-white rounded-lg shadow px-3 py-2 w-full">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Tarih Aralığı
                    </h2>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tarih Aralığı</label>
                        <RangePicker
                            value={dateRange}
                            onChange={(dates) => {
                                if (dates && dates[0] && dates[1]) {
                                    setDateRange([dates[0], dates[1]]);
                                } else {
                                    setDateRange(null);
                                }
                            }}
                            format="DD.MM.YYYY"
                            placeholder={['Başlangıç', 'Bitiş']}
                            className="w-full"
                            disabledDate={(current) => current && current > dayjs().endOf('day')}
                        />
                    </div>
                    <div className="mt-4 flex justify-stretch sm:justify-end">
                        <button
                            onClick={fetchPreview}
                            disabled={previewLoading || !startDate || !endDate}
                            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                            {previewLoading ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Yükleniyor...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    Önizleme
                                </>
                            )}
                        </button>
                    </div>

                    {/* Önizleme Hata Mesajı */}
                    {previewError && (
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="text-red-800 font-medium">Önizleme Hatası</p>
                                <p className="text-red-600 text-sm mt-1">{previewError}</p>
                            </div>
                            <button
                                onClick={() => setPreviewError(null)}
                                className="ml-auto text-red-400 hover:text-red-600"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                {/* Rapor Seçimi */}
                <div className="bg-white rounded-lg shadow px-3 py-2 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            İndirilecek Raporlar
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleSelectAll(true)}
                                disabled={allSelected}
                                className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                            >
                                Tümünü Seç
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                                onClick={() => handleSelectAll(false)}
                                disabled={noneSelected}
                                className="text-sm text-red-600 hover:text-red-800 disabled:text-gray-400"
                            >
                                Tümünü Kaldır
                            </button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {Object.entries(reportLabels).map(([key, label]) => (
                            <label
                                key={key}
                                className="flex items-start sm:items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedReports[key as keyof typeof selectedReports]}
                                    onChange={() => handleReportToggle(key)}
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <span className="text-gray-700 flex-1">{label}</span>
                                {preview && (
                                    <span className="text-xs sm:text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded shrink-0">
                                        {preview.counts[key as keyof RecordCounts]} kayıt
                                    </span>
                                )}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Önizleme Sonuçları */}
                {preview && (
                    <div className="bg-white rounded-lg shadow px-3 py-2 w-full">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            Önizleme
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-blue-50 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-blue-600">{preview.totalDays}</div>
                                <div className="text-sm text-gray-600">Gün</div>
                            </div>
                            <div className="bg-green-50 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-green-600">{preview.totalRecords}</div>
                                <div className="text-sm text-gray-600">Toplam Kayıt</div>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-purple-600">
                                    {Object.values(selectedReports).filter(v => v).length}
                                </div>
                                <div className="text-sm text-gray-600">Seçili Rapor</div>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-4 text-center">
                                <div className="text-2xl font-bold text-orange-600">
                                    {Object.entries(selectedReports)
                                        .filter(([_, selected]) => selected)
                                        .reduce((sum, [key]) => sum + preview.counts[key as keyof RecordCounts], 0)}
                                </div>
                                <div className="text-sm text-gray-600">İndirilecek</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* İndirme Butonu */}
                <div className="bg-white rounded-lg shadow px-3 py-2 w-full">
                    {/* Hata Mesajı */}
                    {error && (
                        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                            <svg className="w-6 h-6 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div className="flex-1">
                                <p className="text-red-800 font-semibold">İndirme Başarısız</p>
                                <p className="text-red-600 text-sm mt-1">{error}</p>
                                <p className="text-red-500 text-xs mt-2">Lütfen tarih aralığını kontrol edip tekrar deneyin veya sistem yöneticisine başvurun.</p>
                            </div>
                            <button
                                onClick={() => setError(null)}
                                className="text-red-400 hover:text-red-600 flex-shrink-0"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    )}

                    {downloading && (
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-gray-600">İndiriliyor...</span>
                                <span className="text-sm font-medium text-blue-600">{downloadProgress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${downloadProgress}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleExport}
                        disabled={downloading || !startDate || !endDate || noneSelected}
                        className="w-full py-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-lg font-semibold text-lg disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                    >
                        {downloading ? (
                            <>
                                <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                İndiriliyor...
                            </>
                        ) : (
                            <>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Excel Olarak İndir
                            </>
                        )}
                    </button>
                    <p className="text-center text-sm text-gray-500 mt-3">
                        Veriler ZIP dosyası içinde yıl/ay/gün klasör yapısıyla indirilecektir
                    </p>
                </div>

            </main>
        </div>
    );
}
