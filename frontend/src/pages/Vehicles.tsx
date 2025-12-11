import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface Vehicle {
    id: string;
    brand: string;
    plate: string;
    status: string;
    is_active: boolean;
    created_at: string;
}

interface VehicleUsage {
    id: string;
    vehicle: string;
    vehicle_brand: string;
    vehicle_plate: string;
    manager: string;
    manager_title: string;
    personnel: string;
    given_date: string;
    given_time: string;
    return_date: string | null;
    return_time: string | null;
    destination: string;
    status: string;
    notes: string | null;
    created_at: string;
}

interface Manager {
    id: string;
    first_name: string;
    last_name: string;
    title: string;
}

export default function Vehicles() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [usages, setUsages] = useState<VehicleUsage[]>([]);
    const [managers, setManagers] = useState<Manager[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showCustomManager, setShowCustomManager] = useState(false);
    const [filter, setFilter] = useState<'all' | 'in_use' | 'returned'>('all');
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Format date to DD/MM/YYYY
    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Format time to HH:MM
    const formatTime = (timeString: string | null) => {
        if (!timeString) return '-';
        return timeString.substring(0, 5); // Get HH:MM from HH:MM:SS
    };

    const [formData, setFormData] = useState({
        vehicle_id: '',
        manager_id: '',
        manager_name: '',
        destination: '',
        notes: ''
    });

    useEffect(() => {
        const user = localStorage.getItem('user');
        if (user) setCurrentUser(JSON.parse(user));
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const [vehiclesRes, recordsRes, managersRes] = await Promise.all([
                axios.get(`${API_URL}/vehicles`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_URL}/vehicles/records`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                axios.get(`${API_URL}/vehicles/managers`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);
            setVehicles(vehiclesRes.data || []);
            setUsages(recordsRes.data || []);
            setManagers(managersRes.data || []);
        } catch (error) {
            console.error('Veri yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/vehicles/records`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowModal(false);
            resetForm();
            fetchData();
        } catch (error: any) {
            alert(error.response?.data?.message || 'İşlem başarısız');
        }
    };

    const handleReturn = async (usageId: string) => {
        if (!confirm('Aracın iadesini kaydetmek istediğinize emin misiniz?')) return;

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/vehicles/records/${usageId}/return`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
        } catch (error: any) {
            alert(error.response?.data?.message || 'İade kaydı başarısız');
        }
    };

    const resetForm = () => {
        setFormData({
            vehicle_id: '',
            manager_id: '',
            manager_name: '',
            destination: '',
            notes: ''
        });
        setShowCustomManager(false);
    };

    const openModal = () => {
        resetForm();
        setShowModal(true);
    };

    // Bugünün kayıtlarını filtrele (bugün alınan VEYA bugün iade edilen)
    const todayUsages = usages.filter(u => {
        const today = new Date();
        const givenDate = new Date(u.given_date);

        // Bugün alınan kayıtlar
        const takenToday = givenDate.getFullYear() === today.getFullYear() &&
            givenDate.getMonth() === today.getMonth() &&
            givenDate.getDate() === today.getDate();

        // Bugün iade edilen kayıtlar
        let returnedToday = false;
        if (u.return_date) {
            const returnDate = new Date(u.return_date);
            returnedToday = returnDate.getFullYear() === today.getFullYear() &&
                returnDate.getMonth() === today.getMonth() &&
                returnDate.getDate() === today.getDate();
        }

        return takenToday || returnedToday;
    });

    const filteredUsages = todayUsages.filter(u => {
        if (filter === 'in_use') return u.status === 'in_use';
        if (filter === 'returned') return u.status === 'returned';
        return true;
    });

    // Tüm kullanımdaki araçlar (bugün + önceki günlerden kalanlar)
    const inUseCount = usages.filter(u => u.status === 'in_use').length;
    const availableVehicles = vehicles.filter(v => v.status === 'available');

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
                                <h1 className="text-3xl font-bold text-gray-900">Otel Araç Kullanım Sistemi</h1>
                                <p className="text-gray-600 mt-1">Otel araçlarının kullanım kayıtlarını yönetin</p>
                            </div>
                        </div>
                        <button
                            onClick={() => openModal()}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition shadow-md hover:shadow-lg"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Araç Al
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-blue-600 text-sm font-medium">Toplam Araç</p>
                                <p className="text-3xl font-bold text-blue-900">{vehicles.length}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-green-600 text-sm font-medium">Müsait Araçlar</p>
                                <p className="text-3xl font-bold text-green-900">{availableVehicles.length}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-lg">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-orange-600 text-sm font-medium">Kullanımda</p>
                                <p className="text-3xl font-bold text-orange-900">{inUseCount}</p>
                            </div>
                            <div className="p-3 bg-orange-100 rounded-lg">
                                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-purple-600 text-sm font-medium">Bugün Alınan</p>
                                <p className="text-3xl font-bold text-purple-900">
                                    {usages.filter(u => {
                                        const givenDate = new Date(u.given_date);
                                        const today = new Date();
                                        return givenDate.getFullYear() === today.getFullYear() &&
                                            givenDate.getMonth() === today.getMonth() &&
                                            givenDate.getDate() === today.getDate();
                                    }).length}
                                </p>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-lg">
                                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-4 py-2 rounded-lg transition ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Bugünün Kayıtları ({todayUsages.length})
                        </button>
                        <button
                            onClick={() => setFilter('in_use')}
                            className={`px-4 py-2 rounded-lg transition ${filter === 'in_use' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Bugün Kullanıma Verilen ({todayUsages.filter(u => u.status === 'in_use').length})
                        </button>
                        <button
                            onClick={() => setFilter('returned')}
                            className={`px-4 py-2 rounded-lg transition ${filter === 'returned' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            Bugün İade Edildi ({todayUsages.filter(u => u.status === 'returned').length})
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredUsages.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                            <p className="text-gray-500">Kayıt bulunmuyor</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="max-h-[600px] overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Araç</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Müdür</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gidilen Yer</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verilme Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İade Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>

                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredUsages.map((usage) => (
                                            <tr key={usage.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="p-2 bg-blue-100 rounded">
                                                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                                            </svg>
                                                        </div>
                                                        <div className="ml-3">
                                                            <div className="text-sm font-bold text-gray-900">{usage.vehicle_plate}</div>
                                                            <div className="text-xs text-gray-500">{usage.vehicle_brand}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-bold text-gray-900">{usage.manager}</div>
                                                    <div className="text-xs text-gray-500">{usage.manager_title}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-900">{usage.destination}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-500">{usage.notes || '-'}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{formatDate(usage.given_date)}</div>
                                                    <div className="text-xs text-gray-500">{formatTime(usage.given_time)}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {usage.return_date ? (
                                                        <>
                                                            <div className="text-sm text-gray-900">{formatDate(usage.return_date)}</div>
                                                            <div className="text-xs text-gray-500">{formatTime(usage.return_time)}</div>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${usage.status === 'in_use'
                                                        ? 'bg-orange-100 text-orange-800'
                                                        : 'bg-green-100 text-green-800'
                                                        }`}>
                                                        {usage.status === 'in_use' ? 'Kullanımda' : 'İade Edildi'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    {usage.status === 'in_use' && (
                                                        <button
                                                            onClick={() => handleReturn(usage.id)}
                                                            className="text-green-600 hover:text-green-900 transition font-medium"
                                                            title="Aracı İade Et"
                                                        >
                                                            İade Et
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    Araç Kullanımı Kaydı
                                </h2>
                                <button
                                    onClick={() => { setShowModal(false); resetForm(); }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Araç Seçin <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            required
                                            value={formData.vehicle_id}
                                            onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="">Araç seçiniz...</option>
                                            {availableVehicles.map(vehicle => (
                                                <option key={vehicle.id} value={vehicle.id}>
                                                    {vehicle.plate} - {vehicle.brand}
                                                </option>
                                            ))}
                                        </select>
                                        {availableVehicles.length === 0 && (
                                            <p className="text-sm text-red-600 mt-1">Müsait araç bulunmamaktadır</p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Aracı Alan Müdür <span className="text-red-500">*</span>
                                        </label>
                                        {!showCustomManager ? (
                                            <>
                                                <select
                                                    required={!showCustomManager}
                                                    value={formData.manager_id}
                                                    onChange={(e) => {
                                                        if (e.target.value === 'custom') {
                                                            setShowCustomManager(true);
                                                            setFormData({ ...formData, manager_id: '', manager_name: '' });
                                                        } else {
                                                            setFormData({ ...formData, manager_id: e.target.value, manager_name: '' });
                                                        }
                                                    }}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="">Müdür seçiniz...</option>
                                                    {managers.map(manager => (
                                                        <option key={manager.id} value={manager.id}>
                                                            {manager.first_name} {manager.last_name} - {manager.title}
                                                        </option>
                                                    ))}
                                                    <option value="custom">🔽 Listede Yok - Elle Gir</option>
                                                </select>
                                            </>
                                        ) : (
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    required={showCustomManager}
                                                    value={formData.manager_name}
                                                    onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                                                    placeholder="Müdür adı soyadı"
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowCustomManager(false);
                                                        setFormData({ ...formData, manager_id: '', manager_name: '' });
                                                    }}
                                                    className="text-sm text-blue-600 hover:text-blue-800"
                                                >
                                                    ← Listeye Dön
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Gidilen Yer <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.destination}
                                            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                                            placeholder="Örn: Havalimanı, Şehir Merkezi"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Açıklama / Not
                                        </label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            rows={3}
                                            placeholder="Kullanım amacı, ek notlar..."
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={availableVehicles.length === 0}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                                    >
                                        Aracı Al
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowModal(false); resetForm(); }}
                                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition"
                                    >
                                        İptal
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
