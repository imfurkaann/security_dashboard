import { useState, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { STORAGE_KEYS } from '../constants';

interface EquipmentItem {
    id: string;
    name: string;
    icon: string;
    status: boolean | null;
    reason: string;
}

const INITIAL_EQUIPMENT: EquipmentItem[] = [
    { id: 'television', name: 'Televizyon', icon: '📺', status: null, reason: '' },
    { id: 'monitor', name: 'Monitör', icon: '🖥️', status: null, reason: '' },
    { id: 'phone', name: 'Telefon', icon: '📱', status: null, reason: '' },
    { id: 'breathalyzer', name: 'Alkol Metre', icon: '🌡️', status: null, reason: '' },
];

export default function EquipmentCheck() {
    const [equipment, setEquipment] = useState<EquipmentItem[]>(INITIAL_EQUIPMENT);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [whatsappMessage, setWhatsappMessage] = useState('');
    const navigate = useNavigate();

    // Get current user info
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    const user = userStr ? JSON.parse(userStr) : null;

    // Handle equipment status change
    const handleStatusChange = useCallback((id: string, status: boolean) => {
        setEquipment(prev => prev.map(item =>
            item.id === id ? { ...item, status, reason: status ? '' : item.reason } : item
        ));
        setError('');
    }, []);

    // Handle reason change
    const handleReasonChange = useCallback((id: string, reason: string) => {
        setEquipment(prev => prev.map(item =>
            item.id === id ? { ...item, reason } : item
        ));
    }, []);

    // Validate form
    const validateForm = useCallback((): boolean => {
        // Check if all items have a status
        const allStatusSet = equipment.every(item => item.status !== null);
        if (!allStatusSet) {
            setError('Lütfen tüm ekipmanlar için durum seçiniz');
            return false;
        }

        // Check if rejected items have reasons
        const rejectedWithoutReason = equipment.some(
            item => item.status === false && !item.reason.trim()
        );
        if (rejectedWithoutReason) {
            setError('Onaylamadığınız ekipmanlar için açıklama yazınız');
            return false;
        }

        return true;
    }, [equipment]);

    // Handle form submission
    const handleSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) return;

        setLoading(true);

        try {
            const formData = {
                television_status: equipment.find(e => e.id === 'television')?.status || false,
                monitor_status: equipment.find(e => e.id === 'monitor')?.status || false,
                phone_status: equipment.find(e => e.id === 'phone')?.status || false,
                breathalyzer_status: equipment.find(e => e.id === 'breathalyzer')?.status || false,
                television_reason: equipment.find(e => e.id === 'television')?.reason || '',
                monitor_reason: equipment.find(e => e.id === 'monitor')?.reason || '',
                phone_reason: equipment.find(e => e.id === 'phone')?.reason || '',
                breathalyzer_reason: equipment.find(e => e.id === 'breathalyzer')?.reason || '',
            };

            const response = await api.post('/equipment-check', formData);

            // Show WhatsApp modal
            if (response.data?.data?.whatsappMessage) {
                setWhatsappMessage(response.data.data.whatsappMessage);
                setShowWhatsAppModal(true);
            } else {
                // If no WhatsApp message, go directly to dashboard
                navigate('/dashboard');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'İşlem başarısız');
        } finally {
            setLoading(false);
        }
    }, [equipment, validateForm, navigate]);

    // Handle WhatsApp modal close
    const handleWhatsAppClose = useCallback(() => {
        setShowWhatsAppModal(false);
        navigate('/dashboard');
    }, [navigate]);

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-3 relative overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
            </div>

            {/* Main Card */}
            <div className="relative w-full max-w-5xl z-10">
                <div className="bg-gray-800/90 backdrop-blur-xl rounded-xl shadow-2xl border border-gray-700/50 overflow-hidden">
                    {/* Header */}
                    <div className="p-4 text-center border-b border-gray-700/50">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-600/20 backdrop-blur-sm border border-blue-500/30 mb-2">
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-1">Ekipman Teslim Alma</h1>
                        <p className="text-gray-400 text-sm">
                            Hoş geldiniz, <span className="text-white font-semibold">{user?.fullName}</span>
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-4">
                        {error && (
                            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                                <p className="text-red-400 text-sm text-center">{error}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {equipment.map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-gray-700/50 rounded-lg p-3 border border-gray-600/50 transition-all hover:border-gray-500/50"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-2xl">{item.icon}</span>
                                        <h3 className="text-lg font-semibold text-white flex-1">{item.name}</h3>
                                    </div>
                                    <div className="flex gap-2 mb-2">
                                        <button
                                            type="button"
                                            onClick={() => handleStatusChange(item.id, true)}
                                            className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${item.status === true
                                                ? 'bg-green-600 text-white shadow-lg shadow-green-500/30'
                                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                                }`}
                                        >
                                            ✓ Onaylıyorum
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleStatusChange(item.id, false)}
                                            className={`flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${item.status === false
                                                ? 'bg-red-600 text-white shadow-lg shadow-red-500/30'
                                                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                                                }`}
                                        >
                                            ✗ Onaylamıyorum
                                        </button>
                                    </div>

                                    {item.status === false && (
                                        <div className="animate-fadeIn">
                                            <textarea
                                                value={item.reason}
                                                onChange={(e) => handleReasonChange(item.id, e.target.value)}
                                                placeholder={`${item.name} ile ilgili sorunu açıklayınız...`}
                                                rows={2}
                                                className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="mt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition shadow-lg hover:shadow-xl"
                            >
                                {loading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        <span>Kaydediliyor...</span>
                                    </div>
                                ) : (
                                    'Onayla ve Devam Et'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* WhatsApp Modal */}
            {showWhatsAppModal && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fadeIn">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">WhatsApp ile Paylaş</h3>
                        </div>

                        <p className="text-gray-600 mb-4">
                            Ekipman teslim alma kaydınız oluşturuldu. WhatsApp'tan paylaşmak ister misiniz?
                        </p>

                        <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-64 overflow-y-auto">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{whatsappMessage}</pre>
                        </div>

                        <div className="flex gap-3">
                            <a
                                href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition text-center flex items-center justify-center gap-2"
                                onClick={handleWhatsAppClose}
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                WhatsApp'ta Aç
                            </a>
                            <button
                                type="button"
                                onClick={handleWhatsAppClose}
                                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
