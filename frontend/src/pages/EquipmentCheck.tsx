import { useState, useCallback, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { STORAGE_KEYS } from '../constants';

interface EquipmentItem {
    id: string;
    name: string;
    status: boolean | null;
    reason: string;
}

interface GateEquipmentConfig {
    id: number;
    name: string;
    sortOrder: number;
    isActive: boolean;
}

interface GateInfo {
    id: number;
    code: string;
    name: string;
    description: string | null;
    isActive: boolean;
    equipments: GateEquipmentConfig[];
}

export default function EquipmentCheck() {
    const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
    const [gates, setGates] = useState<GateInfo[]>([]);
    const [selectedGate, setSelectedGate] = useState('');
    const [loading, setLoading] = useState(false);
    const [configLoading, setConfigLoading] = useState(true);
    const [error, setError] = useState('');
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [whatsappMessage, setWhatsappMessage] = useState('');
    const [autoSendFailed, setAutoSendFailed] = useState(false);
    const [stage, setStage] = useState<'gate-selection' | 'equipment-check'>('gate-selection');
    const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
    const navigate = useNavigate();

    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    const user = userStr ? JSON.parse(userStr) : null;

    const buildEquipmentFromGate = useCallback((gateCode: string): EquipmentItem[] => {
        const gate = gates.find(item => item.code === gateCode);
        if (!gate) return [];

        return gate.equipments.map(item => ({
            id: String(item.id),
            name: item.name,
            status: null,
            reason: '',
        }));
    }, [gates]);

    useEffect(() => {
        const fetchConfig = async () => {
            setConfigLoading(true);
            try {
                const response = await api.get('/equipment-check/config');
                const gateConfig: GateInfo[] = response.data?.data || [];
                setGates(gateConfig);

                if (gateConfig.length === 0) {
                    setError('Henüz aktif görev bölgesi tanımlanmamış. Lütfen yöneticinize başvurun.');
                }
            } catch (err: any) {
                setError(err.response?.data?.message || 'Kapı ve ekipman yapılandırması alınamadı');
            } finally {
                setConfigLoading(false);
            }
        };

        fetchConfig();
    }, []);

    const handleStatusChange = useCallback((id: string, status: boolean) => {
        setEquipment(prev =>
            prev.map(item =>
                item.id === id ? { ...item, status, reason: status ? '' : item.reason } : item
            )
        );
        setError('');
    }, []);

    const handleReasonChange = useCallback((id: string, reason: string) => {
        setEquipment(prev => prev.map(item => (item.id === id ? { ...item, reason } : item)));
    }, []);

    const validateForm = useCallback((): boolean => {
        if (!selectedGate) {
            setError('Lütfen görev bölgesini seçiniz');
            return false;
        }

        const allStatusSet = equipment.every(item => item.status !== null);
        if (!allStatusSet) {
            setError('Lütfen tüm ekipmanlar için durum seçiniz');
            return false;
        }

        const rejectedWithoutReason = equipment.some(
            item => item.status === false && !item.reason.trim()
        );
        if (rejectedWithoutReason) {
            setError('Teslim alınmayan ekipmanlar için açıklama giriniz');
            return false;
        }

        return true;
    }, [equipment, selectedGate]);

    const submitEquipmentCheck = useCallback(
        async (gateCode: string, equipmentItems: EquipmentItem[]) => {
            setLoading(true);
            setError('');

            try {
                localStorage.setItem(STORAGE_KEYS.SELECTED_GATE, gateCode);

                const equipmentStatuses = equipmentItems.map(item => ({
                    name: item.name,
                    status: item.status === true,
                    reason: item.reason,
                }));

                const response = await api.post('/equipment-check', {
                    gate: gateCode,
                    equipmentStatuses,
                });

                if (response.data?.data?.whatsappMessage) {
                    setWhatsappMessage(response.data.data.whatsappMessage);
                    setAutoSendFailed(false);
                    setShowWhatsAppModal(true);
                } else {
                    navigate('/dashboard');
                }
            } catch (err: any) {
                setError(err.response?.data?.message || 'İşlem başarısız');
            } finally {
                setLoading(false);
            }
        },
        [navigate]
    );

    const handleSubmit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();
            setError('');

            if (!validateForm()) return;

            await submitEquipmentCheck(selectedGate, equipment);
        },
        [equipment, selectedGate, submitEquipmentCheck, validateForm]
    );

    const handleWhatsAppClose = useCallback(() => {
        setShowWhatsAppModal(false);
        setAutoSendFailed(false);
        navigate('/dashboard');
    }, [navigate]);

    const handleSendWhatsAppAutomatic = useCallback(async () => {
        setSendingWhatsApp(true);
        try {
            const response = await api.post('/equipment-check/send-whatsapp-message', {
                message: whatsappMessage,
            });

            if (response.data?.success) {
                // Mesaj başarıyla gönderildi, modalı kapat
                setShowWhatsAppModal(false);
                setAutoSendFailed(false);
                navigate('/dashboard');
            } else {
                setAutoSendFailed(true);
                alert(`Mesaj gönderilemedi: ${response.data?.reason || 'Bilinmeyen hata'}. Lütfen Manuel Mesaj Gönder butonunu kullanın.`);
            }
        } catch (err: any) {
            setAutoSendFailed(true);
            alert(`WhatsApp mesajı gönderilemedi: ${err.response?.data?.message || err.message}. Lütfen Manuel Mesaj Gönder butonunu kullanın.`);
        } finally {
            setSendingWhatsApp(false);
        }
    }, [whatsappMessage, navigate]);

    const handleSendWhatsAppManual = useCallback(() => {
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, '_blank');
        // Modal'ı hemen kapat
        setAutoSendFailed(false);
        handleWhatsAppClose();
    }, [whatsappMessage, handleWhatsAppClose]);

    return (
        <div className="min-h-screen bg-white flex flex-col overflow-hidden">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white py-4 sm:py-6 px-4 shadow-md">
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-1">Görev Bölgesi Ataması</h1>
                    <p className="text-gray-300">
                        Hoş geldiniz, <span className="font-semibold">{user?.fullName}</span>
                    </p>
                </div>
            </div>

            <div className="flex-1 min-h-0 max-w-5xl w-full mx-auto p-4 sm:p-6">
                {configLoading && (
                    <div className="bg-white rounded-lg shadow-lg p-6 text-center text-gray-600">
                        Yapılandırma yükleniyor...
                    </div>
                )}

                {!configLoading && stage === 'gate-selection' && (
                    <div className="bg-white rounded-lg shadow-lg p-5 sm:p-6">
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Görev Bölgesini Seçiniz</h2>
                            <p className="text-gray-600">Lütfen görev bölgenizi seçerek devam ediniz.</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-red-700 text-center">{error}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {gates.map(gate => (
                                <button
                                    key={gate.id}
                                    type="button"
                                    disabled={loading}
                                    onClick={async () => {
                                        const selectedEquipment = buildEquipmentFromGate(gate.code);
                                        setSelectedGate(gate.code);
                                        setError('');
                                        setEquipment(selectedEquipment);

                                        if (selectedEquipment.length === 0) {
                                            await submitEquipmentCheck(gate.code, []);
                                            return;
                                        }

                                        setStage('equipment-check');
                                    }}
                                    className={`p-6 rounded-lg border-2 transition-all text-left ${selectedGate === gate.code
                                        ? 'border-blue-600 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    <h3 className="text-lg font-bold text-gray-900">{gate.name}</h3>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {!configLoading && stage === 'equipment-check' && (
                    <div className="h-full min-h-0 flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Ekipman Kontrol Listesi</h2>
                                <p className="text-gray-600">
                                    <span className="font-semibold">{gates.find(g => g.code === selectedGate)?.name}</span>
                                    {' '}için ekipmanları kontrol ediniz.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setStage('gate-selection');
                                    setError('');
                                    setEquipment([]);
                                }}
                                className="px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                            >
                                Geri Dön
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-5 sm:p-6 flex-1 min-h-0 flex flex-col">
                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-red-700 text-center">{error}</p>
                                </div>
                            )}

                            <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-0">
                                {equipment.map(item => (
                                    <div key={item.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <h3 className="text-base font-semibold text-gray-900">{item.name}</h3>

                                            <div className="flex gap-2 md:min-w-[340px]">
                                                <button
                                                    type="button"
                                                    onClick={() => handleStatusChange(item.id, true)}
                                                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition border ${item.status === true
                                                        ? 'bg-green-50 border-green-600 text-green-700'
                                                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    Teslim Alındı
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleStatusChange(item.id, false)}
                                                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition border ${item.status === false
                                                        ? 'bg-red-50 border-red-600 text-red-700'
                                                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    Teslim Alınmadı
                                                </button>
                                            </div>
                                        </div>

                                        {item.status === false && (
                                            <div className="mt-3 animate-fadeIn">
                                                <textarea
                                                    value={item.reason}
                                                    onChange={e => handleReasonChange(item.id, e.target.value)}
                                                    placeholder={`${item.name} ile ilgili sorunu açıklayınız...`}
                                                    rows={3}
                                                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-red-500 focus:border-transparent transition"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 shrink-0">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition shadow-md hover:shadow-lg"
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
                )}
            </div>

            {showWhatsAppModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 animate-fadeIn">
                        <h3 className="text-xl font-bold text-gray-900 mb-3">Kaydedildi</h3>
                        <p className="text-gray-600 mb-4">
                            Ekipman teslim alma kaydınız başarıyla oluşturuldu. Mesajı WhatsApp'tan göndermeye karar veriniz.
                        </p>

                        <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-64 overflow-y-auto border border-gray-200">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{whatsappMessage}</pre>
                        </div>

                        <div className="flex flex-col gap-2">
                            {!autoSendFailed && (
                                <button
                                    type="button"
                                    onClick={handleSendWhatsAppAutomatic}
                                    disabled={sendingWhatsApp}
                                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition text-center flex items-center justify-center gap-2"
                                >
                                    {sendingWhatsApp && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                                    {sendingWhatsApp ? 'Gönderiliyor...' : 'Otomatik Mesaj Gönder'}
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleSendWhatsAppManual}
                                disabled={sendingWhatsApp}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition"
                            >
                                Manuel Mesaj Gönder
                            </button>

                            <button
                                type="button"
                                onClick={handleWhatsAppClose}
                                disabled={sendingWhatsApp}
                                className="w-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-800 py-3 rounded-lg font-medium transition"
                            >
                                Kapat
                            </button>
                        </div>

                        {autoSendFailed && (
                            <p className="text-sm text-red-600 mt-3">
                                Otomatik gönderim başarısız oldu. Lütfen Manuel Mesaj Gönder butonunu kullanın.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
