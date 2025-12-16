import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import api from '../utils/api';

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
    const navigate = useNavigate();

    // TipTap Editor
    const editor = useEditor({
        extensions: [StarterKit],
        content: '<p>Rapor içeriğini buraya yazın...</p>',
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none min-h-[400px] p-4',
            },
        },
    });

    // Vardiya raporunu kaydet
    const handleReportSubmit = useCallback(async () => {
        if (!editor || !selectedShift) return;

        const htmlContent = editor.getHTML();

        try {
            await api.post('/incidents/reports', {
                shift_label: selectedShift,
                report_content: htmlContent,
            });

            setShowReportModal(false);
            editor.commands.setContent('<p>Rapor içeriğini buraya yazın...</p>');
            alert('Rapor başarıyla kaydedildi ve Word dosyası oluşturuldu');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err?.response?.data?.message || 'Rapor kaydı başarısız');
        }
    }, [editor, selectedShift]);

    // Rapor modal aç
    const openReportModal = useCallback((shiftLabel: string) => {
        setSelectedShift(shiftLabel);
        setShowReportModal(true);
        if (editor) {
            editor.commands.setContent('<p>Rapor içeriğini buraya yazın...</p>');
        }
    }, [editor]);

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

                                <button
                                    onClick={() => openReportModal(shift.label)}
                                    disabled={!access.accessible}
                                    className={`w-full py-3 px-4 rounded-lg font-medium transition ${access.accessible
                                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
                                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        }`}
                                >
                                    {access.accessible ? 'Rapor Yaz' : `${access.hoursUntil} saat kaldı`}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </main>

            {/* Rapor Modal */}
            {showReportModal && editor && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    Vardiya Raporu - {selectedShift}
                                </h2>
                                <button
                                    onClick={() => setShowReportModal(false)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Editor Toolbar */}
                            <div className="mb-4 flex flex-wrap gap-2 p-2 bg-gray-100 rounded-lg">
                                <button
                                    onClick={() => editor.chain().focus().toggleBold().run()}
                                    className={`px-3 py-1 rounded ${editor.isActive('bold') ? 'bg-blue-600 text-white' : 'bg-white'}`}
                                >
                                    <strong>B</strong>
                                </button>
                                <button
                                    onClick={() => editor.chain().focus().toggleItalic().run()}
                                    className={`px-3 py-1 rounded ${editor.isActive('italic') ? 'bg-blue-600 text-white' : 'bg-white'}`}
                                >
                                    <em>I</em>
                                </button>
                                <button
                                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                                    className={`px-3 py-1 rounded ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-600 text-white' : 'bg-white'}`}
                                >
                                    H1
                                </button>
                                <button
                                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                                    className={`px-3 py-1 rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-600 text-white' : 'bg-white'}`}
                                >
                                    H2
                                </button>
                                <button
                                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                                    className={`px-3 py-1 rounded ${editor.isActive('bulletList') ? 'bg-blue-600 text-white' : 'bg-white'}`}
                                >
                                    • Liste
                                </button>
                                <button
                                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                                    className={`px-3 py-1 rounded ${editor.isActive('orderedList') ? 'bg-blue-600 text-white' : 'bg-white'}`}
                                >
                                    1. Liste
                                </button>
                            </div>

                            {/* Editor */}
                            <div className="border border-gray-300 rounded-lg bg-white mb-4 min-h-[400px]">
                                <EditorContent editor={editor} />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={handleReportSubmit}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition"
                                >
                                    Raporu Kaydet ve Word'e Çevir
                                </button>
                                <button
                                    onClick={() => setShowReportModal(false)}
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
