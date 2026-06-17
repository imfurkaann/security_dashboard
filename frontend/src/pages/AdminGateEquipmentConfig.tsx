import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal, message } from 'antd';
import 'antd/dist/reset.css';
import { Plus, Trash2, Save, ShieldCheck, Wrench, Settings, ArrowLeft, Check, AlertTriangle, Layers } from 'lucide-react';
import api from '../utils/api';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';

interface GateEquipment {
    id: number;
    name: string;
    sortOrder: number;
}

interface GateConfig {
    id: number;
    code: string;
    name: string;
    isActive: boolean;
    equipments: GateEquipment[];
}

export default function AdminGateEquipmentConfig() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [gates, setGates] = useState<GateConfig[]>([]);
    const [selectedGateId, setSelectedGateId] = useState<number | null>(null);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGateName, setNewGateName] = useState('');
    const [newEquipmentName, setNewEquipmentName] = useState('');
    const [newGateEquipments, setNewGateEquipments] = useState<string[]>([]);

    const [equipmentToAdd, setEquipmentToAdd] = useState('');

    const activeGateCount = useMemo(() => gates.length, [gates]);
    const sortedGates = useMemo(() => {
        return [...gates].sort((a, b) => a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' }));
    }, [gates]);
    const selectedGate = useMemo(
        () => gates.find((gate) => gate.id === selectedGateId) || null,
        [gates, selectedGateId]
    );

    const fetchConfig = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await api.get('/admin/equipment-config');

            const gateList: GateConfig[] = (response.data?.data || []).filter((gate: GateConfig) => gate.isActive);
            setGates(gateList);

            if (gateList.length === 0) {
                setSelectedGateId(null);
                return;
            }

            setSelectedGateId((prev) => {
                if (prev && gateList.some((gate) => gate.id === prev)) {
                    return prev;
                }
                return gateList[0].id;
            });
        } catch (err: any) {
            setError(err.response?.data?.message || 'Yapılandırma yüklenemedi');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    useRealtimeRefetch({
        topics: ['gate-config'],
        onMutation: fetchConfig,
    });

    const resetCreateModal = () => {
        setNewGateName('');
        setNewEquipmentName('');
        setNewGateEquipments([]);
    };

    const openCreateModal = () => {
        setError('');
        setSuccess('');
        resetCreateModal();
        setShowCreateModal(true);
    };

    const closeCreateModal = () => {
        setShowCreateModal(false);
        resetCreateModal();
    };

    const addEquipmentToNewGateList = () => {
        const trimmed = newEquipmentName.trim();
        if (!trimmed) return;

        const exists = newGateEquipments.some((item) => item.toLocaleLowerCase('tr-TR') === trimmed.toLocaleLowerCase('tr-TR'));
        if (exists) {
            setError('Aynı ekipmanı tekrar ekleyemezsiniz');
            return;
        }

        setError('');
        setNewGateEquipments((prev) => [...prev, trimmed]);
        setNewEquipmentName('');
    };

    const removeEquipmentFromNewGateList = (index: number) => {
        setNewGateEquipments((prev) => prev.filter((_, idx) => idx !== index));
    };

    const handleCreateGate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!newGateName.trim()) {
            setError('Kapı adı gereklidir');
            return;
        }

        setSaving(true);
        try {
            await api.post('/admin/equipment-config/gates', {
                name: newGateName.trim(),
                equipments: newGateEquipments,
            });

            message.success('Kapı başarıyla oluşturuldu');
            closeCreateModal();
            await fetchConfig();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Kapı oluşturulamadı');
        } finally {
            setSaving(false);
        }
    };

    const handleGateUpdate = async () => {
        if (!selectedGate) return;

        setError('');
        setSuccess('');
        setSaving(true);

        try {
            await api.put(`/admin/equipment-config/gates/${selectedGate.id}`, {
                name: selectedGate.name,
            });

            message.success('Kapı bilgileri güncellendi');
            setSuccess('Kapı bilgileri güncellendi');
            await fetchConfig();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Kapı güncellenemedi');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteGate = async () => {
        if (!selectedGate) return;

        Modal.confirm({
            title: 'Kapıyı Sil',
            content: `${selectedGate.name} kapısını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
            okText: 'Evet, Sil',
            okType: 'danger',
            cancelText: 'Vazgeç',
            onOk: async () => {
                setError('');
                setSuccess('');
                setSaving(true);

                try {
                    await api.delete(`/admin/equipment-config/gates/${selectedGate.id}`);
                    message.success('Kapı silindi');
                    setSuccess('Kapı silindi');
                    await fetchConfig();
                } catch (err: any) {
                    setError(err.response?.data?.message || 'Kapı silinemedi');
                } finally {
                    setSaving(false);
                }
            }
        });
    };

    const addEquipmentToSelectedGate = async () => {
        if (!selectedGate) return;

        const trimmed = equipmentToAdd.trim();
        if (!trimmed) return;

        setError('');
        setSuccess('');
        setSaving(true);

        try {
            await api.post(`/admin/equipment-config/gates/${selectedGate.id}/equipments`, { name: trimmed });

            setEquipmentToAdd('');
            message.success('Ekipman eklendi');
            setSuccess('Ekipman eklendi');
            await fetchConfig();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ekipman eklenemedi');
        } finally {
            setSaving(false);
        }
    };

    const handleEquipmentDelete = async (equipmentId: number) => {
        Modal.confirm({
            title: 'Ekipmanı Sil',
            content: 'Bu ekipmanı silmek istediğinize emin misiniz?',
            okText: 'Evet, Sil',
            okType: 'danger',
            cancelText: 'Vazgeç',
            onOk: async () => {
                setError('');
                setSuccess('');
                setSaving(true);

                try {
                    await api.delete(`/admin/equipment-config/equipments/${equipmentId}`);
                    message.success('Ekipman silindi');
                    setSuccess('Ekipman silindi');
                    await fetchConfig();
                } catch (err: any) {
                    setError(err.response?.data?.message || 'Ekipman silinemedi');
                } finally {
                    setSaving(false);
                }
            }
        });
    };

    const updateSelectedGateState = (updates: Partial<GateConfig>) => {
        if (!selectedGate) return;

        setGates((prev) =>
            prev.map((gate) => (gate.id === selectedGate.id ? { ...gate, ...updates } : gate))
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                    <div className="text-gray-600 text-sm font-medium">Yapılandırma yükleniyor...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                            <button
                                type="button"
                                onClick={() => navigate('/admin/dashboard')}
                                className="p-2.5 hover:bg-slate-800 rounded-xl transition shrink-0 border border-slate-700/60 bg-slate-800/45 text-slate-300 hover:text-white"
                                title="Geri Dön"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight break-words">
                                    Kapı ve Ekipman Yönetimi
                                </h1>
                                <p className="text-sm text-slate-300 mt-1">
                                    Sistemdeki aktif kapıları ve bu kapılara bağlı kontrol ekipmanlarını yapılandırın.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="w-full lg:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
                        >
                            <Plus className="w-5 h-5" />
                            Yeni Kapı Ekle
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 max-w-7xl mx-auto">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3.5 flex items-center gap-3 animate-fadeIn">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                )}

                {success && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3.5 flex items-center gap-3 animate-fadeIn">
                        <Check className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="text-sm font-medium">{success}</span>
                    </div>
                )}

                {gates.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500 shadow-sm flex flex-col items-center gap-3 justify-center min-h-[300px]">
                        <ShieldCheck className="w-16 h-16 text-gray-400 stroke-[1.5]" />
                        <span className="text-lg font-medium text-gray-700">Tanımlı Kapı Bulunmuyor</span>
                        <span className="text-sm text-gray-400 max-w-md">Henüz kapı tanımlanmamış. Yukarıdaki "Yeni Kapı Ekle" butonuna tıklayarak ilk geçiş kapınızı oluşturabilirsiniz.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
                        {/* Sidebar: Gates List */}
                        <section className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Geçiş Kapıları</h2>
                                <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">{sortedGates.length} Aktif</span>
                            </div>
                            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin">
                                {sortedGates.map((gate) => {
                                    const isSelected = gate.id === selectedGateId;
                                    return (
                                        <button
                                            key={gate.id}
                                            type="button"
                                            onClick={() => {
                                                setError('');
                                                setSuccess('');
                                                setSelectedGateId(gate.id);
                                            }}
                                            className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all flex items-center justify-between gap-3 group relative overflow-hidden ${isSelected
                                                ? 'border-blue-500 bg-blue-50/50 text-blue-900 shadow-sm'
                                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/80 text-gray-750 hover:text-gray-900'
                                                }`}
                                        >
                                            {isSelected && (
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                                            )}
                                            <div className="flex items-center gap-3 min-w-0">
                                                <ShieldCheck className={`w-5 h-5 shrink-0 ${isSelected ? 'text-blue-500' : 'text-slate-400 group-hover:text-slate-500'}`} />
                                                <span className="font-semibold text-sm truncate">{gate.name}</span>
                                            </div>
                                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 border ${
                                                isSelected 
                                                    ? 'bg-blue-100 border-blue-200 text-blue-800' 
                                                    : 'bg-gray-100 border-gray-200 text-gray-500'
                                            }`}>
                                                {gate.equipments.length}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        {/* Content Panel: Details & Equipments */}
                        <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                            {!selectedGate ? (
                                <div className="text-center py-20 text-gray-500 flex flex-col items-center gap-2">
                                    <Settings className="w-12 h-12 text-gray-400 animate-spin-slow" />
                                    <span>Lütfen işlem yapmak istediğiniz kapıyı soldaki listeden seçin.</span>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Gate Settings Header */}
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                                        <div className="space-y-1">
                                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                                <ShieldCheck className="w-5 h-5 text-blue-500" />
                                                {selectedGate.name} Ayarları
                                            </h3>
                                            <p className="text-xs text-gray-500">Kapı adını güncelleyebilir veya bağlı ekipmanları düzenleyebilirsiniz.</p>
                                        </div>
                                    </div>

                                    {/* Edit Name & Actions Card */}
                                    <div className="bg-slate-50 border border-gray-200 rounded-xl p-4 md:p-5 space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kapı İsmi</label>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <input
                                                    type="text"
                                                    value={selectedGate.name}
                                                    onChange={(e) => updateSelectedGateState({ name: e.target.value })}
                                                    className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:border-blue-500 outline-none text-gray-900 text-sm transition-all focus:ring-1 focus:ring-blue-500/20"
                                                    placeholder="Kapı adı girin"
                                                />
                                                <div className="flex gap-2 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={handleGateUpdate}
                                                        disabled={saving}
                                                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                        Kaydet
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleDeleteGate}
                                                        disabled={saving}
                                                        className="px-4 py-2.5 border border-red-200 bg-white text-red-600 hover:bg-red-50 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-all hover:border-red-300"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        Kapıyı Sil
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Equipments Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                                <Wrench className="w-4 h-4 text-blue-500" />
                                                Atanmış Ekipmanlar ({selectedGate.equipments.length})
                                            </h4>
                                        </div>

                                        {selectedGate.equipments.length === 0 ? (
                                            <div className="border border-dashed border-gray-200 bg-gray-50 rounded-xl p-8 text-center text-gray-500 text-sm">
                                                Bu kapıya tanımlı ekipman bulunmuyor. Aşağıdan yeni ekipman tanımlayabilirsiniz.
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                                {selectedGate.equipments.map((equipment) => (
                                                    <div
                                                        key={equipment.id}
                                                        className="bg-white border border-gray-200 hover:border-gray-300 p-3.5 rounded-xl flex items-center justify-between gap-3 group transition-all"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <Wrench className="w-4 h-4 text-gray-400 group-hover:text-blue-500 shrink-0 transition-colors" />
                                                            <span className="text-sm text-gray-750 font-medium truncate">{equipment.name}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEquipmentDelete(equipment.id)}
                                                            disabled={saving}
                                                            className="p-1.5 text-gray-450 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                            title="Ekipmanı Sil"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Add Equipment Card */}
                                        <div className="border border-dashed border-blue-200 bg-blue-50/20 rounded-xl p-4 md:p-5 mt-6">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Plus className="w-4.5 h-4.5 text-blue-500" />
                                                <span className="text-sm font-semibold text-blue-800">Yeni Ekipman Ekle</span>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <input
                                                    type="text"
                                                    value={equipmentToAdd}
                                                    onChange={(e) => setEquipmentToAdd(e.target.value)}
                                                    placeholder="Ekipman adı (örn. Barkod Okuyucu, Kamera)"
                                                    className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:border-blue-500 outline-none text-gray-950 text-sm transition-all focus:ring-1 focus:ring-blue-500/30"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={addEquipmentToSelectedGate}
                                                    disabled={saving}
                                                    className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                                >
                                                    Atama Ekle
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </main>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
                    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col text-gray-800 animate-scaleIn">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-blue-500" />
                                Yeni Kapı Ekle
                            </h2>
                            <button
                                type="button"
                                onClick={closeCreateModal}
                                className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleCreateGate} className="p-6 space-y-5 flex-1 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kapı Adı</label>
                                <input
                                    type="text"
                                    value={newGateName}
                                    onChange={(e) => setNewGateName(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:border-blue-500 outline-none text-gray-900 text-sm transition-all focus:ring-1 focus:ring-blue-500/30"
                                    placeholder="Örn: Kuzey Depo Kapısı"
                                    required
                                />
                            </div>

                            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">İlk Ekipmanlar (İsteğe Bağlı)</label>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        value={newEquipmentName}
                                        onChange={(e) => setNewEquipmentName(e.target.value)}
                                        className="flex-1 px-4 py-2 bg-white border border-gray-300 rounded-xl focus:border-blue-500 outline-none text-gray-950 text-sm transition-all"
                                        placeholder="Ekipman adı (örn. Yüz Tanıma Terminali)"
                                    />
                                    <button
                                        type="button"
                                        onClick={addEquipmentToNewGateList}
                                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-sm font-semibold transition"
                                    >
                                        Listeye Ekle
                                    </button>
                                </div>

                                {newGateEquipments.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic">Henüz bu kapı için bir ekipman listelenmedi.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {newGateEquipments.map((equipment, index) => (
                                            <span
                                                key={`${equipment}-${index}`}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700"
                                            >
                                                <Wrench className="w-3 h-3 text-gray-400" />
                                                {equipment}
                                                <button
                                                    type="button"
                                                    onClick={() => removeEquipmentFromNewGateList(index)}
                                                    className="text-gray-400 hover:text-red-500 ml-0.5 transition"
                                                    title="Ekipmanı Kaldır"
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100 mt-2">
                                <button
                                    type="button"
                                    onClick={closeCreateModal}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition"
                                >
                                    Vazgeç
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
                                >
                                    Kapıyı Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
