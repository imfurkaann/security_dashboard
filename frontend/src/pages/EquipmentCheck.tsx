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
    const [stage, setStage] = useState<'gate-selection' | 'equipment-check'>('gate-selection');
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

        if (equipment.length === 0) {
            setError('Seçilen kapı için ekipman bulunamadı');
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

    const handleSubmit = useCallback(
        async (e: FormEvent) => {
            e.preventDefault();
            setError('');

            if (!validateForm()) return;

            setLoading(true);

            try {
                localStorage.setItem(STORAGE_KEYS.SELECTED_GATE, selectedGate);

                const equipmentStatuses = equipment.map(item => ({
                    name: item.name,
                    status: item.status === true,
                    reason: item.reason,
                }));

                const formData = {
                    gate: selectedGate,
                    equipmentStatuses,
                };

                const response = await api.post('/equipment-check', formData);

                if (response.data?.data?.whatsappMessage) {
                    setWhatsappMessage(response.data.data.whatsappMessage);
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
        [equipment, navigate, selectedGate, validateForm]
    );

    const handleWhatsAppClose = useCallback(() => {
        setShowWhatsAppModal(false);
        navigate('/dashboard');
    }, [navigate]);

    return (
        <div className="min-h-screen bg-white">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white py-8 px-4 shadow-md">
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-3xl font-bold mb-2">Görev Bölgesi Ataması</h1>
                    <p className="text-gray-300">
                        Hoş geldiniz, <span className="font-semibold">{user?.fullName}</span>
                    </p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-4 py-8">
                {configLoading && (
                    <div className="bg-white rounded-lg shadow-lg p-8 text-center text-gray-600">
                        Yapılandırma yükleniyor...
                    </div>
                )}

                {!configLoading && stage === 'gate-selection' && (
                    <div className="bg-white rounded-lg shadow-lg p-8">
                        <div className="mb-8">
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
                                    onClick={() => {
                                        setSelectedGate(gate.code);
                                        setStage('equipment-check');
                                        setError('');
                                        setEquipment(buildEquipmentFromGate(gate.code));
                                    }}
                                    className={`p-6 rounded-lg border-2 transition-all text-left ${selectedGate === gate.code
                                        ? 'border-blue-600 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                >
                                    <h3 className="text-lg font-bold text-gray-900">{gate.name}</h3>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {!configLoading && stage === 'equipment-check' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
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

                        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
                            {error && (
                                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                    <p className="text-red-700 text-center">{error}</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                {equipment.map(item => (
                                    <div key={item.id} className="border border-gray-200 rounded-lg p-5 bg-white">
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

                            <div className="mt-8">
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
                            Ekipman teslim alma kaydınız başarıyla oluşturuldu. WhatsApp'tan paylaşmak ister misiniz?
                        </p>

                        <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-64 overflow-y-auto border border-gray-200">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{whatsappMessage}</pre>
                        </div>

                        <div className="flex gap-3">
                            <a
                                href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition text-center"
                                onClick={handleWhatsAppClose}
                            >
                                WhatsApp'ta Paylaş
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
