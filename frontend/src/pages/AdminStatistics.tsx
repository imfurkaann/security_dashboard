import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Download, ChevronLeft } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { DatePicker } from 'antd';
import dayjs from '../utils/dayjsConfig';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import OverviewTab from '../components/statistics/OverviewTab';
import VisitorsTab from '../components/statistics/VisitorsTab';
import VehiclesTab from '../components/statistics/VehiclesTab';
import FireAlarmsTab from '../components/statistics/FireAlarmsTab';
import IncidentsTab from '../components/statistics/IncidentsTab';

const { RangePicker } = DatePicker;

const AdminStatistics = () => {
    const navigate = useNavigate();

    // Tarih aralığı (Varsayılan son 30 gün)
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [activeTab, setActiveTab] = useState<'overview' | 'visitors' | 'vehicles' | 'fire-alarms' | 'incidents'>('overview');
    const [refetchKey, setRefetchKey] = useState(0);

    // PDF Raporlama Durumları
    const [showExportModal, setShowExportModal] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [reportTitle, setReportTitle] = useState('Sistem Analitiği ve İstatistik Raporu');
    const [exportOptions, setExportOptions] = useState({
        overview: true,
        visitors: true,
        vehicles: true,
        'fire-alarms': true,
        incidents: true
    });

    // Gerçek zamanlı refetch desteği
    useRealtimeRefetch({
        topics: ['dashboard', 'incidents', 'sgk'],
        onMutation: () => setRefetchKey(prev => prev + 1),
    });

    const handlePDFExport = async () => {
        setIsExporting(true);
        const originalActiveTab = activeTab;

        try {
            const selectedTabs = Object.entries(exportOptions)
                .filter(([_, value]) => value)
                .map(([key]) => key);

            if (selectedTabs.length === 0) {
                alert('Lütfen en az bir kategori seçin.');
                setIsExporting(false);
                return;
            }

            const sectionIds: Record<string, string[]> = {
                overview: ['overview-stats-cards', 'overview-grid-1', 'overview-grid-2', 'overview-grid-tag-trends', 'overview-grid-3'],
                visitors: ['visitors-traffic-chart', 'visitors-duration-chart', 'visitors-heatmap', 'visitors-grid-2'],
                vehicles: ['vehicles-trend-chart', 'vehicles-grid-1', 'vehicles-destinations', 'vehicles-heatmap', 'vehicles-wordcloud'],
                'fire-alarms': ['fire-stats-cards', 'fire-trends', 'fire-locations'],
                incidents: ['incident-stats-cards', 'incident-main-dist', 'incident-sub-charts']
            };

            const capturedCanvases: { tab: string; canvas: HTMLCanvasElement }[] = [];
            const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            // Fullscreen loader shows up, so let's cycle activeTab to render hidden components
            for (const tabKey of selectedTabs) {
                setActiveTab(tabKey as any);
                // Allow a brief moment for the browser to render the tab and Recharts to resize properly
                await sleep(500);

                const ids = sectionIds[tabKey] || [];
                for (const id of ids) {
                    const el = document.getElementById(id);
                    if (el) {
                        const canvas = await html2canvas(el, {
                            scale: 2,
                            useCORS: true,
                            backgroundColor: '#ffffff',
                            logging: false
                        });
                        capturedCanvases.push({ tab: tabKey, canvas });
                    }
                }
            }

            // Restore active tab
            setActiveTab(originalActiveTab);
            await sleep(100);

            // Initialize PDF
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 15;
            const contentWidth = pageWidth - 2 * margin; // 180mm

            let currentY = 30; // Start printing below banner
            let isFirstPage = true;

            const formatTurkishDate = (dateStr: string) => {
                if (!dateStr) return '';
                const parts = dateStr.split('-');
                if (parts.length === 3) {
                    return `${parts[2]}.${parts[1]}.${parts[0]}`;
                }
                return dateStr;
            };

            const periodText = `Rapor Dönemi: ${formatTurkishDate(startDate)} - ${formatTurkishDate(endDate)}`;
            const printDateText = `Yazdırma Tarihi: ${new Date().toLocaleString('tr-TR')}`;

            for (const item of capturedCanvases) {
                const canvas = item.canvas;
                const scaledWidth = contentWidth;
                const scaledHeight = (canvas.height * scaledWidth) / canvas.width;

                // Check if element height overflows page printable height (265mm limit to leave room for footer)
                if (!isFirstPage && currentY + scaledHeight > 265) {
                    doc.addPage();
                    currentY = 30; // Reset Y below banner
                }

                if (isFirstPage) {
                    isFirstPage = false;
                }

                const imgData = canvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', margin, currentY, scaledWidth, scaledHeight);
                currentY += scaledHeight + 10; // add gap
            }

            // Add Banner Header and Page Number Footers to all pages
            const totalPages = doc.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);

                // Top Banner Background
                doc.setFillColor(15, 23, 42); // slate-900
                doc.rect(0, 0, pageWidth, 18, 'F');

                // Header Title
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(10);
                doc.setFont('helvetica', 'bold');
                doc.text(reportTitle.toUpperCase(), margin, 11);

                // Header Period (aligned right)
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(periodText, pageWidth - margin - doc.getTextWidth(periodText), 11);

                // Subtle blue accent line below banner
                doc.setDrawColor(59, 130, 246); // blue-500
                doc.setLineWidth(1);
                doc.line(0, 18, pageWidth, 18);

                // Footer Line
                doc.setDrawColor(226, 232, 240); // slate-200
                doc.setLineWidth(0.5);
                doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

                // Footer Text
                doc.setTextColor(100, 116, 139); // slate-500
                doc.setFontSize(7);
                doc.text(printDateText, margin, pageHeight - 10);

                const pageStr = `Sayfa ${i} / ${totalPages}`;
                doc.text(pageStr, pageWidth - margin - doc.getTextWidth(pageStr), pageHeight - 10);
            }

            // Save document
            doc.save(`${reportTitle.toLowerCase().replace(/\s+/g, '_')}_${startDate}_${endDate}.pdf`);
            setShowExportModal(false);
        } catch (error) {
            console.error('PDF Dışa aktarma hatası:', error);
            alert('PDF raporu oluşturulurken bir hata oluştu.');
        } finally {
            setIsExporting(false);
            setActiveTab(originalActiveTab);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans antialiased text-slate-800">
            {/* Üst Header Alanı (Compacted) */}
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700 sticky top-0 z-15">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 sm:py-2">
                    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                        
                        {/* Başlık ve Geri Dön Butonu */}
                        <div className="flex items-center gap-2.5 min-w-0">
                            <button 
                                onClick={() => navigate('/dashboard')} 
                                className="p-1.5 hover:bg-slate-800 rounded-lg transition shrink-0"
                                title="Kontrol Paneline Dön"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-lg sm:text-xl font-bold text-white leading-tight">Sistem Analitiği ve İstatistikler</h1>
                                <p className="text-[11px] sm:text-xs text-slate-350 mt-0.5">Sistem verilerini ve grafiksel analizleri inceleyin</p>
                            </div>
                        </div>

                        {/* Filtre ve Kontrol Alanı (Compacted & Light Inputs) */}
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Tarih Seçici */}
                            <RangePicker
                                value={[
                                    startDate ? dayjs(startDate) : null,
                                    endDate ? dayjs(endDate) : null
                                ]}
                                onChange={(dates) => {
                                    if (dates && dates[0] && dates[1]) {
                                        setStartDate(dates[0].format('YYYY-MM-DD'));
                                        setEndDate(dates[1].format('YYYY-MM-DD'));
                                    }
                                }}
                                allowClear={false}
                                format="DD/MM/YYYY"
                                placeholder={['Başlangıç', 'Bitiş']}
                                size="small"
                                className="w-[200px] sm:w-[220px]"
                            />

                            {/* Hızlı Seçim Presetleri */}
                            <div className="flex items-center gap-1 bg-slate-800/40 border border-slate-700/60 p-0.5 rounded-lg">
                                {[
                                    { label: '7G', val: 7 },
                                    { label: '30G', val: 30 },
                                    { label: '3A', val: 90 },
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
                                        className="px-2 py-0.5 text-[10px] font-bold text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-all"
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                    </div>
                </div>
            </header>

            {/* Navigasyon Sekmeleri (Light & Compacted) */}
            <div className="bg-white border-b border-slate-200 sticky top-[53px] z-10 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between py-1.5 overflow-x-auto gap-4 scrollbar-none">
                        <div className="flex gap-1.5 min-w-max p-1 bg-slate-100/80 border border-slate-200/60 rounded-xl">
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
                                    className={`whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-all duration-200 ${activeTab === tab.key
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* PDF Dışa Aktar Butonu */}
                        <button
                            onClick={() => setShowExportModal(true)}
                            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 px-3 py-1 text-xs font-semibold rounded-lg shrink-0 transition"
                        >
                            <Download size={13} className="shrink-0" />
                            <span>PDF Rapor</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Ana İstatistik İçerik Alanı (Dikeyde py-3 ve gap-3 olarak küçültülmüş) */}
            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-3 pb-14 flex flex-col gap-3">
                {/* 1. Genel Bakış Sekmesi */}
                <div className={activeTab === 'overview' ? 'block' : 'hidden'}>
                    <OverviewTab startDate={startDate} endDate={endDate} refetchKey={refetchKey} />
                </div>

                {/* 2. Ziyaretçiler Sekmesi */}
                <div className={activeTab === 'visitors' ? 'block' : 'hidden'}>
                    <VisitorsTab startDate={startDate} endDate={endDate} refetchKey={refetchKey} />
                </div>

                {/* 3. Araç Kullanımı Sekmesi */}
                <div className={activeTab === 'vehicles' ? 'block' : 'hidden'}>
                    <VehiclesTab startDate={startDate} endDate={endDate} refetchKey={refetchKey} />
                </div>

                {/* 4. Yangın Alarmları Sekmesi */}
                <div className={activeTab === 'fire-alarms' ? 'block' : 'hidden'}>
                    <FireAlarmsTab startDate={startDate} endDate={endDate} refetchKey={refetchKey} />
                </div>

                {/* 5. Olay İstatistikleri Sekmesi */}
                <div className={activeTab === 'incidents' ? 'block' : 'hidden'}>
                    <IncidentsTab startDate={startDate} endDate={endDate} refetchKey={refetchKey} />
                </div>
            </main>

            {/* PDF Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <Download size={16} className="text-blue-400" />
                                <h3 className="text-sm font-bold">PDF Rapor Oluşturucu</h3>
                            </div>
                            <button
                                onClick={() => !isExporting && setShowExportModal(false)}
                                className="text-slate-400 hover:text-white transition text-xs font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4 space-y-4 text-slate-800 text-xs">
                            {/* Rapor Adı */}
                            <div className="space-y-1">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rapor Başlığı</label>
                                <input
                                    type="text"
                                    value={reportTitle}
                                    onChange={(e) => setReportTitle(e.target.value)}
                                    disabled={isExporting}
                                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs disabled:bg-slate-50 disabled:text-slate-400 font-medium"
                                    placeholder="Rapor adını girin..."
                                />
                            </div>

                            {/* Dönem Bilgisi (Readonly) */}
                            <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
                                <span className="font-semibold text-slate-500">Rapor Tarih Aralığı:</span>
                                <span className="font-bold text-slate-800">
                                    {startDate.split('-').reverse().join('.')} - {endDate.split('-').reverse().join('.')}
                                </span>
                            </div>

                            {/* Bölüm Seçimi */}
                            <div className="space-y-2">
                                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dışa Aktarılacak Sayfalar</label>
                                <div className="border border-slate-200 rounded-lg p-2.5 space-y-2 bg-white">
                                    {[
                                        { key: 'overview', label: '📊 Genel Bakış' },
                                        { key: 'visitors', label: '👥 Ziyaretçi Analizleri' },
                                        { key: 'vehicles', label: '🚗 Araç Kullanım İstatistikleri' },
                                        { key: 'fire-alarms', label: '🔥 Yangın Alarmları' },
                                        { key: 'incidents', label: '🚨 Olay İstatistikleri' }
                                    ].map((opt) => (
                                        <label
                                            key={opt.key}
                                            className="flex items-center gap-2.5 p-1 hover:bg-slate-50 rounded cursor-pointer transition select-none font-semibold text-slate-700"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={exportOptions[opt.key as keyof typeof exportOptions]}
                                                onChange={() => !isExporting && setExportOptions(prev => ({ ...prev, [opt.key]: !prev[opt.key as keyof typeof exportOptions] }))}
                                                disabled={isExporting}
                                                className="w-3.5 h-3.5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                                            />
                                            <span>{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Modal Actions */}
                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowExportModal(false)}
                                disabled={isExporting}
                                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                İptal
                            </button>
                            <button
                                type="button"
                                onClick={handlePDFExport}
                                disabled={isExporting}
                                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                            >
                                {isExporting ? (
                                    <>
                                        <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                                        <span>Rapor Hazırlanıyor...</span>
                                    </>
                                ) : (
                                    <>
                                        <Download size={13} />
                                        <span>PDF Raporu İndir</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminStatistics;
