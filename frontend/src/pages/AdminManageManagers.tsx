import { useMemo, useState, useEffect } from 'react';
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

    const sortedManagers = useMemo(() => {
        return [...filteredManagers].sort((a, b) => {
            const firstCompare = a.first_name.localeCompare(b.first_name, 'tr', { sensitivity: 'base' });
            if (firstCompare !== 0) return firstCompare;
            return a.last_name.localeCompare(b.last_name, 'tr', { sensitivity: 'base' });
        });
    }, [filteredManagers]);

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
                                onClick={() => navigate('/admin/dashboard')}
                                className="p-2 hover:bg-slate-800 rounded-lg transition shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Müdür Yönetimi</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Müdürleri ekleyin, düzenleyin veya silin</p>
                            </div>
                        </div>
                        <button
                            onClick={openAddModal}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Yeni Müdür Ekle
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4">
                <div className="bg-white rounded-lg shadow px-3 py-2 mb-3 w-full">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-base font-bold text-gray-900">Filtreler</h2>
                        <button
                            onClick={() => {
                                setFirstNameFilter('');
                                setLastNameFilter('');
                                setTitleFilter('');
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Temizle
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">İsim</label>
                            <input
                                type="text"
                                placeholder="İsim ile filtrele..."
                                value={firstNameFilter}
                                onChange={(e) => setFirstNameFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Soyisim</label>
                            <input
                                type="text"
                                placeholder="Soyisim ile filtrele..."
                                value={lastNameFilter}
                                onChange={(e) => setLastNameFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Ünvan</label>
                            <input
                                type="text"
                                placeholder="Ünvan ile filtrele..."
                                value={titleFilter}
                                onChange={(e) => setTitleFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-auto flex-1 min-h-0">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Müdür Listesi</h2>
                            <p className="text-sm text-gray-500 mt-1">Kayıtlar yukarıdan aşağıya sıralanır</p>
                        </div>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{sortedManagers.length} / {managers.length} kayıt</span>
                    </div>

                    {sortedManagers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-gray-500">
                                {(firstNameFilter || lastNameFilter || titleFilter)
                                    ? 'Arama kriterlerine uygun müdür bulunamadı.'
                                    : 'Henüz kayıtlı müdür bulunmamaktadır.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3 overflow-auto pr-1">
                            {sortedManagers.map((manager) => {
                                const fullName = `${manager.first_name} ${manager.last_name}`.trim();

                                return (
                                    <div key={manager.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 shadow-sm hover:shadow transition-shadow">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-11 w-11 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A9 9 0 1118.88 4.046a9 9 0 01-13.758 13.758zM15 11a3 3 0 11-6 0 3 3 0 016 0zm2 7a7 7 0 10-10 0h10z" />
                                                    </svg>
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-lg font-bold text-gray-900 break-words">{fullName}</h3>
                                                    <p className="text-sm text-gray-600 break-words">{manager.title || '-'}</p>
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        {new Date(manager.created_at).toLocaleDateString('tr-TR')}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-row items-center gap-2 shrink-0">
                                            <ActionButton
                                                onClick={() => openEditModal(manager)}
                                                variant="primary"
                                                title="Düzenle"
                                                className="shrink-0"
                                            >
                                                Düzenle
                                            </ActionButton>
                                            <ActionButton
                                                onClick={() => handleDelete(manager.id, fullName)}
                                                variant="danger"
                                                title="Sil"
                                                className="shrink-0"
                                            >
                                                Sil
                                            </ActionButton>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white">
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
