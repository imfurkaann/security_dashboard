import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../constants';
import ActionButton from '../components/ActionButton';

interface Personnel {
    id: string;
    first_name: string;
    last_name: string;
    username: string;
    role: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export default function AdminManagePersonnel() {
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
    const navigate = useNavigate();

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'personnel'>('all');

    // Form states
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [role, setRole] = useState<'personnel' | 'admin'>('personnel');
    const [isActive, setIsActive] = useState(true);

    const hasInvalidUsernameChars = /[^A-Za-z0-9._-]/.test(username);
    const shouldValidatePasswordMatch = !editingPersonnel || password.trim().length > 0 || confirmPassword.trim().length > 0;
    const passwordsDoNotMatch = shouldValidatePasswordMatch && password !== confirmPassword;

    useEffect(() => {
        fetchPersonnel();
    }, []);

    const fetchPersonnel = async () => {
        try {
            const token = localStorage.getItem('adminToken');
            const response = await axios.get(`${API_URL}/personnel`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPersonnel(response.data.data || []);
        } catch (error) {
            console.error('Error fetching personnel:', error);
            alert('Personel verileri yüklenirken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingPersonnel(null);
        setFirstName('');
        setLastName('');
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setRole('personnel');
        setIsActive(true);
        setShowModal(true);
    };

    const openEditModal = (person: Personnel) => {
        setEditingPersonnel(person);
        setFirstName(person.first_name);
        setLastName(person.last_name);
        setUsername(person.username);
        setPassword(''); // Don't pre-fill password
        setConfirmPassword('');
        setRole(person.role as 'personnel' | 'admin');
        setIsActive(person.is_active);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingPersonnel(null);
        setFirstName('');
        setLastName('');
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setRole('personnel');
        setIsActive(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!firstName.trim() || !lastName.trim() || !username.trim()) {
            alert('Lütfen tüm zorunlu alanları doldurun');
            return;
        }

        if (!editingPersonnel && !password.trim()) {
            alert('Yeni personel için şifre gereklidir');
            return;
        }

        if (hasInvalidUsernameChars) {
            alert('Kullanıcı adında İngilizce olmayan karakter kullanamazsınız');
            return;
        }

        if (shouldValidatePasswordMatch && passwordsDoNotMatch) {
            alert('Girilen şifreler eşleşmiyor');
            return;
        }

        try {
            const token = localStorage.getItem('adminToken');
            const data: any = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                username: username.trim(),
                role,
                isActive
            };

            // Only include password if it's provided
            if (password.trim()) {
                data.password = password;
            }

            if (editingPersonnel) {
                // Update existing personnel
                await axios.put(`${API_URL}/personnel/${editingPersonnel.id}`, data, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert('Personel başarıyla güncellendi');
            } else {
                // Create new personnel
                await axios.post(`${API_URL}/personnel`, data, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                alert('Personel başarıyla eklendi');
            }

            closeModal();
            fetchPersonnel();
        } catch (error: any) {
            console.error('Error saving personnel:', error);
            const errorMessage = error.response?.data?.message || 'İşlem sırasında bir hata oluştu';
            alert(errorMessage);
        }
    };

    const handleDelete = async (id: string, fullName: string) => {
        if (!confirm(`${fullName} kullanıcısını silmek istediğinizden emin misiniz?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('adminToken');
            await axios.delete(`${API_URL}/personnel/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert('Personel başarıyla silindi');
            fetchPersonnel();
        } catch (error: any) {
            console.error('Error deleting personnel:', error);
            const errorMessage = error.response?.data?.message || 'Silme işlemi sırasında bir hata oluştu';
            alert(errorMessage);
        }
    };

    const getRoleBadge = (role: string) => {
        if (role === 'admin') {
            return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Admin</span>;
        }
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Personel</span>;
    };

    // Filter personnel based on search and filters
    const filteredPersonnel = personnel.filter(person => {
        const matchesSearch = searchTerm === '' ||
            person.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            person.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            person.username.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesRole = roleFilter === 'all' || person.role === roleFilter;

        return matchesSearch && matchesRole;
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
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="text-gray-600 hover:text-gray-800 transition shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight break-words">Personel Yönetimi</h1>
                        </div>
                        <button
                            onClick={openAddModal}
                            className="w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Yeni Personel Ekle
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filters */}
                <div className="bg-white rounded-lg shadow mb-6 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Search Box */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Ara
                            </label>
                            <input
                                type="text"
                                placeholder="İsim, soyisim veya kullanıcı adı..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Role Filter */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Rol
                            </label>
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'personnel')}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="admin">Admin</option>
                                <option value="personnel">Personel</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Personel Listesi ({filteredPersonnel.length} / {personnel.length})
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
                                        Kullanıcı Adı
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Rol
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
                                {filteredPersonnel.map((person) => (
                                    <tr key={person.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">
                                                {person.first_name} {person.last_name}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-600">@{person.username}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getRoleBadge(person.role)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-600">
                                                {new Date(person.created_at).toLocaleDateString('tr-TR')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-2">
                                                <ActionButton
                                                    onClick={() => openEditModal(person)}
                                                    variant="primary"
                                                    title="Düzenle"
                                                >
                                                    Düzenle
                                                </ActionButton>
                                                <ActionButton
                                                    onClick={() => handleDelete(person.id, `${person.first_name} ${person.last_name}`)}
                                                    variant="danger"
                                                    title="Sil"
                                                >
                                                    Sil
                                                </ActionButton>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {filteredPersonnel.length === 0 && (
                            <div className="p-8 text-center text-gray-500">
                                {searchTerm || roleFilter !== 'all'
                                    ? 'Arama kriterlerine uygun personel bulunamadı.'
                                    : 'Henüz kayıtlı personel bulunmamaktadır.'}
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
                                {editingPersonnel ? 'Personel Düzenle' : 'Yeni Personel Ekle'}
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
                                    Kullanıcı Adı <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${hasInvalidUsernameChars ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                    required
                                />
                                {hasInvalidUsernameChars && (
                                    <p className="mt-1 text-xs text-red-600">Bu alan için İngilizce olmayan karakter kullanamazsınız.</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Şifre {!editingPersonnel && <span className="text-red-500">*</span>}
                                </label>
                                {editingPersonnel && (
                                    <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                                        ⚠️ Güvenlik nedeniyle mevcut şifre görüntülenemez. Değiştirmek için yeni şifre girin, boş bırakırsanız mevcut şifre korunur.
                                    </div>
                                )}
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={editingPersonnel ? "Yeni şifre (opsiyonel)" : "Şifre"}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${passwordsDoNotMatch ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                    required={!editingPersonnel}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Şifre Tekrar {!editingPersonnel && <span className="text-red-500">*</span>}
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Şifreyi tekrar girin"
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${passwordsDoNotMatch ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                                    required={!editingPersonnel || password.trim().length > 0}
                                />
                                {passwordsDoNotMatch && (
                                    <p className="mt-1 text-xs text-red-600">Şifreler eşleşmiyor.</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Rol <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as 'personnel' | 'admin')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                >
                                    <option value="personnel">Personel</option>
                                    <option value="admin">Admin</option>
                                </select>
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
                                    {editingPersonnel ? 'Güncelle' : 'Ekle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
