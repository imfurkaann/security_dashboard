import { useState, useEffect, useCallback } from 'react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import {
    Users, Car, Flame, TrendingUp, TrendingDown,
    RefreshCw, Download, X, Check
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import api from '../utils/api';
import WordCloud from '../components/WordCloud';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';

// Renk paleti
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
const CHART_COLORS = {
    primary: '#3B82F6',
    secondary: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6'
};

interface StatCard {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    change?: number;
}

interface TrendData {
    date: string;
    count: number;
    total_persons?: number;
}

const AdminStatistics = () => {
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(30);
    const [activeTab, setActiveTab] = useState<'overview' | 'visitors' | 'vehicles' | 'fire-alarms' | 'incidents'>('overview');
    const [showExportModal, setShowExportModal] = useState(false);
    const [selectedCharts, setSelectedCharts] = useState<string[]>([]);
    const [isMobileViewport, setIsMobileViewport] = useState(false);

    // Data states
    const [generalStats, setGeneralStats] = useState<any>(null);
    const [visitorTrends, setVisitorTrends] = useState<any>({ trend: [], hourlyHeatmap: [], avgDuration: {}, durationDistribution: [], hostDistribution: [], electricStationVisitors: [], subcontractorVisitors: [], categoryComparison: [] });
    const [vehicleStats, setVehicleStats] = useState<any>({ trend: [], topVehicles: [], topManagers: [], statusDistribution: [], topDestinations: [], hourlyUsage: [], hourlyHeatmap: [], personnelVehicleUsage: [] });
    const [incidentStats, setIncidentStats] = useState<any>({ monthlyTrend: [], typeDistribution: [], severityDistribution: [] });
    const [fireAlarmStats, setFireAlarmStats] = useState<any>({ dailyTrend: [], monthlyTrend: [], locationDistribution: [], resolutionStats: [], hourlyTrend: [] });
    const [comparison, setComparison] = useState<any>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [generalRes, visitorRes, vehicleRes, incidentRes, fireRes, compRes] = await Promise.all([
                api.get('/statistics/general'),
                api.get(`/statistics/visitors?period=daily&days=${days}`),
                api.get(`/statistics/vehicles?period=daily&days=${days}`),
                api.get(`/statistics/incidents?days=${days}`),
                api.get(`/statistics/fire-alarms?days=${days}`),
                api.get('/statistics/comparison')
            ]);

            setGeneralStats(generalRes.data.data);
            setVisitorTrends(visitorRes.data.data);
            setVehicleStats(vehicleRes.data.data);
            setIncidentStats(incidentRes.data.data);
            setFireAlarmStats(fireRes.data.data);
            setComparison(compRes.data.data);
        } catch (error) {
            console.error('İstatistik yükleme hatası:', error);
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useRealtimeRefetch({
        topics: ['dashboard', 'incidents', 'sgk'],
        onMutation: fetchData,
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const updateViewport = () => setIsMobileViewport(window.innerWidth < 768);
        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, []);

    const getWordCloudWidth = () => {
        if (typeof window === 'undefined') return 320;
        return Math.max(window.innerWidth - (isMobileViewport ? 40 : 120), 280);
    };

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

    const getChangePercent = (current: number, previous: number) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    };

    const getDaysLabel = () => {
        switch (days) {
            case 7: return 'Son 7 Gün';
            case 30: return 'Son 30 Gün';
            case 90: return 'Son 3 Ay';
            case 180: return 'Son 6 Ay';
            case 365: return 'Son 1 Yıl';
            default: return `Son ${days} Gün`;
        }
    };

    const getComparisonLabel = () => {
        if (days <= 14) return { current: 'Bu Hafta', previous: 'Geçen Hafta', type: 'weekly' };
        if (days <= 60) return { current: 'Bu Ay', previous: 'Geçen Ay', type: 'monthly' };
        if (days <= 180) return { current: 'Bu Dönem', previous: 'Önceki Dönem', type: 'quarterly' };
        return { current: 'Bu Yıl', previous: 'Geçen Yıl', type: 'yearly' };
    };

    const StatCardComponent = ({ title, value, icon, color, change }: StatCard) => (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div className="min-w-0">
                    <p className="mb-1 break-words text-xs sm:text-sm text-slate-500">{title}</p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-900">{value.toLocaleString('tr-TR')}</p>
                    {change !== undefined && (
                        <div className={`flex items-center mt-2 text-xs sm:text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {change >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                            <span>{change >= 0 ? '+' : ''}{change}% geçen aya göre</span>
                        </div>
                    )}
                </div>
                <div className={`shrink-0 rounded-xl p-3 sm:p-4 ${color}`}>
                    {icon}
                </div>
            </div>
        </div>
    );

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                    <p className="text-sm font-medium text-gray-700">{formatDate(label)}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm" style={{ color: entry.color }}>
                            {entry.name}: {entry.value.toLocaleString('tr-TR')}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    // PDF Export Charts for Overview Tab
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
        { id: 'vehicle-hourly-heatmap', label: '🔥 Araç Kullanım Yoğunluğu' },
        { id: 'vehicle-destinations-cloud', label: '☁️ Hedef Lokasyonlar' },
        { id: 'vehicle-busy-days', label: '🏆 En Yoğun Günler' }
    ];

    const FIRE_ALARM_CHARTS = [
        { id: 'fire-alarm-daily-trend', label: '📈 Alarm Sayısı' },
        { id: 'fire-alarm-hourly-trend', label: '🕔 Saatlik Alarm Çalma Trendi' },
        { id: 'fire-alarm-locations-cloud', label: '☁️ Alarm Lokasyonları' },
        { id: 'fire-alarm-locations-chart', label: '📍 En Çok Alarm Olan Lokasyonlar' }
    ];

    const INCIDENT_CHARTS = [
        { id: 'incident-category-distribution', label: '📊 Kategori Bazlı Olay Dağılımı' },
        { id: 'incident-theft', label: '🚨 Hırsızlık Kategorileri' },
        { id: 'incident-assault', label: '👊 Saldırı & Kavga Kategorileri' },
        { id: 'incident-medical', label: '⚕️ Tıbbi Acil Kategorileri' },
        { id: 'incident-vandalism', label: '🔨 Vandalizm & Hasar Kategorileri' },
        { id: 'incident-accident', label: '🚑 Kaza/Yaralanma Kategorileri' },
        { id: 'incident-unauthorized', label: '🚫 Yetkisiz Giriş Kategorileri' },
        { id: 'incident-security', label: '🔒 Güvenlik Kategorileri' },
        { id: 'incident-substance', label: '💊 Madde Kullanımı Kategorileri' }
    ];

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

        // Helper to render a layout row
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

            // Collect all images for this row
            const images: { canvas: any; colIndex: number }[] = [];

            for (let i = 0; i < selectedInRow.length; i++) {
                const chartId = selectedInRow[i];
                const element = document.querySelector(`[data-chart-id="${chartId}"]`) as HTMLElement;

                if (!element) continue;

                try {
                    // Set fixed width on parent container for responsive charts
                    const pdfWidth = (colWidth - 2) * 3.78; // Convert mm to px
                    const originalWidth = element.style.width;
                    const originalDisplay = element.style.display;

                    // Store original styles for tables (for compact PDF rendering)
                    const tables = element.querySelectorAll('table');
                    const tableOriginalStyles: { element: HTMLElement; styles: string }[] = [];

                    tables.forEach(table => {
                        tableOriginalStyles.push({
                            element: table as HTMLElement,
                            styles: (table as HTMLElement).getAttribute('style') || ''
                        });
                        // Make tables compact for PDF
                        (table as HTMLElement).style.fontSize = '10px';
                        (table as HTMLElement).style.margin = '0';
                        const cells = table.querySelectorAll('th, td');
                        cells.forEach(cell => {
                            (cell as HTMLElement).style.padding = '2px';
                        });
                    });

                    // Temporarily set width
                    element.style.width = `${pdfWidth}px`;
                    element.style.display = 'block';

                    // Wait for chart to render with new dimensions
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

                    // Restore original styles
                    element.style.width = originalWidth;
                    element.style.display = originalDisplay;
                    tableOriginalStyles.forEach(({ element: tableEl, styles }) => {
                        if (styles) {
                            tableEl.setAttribute('style', styles);
                        } else {
                            tableEl.removeAttribute('style');
                        }
                    });

                    // Verify canvas has content
                    if (canvas.width > 0 && canvas.height > 0) {
                        const imgHeight = (canvas.height / canvas.width) * (colWidth - 2);
                        rowHeight = Math.max(rowHeight, imgHeight);
                        images.push({ canvas, colIndex: i });
                    } else {
                        console.warn(`Grafik '${chartId}' canvas boş oldu`);
                    }
                } catch (error) {
                    console.error(`Grafik '${chartId}' dönüştürme hatası:`, error);
                }
            }

            if (images.length === 0) {
                return { newY: currentY, pageNum: currentPage };
            }

            // Check page break
            if (currentY + rowHeight + 10 > pageHeight - margin) {
                doc.addPage();
                currentPage++;
                currentY = margin;
            }

            // Render images with proper grid layout
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

                // Move to next row if we've filled the columns
                if (colIndex % row.cols === 0) {
                    xOffset = margin;
                    currentY += imgHeight + 3;
                    colIndex = 0;
                }
            }

            // Update final position
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

        // Get layout for current tab
        const layout = LAYOUT_CONFIG[activeTab as keyof typeof LAYOUT_CONFIG];
        if (!layout) {
            alert('Bu sekmede grafik düzeni yapılandırılmamıştır');
            return;
        }

        // Render page 1
        if (layout.page1) {
            for (const row of layout.page1) {
                const result = await renderLayoutRow(row, currentY, currentPage);
                currentY = result.newY;
                currentPage = result.pageNum;
            }
        }

        // Render page 2
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

        // Download PDF
        const fileName = `istatistikler-${getDaysLabel()}-${new Date().getTime()}.pdf`;
        doc.save(fileName);
        setShowExportModal(false);
        setSelectedCharts([]);
    };

    if (loading && !generalStats) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Admin Paneli</p>
                            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">İstatistikler & Grafikler</h1>
                            <p className="text-sm sm:text-base text-slate-200 mt-1">Güvenlik verilerinin dönemsel görünümü ve kategori analizleri</p>
                        </div>
                        <button
                            onClick={() => {
                                setSelectedCharts([]);
                                setShowExportModal(true);
                            }}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                        >
                            <Download size={20} />
                            PDF İndir
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap text-sm text-slate-600">
                                <span className="font-medium text-slate-500">Son</span>
                                <select
                                    value={days}
                                    onChange={(e) => setDays(Number(e.target.value))}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                >
                                    <option value={7}>7 gün</option>
                                    <option value={30}>30 gün</option>
                                    <option value={90}>3 ay</option>
                                    <option value={180}>6 ay</option>
                                    <option value={365}>1 yıl</option>
                                </select>
                            </div>

                            <button
                                onClick={fetchData}
                                disabled={loading}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                                Yenile
                            </button>
                        </div>

                        <div className="xl:ml-auto w-full xl:w-auto overflow-x-auto pb-1">
                            <div className="inline-flex min-w-full xl:min-w-0 rounded-xl border border-slate-200 bg-slate-100 p-1 gap-1">
                                {[
                                    { key: 'overview', label: 'Genel Bakış' },
                                    { key: 'visitors', label: 'Ziyaretçiler' },
                                    { key: 'vehicles', label: 'Araçlar' },
                                    { key: 'fire-alarms', label: 'Yangın Alarmları' },
                                    { key: 'incidents', label: 'Olaylar' }
                                ].map((tab) => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key as any)}
                                        className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.key
                                            ? 'bg-white text-slate-900 shadow-sm'
                                            : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && generalStats && (
                    <>
                        {/* Dönem Bazlı Değişim Kartları */}
                        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                            <p className="text-sm text-slate-600">📅 <strong className="text-slate-900">{getDaysLabel()}</strong> verilerini görüntülüyorsunuz</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            {/* Ziyaretçi Değişimi */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-3 bg-blue-100 rounded-xl">
                                        <Users size={24} className="text-blue-600" />
                                    </div>
                                    {(() => {
                                        const comparisonType = getComparisonLabel().type;
                                        const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                        const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                                        const previousKey = comparisonType === 'weekly' ? 'previous_week' : 'previous_month';
                                        const record = comparisonArray?.find((c: any) => c.category === 'visitors');
                                        const current = parseInt(record?.[currentKey]) || 0;
                                        const previous = parseInt(record?.[previousKey]) || 0;
                                        const change = getChangePercent(current, previous);
                                        return (
                                            <span className={`flex items-center text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {change >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                                                {change >= 0 ? '+' : ''}{change}%
                                            </span>
                                        );
                                    })()}
                                </div>
                                <p className="text-2xl font-bold text-gray-800">
                                    {(() => {
                                        const comparisonType = getComparisonLabel().type;
                                        const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                        const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                                        const record = comparisonArray?.find((c: any) => c.category === 'visitors');
                                        return parseInt(record?.[currentKey]) || 0;
                                    })()}
                                </p>
                                <p className="text-sm text-gray-500">{getComparisonLabel().current} Ziyaretçi</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {getComparisonLabel().previous}: {(() => {
                                        const comparisonType = getComparisonLabel().type;
                                        const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                        const previousKey = comparisonType === 'weekly' ? 'previous_week' : 'previous_month';
                                        const record = comparisonArray?.find((c: any) => c.category === 'visitors');
                                        return parseInt(record?.[previousKey]) || 0;
                                    })()}
                                </p>
                            </div>

                            {/* Araç Değişimi */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-3 bg-green-100 rounded-xl">
                                        <Car size={24} className="text-green-600" />
                                    </div>
                                    {(() => {
                                        const comparisonType = getComparisonLabel().type;
                                        const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                        const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                                        const previousKey = comparisonType === 'weekly' ? 'previous_week' : 'previous_month';
                                        const record = comparisonArray?.find((c: any) => c.category === 'vehicles');
                                        const current = parseInt(record?.[currentKey]) || 0;
                                        const previous = parseInt(record?.[previousKey]) || 0;
                                        const change = getChangePercent(current, previous);
                                        return (
                                            <span className={`flex items-center text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {change >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                                                {change >= 0 ? '+' : ''}{change}%
                                            </span>
                                        );
                                    })()}
                                </div>
                                <p className="text-2xl font-bold text-gray-800">
                                    {(() => {
                                        const comparisonType = getComparisonLabel().type;
                                        const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                        const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                                        const record = comparisonArray?.find((c: any) => c.category === 'vehicles');
                                        return parseInt(record?.[currentKey]) || 0;
                                    })()}
                                </p>
                                <p className="text-sm text-gray-500">{getComparisonLabel().current} Araç</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {getComparisonLabel().previous}: {(() => {
                                        const comparisonType = getComparisonLabel().type;
                                        const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                        const previousKey = comparisonType === 'weekly' ? 'previous_week' : 'previous_month';
                                        const record = comparisonArray?.find((c: any) => c.category === 'vehicles');
                                        return parseInt(record?.[previousKey]) || 0;
                                    })()}
                                </p>
                            </div>

                            {/* Alarm Değişimi */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="p-3 bg-red-100 rounded-xl">
                                        <Flame size={24} className="text-red-600" />
                                    </div>
                                    {(() => {
                                        const comparisonType = getComparisonLabel().type;
                                        const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                        const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                                        const previousKey = comparisonType === 'weekly' ? 'previous_week' : 'previous_month';
                                        const record = comparisonArray?.find((c: any) => c.category === 'fire_alarms');
                                        const current = parseInt(record?.[currentKey]) || 0;
                                        const previous = parseInt(record?.[previousKey]) || 0;
                                        const change = getChangePercent(current, previous);
                                        return (
                                            <span className={`flex items-center text-sm font-medium ${change <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                {change >= 0 ? <TrendingUp size={16} className="mr-1" /> : <TrendingDown size={16} className="mr-1" />}
                                                {change >= 0 ? '+' : ''}{change}%
                                            </span>
                                        );
                                    })()}
                                </div>
                                <p className="text-2xl font-bold text-gray-800">
                                    {(() => {
                                        const comparisonType = getComparisonLabel().type;
                                        const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                        const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                                        const record = comparisonArray?.find((c: any) => c.category === 'fire_alarms');
                                        return parseInt(record?.[currentKey]) || 0;
                                    })()}
                                </p>
                                <p className="text-sm text-gray-500">{getComparisonLabel().current} Alarm</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {getComparisonLabel().previous}: {(() => {
                                        const comparisonType = getComparisonLabel().type;
                                        const comparisonArray = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                        const previousKey = comparisonType === 'weekly' ? 'previous_week' : 'previous_month';
                                        const record = comparisonArray?.find((c: any) => c.category === 'fire_alarms');
                                        return parseInt(record?.[previousKey]) || 0;
                                    })()}
                                </p>
                            </div>
                        </div>

                        {/* Dönemsel Karşılaştırma */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="comparison">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Dönemsel Karşılaştırma ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={(() => {
                                    const comparisonData = days <= 14 ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                    const currentKey = days <= 14 ? 'current_week' : 'current_month';
                                    const previousKey = days <= 14 ? 'previous_week' : 'previous_month';

                                    return (comparisonData || []).filter((item: any) => ['visitors', 'vehicles', 'fire_alarms'].includes(item.category)).map((item: any) => ({
                                        ...item,
                                        current: parseInt(item[currentKey]) || 0,
                                        previous: parseInt(item[previousKey]) || 0
                                    }));
                                })()}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis
                                        dataKey="category"
                                        tickFormatter={(v) => {
                                            const labels: Record<string, string> = {
                                                visitors: 'Ziyaretçi',
                                                vehicles: 'Araç',
                                                fire_alarms: 'Alarm'
                                            };
                                            return labels[v] || v;
                                        }}
                                    />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Bar dataKey="current" name={getComparisonLabel().current} fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="previous" name={getComparisonLabel().previous} fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Tüm Kategoriler Trendi */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            {/* Ziyaretçi Trendi */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-trend">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">👥 Ziyaretçi Trendi ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <AreaChart data={visitorTrends.trend}>
                                        <defs>
                                            <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="total_persons"
                                            name="Kişi Sayısı"
                                            stroke={CHART_COLORS.primary}
                                            fillOpacity={1}
                                            fill="url(#colorVisitors)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Araç Trendi */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="vehicle-trend">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">🚗 Araç Kullanım Trendi ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <AreaChart data={vehicleStats.trend}>
                                        <defs>
                                            <linearGradient id="colorVehiclesOverview" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} />
                                        <YAxis tick={{ fontSize: 10 }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area
                                            type="monotone"
                                            dataKey="count"
                                            name="Kullanım Sayısı"
                                            stroke={CHART_COLORS.secondary}
                                            fillOpacity={1}
                                            fill="url(#colorVehiclesOverview)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Olay Kategori Dağılımı Pasta Grafiği */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-distribution">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">🚨 Olay Kategori Dağılımı ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Hırsızlık', value: parseInt(incidentStats?.categoryStats?.theft_total) || 0 },
                                                { name: 'Saldırı/Kavga', value: parseInt(incidentStats?.categoryStats?.assault_total) || 0 },
                                                { name: 'Tıbbi Acil', value: parseInt(incidentStats?.categoryStats?.medical_total) || 0 },
                                                { name: 'Vandalizm', value: parseInt(incidentStats?.categoryStats?.vandalism_total) || 0 },
                                                { name: 'Kaza', value: parseInt(incidentStats?.categoryStats?.accident_total) || 0 },
                                                { name: 'Madde Kullanımı', value: parseInt(incidentStats?.categoryStats?.substance_total) || 0 }
                                            ].filter(item => item.value > 0)}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => (percent && percent > 0.05) ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                                            outerRadius={100}
                                            dataKey="value"
                                        >
                                            <Cell fill="#EF4444" />
                                            <Cell fill="#F59E0B" />
                                            <Cell fill="#3B82F6" />
                                            <Cell fill="#8B5CF6" />
                                            <Cell fill="#10B981" />
                                            <Cell fill="#EC4899" />
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Dönem Özeti */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">📅 {getDaysLabel()} Toplam</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                                        <p className="text-3xl font-bold text-blue-600">
                                            {(() => {
                                                const comparisonType = getComparisonLabel().type;
                                                const comparisonData = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                                const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                                                const visitorData = comparisonData?.find((c: any) => c.category === 'visitors');
                                                return parseInt(visitorData?.[currentKey]) || 0;
                                            })()}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1">Ziyaretçi</p>
                                    </div>
                                    <div className="text-center p-4 bg-green-50 rounded-lg">
                                        <p className="text-3xl font-bold text-green-600">
                                            {(() => {
                                                const comparisonType = getComparisonLabel().type;
                                                const comparisonData = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                                const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                                                const vehicleData = comparisonData?.find((c: any) => c.category === 'vehicles');
                                                return parseInt(vehicleData?.[currentKey]) || 0;
                                            })()}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1">Araç Kullanımı</p>
                                    </div>
                                    <div className="text-center p-4 bg-red-50 rounded-lg">
                                        <p className="text-3xl font-bold text-red-600">
                                            {(() => {
                                                const comparisonType = getComparisonLabel().type;
                                                const comparisonData = comparisonType === 'weekly' ? comparison?.weeklyComparison : comparison?.monthlyComparison;
                                                const currentKey = comparisonType === 'weekly' ? 'current_week' : 'current_month';
                                                const alarmData = comparisonData?.find((c: any) => c.category === 'fire_alarms');
                                                return parseInt(alarmData?.[currentKey]) || 0;
                                            })()}
                                        </p>
                                        <p className="text-sm text-gray-600 mt-1">Yangın Alarmı</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* En Yoğun Günler */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Ziyaretçi En Yoğun */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="busy-days-visitor">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 Ziyaretçi - En Yoğun Günler ({getDaysLabel()})</h3>
                                {visitorTrends.trend && visitorTrends.trend.length > 0 && (
                                    <div className="space-y-2">
                                        {[...visitorTrends.trend]
                                            .sort((a: any, b: any) => parseInt(String(b.total_persons || 0)) - parseInt(String(a.total_persons || 0)))
                                            .slice(0, 5)
                                            .map((day: any, index: number) => (
                                                <div key={index} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                                                            }`}>
                                                            {index + 1}
                                                        </span>
                                                        <span className="text-sm text-gray-700 truncate">{formatDate(day.date)}</span>
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-800">{parseInt(day.total_persons || 0)} kişi</span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* Araç En Yoğun */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="busy-days-vehicle">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">🚗 Araç - En Yoğun Günler ({getDaysLabel()})</h3>
                                {vehicleStats.trend && vehicleStats.trend.length > 0 && (
                                    <div className="space-y-2">
                                        {[...vehicleStats.trend]
                                            .sort((a: any, b: any) => parseInt(String(b.count || 0)) - parseInt(String(a.count || 0)))
                                            .slice(0, 5)
                                            .map((day: any, index: number) => (
                                                <div key={index} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                                                            }`}>
                                                            {index + 1}
                                                        </span>
                                                        <span className="text-sm text-gray-700 truncate">{formatDate(day.date)}</span>
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-800">{parseInt(day.count || 0)} araç</span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>

                            {/* Günlük Ortalamalar */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="daily-averages">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Günlük Ortalamalar ({getDaysLabel()})</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                        <span className="text-gray-600 text-sm">Ziyaretçi</span>
                                        <span className="text-xl font-bold text-blue-600">
                                            {visitorTrends.trend && visitorTrends.trend.length > 0
                                                ? Math.round(visitorTrends.trend.reduce((a: number, b: any) => a + parseInt(String(b.total_persons || 0)), 0) / visitorTrends.trend.length)
                                                : 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                        <span className="text-gray-600 text-sm">Araç</span>
                                        <span className="text-xl font-bold text-green-600">
                                            {vehicleStats.trend && vehicleStats.trend.length > 0
                                                ? Math.round(vehicleStats.trend.reduce((a: number, b: any) => a + parseInt(String(b.count || 0)), 0) / vehicleStats.trend.length)
                                                : 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                        <span className="text-gray-600 text-sm">Alarm</span>
                                        <span className="text-xl font-bold text-red-600">
                                            {fireAlarmStats.dailyTrend && fireAlarmStats.dailyTrend.length > 0
                                                ? (fireAlarmStats.dailyTrend.reduce((a: number, b: any) => a + parseInt(String(b.count || 0)), 0) / fireAlarmStats.dailyTrend.length).toFixed(1)
                                                : 0}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Visitors Tab */}
                {activeTab === 'visitors' && visitorTrends && (
                    <div className="space-y-6">
                        {/* Dönem Bilgisi Başlık */}
                        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                            <p className="text-sm font-medium text-slate-600">📅 {getDaysLabel()} verilerini görüntülüyorsunuz</p>
                        </div>

                        {/* 1. Toplam İnsan Trafiği - Zaman Serisi */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-daily-trend">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">👥 Toplam İnsan Trafiği ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={400}>
                                <AreaChart data={visitorTrends.trend}>
                                    <defs>
                                        <linearGradient id="colorPersons" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.8} />
                                            <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0.1} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tickFormatter={formatDate} />
                                    <YAxis yAxisId="left" label={{ value: 'Kayıt Sayısı', angle: -90, position: 'insideLeft' }} />
                                    <YAxis yAxisId="right" orientation="right" label={{ value: 'Toplam Kişi', angle: 90, position: 'insideRight' }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Area
                                        yAxisId="right"
                                        type="monotone"
                                        dataKey="total_persons"
                                        name="Toplam Kişi Sayısı"
                                        stroke={CHART_COLORS.primary}
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorPersons)"
                                    />
                                    <Line
                                        yAxisId="left"
                                        type="monotone"
                                        dataKey="count"
                                        name="Kayıt Sayısı"
                                        stroke={CHART_COLORS.secondary}
                                        strokeWidth={2}
                                        dot={{ fill: CHART_COLORS.secondary, r: 4 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* 2. Giriş Saati Yoğunluğu - Isı Haritası */}
                        {visitorTrends.hourlyHeatmap && visitorTrends.hourlyHeatmap.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-hourly-distribution">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">🔥 Giriş Saati Yoğunluğu ({getDaysLabel()} - Gün x Saat)</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="border border-gray-300 px-2 sm:px-4 py-2 bg-gray-50 text-xs sm:text-sm">Gün \\ Saat</th>
                                                {Array.from({ length: 24 }, (_, i) => (
                                                    <th key={i} className="border border-gray-300 px-1.5 sm:px-2 py-2 bg-gray-50 text-[10px] sm:text-xs">{String(i).padStart(2, '0')}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'].map((day, dayIndex) => {
                                                const dayData = visitorTrends.hourlyHeatmap.filter((h: any) => parseInt(h.day_of_week) === dayIndex);
                                                const maxCount = Math.max(...visitorTrends.hourlyHeatmap.map((h: any) => parseInt(h.total_persons || h.visit_count || 0)), 1);

                                                return (
                                                    <tr key={dayIndex}>
                                                        <td className="border border-gray-300 px-2 sm:px-4 py-2 font-medium bg-gray-50 text-xs sm:text-sm whitespace-nowrap">{day}</td>
                                                        {Array.from({ length: 24 }, (_, hour) => {
                                                            const hourData = dayData.find((h: any) => parseInt(h.hour) === hour);
                                                            const count = hourData ? parseInt(hourData.total_persons || hourData.visit_count || 0) : 0;
                                                            const intensity = count / maxCount;
                                                            const bgColor = count === 0 ? '#f3f4f6' :
                                                                intensity < 0.25 ? '#dbeafe' :
                                                                    intensity < 0.5 ? '#93c5fd' :
                                                                        intensity < 0.75 ? '#3b82f6' : '#1e40af';
                                                            const textColor = intensity > 0.5 ? 'white' : 'black';

                                                            return (
                                                                <td
                                                                    key={hour}
                                                                    className="border border-gray-300 px-2 py-2 text-center text-xs cursor-pointer hover:opacity-80 transition-opacity"
                                                                    style={{ backgroundColor: bgColor, color: textColor }}
                                                                    title={`${day} ${String(hour).padStart(2, '0')}:00 - ${count} kişi`}
                                                                >
                                                                    {count > 0 ? count : ''}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                                    <span>Daha az</span>
                                    <div className="flex gap-1">
                                        <div className="w-4 h-4 border" style={{ backgroundColor: '#f3f4f6' }}></div>
                                        <div className="w-4 h-4 border" style={{ backgroundColor: '#dbeafe' }}></div>
                                        <div className="w-4 h-4 border" style={{ backgroundColor: '#93c5fd' }}></div>
                                        <div className="w-4 h-4 border" style={{ backgroundColor: '#3b82f6' }}></div>
                                        <div className="w-4 h-4 border" style={{ backgroundColor: '#1e40af' }}></div>
                                    </div>
                                    <span>Daha çok</span>
                                </div>
                            </div>
                        )}

                        {/* 3. Ortalama Ziyaret Süresi & Dağılım */}
                        {visitorTrends.avgDuration && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Süre İstatistikleri */}
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-duration-stats">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">⏱️ Ziyaret Süresi İstatistikleri ({getDaysLabel()})</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                            <span className="text-gray-700">Ortalama Süre</span>
                                            <span className="text-2xl font-bold text-blue-600">
                                                {visitorTrends.avgDuration?.avg_hours ?
                                                    `${Number(visitorTrends.avgDuration.avg_hours).toFixed(1)} saat` : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                                            <span className="text-gray-700">En Kısa Ziyaret</span>
                                            <span className="text-xl font-bold text-green-600">
                                                {visitorTrends.avgDuration?.min_hours ?
                                                    `${(Number(visitorTrends.avgDuration.min_hours) * 60).toFixed(0)} dk` : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                                            <span className="text-gray-700">En Uzun Ziyaret</span>
                                            <span className="text-xl font-bold text-amber-600">
                                                {visitorTrends.avgDuration?.max_hours ?
                                                    `${Number(visitorTrends.avgDuration.max_hours).toFixed(1)} saat` : 'N/A'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                                            <span className="text-gray-700">Tamamlanan Ziyaret</span>
                                            <span className="text-xl font-bold text-purple-600">
                                                {visitorTrends.avgDuration?.completed_visits || 0}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Süre Dağılımı */}
                                {visitorTrends.durationDistribution && visitorTrends.durationDistribution.length > 0 && (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-duration-distribution">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Ziyaret Süresi Dağılımı ({getDaysLabel()})</h3>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={[...visitorTrends.durationDistribution].sort((a: any, b: any) => {
                                                const order = ['0-1 saat', '1-2 saat', '2-4 saat', '4-8 saat', '8+ saat'];
                                                return order.indexOf(a.duration_range) - order.indexOf(b.duration_range);
                                            })}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="duration_range" tick={{ fontSize: 12 }} />
                                                <YAxis />
                                                <Tooltip />
                                                <Bar dataKey="count" name="Ziyaret Sayısı" fill={CHART_COLORS.purple} radius={[8, 8, 0, 0]}>
                                                    {[...visitorTrends.durationDistribution].sort((a: any, b: any) => {
                                                        const order = ['0-1 saat', '1-2 saat', '2-4 saat', '4-8 saat', '8+ saat'];
                                                        return order.indexOf(a.duration_range) - order.indexOf(b.duration_range);
                                                    }).map((_: any, index: number) => (
                                                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 5. Kime Gelindiği Bazlı Analizler */}
                        {visitorTrends.hostDistribution && visitorTrends.hostDistribution.length > 0 && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Host Dağılımı */}
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-top-managers">
                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">👤 En Çok Ziyaret Edilen Kişiler ({getDaysLabel()})</h3>
                                    <ResponsiveContainer width="100%" height={350}>
                                        <BarChart data={visitorTrends.hostDistribution} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                            <XAxis type="number" />
                                            <YAxis dataKey="host" type="category" width={150} tick={{ fontSize: 11 }} />
                                            <Tooltip />
                                            <Bar dataKey="visit_count" name="Ziyaret Sayısı" fill={CHART_COLORS.primary} radius={[0, 8, 8, 0]}>
                                                {visitorTrends.hostDistribution.map((_: any, index: number) => (
                                                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Kategori Karşılaştırması */}
                                {visitorTrends.categoryComparison && visitorTrends.categoryComparison.length > 0 && (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-category-comparison">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Ziyaretçi Kategori Dağılımı ({getDaysLabel()})</h3>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={visitorTrends.categoryComparison}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="category" />
                                                <YAxis />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend />
                                                <Bar dataKey="count" name="Ziyaret Sayısı" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                                                <Bar dataKey="total_persons" name="Gelen Kişi Sayısı" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                {/* Elektrik İstasyonu Ziyaretleri */}
                                {visitorTrends.electricStationVisitors && visitorTrends.electricStationVisitors.length > 0 && (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">⚡ Elektrik İstasyonu Ziyaretleri ({getDaysLabel()})</h3>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={visitorTrends.electricStationVisitors}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="date" tickFormatter={formatDate} />
                                                <YAxis />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend />
                                                <Bar dataKey="total_persons" name="Kişi Sayısı" fill={CHART_COLORS.warning} radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}

                                {/* Taşeron İşçi Ziyaretleri */}
                                {visitorTrends.subcontractorVisitors && visitorTrends.subcontractorVisitors.length > 0 && (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-4">👷 Taşeron İşçi Ziyaretleri ({getDaysLabel()})</h3>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <BarChart data={visitorTrends.subcontractorVisitors}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                                <XAxis dataKey="date" tickFormatter={formatDate} />
                                                <YAxis />
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend />
                                                <Bar dataKey="total_persons" name="Kişi Sayısı" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Özet Kartlar */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Günlük Ortalamalar ({getDaysLabel()})</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-600 text-sm">Günlük Ort. Kayıt</span>
                                        <span className="text-xl font-bold text-blue-600">
                                            {visitorTrends.trend && visitorTrends.trend.length > 0
                                                ? Math.round(visitorTrends.trend.reduce((a: number, b: any) => a + parseInt(String(b.count)), 0) / visitorTrends.trend.length)
                                                : 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-600 text-sm">Günlük Ort. Kişi</span>
                                        <span className="text-xl font-bold text-green-600">
                                            {visitorTrends.trend && visitorTrends.trend.length > 0
                                                ? Math.round(visitorTrends.trend.reduce((a: number, b: any) => a + parseInt(String(b.total_persons || 0)), 0) / visitorTrends.trend.length)
                                                : 0}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-total-stats">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Toplam İstatistikler ({getDaysLabel()})</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-600 text-sm">Toplam Kayıt</span>
                                        <span className="text-xl font-bold text-purple-600">
                                            {visitorTrends.trend ? visitorTrends.trend.reduce((a: number, b: any) => a + parseInt(String(b.count)), 0) : 0}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-600 text-sm">Toplam Kişi</span>
                                        <span className="text-xl font-bold text-indigo-600">
                                            {visitorTrends.trend ? visitorTrends.trend.reduce((a: number, b: any) => a + parseInt(String(b.total_persons || 0)), 0) : 0}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="visitor-busy-days">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 En Yoğun Gün ({getDaysLabel()})</h3>
                                {visitorTrends.trend && visitorTrends.trend.length > 0 && (
                                    <div className="space-y-2">
                                        {[...visitorTrends.trend]
                                            .sort((a: any, b: any) => parseInt(String(b.total_persons || 0)) - parseInt(String(a.total_persons || 0)))
                                            .slice(0, 3)
                                            .map((day: any, index: number) => (
                                                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'
                                                            }`}>
                                                            {index + 1}
                                                        </span>
                                                        <span className="text-sm text-gray-700">{formatDate(day.date)}</span>
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-800">{day.total_persons} kişi</span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Vehicles Tab */}
                {activeTab === 'vehicles' && vehicleStats && (
                    <div className="space-y-6">
                        {/* Dönem Bilgisi Başlık */}
                        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                            <p className="text-sm font-medium text-slate-600">📅 {getDaysLabel()} verilerini görüntülüyorsunuz</p>
                        </div>

                        {/* Araç Kullanım Trendi */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="vehicle-daily-trend">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">🚗 Araç Kullanım Trendi ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={350}>
                                <AreaChart data={vehicleStats.trend}>
                                    <defs>
                                        <linearGradient id="colorVehicles" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                    <XAxis dataKey="date" tickFormatter={formatDate} />
                                    <YAxis />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="count"
                                        name="Kullanım Sayısı"
                                        stroke={CHART_COLORS.secondary}
                                        fillOpacity={1}
                                        fill="url(#colorVehicles)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* En Çok Kullanılan Araçlar */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="vehicle-top-vehicles">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">🏆 En Çok Kullanılan Araçlar ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={vehicleStats.topVehicles} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis type="number" />
                                        <YAxis
                                            dataKey="plate"
                                            type="category"
                                            width={100}
                                            tick={{ fontSize: 12 }}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="usage_count" name="Kullanım" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]}>
                                            {vehicleStats.topVehicles.map((_: any, index: number) => (
                                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* En Çok Araç Alan Yöneticiler */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="vehicle-top-managers">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">👤 En Çok Araç Alan Yöneticiler ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={vehicleStats.topManagers} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis type="number" />
                                        <YAxis
                                            dataKey="manager_name"
                                            type="category"
                                            width={120}
                                            tick={{ fontSize: 11 }}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="usage_count" name="Kullanım" fill={CHART_COLORS.warning} radius={[0, 4, 4, 0]}>
                                            {vehicleStats.topManagers.map((_: any, index: number) => (
                                                <Cell key={index} fill={COLORS[(index + 3) % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* En Çok Gidilen Lokasyonlar */}
                        {vehicleStats.topDestinations && vehicleStats.topDestinations.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="vehicle-top-destinations">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">📍 En Çok Gidilen Yerler ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={vehicleStats.topDestinations} layout="horizontal">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis type="category" dataKey="destination" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 10 }} />
                                        <YAxis type="number" />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name="Sefer Sayısı" fill={CHART_COLORS.purple} radius={[4, 4, 0, 0]}>
                                            {vehicleStats.topDestinations.map((_: any, index: number) => (
                                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Gün x Saat Isı Haritası */}
                        {vehicleStats.hourlyHeatmap && vehicleStats.hourlyHeatmap.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="vehicle-hourly-heatmap">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">🔥 Araç Kullanım Yoğunluğu ({getDaysLabel()} - Gün x Saat)</h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th className="border border-gray-300 px-2 sm:px-4 py-2 bg-gray-50 text-xs sm:text-sm">Gün \\ Saat</th>
                                                {Array.from({ length: 24 }, (_, i) => (
                                                    <th key={i} className="border border-gray-300 px-1.5 sm:px-2 py-2 bg-gray-50 text-[10px] sm:text-xs">{String(i).padStart(2, '0')}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'].map((day, dayIndex) => {
                                                const dayData = vehicleStats.hourlyHeatmap.filter((h: any) => parseInt(h.day_of_week) === dayIndex);
                                                const maxCount = Math.max(...vehicleStats.hourlyHeatmap.map((h: any) => parseInt(h.count || 0)), 1);

                                                return (
                                                    <tr key={dayIndex}>
                                                        <td className="border border-gray-300 px-2 sm:px-4 py-2 font-medium bg-gray-50 text-xs sm:text-sm whitespace-nowrap">{day}</td>
                                                        {Array.from({ length: 24 }, (_, hour) => {
                                                            const hourData = dayData.find((h: any) => parseInt(h.hour) === hour);
                                                            const count = hourData ? parseInt(hourData.count || 0) : 0;
                                                            const intensity = count / maxCount;
                                                            const bgColor = count === 0 ? '#f3f4f6' :
                                                                intensity < 0.25 ? '#d1fae5' :
                                                                    intensity < 0.5 ? '#6ee7b7' :
                                                                        intensity < 0.75 ? '#10b981' : '#047857';
                                                            const textColor = intensity > 0.5 ? 'white' : 'black';

                                                            return (
                                                                <td
                                                                    key={hour}
                                                                    className="border border-gray-300 px-2 py-2 text-center text-xs cursor-pointer hover:opacity-80 transition-opacity"
                                                                    style={{ backgroundColor: bgColor, color: textColor }}
                                                                    title={`${day} ${String(hour).padStart(2, '0')}:00 - ${count} araç`}
                                                                >
                                                                    {count > 0 ? count : ''}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                                    <span>Daha az</span>
                                    <div className="flex gap-1">
                                        <div className="w-4 h-4 border" style={{ backgroundColor: '#f3f4f6' }}></div>
                                        <div className="w-4 h-4 border" style={{ backgroundColor: '#d1fae5' }}></div>
                                        <div className="w-4 h-4 border" style={{ backgroundColor: '#6ee7b7' }}></div>
                                        <div className="w-4 h-4 border" style={{ backgroundColor: '#10b981' }}></div>
                                        <div className="w-4 h-4 border" style={{ backgroundColor: '#047857' }}></div>
                                    </div>
                                    <span>Daha çok</span>
                                </div>
                            </div>
                        )}

                        {/* Kelime Bulutu - En Çok Gidilen Yerler */}
                        {vehicleStats.topDestinations && vehicleStats.topDestinations.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="vehicle-destinations-cloud">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">☁️ Hedef Lokasyonlar ({getDaysLabel()})</h3>
                                <div className="w-full flex justify-center overflow-auto">
                                    <div className="w-full" style={{ minWidth: '100%', maxWidth: '100%' }}>
                                        <WordCloud
                                            data={vehicleStats.topDestinations.map((item: any) => ({
                                                text: item.destination,
                                                value: item.count
                                            }))}
                                            width={getWordCloudWidth()}
                                            height={300}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}


                    </div>
                )}

                {/* Managers Tab */}
                {/* Fire Alarms Tab */}
                {activeTab === 'fire-alarms' && (
                    <div className="space-y-6">
                        {/* Dönem Bilgisi Başlık */}
                        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                            <p className="text-sm font-medium text-slate-600">📅 {getDaysLabel()} verilerini görüntülüyorsunuz</p>
                        </div>

                        {/* Özet Kartlar */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-600 text-sm">Toplam Alarm ({getDaysLabel()})</p>
                                        <p className="text-3xl font-bold text-red-600 mt-2">
                                            {fireAlarmStats.dailyTrend?.reduce((a: number, b: any) => a + parseInt(b.count || 0), 0) || 0}
                                        </p>
                                    </div>
                                    <Flame size={32} className="text-red-500" />
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-600 text-sm">Gerçek Alarm ({getDaysLabel()})</p>
                                        <p className="text-3xl font-bold text-orange-600 mt-2">
                                            {fireAlarmStats.dailyTrend?.reduce((a: number, b: any) => a + parseInt(b.real_alarms || 0), 0) || 0}
                                        </p>
                                    </div>
                                    <Flame size={32} className="text-orange-500" />
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-600 text-sm">Yanlış Alarm ({getDaysLabel()})</p>
                                        <p className="text-3xl font-bold text-green-600 mt-2">
                                            {fireAlarmStats.dailyTrend?.reduce((a: number, b: any) => a + parseInt(b.false_alarms || 0), 0) || 0}
                                        </p>
                                    </div>
                                    <Flame size={32} className="text-green-500" />
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-gray-600 text-sm">Doğruluk Oranı ({getDaysLabel()})</p>
                                        <p className="text-3xl font-bold text-blue-600 mt-2">
                                            {(() => {
                                                const total = fireAlarmStats.dailyTrend?.reduce((a: number, b: any) => a + parseInt(b.count || 0), 0) || 0;
                                                const real = fireAlarmStats.dailyTrend?.reduce((a: number, b: any) => a + parseInt(b.real_alarms || 0), 0) || 0;
                                                return total > 0 ? `${((real / total) * 100).toFixed(0)}%` : '0%';
                                            })()}
                                        </p>
                                    </div>
                                    <TrendingUp size={32} className="text-blue-500" />
                                </div>
                            </div>
                        </div>

                        {/* Günlük Alarm Sayısı - Bar Chart */}
                        {fireAlarmStats.dailyTrend && fireAlarmStats.dailyTrend.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="fire-alarm-daily-trend">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">📈 Alarm Sayısı ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart data={fireAlarmStats.dailyTrend}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="date" tickFormatter={formatDate} />
                                        <YAxis />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name="Toplam Alarm" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Saatlik Alarm Çalma Trendi */}
                        {fireAlarmStats.hourlyTrend && fireAlarmStats.hourlyTrend.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="fire-alarm-hourly-trend">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">🕔 Saatlik Alarm Çalma Trendi ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart data={fireAlarmStats.hourlyTrend.map((item: any) => ({
                                        ...item,
                                        total: (parseInt(item.real_alarms || 0) + parseInt(item.false_alarms || 0))
                                    }))}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis
                                            dataKey="hour"
                                            tickFormatter={(hour) => `${hour}:00`}
                                        />
                                        <YAxis />
                                        <Tooltip
                                            content={<CustomTooltip />}
                                            labelFormatter={(hour) => `Saat: ${hour}:00`}
                                        />
                                        <Bar dataKey="total" name="Toplam Alarm" fill={CHART_COLORS.danger} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Lokasyon Kelime Bulutu */}
                        {fireAlarmStats.locationDistribution && fireAlarmStats.locationDistribution.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="fire-alarm-locations-cloud">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">☁️ Alarm Lokasyonları ({getDaysLabel()})</h3>
                                <div className="w-full flex justify-center overflow-auto">
                                    <div className="w-full" style={{ minWidth: '100%', maxWidth: '100%' }}>
                                        <WordCloud
                                            data={fireAlarmStats.locationDistribution.map((item: any) => ({
                                                text: item.location,
                                                value: item.count
                                            }))}
                                            width={getWordCloudWidth()}
                                            height={300}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Lokasyon Bar Chart */}
                        {fireAlarmStats.locationDistribution && fireAlarmStats.locationDistribution.length > 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="fire-alarm-locations-chart">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">📍 En Çok Alarm Olan Lokasyonlar ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={350}>
                                    <BarChart data={fireAlarmStats.locationDistribution.slice(0, 10)} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="location" type="category" width={150} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name="Alarm Sayısı" fill={CHART_COLORS.danger} radius={[0, 4, 4, 0]}>
                                            {fireAlarmStats.locationDistribution.slice(0, 10).map((_: any, index: number) => (
                                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                    </div>
                )}

                {/* Incidents Tab */}
                {activeTab === 'incidents' && (
                    <div className="space-y-6">
                        {/* Dönem Bilgisi Başlık */}
                        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                            <p className="text-sm font-medium text-slate-600">📅 {getDaysLabel()} verilerini görüntülüyorsunuz</p>
                        </div>

                        {/* Kategori İstatistikleri - Ana Kartlar */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-red-100 rounded-lg">
                                        <span className="text-2xl">🚨</span>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Hırsızlık</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {parseInt(incidentStats?.categoryStats?.theft_total) || 0}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-orange-100 rounded-lg">
                                        <span className="text-2xl">👊</span>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Saldırı/Kavga</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {parseInt(incidentStats?.categoryStats?.assault_total) || 0}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-yellow-100 rounded-lg">
                                        <span className="text-2xl">⚕️</span>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Tıbbi Acil</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {parseInt(incidentStats?.categoryStats?.medical_total) || 0}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <span className="text-2xl">🔨</span>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Vandalizm</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {parseInt(incidentStats?.categoryStats?.vandalism_total) || 0}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <span className="text-2xl">🚑</span>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Kaza</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {parseInt(incidentStats?.categoryStats?.accident_total) || 0}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-pink-100 rounded-lg">
                                        <span className="text-2xl">💊</span>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Madde Kullanımı</p>
                                        <p className="text-2xl font-bold text-gray-900">
                                            {parseInt(incidentStats?.categoryStats?.substance_total) || 0}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Ana Kategori Dağılımı - Pasta Grafiği */}
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-category-distribution">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Kategori Bazlı Olay Dağılımı ({getDaysLabel()})</h3>
                            <ResponsiveContainer width="100%" height={400}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Hırsızlık', value: parseInt(incidentStats?.categoryStats?.theft_total) || 0 },
                                            { name: 'Saldırı/Kavga', value: parseInt(incidentStats?.categoryStats?.assault_total) || 0 },
                                            { name: 'Tıbbi Acil', value: parseInt(incidentStats?.categoryStats?.medical_total) || 0 },
                                            { name: 'Vandalizm', value: parseInt(incidentStats?.categoryStats?.vandalism_total) || 0 },
                                            { name: 'Kaza/Yaralanma', value: parseInt(incidentStats?.categoryStats?.accident_total) || 0 },
                                            { name: 'Madde Kullanımı', value: parseInt(incidentStats?.categoryStats?.substance_total) || 0 }
                                        ]}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => (percent && percent > 0) ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                                        outerRadius={120}
                                        dataKey="value"
                                    >
                                        <Cell fill="#EF4444" />
                                        <Cell fill="#F59E0B" />
                                        <Cell fill="#3B82F6" />
                                        <Cell fill="#8B5CF6" />
                                        <Cell fill="#10B981" />
                                        <Cell fill="#EC4899" />
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Hırsızlık Detayı */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-theft">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">🚨 Hırsızlık Kategorileri ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={[
                                        { name: 'Misafir Eşyası', count: parseInt(incidentStats?.categoryStats?.theft_guest_property) || 0 },
                                        { name: 'Otel Mülkiyeti', count: parseInt(incidentStats?.categoryStats?.theft_hotel_property) || 0 },
                                        { name: 'Personel Hırsızlığı', count: parseInt(incidentStats?.categoryStats?.theft_personnel) || 0 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                                        <YAxis />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name="Olay Sayısı" fill="#EF4444" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Saldırı/Kavga Detayı */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-assault">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">👊 Saldırı & Kavga Kategorileri ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={[
                                        { name: 'Fiziksel Saldırı', count: parseInt(incidentStats?.categoryStats?.assault_physical) || 0 },
                                        { name: 'Sözlü Taciz', count: parseInt(incidentStats?.categoryStats?.assault_verbal) || 0 },
                                        { name: 'Toplu Kavga', count: parseInt(incidentStats?.categoryStats?.assault_mass_fight) || 0 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                                        <YAxis />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name="Olay Sayısı" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Tıbbi Acil Detayı */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-medical">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">⚕️ Tıbbi Acil Kategorileri ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Ciddi Tıbbi Durum', value: parseInt(incidentStats?.categoryStats?.medical_serious) || 0 },
                                                { name: 'İlk Yardım', value: parseInt(incidentStats?.categoryStats?.medical_first_aid) || 0 },
                                                { name: 'Ambulans Çağrısı', value: parseInt(incidentStats?.categoryStats?.medical_ambulance) || 0 }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            dataKey="value"
                                            labelLine={false}
                                            label={({ name, percent }) => (percent && percent > 0) ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                                        >
                                            <Cell fill="#3B82F6" />
                                            <Cell fill="#10B981" />
                                            <Cell fill="#F59E0B" />
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Vandalizm Kategorileri */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-vandalism">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">🔨 Vandalizm & Hasar Kategorileri ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={[
                                        { name: 'Oda Hasarı', count: parseInt(incidentStats?.categoryStats?.vandalism_room) || 0 },
                                        { name: 'Ortak Alan Hasarı', count: parseInt(incidentStats?.categoryStats?.vandalism_common_area) || 0 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name="Olay Sayısı" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Madde Kullanımı Kategorileri */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-substance">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">💊 Madde Kullanımı Kategorileri ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Personel (Görevde)', value: parseInt(incidentStats?.categoryStats?.substance_personnel) || 0 },
                                                { name: 'Mülkte Bulunma', value: parseInt(incidentStats?.categoryStats?.substance_property) || 0 }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={100}
                                            dataKey="value"
                                            labelLine={false}
                                            label={({ name, percent }) => (percent && percent > 0) ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                                        >
                                            <Cell fill="#EC4899" />
                                            <Cell fill="#F472B6" />
                                        </Pie>
                                        <Tooltip />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Kaza/Yaralanma Detayı */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-accident">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">🚑 Kaza & Yaralanma Kategorileri ({getDaysLabel()})</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={[
                                        { name: 'Kayma/Düşme', count: parseInt(incidentStats?.categoryStats?.accident_slip_fall) || 0 },
                                        { name: 'Ekipman Kazası', count: parseInt(incidentStats?.categoryStats?.accident_equipment) || 0 },
                                        { name: 'İş Kazası', count: parseInt(incidentStats?.categoryStats?.accident_work) || 0 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                        <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                                        <YAxis />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Bar dataKey="count" name="Olay Sayısı" fill="#10B981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Diğer Kategoriler */}
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Diğer Kategoriler ({getDaysLabel()})</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-pink-100 rounded-xl border border-pink-200">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">💊</span>
                                            <span className="text-sm font-medium text-gray-700">Madde (Personel)</span>
                                        </div>
                                        <span className="text-lg font-bold text-pink-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.substance_personnel) || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-pink-100 rounded-xl border border-pink-200">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">💊</span>
                                            <span className="text-sm font-medium text-gray-700">Madde (Mülk)</span>
                                        </div>
                                        <span className="text-lg font-bold text-pink-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.substance_property) || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">🔨</span>
                                            <span className="text-sm font-medium text-gray-700">Vandalizm (Oda)</span>
                                        </div>
                                        <span className="text-lg font-bold text-purple-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.vandalism_room) || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">🔨</span>
                                            <span className="text-sm font-medium text-gray-700">Vandalizm (Alan)</span>
                                        </div>
                                        <span className="text-lg font-bold text-purple-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.vandalism_common_area) || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">🚪</span>
                                            <span className="text-sm font-medium text-gray-700">İzinsiz Giriş (Oda)</span>
                                        </div>
                                        <span className="text-lg font-bold text-amber-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.unauthorized_room) || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">🚪</span>
                                            <span className="text-sm font-medium text-gray-700">İzinsiz (Kısıtlı)</span>
                                        </div>
                                        <span className="text-lg font-bold text-amber-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.unauthorized_restricted_area) || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">📹</span>
                                            <span className="text-sm font-medium text-gray-700">CCTV Arızası</span>
                                        </div>
                                        <span className="text-lg font-bold text-blue-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.security_cctv_malfunction) || 0}</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">📝</span>
                                            <span className="text-sm font-medium text-gray-700">Diğer</span>
                                        </div>
                                        <span className="text-lg font-bold text-gray-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.other) || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
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
                                <div className="flex-1 relative group">
                                    <button
                                        disabled={true}
                                        className="w-full px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
                                        title="PDF export şu anda bakım aşamasındadır"
                                    >
                                        <Download size={18} />
                                        PDF İndir
                                    </button>
                                    <div className="absolute bottom-full left-0 right-0 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50">
                                        Bakım aşamasında
                                    </div>
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
