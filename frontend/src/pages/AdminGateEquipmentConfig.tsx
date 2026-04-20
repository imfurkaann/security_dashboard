import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';

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

const getAdminHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
};

export default function AdminGateEquipmentConfig() {
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
            const response = await axios.get(`${API_URL}/admin/equipment-config`, {
                headers: getAdminHeaders(),
            });

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
            await axios.post(
                `${API_URL}/admin/equipment-config/gates`,
                {
                    name: newGateName.trim(),
                    equipments: newGateEquipments,
                },
                { headers: getAdminHeaders() }
            );

            setSuccess('Kapı başarıyla oluşturuldu');
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
            await axios.put(
                `${API_URL}/admin/equipment-config/gates/${selectedGate.id}`,
                {
                    name: selectedGate.name,
                },
                { headers: getAdminHeaders() }
            );

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

        if (!window.confirm(`${selectedGate.name} kapısını silmek istediğinize emin misiniz?`)) {
            return;
        }

        setError('');
        setSuccess('');
        setSaving(true);

        try {
            await axios.delete(`${API_URL}/admin/equipment-config/gates/${selectedGate.id}`, {
                headers: getAdminHeaders(),
            });

            setSuccess('Kapı silindi');
            await fetchConfig();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Kapı silinemedi');
        } finally {
            setSaving(false);
        }
    };

    const addEquipmentToSelectedGate = async () => {
        if (!selectedGate) return;

        const trimmed = equipmentToAdd.trim();
        if (!trimmed) return;

        setError('');
        setSuccess('');
        setSaving(true);

        try {
            await axios.post(
                `${API_URL}/admin/equipment-config/gates/${selectedGate.id}/equipments`,
                { name: trimmed },
                { headers: getAdminHeaders() }
            );

            setEquipmentToAdd('');
            setSuccess('Ekipman eklendi');
            await fetchConfig();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ekipman eklenemedi');
        } finally {
            setSaving(false);
        }
    };

    const handleEquipmentDelete = async (equipmentId: number) => {
        if (!window.confirm('Bu ekipmanı silmek istediğinize emin misiniz?')) {
            return;
        }

        setError('');
        setSuccess('');
        setSaving(true);

        try {
            await axios.delete(`${API_URL}/admin/equipment-config/equipments/${equipmentId}`, {
                headers: getAdminHeaders(),
            });

            setSuccess('Ekipman silindi');
            await fetchConfig();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Ekipman silinemedi');
        } finally {
            setSaving(false);
        }
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
                <div className="text-gray-600">Yükleniyor...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                type="button"
                                onClick={() => window.history.back()}
                                className="p-2 hover:bg-slate-800 rounded-lg transition shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Kapı ve Ekipman Yönetimi</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">
                                    Toplam kapı sayısı: <span className="font-semibold text-white">{activeGateCount}</span>
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Yeni Kapı Ekle
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4">
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3">
                        {success}
                    </div>
                )}

                {gates.length === 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-600 shadow-sm">
                        Henüz kapı tanımlanmadı. "Yeni Kapı Ekle" ile başlayabilirsiniz.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start">
                        <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm lg:sticky lg:top-6">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="text-sm font-semibold text-gray-900">Kapılar</h2>
                                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{sortedGates.length}</span>
                            </div>
                            <div className="space-y-2">
                                {sortedGates.map((gate) => {
                                    const isSelected = gate.id === selectedGateId;
                                    return (
                                        <button
                                            key={gate.id}
                                            type="button"
                                            onClick={() => setSelectedGateId(gate.id)}
                                            className={`w-full text-left px-3 py-3 rounded-lg border transition ${isSelected
                                                ? 'border-blue-300 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="font-medium text-gray-900 break-words">{gate.name}</span>
                                                <span className="text-xs text-gray-500 shrink-0">{gate.equipments.length}</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 shadow-sm">
                            {!selectedGate ? (
                                <div className="text-gray-600">Kapı seçiniz.</div>
                            ) : (
                                <>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 pb-4 mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">{selectedGate.name}</h3>
                                            <p className="text-sm text-gray-500">Kapı ve ekipman düzenleme</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 mb-4">
                                        <input
                                            type="text"
                                            value={selectedGate.name}
                                            onChange={(e) => updateSelectedGateState({ name: e.target.value })}
                                            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            placeholder="Kapı adı"
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center justify-end gap-3 mb-5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                        <div className="flex gap-2 w-full sm:w-auto">
                                            <button
                                                type="button"
                                                onClick={handleGateUpdate}
                                                disabled={saving}
                                                className="flex-1 sm:flex-none px-3 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800 disabled:opacity-60"
                                            >
                                                Kaydet
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleDeleteGate}
                                                disabled={saving}
                                                className="flex-1 sm:flex-none px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-60"
                                            >
                                                Kapıyı Sil
                                            </button>
                                        </div>
                                    </div>

                                    <div className="border-t border-gray-200 pt-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-sm font-semibold text-gray-900">Ekipmanlar</h3>
                                            <span className="text-xs text-gray-500">Toplam: {selectedGate.equipments.length}</span>
                                        </div>

                                        <div className="space-y-2 mb-4">
                                            {selectedGate.equipments.map((equipment) => (
                                                <div
                                                    key={equipment.id}
                                                    className="border border-gray-200 rounded-lg p-3 flex flex-col lg:flex-row lg:items-center gap-2"
                                                >
                                                    <div className="flex-1 px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-900">
                                                        {equipment.name}
                                                    </div>

                                                    <div className="flex gap-2 lg:ml-auto w-full lg:w-auto">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleEquipmentDelete(equipment.id)}
                                                            disabled={saving}
                                                            className="w-full lg:w-auto px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-60"
                                                        >
                                                            Sil
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
                                            <p className="text-sm text-gray-700 font-medium mb-2">Yeni ekipman ekle</p>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <input
                                                    type="text"
                                                    value={equipmentToAdd}
                                                    onChange={(e) => setEquipmentToAdd(e.target.value)}
                                                    placeholder="Yeni ekipman adı"
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={addEquipmentToSelectedGate}
                                                    disabled={saving}
                                                    className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60"
                                                >
                                                    Ekipman Ekle
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </section>
                    </div>
                )}
            </main>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg w-full max-w-xl max-h-[90vh] overflow-y-auto border border-gray-200 shadow-xl">
                        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
                            <h2 className="text-lg font-semibold text-gray-900">Yeni Kapı Ekle</h2>
                            <button
                                type="button"
                                onClick={closeCreateModal}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                Kapat
                            </button>
                        </div>

                        <form onSubmit={handleCreateGate} className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kapı Adı</label>
                                <input
                                    type="text"
                                    value={newGateName}
                                    onChange={(e) => setNewGateName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Örn: Depo Kapısı"
                                />
                            </div>

                            <div className="border border-gray-200 rounded-md p-3">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Kapı Ekipmanları</label>
                                <div className="flex flex-col sm:flex-row gap-2 mb-3">
                                    <input
                                        type="text"
                                        value={newEquipmentName}
                                        onChange={(e) => setNewEquipmentName(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Ekipman adı"
                                    />
                                    <button
                                        type="button"
                                        onClick={addEquipmentToNewGateList}
                                        className="px-3 py-2 bg-slate-700 text-white rounded-md hover:bg-slate-800"
                                    >
                                        Listeye Ekle
                                    </button>
                                </div>

                                {newGateEquipments.length === 0 ? (
                                    <p className="text-sm text-gray-500">Henüz ekipman eklenmedi.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {newGateEquipments.map((equipment, index) => (
                                            <div
                                                key={`${equipment}-${index}`}
                                                className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 rounded-md"
                                            >
                                                <span className="text-sm text-gray-800">{equipment}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeEquipmentFromNewGateList(index)}
                                                    className="text-sm text-red-600 hover:text-red-700"
                                                >
                                                    Kaldır
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={closeCreateModal}
                                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                                >
                                    Vazgeç
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 bg-blue-700 text-white rounded-md hover:bg-blue-800 disabled:opacity-60"
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
