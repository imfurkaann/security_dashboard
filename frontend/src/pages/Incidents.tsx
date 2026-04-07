import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { isValidLength } from '../utils/validation';

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

    // Vardiya raporunu kaydet veya güncelle
    const handleReportSubmit = useCallback(async () => {
        if (!selectedShift || !reportContent.trim()) {
            alert('Lütfen rapor içeriği girin');
            return;
        }

        // Uzunluk kontrolü
        if (!isValidLength(reportContent, 1, 50000)) {
            alert('Rapor içeriği en az 1, en fazla 50000 karakter olabilir');
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
                alert('Rapor başarıyla güncellendi ve yeni Word dosyası oluşturuldu');
            } else {
                // Yeni kayıt
                try {
                    await api.post('/incidents/reports', {
                        shift_label: selectedShift,
                        report_content: reportContent,
                        categories: categories
                    });
                    alert('Rapor başarıyla kaydedildi ve Word dosyası oluşturuldu');
                } catch (postError) {
                    // 409 Conflict: Rapor zaten var, güncelleme yap
                    const postErr = postError as { response?: { status?: number; data?: { existingId?: string; message?: string } } };
                    if (postErr?.response?.status === 409 && postErr?.response?.data?.existingId) {
                        await api.put(`/incidents/reports/${postErr.response.data.existingId}`, {
                            report_content: reportContent,
                            categories: categories
                        });
                        alert('Rapor başarıyla güncellendi ve yeni Word dosyası oluşturuldu');
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
            alert(err?.response?.data?.message || 'Rapor kaydı başarısız');
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
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight break-words">Vardiya Rapor Sistemi</h1>
                                <p className="text-sm sm:text-base text-gray-600 mt-1">Günlük güvenlik vardiya raporlarını kaydedin</p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/incident-records')}
                            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg transition shadow-md hover:shadow-lg text-sm sm:text-base w-full sm:w-auto"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            Kayıt Filtrele
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Vardiya Kartları */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {SHIFTS.map((shift) => {
                        const access = getShiftAccess(shift.start, shift.end);

                        return (
                            <div
                                key={shift.id}
                                className={`bg-white rounded-lg shadow-md border-2 p-6 transition-all ${access.accessible
                                    ? 'border-blue-500 ring-2 ring-blue-200'
                                    : 'border-gray-200'
                                    }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-blue-100 rounded-lg">
                                            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900">{shift.label}</h3>
                                            <span className={`text-sm font-medium ${access.accessible ? 'text-green-600' : 'text-gray-500'}`}>
                                                {access.message}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-sm text-gray-600 mb-6">
                                    Günlük güvenlik olaylarını ve vardiya notlarını kaydedin. Rapor otomatik olarak Word dosyasına dönüştürülecektir.
                                </p>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => openReportModal(shift.label, !!shiftReports[shift.label])}
                                        disabled={!access.accessible}
                                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2 ${!access.accessible
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : shiftReports[shift.label]
                                                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl'
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                                            }`}
                                    >
                                        {!access.accessible ? (
                                            `${access.hoursUntil} saat kaldı`
                                        ) : shiftReports[shift.label] ? (
                                            <>
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            </main>

            {/* Rapor Modal */}
            {showReportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    {existingReportId ? 'Raporu Düzenle' : 'Yeni Rapor'} - {selectedShift}
                                </h2>
                                <button
                                    onClick={() => {
                                        setShowReportModal(false);
                                        setExistingReportId(null);
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Basit Textarea */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Rapor İçeriği
                                </label>
                                <textarea
                                    value={reportContent}
                                    onChange={(e) => setReportContent(e.target.value)}
                                    placeholder="Vardiya raporu içeriğini buraya yazın..."
                                    className="w-full min-h-[400px] p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical"
                                    style={{ fontFamily: 'inherit' }}
                                />
                                <p className="text-sm text-gray-500 mt-2">
                                    {reportContent.length} / 50000 karakter
                                </p>
                            </div>

                            {/* Olay Kategorileri */}
                            <div className="mb-6">
                                <h3 className="text-lg font-semibold text-gray-800 mb-4">Olay Kategorileri</h3>
                                <p className="text-sm text-gray-600 mb-4">Raporda bahsettiğiniz olayları aşağıdan işaretleyin:</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* HIRSIZLIK */}
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-gray-700 mb-3">HIRSIZLIK</h4>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.theft_guest_property}
                                                    onChange={(e) => setCategories({ ...categories, theft_guest_property: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Misafir Eşyası Çalınması</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.theft_hotel_property}
                                                    onChange={(e) => setCategories({ ...categories, theft_hotel_property: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Otel Mülkiyeti Çalınması</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.theft_personnel}
                                                    onChange={(e) => setCategories({ ...categories, theft_personnel: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Personel Hırsızlığı</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Saldırı & KAVGA */}
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-gray-700 mb-3">Saldırı & KAVGA</h4>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.assault_physical}
                                                    onChange={(e) => setCategories({ ...categories, assault_physical: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Fiziksel Saldırı</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.assault_verbal}
                                                    onChange={(e) => setCategories({ ...categories, assault_verbal: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Sözlü/Davranışsal Taciz</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.assault_mass_fight}
                                                    onChange={(e) => setCategories({ ...categories, assault_mass_fight: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Toplu Kavga/İzdiham</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* MADDE KULLANIMI */}
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-gray-700 mb-3">MADDE KULLANIMI</h4>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.substance_personnel}
                                                    onChange={(e) => setCategories({ ...categories, substance_personnel: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Personelin Görevde Alkol/Uyuşturucu Kullanımı</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.substance_property}
                                                    onChange={(e) => setCategories({ ...categories, substance_property: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Mülkte Yasak Madde Bulunması</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* VANDALİZM & HASAR */}
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-gray-700 mb-3">VANDALİZM & HASAR</h4>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.vandalism_room}
                                                    onChange={(e) => setCategories({ ...categories, vandalism_room: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Misafirin Oda Eşyalara Kasıtlı Zarar Vermesi</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.vandalism_common_area}
                                                    onChange={(e) => setCategories({ ...categories, vandalism_common_area: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Misafirin Ortak Alan Eşyalarına Kasıtlı Zarar Vermesi</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* İZİNSİZ GİRİŞ */}
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-gray-700 mb-3">İZİNSİZ GİRİŞ</h4>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.unauthorized_room}
                                                    onChange={(e) => setCategories({ ...categories, unauthorized_room: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Yetkisiz Oda Girişi</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.unauthorized_restricted_area}
                                                    onChange={(e) => setCategories({ ...categories, unauthorized_restricted_area: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Kısıtlı Alan İhlali</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* KAZA & YARALANMA */}
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-gray-700 mb-3">KAZA & YARALANMA</h4>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.accident_slip_fall}
                                                    onChange={(e) => setCategories({ ...categories, accident_slip_fall: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Kayma/Düşme Kazası</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.accident_equipment}
                                                    onChange={(e) => setCategories({ ...categories, accident_equipment: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Ekipman/Cihaz Kazası</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.accident_work}
                                                    onChange={(e) => setCategories({ ...categories, accident_work: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">İş Kazası</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* TIBBİ ACİL */}
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-gray-700 mb-3">TIBBİ ACİL</h4>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.medical_serious}
                                                    onChange={(e) => setCategories({ ...categories, medical_serious: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Ciddi Tıbbi Durum</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.medical_first_aid}
                                                    onChange={(e) => setCategories({ ...categories, medical_first_aid: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">İlk Yardım Müdahalesi</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.medical_ambulance}
                                                    onChange={(e) => setCategories({ ...categories, medical_ambulance: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Ambulans</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* YANGIN & TAHLİYE */}
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-gray-700 mb-3">YANGIN & TAHLİYE</h4>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.fire_real}
                                                    onChange={(e) => setCategories({ ...categories, fire_real: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Gerçek Yangın Olayı</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.fire_false_alarm}
                                                    onChange={(e) => setCategories({ ...categories, fire_false_alarm: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Hatalı Yangın Alarmı</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.fire_evacuation}
                                                    onChange={(e) => setCategories({ ...categories, fire_evacuation: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Tahliye Gerektiren Durum</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* GÜVENLİK TEKNİK */}
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-gray-700 mb-3">GÜVENLİK TEKNİK</h4>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.security_cctv_malfunction}
                                                    onChange={(e) => setCategories({ ...categories, security_cctv_malfunction: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">CCTV Arızası/Kayıt Kesintisi</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Diğer (Güvenlik) */}
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <h4 className="font-semibold text-gray-700 mb-3">Diğer (Güvenlik)</h4>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={categories.other}
                                                    onChange={(e) => setCategories({ ...categories, other: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-gray-700">Diğer</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleReportSubmit}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition"
                                >
                                    {existingReportId ? 'Güncelle ve Yeni Word Oluştur' : 'Raporu Kaydet ve Word\'e Çevir'}
                                </button>
                                <button
                                    onClick={() => {
                                        setShowReportModal(false);
                                        setExistingReportId(null);
                                    }}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition"
                                >
                                    İptal
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
