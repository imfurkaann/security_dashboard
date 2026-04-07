import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate, formatTime } from '../utils/dateUtils';
import dayjs from '../utils/dayjsConfig';
import { isValidLength } from '../utils/validation';
import type { ManagerRecord, Manager, ManagerFilterType } from '../types';
import ActionButton from '../components/ActionButton';

// Personnel type for manager list
interface Personnel {
    id: string;
    full_name: string;
    first_name?: string;
    last_name?: string;
    title?: string;
    department?: string | null;
    phone?: string | null;
    email?: string | null;
}

export default function Managers() {
    const [records, setRecords] = useState<ManagerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [managersList, setManagersList] = useState<Personnel[]>([]);
    const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
    const [notes, setNotes] = useState('');
    const [entryTime, setEntryTime] = useState('');
    const [exitTime, setExitTime] = useState('');
    const [filterMode, setFilterMode] = useState<ManagerFilterType>('all');
    const [recordVisibility, setRecordVisibility] = useState<'all' | 'active' | 'deleted'>('all');
    const navigate = useNavigate();

    // Fetch manager records
    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/managers/records?includeDeleted=true');
            setRecords(res.data || []);
        } catch (err) {
            console.error('Müdür verisi yüklenemedi', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch managers list
    const fetchManagers = useCallback(async () => {
        try {
            const res = await api.get('/vehicles/managers');
            setManagersList(res.data || []);
        } catch (err) {
            console.warn('Müdür listesi yüklenemedi', err);
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchManagers();
    }, [fetchData, fetchManagers]);

    // Reset form to initial state
    const resetForm = useCallback(() => {
        setIsEditing(false);
        setEditingId(null);
        setSelectedManagerId(null);
        setNotes('');
        setEntryTime('');
        setExitTime('');
    }, []);

    // Open modal for new record
    const openModalForNew = useCallback(() => {
        resetForm();
        setShowModal(true);
    }, [resetForm]);

    // Open modal for editing
    const openModalForEdit = useCallback((rec: ManagerRecord) => {
        const found = managersList.find(p => {
            const name = p.first_name ? `${p.first_name} ${p.last_name}` : p.full_name;
            return name === (rec.manager || '');
        });
        setSelectedManagerId(found ? found.id : null);
        setNotes(rec.notes || '');
        setEntryTime(rec.entry_time ? formatTime(rec.entry_time) : '');
        setExitTime(rec.exit_time ? formatTime(rec.exit_time) : '');
        setIsEditing(true);
        setEditingId(rec.id);
        setShowModal(true);
    }, [managersList]);

    // Form submission handler
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedManagerId) {
            alert('Lütfen listeden bir müdür seçin.');
            return;
        }

        // Frontend validasyon
        if (!isValidLength(notes, 0, 1000)) {
            alert('Açıklama en fazla 1000 karakter olabilir');
            return;
        }

        try {
            const payload = {
                manager_id: selectedManagerId,
                notes: notes?.trim() || null,
                entry_time: entryTime || null,
                exit_time: exitTime || null
            };

            if (isEditing && editingId) {
                await api.put(`/managers/records/${editingId}`, payload);
            } else {
                await api.post('/managers/records', payload);
            }

            setShowModal(false);
            resetForm();
            fetchData();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err?.response?.data?.message || 'İşlem başarısız');
        }
    }, [selectedManagerId, notes, entryTime, exitTime, isEditing, editingId, resetForm, fetchData]);

    // Handle manager exit
    const handleExit = useCallback(async (id: string) => {
        if (!confirm('Seçili müdür için çıkış kaydı oluşturulsun mu?')) return;

        try {
            await api.post(`/managers/records/${id}/exit`, { exit_time: null });
            fetchData();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err?.response?.data?.message || 'Çıkış işlemi başarısız');
        }
    }, [fetchData]);

    const handleDelete = useCallback(async (id: string) => {
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

        try {
            await api.delete(`/managers/records/${id}`);
            fetchData();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err?.response?.data?.message || 'Silme işlemi başarısız');
        }
    }, [fetchData]);

    const handleRestore = useCallback(async (id: string) => {
        try {
            await api.post(`/managers/records/${id}/restore`);
            fetchData();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err?.response?.data?.message || 'Geri alma işlemi başarısız');
        }
    }, [fetchData]);

    // Memoized statistics
    const stats = useMemo(() => {
        const today = dayjs().format('YYYY-MM-DD');
        const todayRecords = records.filter(r => {
            const entryDate = r.entry_date ? dayjs(r.entry_date).format('YYYY-MM-DD') : null;
            const exitDate = r.exit_date ? dayjs(r.exit_date).format('YYYY-MM-DD') : null;
            return entryDate === today || exitDate === today;
        });
        const todayExits = records.filter(r => {
            const exitDate = r.exit_date ? dayjs(r.exit_date).format('YYYY-MM-DD') : null;
            return exitDate === today;
        });
        return {
            totalManagers: managersList.length,
            insideCount: records.filter(r => r.status === 'inside').length,
            todayExitCount: todayExits.length,
            todayCount: todayRecords.length,
        };
    }, [records, managersList]);

    // Memoized filtered records
    const filteredRecords = useMemo(() => {
        const today = dayjs().format('YYYY-MM-DD');
        return records.filter(r => {
            const isDeleted = Boolean(r.deleted_at);
            if (recordVisibility === 'active' && isDeleted) return false;
            if (recordVisibility === 'deleted' && !isDeleted) return false;

            if (filterMode === 'all') {
                // Bugünün kayıtları: bugün giriş yapan veya bugün çıkış yapan
                const entryDate = r.entry_date ? dayjs(r.entry_date).format('YYYY-MM-DD') : null;
                const exitDate = r.exit_date ? dayjs(r.exit_date).format('YYYY-MM-DD') : null;
                return entryDate === today || exitDate === today;
            }
            if (filterMode === 'inside') return r.status === 'inside'; // Aktif içeridekiler
            if (filterMode === 'exited') {
                // Bugün çıkış yapanlar
                const exitDate = r.exit_date ? dayjs(r.exit_date).format('YYYY-MM-DD') : null;
                return exitDate === today;
            }
            return true;
        });
    }, [records, filterMode, recordVisibility]);

    // Memoized available managers for select
    const selectManagers = useMemo(() => {
        const insideManagerIds = new Set(
            records.filter(r => r.status === 'inside' && r.manager_id).map(r => r.manager_id)
        );
        let available = managersList.filter(m => !insideManagerIds.has(m.id));

        // If editing, include the current record's manager
        if (isEditing && editingId) {
            const editingRecord = records.find(r => r.id === editingId);
            if (editingRecord?.manager_id) {
                const exists = available.find(m => m.id === editingRecord.manager_id);
                if (!exists) {
                    const mgr = managersList.find(m => m.id === editingRecord.manager_id);
                    if (mgr) available = [mgr, ...available];
                }
            }
        }

        return available;
    }, [managersList, records, isEditing, editingId]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg transition shrink-0">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight break-words">Müdür Yönetimi</h1>
                                <p className="text-sm sm:text-base text-gray-600 mt-1">Müdür kayıtlarını görüntüle ve yönet</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3 w-full lg:w-auto">
                            <button
                                onClick={() => navigate('/manager-records')}
                                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg transition shadow-md hover:shadow-lg text-sm sm:text-base"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                Kayıt Filtrele
                            </button>
                            <button onClick={openModalForNew} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg transition shadow-md hover:shadow-lg text-sm sm:text-base">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Yeni Müdür
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats: Toplam, İçeride, Çıkış Yapan */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-purple-600 text-sm font-medium">Toplam Müdür Sayısı</p>
                                <p className="text-3xl font-bold text-purple-900">{stats.totalManagers}</p>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-lg">
                                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-green-600 text-sm font-medium">Aktif İçerideki Müdür Sayısı</p>
                                <p className="text-3xl font-bold text-green-900">{stats.insideCount}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-lg">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-red-600 text-sm font-medium">Bugün Çıkış Yapan Müdür Sayısı</p>
                                <p className="text-3xl font-bold text-red-900">{stats.todayExitCount}</p>
                            </div>
                            <div className="p-3 bg-red-100 rounded-lg">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-auto">
                    {/* Filter buttons - always visible when not loading */}
                    <div className="mb-4">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <button
                                onClick={() => setFilterMode('all')}
                                className={`px-3 sm:px-4 py-2 rounded-lg text-sm ${filterMode === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                            >
                                Bugünün Kayıtları ({stats.todayCount})
                            </button>

                            <button
                                onClick={() => setFilterMode('inside')}
                                className={`px-3 sm:px-4 py-2 rounded-lg text-sm ${filterMode === 'inside' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                            >
                                Aktif İçeridekiler ({stats.insideCount})
                            </button>

                            <button
                                onClick={() => setFilterMode('exited')}
                                className={`px-3 sm:px-4 py-2 rounded-lg text-sm ${filterMode === 'exited' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                            >
                                Bugün Çıkış Yapanlar ({stats.todayExitCount})
                            </button>


                        </div>
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500">Kayıt bulunmuyor</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="max-h-[600px] overflow-y-auto">
                                <table className="min-w-full table-auto divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İsim Soyisim</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Yapan</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Yapan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredRecords.map(rec => (
                                            <tr key={rec.id} className={`hover:bg-gray-50 ${rec.deleted_at ? 'opacity-60' : ''}`}>
                                                {/* İşlem */}
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <div className="flex items-center gap-3">
                                                        <ActionButton
                                                            onClick={() => openModalForEdit(rec)}
                                                            variant="primary"
                                                            disabled={Boolean(rec.deleted_at)}
                                                        >
                                                            Düzenle
                                                        </ActionButton>
                                                        {rec.status === 'inside' && !rec.deleted_at && (
                                                            <ActionButton
                                                                onClick={() => handleExit(rec.id)}
                                                                variant="success"
                                                            >
                                                                Çıkış Yap
                                                            </ActionButton>
                                                        )}
                                                        {rec.deleted_at ? (
                                                            <ActionButton onClick={() => handleRestore(rec.id)} variant="success">Geri Al</ActionButton>
                                                        ) : (
                                                            <ActionButton onClick={() => handleDelete(rec.id)} variant="danger">Sil</ActionButton>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* İsim Soyisim */}
                                                <td className="px-6 py-4 align-top">
                                                    <div className="text-sm font-bold text-gray-900">{rec.manager || '-'}</div>
                                                    <div className="text-xs text-gray-600 mt-1">{rec.manager_title || '-'}</div>
                                                </td>

                                                {/* Giriş Tarihi */}
                                                <td className="px-6 py-4 align-top">
                                                    <div className="text-sm text-gray-900">{formatDate(rec.entry_date)}</div>
                                                    <div className="text-xs text-gray-600 mt-1">{formatTime(rec.entry_time)}</div>
                                                </td>

                                                {/* Çıkış Tarihi */}
                                                <td className="px-6 py-4 align-top">
                                                    {rec.exit_date ? (
                                                        <>
                                                            <div className="text-sm text-gray-900">{formatDate(rec.exit_date)}</div>
                                                            <div className="text-xs text-gray-600 mt-1">{formatTime(rec.exit_time)}</div>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>

                                                {/* Giriş Yapan */}
                                                <td className="px-6 py-4 align-top">
                                                    <div className="text-sm text-gray-900">{rec.entry_by || '-'}</div>
                                                </td>

                                                {/* Çıkış Yapan */}
                                                <td className="px-6 py-4 align-top">
                                                    <div className="text-sm text-gray-900">{rec.exit_by || '-'}</div>
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

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">{isEditing ? 'Müdür Düzenle' : 'Yeni Müdür'}</h2>
                                <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Personel Seç</label>
                                    <select required value={selectedManagerId || ''} onChange={(e) => {
                                        const id = e.target.value || null;
                                        setSelectedManagerId(id);
                                    }} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                                        <option value="">-- Lütfen bir müdür seçin --</option>
                                        {selectManagers.map(p => (
                                            <option key={p.id} value={p.id}>{p.first_name ? `${p.first_name} ${p.last_name} - ${p.title}` : p.full_name}</option>
                                        ))}
                                    </select>

                                    {selectedManagerId && (() => {
                                        const p = managersList.find(x => x.id === selectedManagerId);
                                        if (!p) return null;
                                        const name = p.first_name ? `${p.first_name} ${p.last_name}` : p.full_name;
                                        const title = p.title || p.department || '';
                                        return (
                                            <div className="mt-4 p-3 border border-gray-100 rounded bg-gray-50">
                                                <div className="text-sm font-medium text-gray-900">{name}</div>
                                                <div className="text-xs text-gray-600">{title || '-'} • {p.phone || '-'} • {p.email || '-'}</div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Entry Time */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Giriş Saati (isteğe bağlı)
                                    </label>
                                    <input
                                        type="time"
                                        value={entryTime}
                                        onChange={(e) => setEntryTime(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Boş bırakırsanız anlık saat kaydedilir</p>
                                </div>

                                {/* Exit Time - only show when editing exited records */}
                                {isEditing && records.find(r => r.id === editingId)?.status === 'exited' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Çıkış Saati (isteğe bağlı)
                                        </label>
                                        <input
                                            type="time"
                                            value={exitTime}
                                            onChange={(e) => setExitTime(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">Çıkış saatini düzenleyebilirsiniz</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama (isteğe bağlı)</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={3}
                                        placeholder="Not veya açıklama (zorunlu değil)"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg font-medium transition">{isEditing ? 'Güncelle' : 'Kaydet'}</button>
                                    <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition">İptal</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
