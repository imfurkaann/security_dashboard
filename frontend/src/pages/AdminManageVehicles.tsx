import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import type { Vehicle } from '../types';
import { API_URL } from '../constants';

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
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/admin/vehicle-records')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Araç Yönetimi</h1>
                                <p className="text-gray-600 mt-1">Araçları ekleyin, düzenleyin veya silin</p>
                            </div>
                        </div>
                        <button
                            onClick={handleAddNew}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Yeni Araç Ekle
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {vehicles.map((vehicle) => (
                            <div key={vehicle.id} className="bg-white rounded-lg shadow-md p-6">
                                <div className="mb-4">
                                    <h3 className="text-xl font-bold text-gray-900">{vehicle.plate}</h3>
                                    <p className="text-gray-600">{vehicle.brand}</p>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleEdit(vehicle)}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
                                    >
                                        Düzenle
                                    </button>
                                    <button
                                        onClick={() => handleDelete(vehicle.id)}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium"
                                    >
                                        Sil
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div className="p-6">
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">
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

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium"
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
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
