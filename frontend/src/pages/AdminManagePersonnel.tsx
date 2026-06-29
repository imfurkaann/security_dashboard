import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal } from 'antd';
import 'antd/dist/reset.css';
import api from '../utils/api';
import ActionButton from '../components/ActionButton';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';

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

const normalizeSearchText = (value: string | null | undefined): string => {
    return (value || '').toLocaleLowerCase('tr-TR').normalize('NFC');
};

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

    const fetchPersonnel = useCallback(async () => {
        try {
            const response = await api.get('/personnel');
            setPersonnel(response.data.data || []);
        } catch (error) {
            console.error('Error fetching personnel:', error);
            message.error('Personel verileri yüklenirken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchPersonnel();
    }, [fetchPersonnel]);

    useRealtimeRefetch({
        topics: ['personnel'],
        onMutation: fetchPersonnel,
        enabled: true,
    });

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
            message.warning('Lütfen tüm zorunlu alanları doldurun');
            return;
        }

        if (!editingPersonnel && !password.trim()) {
            message.warning('Yeni personel için şifre gereklidir');
            return;
        }

        if (hasInvalidUsernameChars) {
            message.warning('Kullanıcı adında Türkçe olmayan karakter kullanamazsınız');
            return;
        }

        if (shouldValidatePasswordMatch && passwordsDoNotMatch) {
            message.warning('Girilen şifreler eşleşmiyor');
            return;
        }

        try {
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
                await api.put(`/personnel/${editingPersonnel.id}`, data);
                message.success('Personel başarıyla güncellendi');
            } else {
                // Create new personnel
                await api.post('/personnel', data);
                message.success('Personel başarıyla eklendi');
            }

            closeModal();
            void fetchPersonnel();
        } catch (error: any) {
            console.error('Error saving personnel:', error);
            const errorMessage = error.response?.data?.message || 'İşlem sırasında bir hata oluştu';
            message.error(errorMessage);
        }
    };

    const handleDelete = async (id: string, fullName: string) => {
        Modal.confirm({
            title: 'Personeli Sil',
            content: `${fullName} kullanıcısını silmek istediğinizden emin misiniz?`,
            okText: 'Evet, Sil',
            okType: 'danger',
            cancelText: 'Vazgeç',
            onOk: async () => {
                try {
                    await api.delete(`/personnel/${id}`);
                    message.success('Personel başarıyla silindi');
                    void fetchPersonnel();
                } catch (error: any) {
                    console.error('Error deleting personnel:', error);
                    const errorMessage = error.response?.data?.message || 'Silme işlemi sırasında bir hata oluştu';
                    message.error(errorMessage);
                }
            }
        });
    };

    const getRoleBadge = (role: string) => {
        if (role === 'admin') {
            return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Admin</span>;
        }
        return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Personel</span>;
    };

    // Filter personnel based on search and filters
    const filteredPersonnel = personnel.filter(person => {
        const normalizedSearch = normalizeSearchText(searchTerm);
        const matchesSearch = normalizedSearch === '' ||
            normalizeSearchText(person.first_name).includes(normalizedSearch) ||
            normalizeSearchText(person.last_name).includes(normalizedSearch) ||
            normalizeSearchText(person.username).includes(normalizedSearch);

        const matchesRole = roleFilter === 'all' || person.role === roleFilter;

        return matchesSearch && matchesRole;
    });

    const sortedPersonnel = useMemo(() => {
        return [...filteredPersonnel].sort((a, b) => {
            const firstCompare = a.first_name.localeCompare(b.first_name, 'tr', { sensitivity: 'base' });
            if (firstCompare !== 0) return firstCompare;
            return a.last_name.localeCompare(b.last_name, 'tr', { sensitivity: 'base' });
        });
    }, [filteredPersonnel]);

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
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Personel Yönetimi</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Personelleri ekleyin, düzenleyin veya silin</p>
                            </div>
                        </div>
                        <button
                            onClick={openAddModal}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Yeni Personel Ekle
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
                                setSearchTerm('');
                                setRoleFilter('all');
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Temizle
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Ara</label>
                            <input
                                type="text"
                                placeholder="İsim, soyisim veya kullanıcı adı..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'personnel')}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="admin">Admin</option>
                                <option value="personnel">Personel</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-auto flex-1 min-h-0">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Personel Listesi</h2>
                        </div>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{sortedPersonnel.length} / {personnel.length} kayıt</span>
                    </div>

                    {sortedPersonnel.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-gray-500">
                                {searchTerm || roleFilter !== 'all'
                                    ? 'Arama kriterlerine uygun personel bulunamadı.'
                                    : 'Henüz kayıtlı personel bulunmamaktadır.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto min-h-0">
                            <table className="w-full table-auto divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Ad Soyad</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kullanıcı Adı</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kayıt Tarihi</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-40">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {sortedPersonnel.map((person) => {
                                        const fullName = `${person.first_name} ${person.last_name}`.trim();
                                        return (
                                            <tr key={person.id} className="hover:bg-gray-50/50 transition">
                                                <td className="px-4 py-2.5 whitespace-nowrap text-sm font-semibold text-slate-800">
                                                    {fullName}
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-600">
                                                    @{person.username}
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                                                    {getRoleBadge(person.role)}
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap text-sm">
                                                    {person.is_active ? (
                                                        <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-100 text-emerald-800">Aktif</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-gray-100 text-gray-800">Pasif</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap text-sm text-gray-500">
                                                    {new Date(person.created_at).toLocaleDateString('tr-TR')}
                                                </td>
                                                <td className="px-4 py-2.5 whitespace-nowrap text-right text-sm">
                                                    <div className="flex justify-end gap-2">
                                                        <CompactActionButton
                                                            onClick={() => openEditModal(person)}
                                                            variant="primary"
                                                            label="Düzenle"
                                                            icon={
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                </svg>
                                                            }
                                                        />
                                                        <CompactActionButton
                                                            onClick={() => handleDelete(person.id, fullName)}
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
                                        );
                                    })}
                                </tbody>
                            </table>
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
                                    <p className="mt-1 text-xs text-red-600">Lütfen Türkçe karakterler kullanmayınız. Örn Ş, Ğ, Ü vb..</p>
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
