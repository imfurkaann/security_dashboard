import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import type { Vehicle } from '../types';
import { API_URL } from '../constants';
import ActionButton from '../components/ActionButton';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';

interface VehicleFormData {
    plate: string;
    brand: string;
}

export default function AdminManageVehicles() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
    const [formData, setFormData] = useState<VehicleFormData>({
        plate: '',
        brand: ''
    });
    const navigate = useNavigate();

    const sortedVehicles = useMemo(() => {
        return [...vehicles].sort((a, b) => {
            const brandCompare = a.brand.localeCompare(b.brand, 'tr', { sensitivity: 'base' });
            if (brandCompare !== 0) return brandCompare;
            return a.plate.localeCompare(b.plate, 'tr', { sensitivity: 'base' });
        });
    }, [vehicles]);

    // Fetch vehicles
    const fetchVehicles = async () => {
        try {
            const adminToken = localStorage.getItem('adminToken');
            const config = {
                headers: {
                    Authorization: `Bearer ${adminToken}`
                }
            };
            const response = await axios.get(`${API_URL}/vehicles`, config);
            setVehicles(response.data || []);
        } catch (error) {
            console.error('Araçlar yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVehicles();
    }, []);

    useRealtimeRefetch({
        topics: ['vehicles'],
        onMutation: fetchVehicles,
        enabled: true,
    });

    // Open modal for adding new vehicle
    const handleAddNew = () => {
        setEditingVehicle(null);
        setFormData({
            plate: '',
            brand: ''
        });
        setShowModal(true);
    };

    // Open modal for editing vehicle
    const handleEdit = (vehicle: Vehicle) => {
        setEditingVehicle(vehicle);
        setFormData({
            plate: vehicle.plate,
            brand: vehicle.brand
        });
        setShowModal(true);
    };

    // Save vehicle (create or update)
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const adminToken = localStorage.getItem('adminToken');
            const config = {
                headers: {
                    Authorization: `Bearer ${adminToken}`
                }
            };

            const vehicleData = formData;

            if (editingVehicle) {
                // Update existing vehicle
                await axios.put(
                    `${API_URL}/vehicles/${editingVehicle.id}`,
                    vehicleData,
                    config
                );
            } else {
                // Create new vehicle
                await axios.post(
                    `${API_URL}/vehicles`,
                    vehicleData,
                    config
                );
            }

            setShowModal(false);
            fetchVehicles();
        } catch (error) {
            console.error('Araç kaydedilemedi:', error);
            alert('Araç kaydedilirken bir hata oluştu');
        }
    };

    // Delete vehicle
    const handleDelete = async (id: string) => {
        if (!confirm('Bu aracı silmek istediğinizden emin misiniz?')) {
            return;
        }

        try {
            const adminToken = localStorage.getItem('adminToken');
            const config = {
                headers: {
                    Authorization: `Bearer ${adminToken}`
                }
            };

            await axios.delete(
                `${API_URL}/vehicles/${id}`,
                config
            );

            fetchVehicles();
        } catch (error) {
            console.error('Araç silinemedi:', error);
            alert('Araç silinirken bir hata oluştu');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/admin/vehicle-records')}
                                className="p-2 hover:bg-slate-800 rounded-lg transition shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Araç Yönetimi</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Araçları ekleyin, düzenleyin veya silin</p>
                            </div>
                        </div>
                        <button
                            onClick={handleAddNew}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Yeni Araç Ekle
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4">
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 flex-1 min-h-[520px]">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Araç Listesi</h2>
                            <p className="text-sm text-gray-500 mt-1">Kayıtlar yukarıdan aşağıya sıralanır</p>
                        </div>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{sortedVehicles.length} kayıt</span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : sortedVehicles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-gray-500">Kayıtlı araç bulunamadı</p>
                        </div>
                    ) : (
                        <div className="space-y-3 overflow-auto pr-1">
                            {sortedVehicles.map((vehicle) => (
                                <div key={vehicle.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 shadow-sm hover:shadow transition-shadow">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="h-11 w-11 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17h6m-3-7v7m8-4V5a2 2 0 00-2-2H6a2 2 0 00-2 2v8m16 0l-2-2H6l-2 2m16 0v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6" />
                                                </svg>
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="text-lg font-bold text-gray-900 break-words">{vehicle.plate}</h3>
                                                <p className="text-sm text-gray-600 break-words">{vehicle.brand}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-row items-center gap-2 shrink-0">
                                        <ActionButton
                                            onClick={() => handleEdit(vehicle)}
                                            variant="primary"
                                            className="shrink-0"
                                        >
                                            Düzenle
                                        </ActionButton>
                                        <ActionButton
                                            onClick={() => handleDelete(vehicle.id)}
                                            variant="danger"
                                            className="shrink-0"
                                        >
                                            Sil
                                        </ActionButton>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-4 sm:p-6">
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">
                                {editingVehicle ? 'Araç Düzenle' : 'Yeni Araç Ekle'}
                            </h2>

                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Plaka *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.plate}
                                        onChange={(e) => setFormData({ ...formData, plate: e.target.value.toUpperCase() })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="34 ABC 123"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Marka *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.brand}
                                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Toyota Corolla"
                                    />
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="w-full sm:flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                                    >
                                        Kaydet
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
