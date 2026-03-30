import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../constants';
import ActionButton from '../components/ActionButton';

interface Manager {
    id: string;
    first_name: string;
    last_name: string;
    title: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export default function AdminManageManagers() {
    const [managers, setManagers] = useState<Manager[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingManager, setEditingManager] = useState<Manager | null>(null);
    const navigate = useNavigate();

    // Filter states
    const [firstNameFilter, setFirstNameFilter] = useState('');
    const [lastNameFilter, setLastNameFilter] = useState('');
    const [titleFilter, setTitleFilter] = useState('');

    // Form states
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [title, setTitle] = useState('');
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        fetchManagers();
    }, []);

    const fetchManagers = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await axios.get(`${API_URL}/managers`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setManagers(response.data.data || []);
        } catch (error) {
            console.error('Error fetching managers:', error);
            alert('Müdür verileri yüklenirken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingManager(null);
        setFirstName('');
        setLastName('');
        setTitle('');
        setIsActive(true);
        setShowModal(true);
    };

    const openEditModal = (manager: Manager) => {
        setEditingManager(manager);
        setFirstName(manager.first_name);
        setLastName(manager.last_name);
        setTitle(manager.title || '');
        setIsActive(manager.is_active);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingManager(null);
        setFirstName('');
        setLastName('');
        setTitle('');
        setIsActive(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!firstName.trim() || !lastName.trim()) {
            alert('Lütfen ad ve soyad alanlarını doldurun');
            return;
        }

        try {
            const token = localStorage.getItem('adminToken');
            const data = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                title: title.trim() || null,
                isActive
            };

            if (editingManager) {
                // Update existing manager
                await axios.put(`${API_URL}/managers/${editingManager.id}`, data, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert('Müdür başarıyla güncellendi');
            } else {
                // Create new manager
                await axios.post(`${API_URL}/managers`, data, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert('Müdür başarıyla eklendi');
            }

            closeModal();
            fetchManagers();
        } catch (error: any) {
            console.error('Error saving manager:', error);
            const errorMessage = error.response?.data?.message || 'İşlem sırasında bir hata oluştu';
            alert(errorMessage);
        }
    };

    const handleDelete = async (id: string, fullName: string) => {
        if (!confirm(`${fullName} müdürünü silmek istediğinizden emin misiniz?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('adminToken');
            await axios.delete(`${API_URL}/managers/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Müdür başarıyla silindi');
            fetchManagers();
        } catch (error: any) {
            console.error('Error deleting manager:', error);
            const errorMessage = error.response?.data?.message || 'Silme işlemi sırasında bir hata oluştu';
            alert(errorMessage);
        }
    };

    // Filter managers based on search
    const filteredManagers = managers.filter(manager => {
        const matchesFirstName = firstNameFilter === '' ||
            manager.first_name.toLowerCase().includes(firstNameFilter.toLowerCase());

        const matchesLastName = lastNameFilter === '' ||
            manager.last_name.toLowerCase().includes(lastNameFilter.toLowerCase());

        const matchesTitle = titleFilter === '' ||
            (manager.title && manager.title.toLowerCase().includes(titleFilter.toLowerCase()));

        return matchesFirstName && matchesLastName && matchesTitle;
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-xl">Yükleniyor...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="text-gray-600 hover:text-gray-800 transition"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <h1 className="text-2xl font-bold text-gray-900">Müdür Yönetimi</h1>
                        </div>
                        <button
                            onClick={openAddModal}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Yeni Müdür Ekle
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow mb-6 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                İsim
                            </label>
                            <input
                                type="text"
                                placeholder="İsim ile filtrele..."
                                value={firstNameFilter}
                                onChange={(e) => setFirstNameFilter(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Soyisim
                            </label>
                            <input
                                type="text"
                                placeholder="Soyisim ile filtrele..."
                                value={lastNameFilter}
                                onChange={(e) => setLastNameFilter(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Ünvan
                            </label>
                            <input
                                type="text"
                                placeholder="Ünvan ile filtrele..."
                                value={titleFilter}
                                onChange={(e) => setTitleFilter(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Müdür Listesi ({filteredManagers.length} / {managers.length})
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Ad Soyad
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Ünvan
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Kayıt Tarihi
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        İşlemler
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredManagers.map((manager) => (
                                    <tr key={manager.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {manager.first_name} {manager.last_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-600">{manager.title || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-600">
                                                {new Date(manager.created_at).toLocaleDateString('tr-TR')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <ActionButton
                                                onClick={() => openEditModal(manager)}
                                                variant="primary"
                                                title="Düzenle"
                                                className="mr-2"
                                            >
                                                <svg className="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </ActionButton>
                                            <ActionButton
                                                onClick={() => handleDelete(manager.id, `${manager.first_name} ${manager.last_name}`)}
                                                variant="danger"
                                                title="Sil"
                                            >
                                                <svg className="w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </ActionButton>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filteredManagers.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                {(firstNameFilter || lastNameFilter || titleFilter)
                                    ? 'Arama kriterlerine uygun müdür bulunamadı.'
                                    : 'Henüz kayıtlı müdür bulunmamaktadır.'}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900">
                                {editingManager ? 'Müdür Düzenle' : 'Yeni Müdür Ekle'}
                            </h2>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Ad <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Soyad <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Ünvan
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Örn: İnsan Kaynakları Müdürü"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                                >
                                    {editingManager ? 'Güncelle' : 'Ekle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
