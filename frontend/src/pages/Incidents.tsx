import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Checkbox } from 'antd';
import api from '../utils/api';
import { isValidLength } from '../utils/validation';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import CustomModal from '../components/Modal';
import ActionButton from '../components/ActionButton';


// Vardiya tanımları
const SHIFTS = [
    { id: '1', label: '00:00-08:00', start: 0, end: 8 },
    { id: '2', label: '08:00-16:00', start: 8, end: 16 },
    { id: '3', label: '16:00-00:00', start: 16, end: 24 },
];

// Vardiya için buton erişilebilirliğini kontrol et
const getShiftAccess = (startHour: number, endHour: number): {
    accessible: boolean;
    message: string;
    hoursUntil: number;
} => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTotalMinutes = currentHour * 60 + currentMinute;

    // Vardiya başlangıç ve bitiş saatlerini dakikaya çevir
    let shiftStartMinutes = startHour * 60 - 20; // 20 dk önce
    let shiftEndMinutes = (endHour === 24 ? 0 : endHour) * 60 + 30; // 30 dk sonra

    // Gece vardiyası için özel durum (16:00-00:00)
    if (startHour > endHour || endHour === 24) {
        // Akşam 15:40'tan gece 00:30'a kadar
        if (currentTotalMinutes >= shiftStartMinutes || currentTotalMinutes <= 30) {
            return { accessible: true, message: 'Rapor yazabilirsiniz', hoursUntil: 0 };
        }
        // Vardiyaya ne kadar kaldı?
        const minutesUntil = shiftStartMinutes - currentTotalMinutes;
        const hoursUntil = Math.ceil(minutesUntil / 60);
        return {
            accessible: false,
            message: `${hoursUntil} saat sonra vardiyanız başlayacaktır`,
            hoursUntil
        };
    }

    // Normal vardiyalar (00:00-08:00, 08:00-16:00)
    if (currentTotalMinutes >= shiftStartMinutes && currentTotalMinutes <= shiftEndMinutes) {
        return { accessible: true, message: 'Rapor yazabilirsiniz', hoursUntil: 0 };
    }

    // Vardiyaya ne kadar kaldı?
    let minutesUntil = shiftStartMinutes - currentTotalMinutes;
    if (minutesUntil < 0) {
        minutesUntil += 24 * 60; // Bir sonraki gün
    }
    const hoursUntil = Math.ceil(minutesUntil / 60);

    return {
        accessible: false,
        message: `${hoursUntil} saat sonra vardiyanız başlayacaktır`,
        hoursUntil
    };
};

export default function Incidents() {
    const [showReportModal, setShowReportModal] = useState(false);
    const [selectedShift, setSelectedShift] = useState<string | null>(null);
    const [existingReportId, setExistingReportId] = useState<string | null>(null);
    const [shiftReports, setShiftReports] = useState<Record<string, any>>({});
    const [reportContent, setReportContent] = useState('');
    const [categories, setCategories] = useState<Record<string, boolean>>({
        theft_guest_property: false,
        theft_hotel_property: false,
        theft_personnel: false,
        assault_physical: false,
        assault_verbal: false,
        assault_mass_fight: false,
        substance_personnel: false,
        substance_property: false,
        vandalism_room: false,
        vandalism_common_area: false,
        unauthorized_room: false,
        unauthorized_restricted_area: false,
        accident_slip_fall: false,
        accident_equipment: false,
        accident_work: false,
        medical_serious: false,
        medical_first_aid: false,
        medical_ambulance: false,
        fire_real: false,
        fire_false_alarm: false,
        fire_evacuation: false,
        security_cctv_malfunction: false,
        other: false
    });
    const navigate = useNavigate();

    const isFormDirty = useMemo(() => {
        if (!existingReportId) {
            return reportContent.trim() !== '';
        }
        const originalReport = selectedShift ? shiftReports[selectedShift] : null;
        if (!originalReport) return reportContent.trim() !== '';

        const originalContent = originalReport.report_content || '';
        if (reportContent !== originalContent) return true;

        const originalCategories = originalReport.categories || {};
        for (const key of Object.keys(categories)) {
            if (!!categories[key] !== !!originalCategories[key]) return true;
        }

        return false;
    }, [existingReportId, reportContent, selectedShift, shiftReports, categories]);

    // Bugünkü vardiya raporlarını yükle
    const loadShiftReports = useCallback(async () => {
        const reports: Record<string, any> = {};
        for (const shift of SHIFTS) {
            try {
                const res = await api.get(`/incidents/reports/${shift.label}`);
                if (res.data?.success && res.data?.data) {
                    reports[shift.label] = res.data.data;
                }
            } catch (err) {
                // Rapor yoksa 404 dönecek, sorun değil
            }
        }
        setShiftReports(reports);
    }, []);

    useEffect(() => {
        loadShiftReports();
    }, [loadShiftReports]);

    useRealtimeRefetch({
        topics: ['incidents'],
        onMutation: loadShiftReports,
        enabled: true,
    });

    // Vardiya raporunu kaydet veya güncelle
    const handleReportSubmit = useCallback(async () => {
        if (!selectedShift || !reportContent.trim()) {
            message.warning('Lütfen rapor içeriği girin');
            return;
        }

        // Uzunluk kontrolü
        if (!isValidLength(reportContent, 1, 50000)) {
            message.warning('Rapor içeriği en az 1, en fazla 50000 karakter olabilir');
            return;
        }

        try {
            const reportId = existingReportId || shiftReports[selectedShift]?.id;

            if (reportId) {
                // Güncelleme
                await api.put(`/incidents/reports/${reportId}`, {
                    report_content: reportContent,
                    categories: categories
                });
                message.success('Rapor başarıyla güncellendi ve yeni Word dosyası oluşturuldu');
            } else {
                // Yeni kayıt
                try {
                    await api.post('/incidents/reports', {
                        shift_label: selectedShift,
                        report_content: reportContent,
                        categories: categories
                    });
                    message.success('Rapor başarıyla kaydedildi ve Word dosyası oluşturuldu');
                } catch (postError) {
                    // 409 Conflict: Rapor zaten var, güncelleme yap
                    const postErr = postError as { response?: { status?: number; data?: { existingId?: string; message?: string } } };
                    if (postErr?.response?.status === 409 && postErr?.response?.data?.existingId) {
                        await api.put(`/incidents/reports/${postErr.response.data.existingId}`, {
                            report_content: reportContent,
                            categories: categories
                        });
                        message.success('Rapor başarıyla güncellendi ve yeni Word dosyası oluşturuldu');
                    } else {
                        throw postError;
                    }
                }
            }

            // Önce raporları yeniden yükle, ardından modalı kapat ve state'i sıfırla
            await loadShiftReports();

            setShowReportModal(false);
            setExistingReportId(null);
            setReportContent('');
            // Kategorileri sıfırla
            setCategories({
                theft_guest_property: false,
                theft_hotel_property: false,
                theft_personnel: false,
                assault_physical: false,
                assault_verbal: false,
                assault_mass_fight: false,
                substance_personnel: false,
                substance_property: false,
                vandalism_room: false,
                vandalism_common_area: false,
                unauthorized_room: false,
                unauthorized_restricted_area: false,
                accident_slip_fall: false,
                accident_equipment: false,
                accident_work: false,
                medical_serious: false,
                medical_first_aid: false,
                medical_ambulance: false,
                fire_real: false,
                fire_false_alarm: false,
                fire_evacuation: false,
                security_cctv_malfunction: false,
                other: false
            });
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            message.error(err?.response?.data?.message || 'Rapor kaydı başarısız');
        }
    }, [selectedShift, reportContent, existingReportId, shiftReports, loadShiftReports, categories]);

    // Rapor modal aç (yeni veya düzenle)
    const openReportModal = useCallback(async (shiftLabel: string, _isEdit: boolean = false) => {
        setSelectedShift(shiftLabel);

        // Her zaman API'den güncel veriyi çek
        try {
            const res = await api.get(`/incidents/reports/${shiftLabel}`);
            if (res.data?.success && res.data?.data) {
                const report = res.data.data;
                setExistingReportId(report.id);
                setReportContent(report.report_content || '');

                // Kategorileri yükle
                if (report.categories) {
                    setCategories({
                        theft_guest_property: report.categories.theft_guest_property || false,
                        theft_hotel_property: report.categories.theft_hotel_property || false,
                        theft_personnel: report.categories.theft_personnel || false,
                        assault_physical: report.categories.assault_physical || false,
                        assault_verbal: report.categories.assault_verbal || false,
                        assault_mass_fight: report.categories.assault_mass_fight || false,
                        substance_personnel: report.categories.substance_personnel || false,
                        substance_property: report.categories.substance_property || false,
                        vandalism_room: report.categories.vandalism_room || false,
                        vandalism_common_area: report.categories.vandalism_common_area || false,
                        unauthorized_room: report.categories.unauthorized_room || false,
                        unauthorized_restricted_area: report.categories.unauthorized_restricted_area || false,
                        accident_slip_fall: report.categories.accident_slip_fall || false,
                        accident_equipment: report.categories.accident_equipment || false,
                        accident_work: report.categories.accident_work || false,
                        medical_serious: report.categories.medical_serious || false,
                        medical_first_aid: report.categories.medical_first_aid || false,
                        medical_ambulance: report.categories.medical_ambulance || false,
                        fire_real: report.categories.fire_real || false,
                        fire_false_alarm: report.categories.fire_false_alarm || false,
                        fire_evacuation: report.categories.fire_evacuation || false,
                        security_cctv_malfunction: report.categories.security_cctv_malfunction || false,
                        other: report.categories.other || false
                    });
                } else {
                    setCategories({
                        theft_guest_property: false,
                        theft_hotel_property: false,
                        theft_personnel: false,
                        assault_physical: false,
                        assault_verbal: false,
                        assault_mass_fight: false,
                        substance_personnel: false,
                        substance_property: false,
                        vandalism_room: false,
                        vandalism_common_area: false,
                        unauthorized_room: false,
                        unauthorized_restricted_area: false,
                        accident_slip_fall: false,
                        accident_equipment: false,
                        accident_work: false,
                        medical_serious: false,
                        medical_first_aid: false,
                        medical_ambulance: false,
                        fire_real: false,
                        fire_false_alarm: false,
                        fire_evacuation: false,
                        security_cctv_malfunction: false,
                        other: false
                    });
                }
            } else {
                // API'den veri gelmedi - yeni rapor
                setExistingReportId(null);
                setReportContent('');
                setCategories({
                    theft_guest_property: false,
                    theft_hotel_property: false,
                    theft_personnel: false,
                    assault_physical: false,
                    assault_verbal: false,
                    assault_mass_fight: false,
                    substance_personnel: false,
                    substance_property: false,
                    vandalism_room: false,
                    vandalism_common_area: false,
                    unauthorized_room: false,
                    unauthorized_restricted_area: false,
                    accident_slip_fall: false,
                    accident_equipment: false,
                    accident_work: false,
                    medical_serious: false,
                    medical_first_aid: false,
                    medical_ambulance: false,
                    fire_real: false,
                    fire_false_alarm: false,
                    fire_evacuation: false,
                    security_cctv_malfunction: false,
                    other: false
                });
            }
        } catch {
            // 404 veya hata - yeni rapor olarak aç
            setExistingReportId(null);
            setReportContent('');
            setCategories({
                theft_guest_property: false,
                theft_hotel_property: false,
                theft_personnel: false,
                assault_physical: false,
                assault_verbal: false,
                assault_mass_fight: false,
                substance_personnel: false,
                substance_property: false,
                vandalism_room: false,
                vandalism_common_area: false,
                unauthorized_room: false,
                unauthorized_restricted_area: false,
                accident_slip_fall: false,
                accident_equipment: false,
                accident_work: false,
                medical_serious: false,
                medical_first_aid: false,
                medical_ambulance: false,
                fire_real: false,
                fire_false_alarm: false,
                fire_evacuation: false,
                security_cctv_malfunction: false,
                other: false
            });
        }

        setShowReportModal(true);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 sm:py-2">
                    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="p-1.5 hover:bg-slate-800 rounded-lg transition shrink-0"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-lg sm:text-xl font-bold text-white leading-tight break-words">Vardiya Rapor Sistemi</h1>
                                <p className="text-[11px] sm:text-xs text-slate-355 mt-0.5">Günlük güvenlik vardiya raporlarını kaydedin</p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/incident-records')}
                            className="flex w-full lg:w-auto items-center justify-center gap-1.5 bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg transition shadow-sm text-xs sm:text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            Kayıt Filtrele
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-3 pb-14 flex flex-col gap-3 overflow-hidden">
                <div className="max-w-6xl mx-auto w-full">
                    {/* Vardiya Kartları */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        {SHIFTS.map((shift) => {
                            const access = getShiftAccess(shift.start, shift.end);

                            return (
                                <div
                                    key={shift.id}
                                    className={`rounded-xl shadow-sm p-3 min-h-[100px] border transition-all ${access.accessible
                                        ? 'border-blue-500 bg-gradient-to-br from-blue-500 to-blue-700'
                                        : 'border-slate-200 bg-white'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 min-h-[40px] mb-2">
                                        <div className={`p-1.5 rounded-lg border shrink-0 ${access.accessible ? 'bg-white/20 border-white/20' : 'bg-blue-100 border-blue-200'}`}>
                                            <svg className={`w-5 h-5 ${access.accessible ? 'text-white' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0 flex-1 text-center">
                                            <h3 className={`text-base font-bold leading-tight ${access.accessible ? 'text-white' : 'text-gray-900'}`}>{shift.label}</h3>
                                            <span className={`text-[10px] font-medium ${access.accessible ? 'text-white/90' : 'text-gray-500'}`}>
                                                {access.message}
                                            </span>
                                        </div>
                                    </div>

                                    <p className={`text-xs mb-3 leading-relaxed ${access.accessible ? 'text-white/90' : 'text-gray-600'}`}>
                                        Günlük güvenlik olaylarını ve vardiya notlarını kaydedin. Rapor otomatik olarak Word dosyasına dönüştürülecektir.
                                    </p>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openReportModal(shift.label, !!shiftReports[shift.label])}
                                            disabled={!access.accessible}
                                            className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition flex items-center justify-center gap-1.5 text-xs sm:text-sm ${!access.accessible
                                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                : shiftReports[shift.label]
                                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md'
                                                    : 'bg-white/15 hover:bg-white/25 text-white border border-white/20'
                                                }`}
                                        >
                                            {!access.accessible ? (
                                                `${access.hoursUntil} saat kaldı`
                                            ) : shiftReports[shift.label] ? (
                                                <>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                    Raporu Düzenle
                                                </>
                                            ) : (
                                                'Rapor Yaz'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </main>

            {/* Rapor Modal */}
            <CustomModal
                isOpen={showReportModal}
                onClose={() => {
                    setShowReportModal(false);
                    setExistingReportId(null);
                }}
                size="xl"
                closeOnBackdropClick={false}
                hasUnsavedChanges={isFormDirty}
            >
                <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                            {selectedShift} Vardiya Raporu
                        </span>
                        {existingReportId && (
                            <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-md">
                                Kayıtlı Rapor Düzenleniyor
                            </span>
                        )}
                    </div>

                    {/* Basit Textarea */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Rapor İçeriği
                        </label>
                        <textarea
                            value={reportContent}
                            onChange={(e) => setReportContent(e.target.value)}
                            placeholder="Vardiya raporu içeriğini buraya yazın..."
                            className="w-full min-h-[300px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical text-sm"
                            style={{ fontFamily: 'inherit' }}
                        />
                        <p className="text-[11px] text-gray-500 mt-1">
                            {reportContent.length} / 50000 karakter
                        </p>
                    </div>

                    {/* Olay Kategorileri */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-800 mb-1">Olay Kategorileri</h3>
                        <p className="text-xs text-gray-500 mb-3">Raporda bahsettiğiniz olayları aşağıdan işaretleyin:</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* HIRSIZLIK */}
                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                                <h4 className="font-bold text-xs text-gray-700 mb-2 uppercase tracking-wider">HIRSIZLIK</h4>
                                <div className="flex flex-col gap-1.5">
                                    <Checkbox
                                        checked={categories.theft_guest_property}
                                        onChange={(e) => setCategories({ ...categories, theft_guest_property: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Misafir Eşyası Çalınması
                                    </Checkbox>
                                    <Checkbox
                                        checked={categories.theft_hotel_property}
                                        onChange={(e) => setCategories({ ...categories, theft_hotel_property: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Otel Mülkiyeti Çalınması
                                    </Checkbox>
                                    <Checkbox
                                        checked={categories.theft_personnel}
                                        onChange={(e) => setCategories({ ...categories, theft_personnel: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Personel Hırsızlığı
                                    </Checkbox>
                                </div>
                            </div>

                            {/* Saldırı & KAVGA */}
                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                                <h4 className="font-bold text-xs text-gray-700 mb-2 uppercase tracking-wider">Saldırı & KAVGA</h4>
                                <div className="flex flex-col gap-1.5">
                                    <Checkbox
                                        checked={categories.assault_physical}
                                        onChange={(e) => setCategories({ ...categories, assault_physical: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Fiziksel Saldırı
                                    </Checkbox>
                                    <Checkbox
                                        checked={categories.assault_verbal}
                                        onChange={(e) => setCategories({ ...categories, assault_verbal: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Sözlü/Davranışsal Taciz
                                    </Checkbox>
                                    <Checkbox
                                        checked={categories.assault_mass_fight}
                                        onChange={(e) => setCategories({ ...categories, assault_mass_fight: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Toplu Kavga/İzdiham
                                    </Checkbox>
                                </div>
                            </div>

                            {/* MADDE KULLANIMI */}
                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                                <h4 className="font-bold text-xs text-gray-700 mb-2 uppercase tracking-wider">MADDE KULLANIMI</h4>
                                <div className="flex flex-col gap-1.5">
                                    <Checkbox
                                        checked={categories.substance_personnel}
                                        onChange={(e) => setCategories({ ...categories, substance_personnel: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Personelin Görevde Alkol/Uyuşturucu Kullanımı
                                    </Checkbox>
                                    <Checkbox
                                        checked={categories.substance_property}
                                        onChange={(e) => setCategories({ ...categories, substance_property: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Mülkte Yasak Madde Bulunması
                                    </Checkbox>
                                </div>
                            </div>

                            {/* VANDALİZM & HASAR */}
                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                                <h4 className="font-bold text-xs text-gray-700 mb-2 uppercase tracking-wider">VANDALİZM & HASAR</h4>
                                <div className="flex flex-col gap-1.5">
                                    <Checkbox
                                        checked={categories.vandalism_room}
                                        onChange={(e) => setCategories({ ...categories, vandalism_room: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Misafirin Oda Eşyalara Kasıtlı Zarar Vermesi
                                    </Checkbox>
                                    <Checkbox
                                        checked={categories.vandalism_common_area}
                                        onChange={(e) => setCategories({ ...categories, vandalism_common_area: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Misafirin Ortak Alan Eşyalarına Kasıtlı Zarar Vermesi
                                    </Checkbox>
                                </div>
                            </div>

                            {/* İZİNSİZ GİRİŞ */}
                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                                <h4 className="font-bold text-xs text-gray-700 mb-2 uppercase tracking-wider">İZİNSİZ GİRİŞ</h4>
                                <div className="flex flex-col gap-1.5">
                                    <Checkbox
                                        checked={categories.unauthorized_room}
                                        onChange={(e) => setCategories({ ...categories, unauthorized_room: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Yetkisiz Oda Girişi
                                    </Checkbox>
                                    <Checkbox
                                        checked={categories.unauthorized_restricted_area}
                                        onChange={(e) => setCategories({ ...categories, unauthorized_restricted_area: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Kısıtlı Alan İhlali
                                    </Checkbox>
                                </div>
                            </div>

                            {/* KAZA & YARALANMA */}
                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                                <h4 className="font-bold text-xs text-gray-700 mb-2 uppercase tracking-wider">KAZA & YARALANMA</h4>
                                <div className="flex flex-col gap-1.5">
                                    <Checkbox
                                        checked={categories.accident_slip_fall}
                                        onChange={(e) => setCategories({ ...categories, accident_slip_fall: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Kayma/Düşme Kazası
                                    </Checkbox>
                                    <Checkbox
                                        checked={categories.accident_equipment}
                                        onChange={(e) => setCategories({ ...categories, accident_equipment: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Ekipman/Cihaz Kazası
                                    </Checkbox>
                                    <Checkbox
                                        checked={categories.accident_work}
                                        onChange={(e) => setCategories({ ...categories, accident_work: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        İş Kazası
                                    </Checkbox>
                                </div>
                            </div>

                            {/* TIBBİ ACİL */}
                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                                <h4 className="font-bold text-xs text-gray-700 mb-2 uppercase tracking-wider">TIBBİ ACİL</h4>
                                <div className="flex flex-col gap-1.5">
                                    <Checkbox
                                        checked={categories.medical_serious}
                                        onChange={(e) => setCategories({ ...categories, medical_serious: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Ciddi Tıbbi Durum
                                    </Checkbox>
                                    <Checkbox
                                        checked={categories.medical_first_aid}
                                        onChange={(e) => setCategories({ ...categories, medical_first_aid: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        İlk Yardım Müdahalesi
                                    </Checkbox>
                                    <Checkbox
                                        checked={categories.medical_ambulance}
                                        onChange={(e) => setCategories({ ...categories, medical_ambulance: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Ambulans
                                    </Checkbox>
                                </div>
                            </div>

                            {/* YANGIN & TAHLİYE */}
                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                                <h4 className="font-bold text-xs text-gray-700 mb-2 uppercase tracking-wider">YANGIN & TAHLİYE</h4>
                                <div className="flex flex-col gap-1.5">
                                    <Checkbox
                                        checked={categories.fire_real}
                                        onChange={(e) => setCategories({ ...categories, fire_real: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Gerçek Yangın Olayı
                                    </Checkbox>
                                    <Checkbox
                                        checked={categories.fire_false_alarm}
                                        onChange={(e) => setCategories({ ...categories, fire_false_alarm: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Hatalı Yangın Alarmı
                                    </Checkbox>
                                    <Checkbox
                                        checked={categories.fire_evacuation}
                                        onChange={(e) => setCategories({ ...categories, fire_evacuation: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Tahliye Gerektiren Durum
                                    </Checkbox>
                                </div>
                            </div>

                            {/* GÜVENLİK TEKNİK */}
                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                                <h4 className="font-bold text-xs text-gray-700 mb-2 uppercase tracking-wider">GÜVENLİK TEKNİK</h4>
                                <div className="flex flex-col gap-1.5">
                                    <Checkbox
                                        checked={categories.security_cctv_malfunction}
                                        onChange={(e) => setCategories({ ...categories, security_cctv_malfunction: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        CCTV Arızası/Kayıt Kesintisi
                                    </Checkbox>
                                </div>
                            </div>

                            {/* Diğer (Güvenlik) */}
                            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                                <h4 className="font-bold text-xs text-gray-700 mb-2 uppercase tracking-wider">Diğer (Güvenlik)</h4>
                                <div className="flex flex-col gap-1.5">
                                    <Checkbox
                                        checked={categories.other}
                                        onChange={(e) => setCategories({ ...categories, other: e.target.checked })}
                                        className="text-xs font-normal"
                                    >
                                        Diğer
                                    </Checkbox>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-gray-200">
                        <ActionButton
                            onClick={handleReportSubmit}
                            variant="primary"
                            className="flex-1 py-2.5 text-sm"
                        >
                            {existingReportId ? 'Güncelle ve Word Dosyasını Yenile' : 'Kaydet ve Word Dosyasına Çevir'}
                        </ActionButton>
                        <ActionButton
                            onClick={() => {
                                setShowReportModal(false);
                                setExistingReportId(null);
                            }}
                            variant="neutral"
                            className="flex-1 py-2.5 text-sm"
                        >
                            İptal
                        </ActionButton>
                    </div>
                </div>
            </CustomModal>
        </div>
    );
}
