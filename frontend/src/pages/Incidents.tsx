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
                });
                alert('Rapor başarıyla güncellendi ve yeni Word dosyası oluşturuldu');
            } else {
                // Yeni kayıt
                await api.post('/incidents/reports', {
                    shift_label: selectedShift,
                    report_content: reportContent,
                });
                alert('Rapor başarıyla kaydedildi ve Word dosyası oluşturuldu');
            }

            setShowReportModal(false);
            setExistingReportId(null);
            setReportContent('');
            loadShiftReports();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err?.response?.data?.message || 'Rapor kaydı başarısız');
        }
    }, [selectedShift, reportContent, existingReportId, shiftReports, loadShiftReports]);

    // Rapor modal aç (yeni veya düzenle)
    const openReportModal = useCallback((shiftLabel: string, isEdit: boolean = false) => {
        setSelectedShift(shiftLabel);

        if (shiftReports[shiftLabel]) {
            const report = shiftReports[shiftLabel];
            setExistingReportId(report.id);
            setReportContent(report.report_content || '');
        } else {
            setExistingReportId(null);
            setReportContent('');
        }

        setShowReportModal(true);
    }, [shiftReports]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Vardiya Rapor Sistemi</h1>
                                <p className="text-gray-600 mt-1">Günlük güvenlik vardiya raporlarını kaydedin</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => navigate('/incident-records')} 
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition shadow-md hover:shadow-lg"
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
                                        onClick={() => openReportModal(shift.label, false)}
                                        disabled={!access.accessible}
                                        className={`flex-1 py-3 px-4 rounded-lg font-medium transition ${access.accessible
                                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            }`}
                                    >
                                        {access.accessible ? 'Rapor Yaz' : `${access.hoursUntil} saat kaldı`}
                                    </button>

                                    {shiftReports[shift.label] && (
                                        <button
                                            onClick={() => openReportModal(shift.label, true)}
                                            className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition shadow-lg hover:shadow-xl"
                                            title="Raporu Düzenle"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                    )}
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
