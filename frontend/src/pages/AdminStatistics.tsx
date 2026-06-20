import { useState, useEffect } from 'react';
import {
    Users, Car, Flame, TrendingUp, TrendingDown,
    RefreshCw, Download, X, Check
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import api from '../utils/api';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';

// Sub-components
import OverviewTab from '../components/statistics/OverviewTab';
import VisitorsTab from '../components/statistics/VisitorsTab';
import VehiclesTab from '../components/statistics/VehiclesTab';
import FireAlarmsTab from '../components/statistics/FireAlarmsTab';
import IncidentsTab from '../components/statistics/IncidentsTab';

// Color Palette
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
const CHART_COLORS = {
    primary: '#3B82F6',
    secondary: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6'
};

const OVERVIEW_CHARTS = [
    { id: 'comparison', label: '📊 Dönemsel Karşılaştırma' },
    { id: 'visitor-trend', label: '👥 Ziyaretçi Trendi' },
    { id: 'vehicle-trend', label: '🚗 Araç Kullanım Trendi' },
    { id: 'incident-distribution', label: '🚨 Olay Kategori Dağılımı' },
    { id: 'busy-days-visitor', label: '🏆 Ziyaretçi - En Yoğun Günler' },
    { id: 'busy-days-vehicle', label: '🚗 Araç - En Yoğun Günler' },
    { id: 'daily-averages', label: '📊 Günlük Ortalamalar' }
];

const VISITOR_CHARTS = [
    { id: 'visitor-daily-trend', label: '👥 Günlük Ziyaretçi Trendi' },
    { id: 'visitor-hourly-distribution', label: '🕐 Saatlik Dağılım' },
    { id: 'visitor-duration-stats', label: '⏱️ Ziyaret Süresi İstatistikleri' },
    { id: 'visitor-duration-distribution', label: '📊 Ziyaret Süresi Dağılımı' },
    { id: 'visitor-top-managers', label: '👤 En Çok Ziyaretçi Alan Kişiler' },
    { id: 'visitor-category-comparison', label: '📊 Ziyaretçi Kategori Dağılımı' },
    { id: 'visitor-busy-days', label: '🏆 En Yoğun Günler' },
    { id: 'visitor-total-stats', label: '📋 Toplam İstatistikler' }
];

const VEHICLE_CHARTS = [
    { id: 'vehicle-daily-trend', label: '🚗 Günlük Araç Kullanım Trendi' },
    { id: 'vehicle-top-vehicles', label: '🔝 En Çok Kullanılan Araçlar' },
    { id: 'vehicle-top-managers', label: '👤 En Çok Araç Alan Yöneticiler' },
    { id: 'vehicle-top-destinations', label: '📍 En Çok Gidilen Yerler' },
    { id: 'vehicle-hourly-heatmap', label: '🔥 Araç Kullanım Yoğunluğu (Isı Haritası)' },
    { id: 'vehicle-destinations-cloud', label: '☁️ Hedef Lokasyonlar (Kelime Bulutu)' }
];

const FIRE_ALARM_CHARTS = [
    { id: 'fire-alarm-locations-cloud', label: '☁️ Alarm Lokasyonları (Kelime Bulutu)' },
    { id: 'fire-alarm-locations-chart', label: '📍 En Çok Alarm Olan Lokasyonlar' },
    { id: 'fire-alarm-daily-trend', label: '📈 Alarm Sayısı (Günlük)' },
    { id: 'fire-alarm-hourly-trend', label: '🕔 Saatlik Alarm Çalma Trendi' }
];

const INCIDENT_CHARTS = [
    { id: 'incident-category-distribution', label: '📊 Kategori Bazlı Olay Dağılımı' },
    { id: 'incident-theft', label: '🚨 Hırsızlık Kategorileri' },
    { id: 'incident-assault', label: '👊 Saldırı & Kavga Kategorileri' },
    { id: 'incident-medical', label: '⚕️ Tıbbi Acil Kategorileri' },
    { id: 'incident-vandalism', label: '🔨 Vandalizm & Hasar Kategorileri' },
    { id: 'incident-accident', label: '🚑 Kaza/Yaralanma Kategorileri' },
    { id: 'incident-substance', label: '💊 Madde Kullanımı Kategorileri' }
];

const AdminStatistics = () => {
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [activeTab, setActiveTab] = useState<'overview' | 'visitors' | 'vehicles' | 'fire-alarms' | 'incidents'>('overview');
    const [showExportModal, setShowExportModal] = useState(false);
    const [selectedCharts, setSelectedCharts] = useState<string[]>([]);
    const [isMobileViewport, setIsMobileViewport] = useState(false);
    const [refetchKey, setRefetchKey] = useState(0);

    // Realtime refetch setup
    useRealtimeRefetch({
        topics: ['dashboard', 'incidents', 'sgk'],
        onMutation: () => setRefetchKey(prev => prev + 1),
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const updateViewport = () => setIsMobileViewport(window.innerWidth < 768);
        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, []);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('-') && dateStr.length === 10) {
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}`;
        }
        if (dateStr.length === 7) {
            const [year, month] = dateStr.split('-');
            const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
            return `${months[parseInt(month) - 1]} ${year.slice(2)}`;
        }
        return dateStr;
    };

    const getRangeDays = () => {
        if (!startDate || !endDate) return 30;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const getDaysLabel = () => {
        const formatStr = (dateStr: string) => {
            if (!dateStr) return '';
            const [year, month, day] = dateStr.split('-');
            return `${day}/${month}/${year}`;
        };
        return `${formatStr(startDate)} - ${formatStr(endDate)}`;
    };

    const getComparisonLabel = () => {
        const daysCount = getRangeDays();
        if (daysCount <= 14) return { current: 'Bu Hafta', previous: 'Geçen Hafta', type: 'weekly' };
        if (daysCount <= 60) return { current: 'Bu Ay', previous: 'Geçen Ay', type: 'monthly' };
        if (daysCount <= 180) return { current: 'Bu Dönem', previous: 'Önceki Dönem', type: 'quarterly' };
        return { current: 'Bu Yıl', previous: 'Geçen Yıl', type: 'yearly' };
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-700">{formatDate(label)}</p>
                    {payload.map((entry: any, index: number) => {
                        let displayName = entry.name;
                        if (label === 'Şarj İstasyonu' && entry.name === 'Ziyaret Sayısı') {
                            displayName = 'Araç Sayısı';
                        }
                        return (
                            <p key={index} className="text-sm" style={{ color: entry.color }}>
                                {displayName}: {entry.value.toLocaleString('tr-TR')}
                            </p>
                        );
                    })}
                </div>
            );
        }
        return null;
    };

    const getAvailableCharts = () => {
        switch (activeTab) {
            case 'overview':
                return OVERVIEW_CHARTS;
            case 'visitors':
                return VISITOR_CHARTS;
            case 'vehicles':
                return VEHICLE_CHARTS;
            case 'fire-alarms':
                return FIRE_ALARM_CHARTS;
            case 'incidents':
                return INCIDENT_CHARTS;
            default:
                return [];
        }
    };

    // Layout configuration for PDF export - Per-tab grid definitions
    interface LayoutRow {
        charts: string[];
        cols: number;
    }

    interface LayoutConfig {
        page1: LayoutRow[];
        page2?: LayoutRow[];
    }

    const LAYOUT_CONFIG: Record<string, LayoutConfig> = {
        overview: {
            page1: [
                { charts: ['comparison'], cols: 1 },
                { charts: ['visitor-trend'], cols: 1 },
                { charts: ['vehicle-trend'], cols: 1 }
            ],
            page2: [
                { charts: ['incident-distribution'], cols: 1 },
                { charts: ['busy-days-visitor', 'busy-days-vehicle'], cols: 2 },
                { charts: ['daily-averages'], cols: 1 }
            ]
        },
        visitors: {
            page1: [
                { charts: ['visitor-daily-trend'], cols: 1 },
                { charts: ['visitor-hourly-distribution'], cols: 1 },
                { charts: ['visitor-duration-stats', 'visitor-duration-distribution'], cols: 2 }
            ],
            page2: [
                { charts: ['visitor-top-managers'], cols: 1 },
                { charts: ['visitor-busy-days'], cols: 1 },
                { charts: ['visitor-total-stats'], cols: 1 }
            ]
        },
        vehicles: {
            page1: [
                { charts: ['vehicle-daily-trend'], cols: 1 },
                { charts: ['vehicle-top-vehicles'], cols: 1 },
                { charts: ['vehicle-top-managers'], cols: 1 }
            ],
            page2: [
                { charts: ['vehicle-top-destinations'], cols: 1 },
                { charts: ['vehicle-hourly-heatmap'], cols: 1 },
                { charts: ['vehicle-destinations-cloud'], cols: 1 }
            ]
        },
        'fire-alarms': {
            page1: [
                { charts: ['fire-alarm-locations-cloud'], cols: 1 },
                { charts: ['fire-alarm-locations-chart'], cols: 1 },
                { charts: ['fire-alarm-daily-trend'], cols: 1 },
                { charts: ['fire-alarm-hourly-trend'], cols: 1 }
            ],
            page2: [
                { charts: [], cols: 1 }
            ]
        },
        incidents: {
            page1: [
                { charts: ['incident-category-distribution'], cols: 1 },
                { charts: ['incident-theft', 'incident-assault'], cols: 2 },
                { charts: ['incident-medical', 'incident-vandalism'], cols: 2 }
            ],
            page2: [
                { charts: ['incident-accident', 'incident-substance'], cols: 2 }
            ]
        }
    };

    const exportToPDF = async () => {
        if (selectedCharts.length === 0) {
            alert('Lütfen en az bir grafik seçiniz');
            return;
        }

        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;

        const renderLayoutRow = async (
            row: LayoutRow,
            yPos: number,
            pageNum: number
        ): Promise<{ newY: number; pageNum: number }> => {
            const selectedInRow = row.charts.filter(id => selectedCharts.includes(id));
            if (selectedInRow.length === 0) {
                return { newY: yPos, pageNum };
            }

            const colWidth = (pageWidth - 2 * margin) / row.cols;
            let currentY = yPos;
            let currentPage = pageNum;
            let xOffset = margin;
            let rowHeight = 0;

            const images: { canvas: any; colIndex: number }[] = [];

            for (let i = 0; i < selectedInRow.length; i++) {
                const chartId = selectedInRow[i];
                const element = document.querySelector(`[data-chart-id="${chartId}"]`) as HTMLElement;

                if (!element) continue;

                try {
                    const pdfWidth = (colWidth - 2) * 3.78; // Convert mm to px
                    const originalWidth = element.style.width;
                    const originalDisplay = element.style.display;

                    const tables = element.querySelectorAll('table');
                    const tableOriginalStyles: { element: HTMLElement; styles: string }[] = [];

                    tables.forEach(table => {
                        tableOriginalStyles.push({
                            element: table as HTMLElement,
                            styles: (table as HTMLElement).getAttribute('style') || ''
                        });
                        (table as HTMLElement).style.fontSize = '10px';
                        (table as HTMLElement).style.margin = '0';
                        const cells = table.querySelectorAll('th, td');
                        cells.forEach(cell => {
                            (cell as HTMLElement).style.padding = '2px';
                        });
                    });

                    element.style.width = `${pdfWidth}px`;
                    element.style.display = 'block';

                    await new Promise(resolve => setTimeout(resolve, 200));

                    const canvas = await html2canvas(element, {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        allowTaint: true,
                        logging: false,
                        proxy: undefined,
                        imageTimeout: 0,
                        width: pdfWidth,
                        height: element.scrollHeight
                    });

                    element.style.width = originalWidth;
                    element.style.display = originalDisplay;
                    tableOriginalStyles.forEach(({ element: tableEl, styles }) => {
                        if (styles) {
                            tableEl.setAttribute('style', styles);
                        } else {
                            tableEl.removeAttribute('style');
                        }
                    });

                    if (canvas.width > 0 && canvas.height > 0) {
                        const imgHeight = (canvas.height / canvas.width) * (colWidth - 2);
                        rowHeight = Math.max(rowHeight, imgHeight);
                        images.push({ canvas, colIndex: i });
                    }
                } catch (error) {
                    console.error(`Grafik '${chartId}' dönüştürme hatası:`, error);
                }
            }

            if (images.length === 0) {
                return { newY: currentY, pageNum: currentPage };
            }

            if (currentY + rowHeight + 10 > pageHeight - margin) {
                doc.addPage();
                currentPage++;
                currentY = margin;
            }

            xOffset = margin;
            let colIndex = 0;

            for (const { canvas } of images) {
                const imgWidth = colWidth - 2;
                const imgHeight = (canvas.height / canvas.width) * imgWidth;

                doc.addImage(
                    canvas.toDataURL('image/png'),
                    'PNG',
                    xOffset,
                    currentY,
                    imgWidth,
                    imgHeight
                );

                xOffset += colWidth;
                colIndex++;

                if (colIndex % row.cols === 0) {
                    xOffset = margin;
                    currentY += imgHeight + 3;
                    colIndex = 0;
                }
            }

            if (colIndex > 0 || images.length === 0) {
                currentY += rowHeight + 3;
            }

            return { newY: currentY, pageNum: currentPage };
        };

        // Add header
        doc.setFontSize(16);
        doc.text(`İstatistik Raporu - ${getDaysLabel()}`, margin, margin + 5);

        doc.setFontSize(10);
        doc.text(`Oluşturulma: ${new Date().toLocaleString('tr-TR')}`, margin, margin + 13);

        let currentY = margin + 20;
        let currentPage = 1;

        const layout = LAYOUT_CONFIG[activeTab as keyof typeof LAYOUT_CONFIG];
        if (!layout) {
            alert('Bu sekmede grafik düzeni yapılandırılmamıştır');
            return;
        }

        if (layout.page1) {
            for (const row of layout.page1) {
                const result = await renderLayoutRow(row, currentY, currentPage);
                currentY = result.newY;
                currentPage = result.pageNum;
            }
        }

        if (layout.page2 && layout.page2.length > 0) {
            doc.addPage();
            currentPage++;
            currentY = margin;

            for (const row of layout.page2) {
                const result = await renderLayoutRow(row, currentY, currentPage);
                currentY = result.newY;
                currentPage = result.pageNum;
            }
        }

        const fileName = `istatistikler-${getDaysLabel()}-${new Date().getTime()}.pdf`;
        doc.save(fileName);
        setShowExportModal(false);
        setSelectedCharts([]);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Admin Paneli</p>
                            <h2 className="text-lg sm:text-xl font-bold tracking-tight mt-0.5">📊 Sistem İstatistikleri</h2>
                        </div>

                        {/* Date Pickers Container */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-800 p-3 rounded-2xl border border-slate-700">
                            {/* Inputs */}
                            <div className="flex items-center gap-2">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider pl-1 mb-0.5">Başlangıç</span>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider pl-1 mb-0.5">Bitiş</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="bg-slate-900 border border-slate-600 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Preset buttons */}
                            <div className="flex flex-wrap gap-1 border-t sm:border-t-0 sm:border-l border-slate-700 pt-2 sm:pt-0 sm:pl-3">
                                {[
                                    { label: '7G', val: 7 },
                                    { label: '30G', val: 30 },
                                    { label: '3A', val: 90 },
                                    { label: '6A', val: 180 },
                                    { label: '1Y', val: 365 }
                                ].map((preset) => (
                                    <button
                                        key={preset.label}
                                        onClick={() => {
                                            const end = new Date();
                                            const start = new Date();
                                            start.setDate(end.getDate() - preset.val);
                                            setStartDate(start.toISOString().split('T')[0]);
                                            setEndDate(end.toISOString().split('T')[0]);
                                        }}
                                        className="px-2 py-1 text-[10px] font-semibold text-slate-300 bg-slate-900/60 hover:bg-slate-950 rounded-md border border-slate-700 hover:border-slate-500 transition-all"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Tab navigation */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between py-2 overflow-x-auto gap-4">
                        <div className="flex gap-2 min-w-max">
                            {[
                                { key: 'overview', label: '📊 Genel Bakış' },
                                { key: 'visitors', label: '👥 Ziyaretçiler' },
                                { key: 'vehicles', label: '🚗 Araç Kullanımı' },
                                { key: 'fire-alarms', label: '🔥 Yangın Alarmları' },
                                { key: 'incidents', label: '🚨 Olay İstatistikleri' }
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key as any)}
                                    className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.key
                                        ? 'bg-blue-700 text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Export Button */}
                        <button
                            onClick={() => {
                                setSelectedCharts([]);
                                setShowExportModal(true);
                            }}
                            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors shrink-0"
                        >
                            <Download size={16} />
                            <span>PDF Dışa Aktar</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Area */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Active Tab View */}
                {activeTab === 'overview' && (
                    <OverviewTab
                        startDate={startDate}
                        endDate={endDate}
                        refetchKey={refetchKey}
                        getDaysLabel={getDaysLabel}
                        getComparisonLabel={getComparisonLabel}
                        getRangeDays={getRangeDays}
                        formatDate={formatDate}
                        CustomTooltip={CustomTooltip}
                    />
                )}
                {activeTab === 'visitors' && (
                    <VisitorsTab
                        startDate={startDate}
                        endDate={endDate}
                        refetchKey={refetchKey}
                        getDaysLabel={getDaysLabel}
                        formatDate={formatDate}
                        CustomTooltip={CustomTooltip}
                    />
                )}
                {activeTab === 'vehicles' && (
                    <VehiclesTab
                        startDate={startDate}
                        endDate={endDate}
                        refetchKey={refetchKey}
                        getDaysLabel={getDaysLabel}
                        formatDate={formatDate}
                        CustomTooltip={CustomTooltip}
                    />
                )}
                {activeTab === 'fire-alarms' && (
                    <FireAlarmsTab
                        startDate={startDate}
                        endDate={endDate}
                        refetchKey={refetchKey}
                        getDaysLabel={getDaysLabel}
                        formatDate={formatDate}
                        CustomTooltip={CustomTooltip}
                    />
                )}
                {activeTab === 'incidents' && (
                    <IncidentsTab
                        startDate={startDate}
                        endDate={endDate}
                        refetchKey={refetchKey}
                        getDaysLabel={getDaysLabel}
                        formatDate={formatDate}
                        CustomTooltip={CustomTooltip}
                    />
                )}

                {/* PDF Export Modal */}
                {showExportModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
                        <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-800">📊 Grafikleri Seç</h3>
                                <button
                                    onClick={() => {
                                        setShowExportModal(false);
                                        setSelectedCharts([]);
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>

                            {/* Instructions */}
                            <p className="text-sm text-gray-600 mb-4">PDF dosyasına dâhil etmek istediğiniz grafikleri seçiniz.</p>

                            {/* Select All / Deselect All Buttons */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                                <button
                                    onClick={() => setSelectedCharts(getAvailableCharts().map(c => c.id))}
                                    className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                                >
                                    Tümünü Seç
                                </button>
                                <button
                                    onClick={() => setSelectedCharts([])}
                                    className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                                >
                                    Tümünü Kaldır
                                </button>
                            </div>

                            {/* Charts List */}
                            <div className="space-y-2 max-h-64 overflow-y-auto mb-6 p-3 bg-gray-50 rounded-lg">
                                {getAvailableCharts().map((chart) => (
                                    <label key={chart.id} className="flex items-center gap-3 cursor-pointer hover:bg-white p-2 rounded-lg transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectedCharts.includes(chart.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedCharts([...selectedCharts, chart.id]);
                                                } else {
                                                    setSelectedCharts(selectedCharts.filter(c => c !== chart.id));
                                                }
                                            }}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                                        />
                                        <div className="flex items-center gap-2 flex-1">
                                            {selectedCharts.includes(chart.id) && <Check size={16} className="text-green-600" />}
                                            <span className="text-sm text-gray-700">{chart.label}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => {
                                        setShowExportModal(false);
                                        setSelectedCharts([]);
                                    }}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                                >
                                    İptal
                                </button>
                                <div className="flex-1">
                                    <button
                                        onClick={exportToPDF}
                                        disabled={selectedCharts.length === 0}
                                        className={`w-full px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
                                            selectedCharts.length === 0
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
                                                : 'bg-blue-700 hover:bg-blue-800 text-white shadow-sm'
                                        }`}
                                    >
                                        <Download size={18} />
                                        PDF İndir
                                    </button>
                                </div>
                            </div>

                            {/* Info Text */}
                            {selectedCharts.length === 0 && (
                                <p className="text-xs text-gray-500 text-center mt-3">En az bir grafik seçmelisiniz</p>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminStatistics;
