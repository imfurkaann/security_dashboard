import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal } from 'antd';
import 'antd/dist/reset.css';
import api from '../utils/api';
import type { Vehicle } from '../types';
import ActionButton from '../components/ActionButton';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';

interface VehicleFormData {
    plate: string;
    brand: string;
}

interface CompactActionButtonProps {
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    variant?: 'primary' | 'success' | 'danger' | 'neutral';
    title?: string;
    disabled?: boolean;
    className?: string;
}

const actionVariantClasses = {
    primary: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    danger: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    neutral: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
};

function CompactActionButton({
    onClick,
    icon,
    label,
    variant = 'neutral',
    title,
    disabled = false,
    className = ''
}: CompactActionButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title || label}
            className={`compact-btn inline-flex items-center justify-center h-8 min-w-[32px] px-2 hover:px-3 rounded-full border transition-all duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${actionVariantClasses[variant]} ${className}`.trim()}
        >
            <span className="flex items-center justify-center shrink-0">
                {icon}
            </span>
            <span className="compact-btn-text text-[11px] font-bold">
                {label}
            </span>
        </button>
    );
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

    // Filter states
    const [plateFilter, setPlateFilter] = useState('');
    const [brandFilter, setBrandFilter] = useState('');

    const filteredVehicles = useMemo(() => {
        return vehicles.filter(vehicle => {
            const matchesPlate = plateFilter === '' ||
                vehicle.plate.toLowerCase().includes(plateFilter.toLowerCase());

            const matchesBrand = brandFilter === '' ||
                vehicle.brand.toLowerCase().includes(brandFilter.toLowerCase());

            return matchesPlate && matchesBrand;
        });
    }, [vehicles, plateFilter, brandFilter]);

    const sortedVehicles = useMemo(() => {
        return [...filteredVehicles].sort((a, b) => {
            const brandCompare = a.brand.localeCompare(b.brand, 'tr', { sensitivity: 'base' });
            if (brandCompare !== 0) return brandCompare;
            return a.plate.localeCompare(b.plate, 'tr', { sensitivity: 'base' });
        });
    }, [filteredVehicles]);

    // Fetch vehicles
    const fetchVehicles = async () => {
        try {
            const response = await api.get('/vehicles');
            setVehicles(response.data || []);
        } catch (error) {
            console.error('Araçlar yüklenemedi:', error);
            message.error('Araçlar yüklenemedi');
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
            const vehicleData = formData;

            if (editingVehicle) {
                // Update existing vehicle
                await api.put(`/vehicles/${editingVehicle.id}`, vehicleData);
                message.success('Araç başarıyla güncellendi');
            } else {
                // Create new vehicle
                await api.post('/vehicles', vehicleData);
                message.success('Araç başarıyla eklendi');
            }

            setShowModal(false);
            void fetchVehicles();
        } catch (error: any) {
            console.error('Araç kaydedilemedi:', error);
            const errorMessage = error.response?.data?.message || 'Araç kaydedilirken bir hata oluştu';
            message.error(errorMessage);
        }
    };

    // Delete vehicle
    const handleDelete = async (id: string) => {
        Modal.confirm({
            title: 'Aracı Sil',
            content: 'Bu aracı silmek istediğinizden emin misiniz?',
            okText: 'Evet, Sil',
            okType: 'danger',
            cancelText: 'Vazgeç',
            onOk: async () => {
                try {
                    await api.delete(`/vehicles/${id}`);
                    message.success('Araç başarıyla silindi');
                    void fetchVehicles();
                } catch (error: any) {
                    console.error('Araç silinemedi:', error);
                    const errorMessage = error.response?.data?.message || 'Araç silinirken bir hata oluştu';
                    message.error(errorMessage);
                }
            }
        });
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
                <div className="bg-white rounded-lg shadow px-3 py-2 mb-1 w-full">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-base font-bold text-gray-900">Filtreler</h2>
                        <button
                            onClick={() => {
                                setPlateFilter('');
                                setBrandFilter('');
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Temizle
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Plaka</label>
                            <input
                                type="text"
                                placeholder="Plaka ile filtrele..."
                                value={plateFilter}
                                onChange={(e) => setPlateFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Marka / Model</label>
                            <input
                                type="text"
                                placeholder="Marka / Model ile filtrele..."
                                value={brandFilter}
                                onChange={(e) => setBrandFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 flex-1 min-h-[520px]">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Araç Listesi</h2>
                        </div>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{sortedVehicles.length} / {vehicles.length} kayıt</span>
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
                        <div className="overflow-x-auto min-h-0">
                            <table className="w-full table-auto divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Plaka</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Marka / Model</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {sortedVehicles.map((vehicle) => (
                                        <tr key={vehicle.id} className="hover:bg-gray-50/50 transition">
                                            <td className="px-4 py-2.5 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                <span className="font-semibold text-slate-800 tracking-wider">
                                                    {vehicle.plate}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">
                                                {vehicle.brand}
                                            </td>
                                            <td className="px-4 py-2.5 whitespace-nowrap text-right text-sm">
                                                <div className="flex justify-end gap-2">
                                                    <CompactActionButton
                                                        onClick={() => handleEdit(vehicle)}
                                                        variant="primary"
                                                        label="Düzenle"
                                                        icon={
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                            </svg>
                                                        }
                                                    />
                                                    <CompactActionButton
                                                        onClick={() => handleDelete(vehicle.id)}
                                                        variant="danger"
                                                        label="Sil"
                                                        icon={
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        }
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
                            <h2 className="text-xl font-semibold text-gray-900">
                                {editingVehicle ? 'Araç Düzenle' : 'Yeni Araç Ekle'}
                            </h2>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Plaka <span className="text-red-500">*</span>
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
                                    Marka <span className="text-red-500">*</span>
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
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                                >
                                    {editingVehicle ? 'Güncelle' : 'Ekle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
