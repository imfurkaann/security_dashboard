import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from '../utils/dayjsConfig';
import type { Dayjs } from 'dayjs';
import 'antd/dist/reset.css';
import axios from 'axios';
import { formatDate, formatTime } from '../utils/dateUtils';
import type { ManagerRecord } from '../types';
import { API_URL } from '../constants';
import ActionButton from '../components/ActionButton';

const { RangePicker } = DatePicker;

export default function AdminManagerRecords() {
    const [records, setRecords] = useState<ManagerRecord[]>([]);
    const [managersList, setManagersList] = useState<Array<{ id: string; full_name: string; first_name?: string; last_name?: string; title?: string; department?: string | null; phone?: string | null; email?: string | null }>>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedManagerId, setSelectedManagerId] = useState<string | null>(null);
    const [createEntryDate, setCreateEntryDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [createExitDate, setCreateExitDate] = useState('');
    const [createEntryTime, setCreateEntryTime] = useState('');
    const [createExitTime, setCreateExitTime] = useState('');
    const [createNotes, setCreateNotes] = useState('');
    const [creatingRecord, setCreatingRecord] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState<ManagerRecord | null>(null);
    const [editEntryTime, setEditEntryTime] = useState('');
    const [editExitTime, setEditExitTime] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const navigate = useNavigate();

    // Filter states
    const [filters, setFilters] = useState({
        manager_name: '',
        entry_by: '',
        exit_by: '',
        status: 'all',
        gate: 'all',
        entryDateStart: '',
        entryDateEnd: '',
        exitDateStart: '',
        exitDateEnd: ''
    });

    // Fetch all records with admin authentication
    useEffect(() => {
        const fetchData = async () => {
            try {
                const adminToken = localStorage.getItem('adminToken');
                const config = {
                    headers: {
                        Authorization: `Bearer ${adminToken}`
                    }
                };
                const [recordsRes, managersRes] = await Promise.all([
                    axios.get(`${API_URL}/managers/records?includeDeleted=true`, config),
                    axios.get(`${API_URL}/vehicles/managers`, config)
                ]);
                setRecords(recordsRes.data || []);
                setManagersList(managersRes.data || []);
            } catch (error) {
                console.error('Veriler yüklenemedi:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            // Manager name filter
            if (filters.manager_name && (!record.manager || !record.manager.toLowerCase().includes(filters.manager_name.toLowerCase()))) {
                return false;
            }

            // Entry by filter
            if (filters.entry_by && (!record.entry_by || !record.entry_by.toLowerCase().includes(filters.entry_by.toLowerCase()))) {
                return false;
            }

            // Exit by filter
            if (filters.exit_by && (!record.exit_by || !record.exit_by.toLowerCase().includes(filters.exit_by.toLowerCase()))) {
                return false;
            }

            // Status filter
            if (filters.status !== 'all' && record.status !== filters.status) {
                return false;
            }

            // Gate filter
            if (filters.gate !== 'all' && (record.gate || '') !== filters.gate) {
                return false;
            }

            // Entry date range filter - dayjs ile yerel tarihe çevir
            const entryDateOnly = record.entry_date ? dayjs(record.entry_date).format('YYYY-MM-DD') : '';
            if (filters.entryDateStart && entryDateOnly) {
                if (entryDateOnly < filters.entryDateStart) {
                    return false;
                }
            }
            if (filters.entryDateEnd && entryDateOnly) {
                if (entryDateOnly > filters.entryDateEnd) {
                    return false;
                }
            }

            // Exit date range filter - dayjs ile yerel tarihe çevir
            const exitDateOnly = record.exit_date ? dayjs(record.exit_date).format('YYYY-MM-DD') : '';
            if (filters.exitDateStart && exitDateOnly) {
                if (exitDateOnly < filters.exitDateStart) {
                    return false;
                }
            }
            if (filters.exitDateEnd && exitDateOnly) {
                if (exitDateOnly > filters.exitDateEnd) {
                    return false;
                }
            }

            return true;
        });
    }, [records, filters]);

    // Check if any filter is active
    const hasActiveFilters = useMemo(() => {
        return filters.manager_name !== '' ||
            filters.entry_by !== '' ||
            filters.exit_by !== '' ||
            filters.status !== 'all' ||
            filters.gate !== 'all' ||
            filters.entryDateStart !== '' ||
            filters.entryDateEnd !== '' ||
            filters.exitDateStart !== '' ||
            filters.exitDateEnd !== '';
    }, [filters]);

    // Grouped records by month and day (when no filters active)
    const groupedRecords = useMemo(() => {
        if (hasActiveFilters) return [];

        // Group by YYYY-MM (month), then by YYYY-MM-DD (day)
        const monthGroups: Record<string, Record<string, ManagerRecord[]>> = {};

        filteredRecords.forEach(record => {
            if (!record.entry_date) return;

            const monthKey = record.entry_date.substring(0, 7); // YYYY-MM
            const dayKey = record.entry_date; // YYYY-MM-DD

            if (!monthGroups[monthKey]) {
                monthGroups[monthKey] = {};
            }
            if (!monthGroups[monthKey][dayKey]) {
                monthGroups[monthKey][dayKey] = [];
            }
            monthGroups[monthKey][dayKey].push(record);
        });

        // Sort months in descending order (newest first)
        const sortedMonths = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a));

        return sortedMonths.map(monthKey => {
            // Sort days within month in descending order (newest first)
            const sortedDays = Object.keys(monthGroups[monthKey]).sort((a, b) => b.localeCompare(a));

            const dayGroups = sortedDays.map(dayKey => ({
                dayKey,
                dayLabel: dayjs(dayKey).format('DD MMMM YYYY dddd'),
                records: monthGroups[monthKey][dayKey].sort((a, b) =>
                    // Sort records by time in ascending order (earliest first)
                    (a.entry_time || '').localeCompare(b.entry_time || '')
                )
            }));

            return {
                monthKey,
                monthLabel: dayjs(monthKey + '-01').format('MMMM YYYY'),
                dayGroups,
                totalRecords: sortedDays.reduce((sum, dayKey) => sum + monthGroups[monthKey][dayKey].length, 0)
            };
        });
    }, [filteredRecords, hasActiveFilters]);

    // Sorted records for filtered view (newest first)
    const sortedFilteredRecords = useMemo(() => {
        return [...filteredRecords].sort((a, b) => {
            // Sort by date (newest first), then by time
            const dateCompare = (b.entry_date || '').localeCompare(a.entry_date || '');
            if (dateCompare !== 0) return dateCompare;
            return (b.entry_time || '').localeCompare(a.entry_time || '');
        });
    }, [filteredRecords]);

    // Clear all filters
    const clearFilters = () => {
        setFilters({
            manager_name: '',
            entry_by: '',
            exit_by: '',
            status: 'all',
            gate: 'all',
            entryDateStart: '',
            entryDateEnd: '',
            exitDateStart: '',
            exitDateEnd: ''
        });
    };

    const handleDeleteRecord = async (id: string) => {
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

        try {
            const adminToken = localStorage.getItem('adminToken');
            await axios.delete(`${API_URL}/managers/records/${id}`, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: new Date().toISOString() } : record));
        } catch (error) {
            console.error('Kayıt silinemedi:', error);
            alert('Kayıt silinirken bir hata oluştu');
        }
    };

    const handleRestoreRecord = async (id: string) => {
        try {
            const adminToken = localStorage.getItem('adminToken');
            await axios.post(`${API_URL}/managers/records/${id}/restore`, {}, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: null } : record));
        } catch (error) {
            console.error('Kayıt geri alınamadı:', error);
            alert('Kayıt geri alınırken bir hata oluştu');
        }
    };

    const resetCreateForm = () => {
        setSelectedManagerId(null);
        setCreateEntryDate(dayjs().format('YYYY-MM-DD'));
        setCreateExitDate('');
        setCreateEntryTime('');
        setCreateExitTime('');
        setCreateNotes('');
        setCreatingRecord(false);
    };

    const openCreateModal = () => {
        resetCreateForm();
        setShowCreateModal(true);
    };

    const closeCreateModal = () => {
        setShowCreateModal(false);
        resetCreateForm();
    };

    const handleCreateRecord = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedManagerId) {
            alert('Lütfen listeden bir müdür seçin.');
            return;
        }

        if (createNotes.length > 1000) {
            alert('Açıklama en fazla 1000 karakter olabilir');
            return;
        }

        if (createEntryDate && createExitDate && createExitDate < createEntryDate) {
            alert('Çıkış tarihi giriş tarihinden önce olamaz');
            return;
        }

        try {
            setCreatingRecord(true);
            const adminToken = localStorage.getItem('adminToken');
            await axios.post(`${API_URL}/managers/records`, {
                manager_id: selectedManagerId,
                entry_date: createEntryDate || null,
                exit_date: createExitDate || null,
                entry_time: createEntryTime || null,
                exit_time: createExitTime || null,
                notes: createNotes.trim() || null
            }, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });

            const refreshConfig = {
                headers: { Authorization: `Bearer ${adminToken}` }
            };
            const res = await axios.get(`${API_URL}/managers/records?includeDeleted=true`, refreshConfig);
            setRecords(res.data || []);
            closeCreateModal();
        } catch (error: any) {
            console.error('Kayıt oluşturulamadı:', error);
            const message = error.response?.data?.message || 'Kayıt oluşturulurken bir hata oluştu';
            alert(message);
        } finally {
            setCreatingRecord(false);
        }
    };

    const availableManagers = useMemo(() => {
        const insideManagerIds = new Set(
            records
                .filter(r => r.status === 'inside' && !r.deleted_at && r.manager_id)
                .map(r => r.manager_id as string)
        );

        return managersList.filter(m => !insideManagerIds.has(m.id));
    }, [managersList, records]);

    const openEditModal = (record: ManagerRecord) => {
        setEditingRecord(record);
        setEditEntryTime(record.entry_time ? formatTime(record.entry_time) : '');
        setEditExitTime(record.exit_time ? formatTime(record.exit_time) : '');
        setEditNotes(record.notes || '');
        setShowEditModal(true);
    };

    const closeEditModal = () => {
        setShowEditModal(false);
        setEditingRecord(null);
        setEditEntryTime('');
        setEditExitTime('');
        setEditNotes('');
        setSavingEdit(false);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingRecord) return;

        if (editNotes.length > 1000) {
            alert('Açıklama en fazla 1000 karakter olabilir');
            return;
        }

        try {
            setSavingEdit(true);
            const adminToken = localStorage.getItem('adminToken');
            const payload = {
                entry_time: editEntryTime || null,
                exit_time: editExitTime || null,
                notes: editNotes.trim() || null
            };

            await axios.put(`${API_URL}/managers/records/${editingRecord.id}`, payload, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });

            setRecords(prev => prev.map(record => {
                if (record.id !== editingRecord.id) return record;
                return {
                    ...record,
                    entry_time: payload.entry_time,
                    exit_time: payload.exit_time,
                    notes: payload.notes
                };
            }));

            closeEditModal();
        } catch (error: any) {
            console.error('Kayıt güncellenemedi:', error);
            const message = error.response?.data?.message || 'Kayıt güncellenirken bir hata oluştu';
            alert(message);
        } finally {
            setSavingEdit(false);
        }
    };

    // Handle date range change for entry dates
    const handleEntryDateChange = (dates: null | [Dayjs | null, Dayjs | null], dateStrings: [string, string]) => {
        if (!dates || (!dates[0] && !dates[1])) {
            // Takvim temizlendi
            setFilters({
                ...filters,
                entryDateStart: '',
                entryDateEnd: ''
            });
        } else if (dates[0] && dates[1]) {
            // İki tarih de seçildi
            setFilters({
                ...filters,
                entryDateStart: dates[0].format('YYYY-MM-DD'),
                entryDateEnd: dates[1].format('YYYY-MM-DD')
            });
        } else if (dates[0] && !dates[1]) {
            // Sadece başlangıç tarihi seçili - tek gün olarak kullan
            const singleDate = dates[0].format('YYYY-MM-DD');
            setFilters({
                ...filters,
                entryDateStart: singleDate,
                entryDateEnd: singleDate
            });
        }
    };

    // Handle date range change for exit dates
    const handleExitDateChange = (dates: null | [Dayjs | null, Dayjs | null], dateStrings: [string, string]) => {
        if (!dates || (!dates[0] && !dates[1])) {
            // Takvim temizlendi
            setFilters({
                ...filters,
                exitDateStart: '',
                exitDateEnd: ''
            });
        } else if (dates[0] && dates[1]) {
            // İki tarih de seçildi
            setFilters({
                ...filters,
                exitDateStart: dates[0].format('YYYY-MM-DD'),
                exitDateEnd: dates[1].format('YYYY-MM-DD')
            });
        } else if (dates[0] && !dates[1]) {
            // Sadece başlangıç tarihi seçili - tek gün olarak kullan
            const singleDate = dates[0].format('YYYY-MM-DD');
            setFilters({
                ...filters,
                exitDateStart: singleDate,
                exitDateEnd: singleDate
            });
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition shrink-0"
                                title="Geri Dön"
                            >
                                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight break-words">Müdür Kayıtlarını Filtrele</h1>
                                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                                    Toplam {records.length} kayıt, {filteredRecords.length} sonuç gösteriliyor
                                </p>
                            </div>
                        </div>
                        <div className="flex w-full sm:w-auto gap-2">
                            <button
                                onClick={openCreateModal}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base w-full sm:w-auto"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Müdür Giriş Kaydı Oluştur
                            </button>
                            <button
                                onClick={() => navigate('/admin/manage-managers')}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base w-full sm:w-auto"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Müdürleri Yönet
                            </button>
                        </div>
                    </div>
                </div>
            </header>


            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filter Panel */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Filtreler</h2>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                Filtreleri Temizle
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Manager Name */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Müdür Adı
                            </label>
                            <input
                                type="text"
                                value={filters.manager_name}
                                onChange={(e) => setFilters({ ...filters, manager_name: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        {/* Entry By */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Giriş Yapan
                            </label>
                            <input
                                type="text"
                                value={filters.entry_by}
                                onChange={(e) => setFilters({ ...filters, entry_by: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        {/* Exit By */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Çıkış Yapan
                            </label>
                            <input
                                type="text"
                                value={filters.exit_by}
                                onChange={(e) => setFilters({ ...filters, exit_by: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Durum
                            </label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="inside">İçeride</option>
                                <option value="exited">Çıkış Yapıldı</option>
                            </select>
                        </div>

                        {/* Gate */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Kapı
                            </label>
                            <select
                                value={filters.gate}
                                onChange={(e) => setFilters({ ...filters, gate: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="Ana Kapı">Ana Kapı</option>
                                <option value="Sahil Kapı">Sahil Kapı</option>
                            </select>
                        </div>

                        {/* Entry Date Range */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Giriş Tarihi
                            </label>
                            <RangePicker
                                value={[
                                    filters.entryDateStart ? dayjs(filters.entryDateStart) : null,
                                    filters.entryDateEnd ? dayjs(filters.entryDateEnd) : null
                                ]}
                                onChange={handleEntryDateChange}
                                allowEmpty={[false, true]}
                                format="DD/MM/YYYY"
                                placeholder={['Başlangıç', 'Bitiş']}
                                className="w-full text-sm"
                                style={{ height: '34px' }}
                            />
                        </div>

                        {/* Exit Date Range */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Çıkış Tarihi
                            </label>
                            <RangePicker
                                value={[
                                    filters.exitDateStart ? dayjs(filters.exitDateStart) : null,
                                    filters.exitDateEnd ? dayjs(filters.exitDateEnd) : null
                                ]}
                                onChange={handleExitDateChange}
                                allowEmpty={[false, true]}
                                format="DD/MM/YYYY"
                                placeholder={['Başlangıç', 'Bitiş']}
                                className="w-full text-sm"
                                style={{ height: '34px' }}
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-2 text-gray-600">Yükleniyor...</p>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-8 text-center">
                        <p className="text-gray-500">Kayıt bulunamadı</p>
                    </div>
                ) : hasActiveFilters ? (
                    /* Flat table view when filters are active */
                    <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
                        <div className="overflow-x-auto">
                            <div className="max-h-[600px] overflow-y-auto">
                                <table className="mobile-stack-table w-full 2xl:w-[1210px] 2xl:min-w-[1210px] table-auto 2xl:table-fixed divide-y divide-gray-200">
                                    <colgroup>
                                        <col style={{ width: '170px' }} />
                                        <col style={{ width: '120px' }} />
                                        <col style={{ width: '220px' }} />
                                        <col style={{ width: '150px' }} />
                                        <col style={{ width: '150px' }} />
                                        <col style={{ width: '140px' }} />
                                        <col style={{ width: '140px' }} />
                                        <col style={{ width: '120px' }} />
                                    </colgroup>
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kapı</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İsim Soyisim</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Yapan</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Yapan</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sortedFilteredRecords.map((record) => (
                                            <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <ActionButton
                                                            onClick={() => openEditModal(record)}
                                                            variant="primary"
                                                            disabled={Boolean(record.deleted_at)}
                                                            title="Düzenle"
                                                        >
                                                            Düzenle
                                                        </ActionButton>
                                                        {record.deleted_at ? (
                                                            <ActionButton onClick={() => handleRestoreRecord(record.id)} variant="success" title="Geri Al">Geri Al</ActionButton>
                                                        ) : (
                                                            <ActionButton onClick={() => handleDeleteRecord(record.id)} variant="danger" title="Sil">Sil</ActionButton>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.gate || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-indigo-100 rounded">
                                                            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-bold text-gray-900">{record.manager || '-'}</span>
                                                            {record.manager_title && (
                                                                <div className="text-xs text-gray-500">{record.manager_title}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-900">{formatDate(record.entry_date)}</div>
                                                    <div className="text-xs text-gray-500">{formatTime(record.entry_time)}</div>
                                                </td>

                                                <td className="px-6 py-4">
                                                    {record.exit_date ? (
                                                        <>
                                                            <div className="text-sm text-gray-900">{formatDate(record.exit_date)}</div>
                                                            <div className="text-xs text-gray-500">{formatTime(record.exit_time)}</div>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.entry_by || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.exit_by || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'inside' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                                        {record.status === 'inside' ? 'İçeride' : 'Çıkış Yapıldı'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Grouped view by month and day */
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="overflow-x-auto">
                            <div className="max-h-[600px] overflow-y-auto">
                                {groupedRecords.map((monthGroup) => (
                                    <div key={monthGroup.monthKey} className="mb-8 last:mb-0">
                                        {/* Month Header */}
                                        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-3 z-10 shadow-md">
                                            <h2 className="text-lg font-bold">{monthGroup.monthLabel}</h2>
                                            <p className="text-sm text-indigo-100">{monthGroup.totalRecords} kayıt</p>
                                        </div>

                                        {/* Day Groups */}
                                        {monthGroup.dayGroups.map((dayGroup) => (
                                            <div key={dayGroup.dayKey} className="border-b border-gray-200 last:border-b-0">
                                                {/* Day Header */}
                                                <div className="sticky top-14 bg-gray-100 px-6 py-2 border-l-4 border-blue-500 z-9 shadow-sm">

                                                    <h3 className="text-sm font-semibold text-gray-700">{dayGroup.dayLabel}</h3>
                                                    <p className="text-xs text-gray-500">{dayGroup.records.length} kayıt</p>
                                                </div>

                                                {/* Records Table */}
                                                <table className="mobile-stack-table w-full 2xl:w-[1210px] 2xl:min-w-[1210px] table-auto 2xl:table-fixed divide-y divide-gray-200">
                                                    <colgroup>
                                                        <col style={{ width: '170px' }} />
                                                        <col style={{ width: '120px' }} />
                                                        <col style={{ width: '220px' }} />
                                                        <col style={{ width: '150px' }} />
                                                        <col style={{ width: '150px' }} />
                                                        <col style={{ width: '140px' }} />
                                                        <col style={{ width: '140px' }} />
                                                        <col style={{ width: '120px' }} />
                                                    </colgroup>
                                                    <thead className="bg-gray-50 sticky top-14 z-10">
                                                        <tr>

                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kapı</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İsim Soyisim</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Tarihi</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Tarihi</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Yapan</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Yapan</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {dayGroup.records.map((record) => (
                                                            <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center gap-2">
                                                                        <ActionButton
                                                                            onClick={() => openEditModal(record)}
                                                                            variant="primary"
                                                                            disabled={Boolean(record.deleted_at)}
                                                                            title="Düzenle"
                                                                        >
                                                                            Düzenle
                                                                        </ActionButton>
                                                                        {record.deleted_at ? (
                                                                            <ActionButton onClick={() => handleRestoreRecord(record.id)} variant="success" title="Geri Al">Geri Al</ActionButton>
                                                                        ) : (
                                                                            <ActionButton onClick={() => handleDeleteRecord(record.id)} variant="danger" title="Sil">Sil</ActionButton>
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.gate || '-'}</div>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 bg-indigo-100 rounded">
                                                                            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                            </svg>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-sm font-bold text-gray-900">{record.manager || '-'}</span>
                                                                            {record.manager_title && (
                                                                                <div className="text-xs text-gray-500">{record.manager_title}</div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{formatDate(record.entry_date)}</div>
                                                                    <div className="text-xs text-gray-500">{formatTime(record.entry_time)}</div>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    {record.exit_date ? (
                                                                        <>
                                                                            <div className="text-sm text-gray-900">{formatDate(record.exit_date)}</div>
                                                                            <div className="text-xs text-gray-500">{formatTime(record.exit_time)}</div>
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-gray-400">-</span>
                                                                    )}
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.entry_by || '-'}</div>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.exit_by || '-'}</div>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'inside' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                                                        {record.status === 'inside' ? 'İçeride' : 'Çıkış Yapıldı'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {showEditModal && editingRecord && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-start justify-between mb-5">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Müdür Kaydı Düzenle</h2>
                                    <p className="text-sm text-gray-600 mt-1">{editingRecord.manager || '-'}</p>
                                </div>
                                <button
                                    onClick={closeEditModal}
                                    className="text-gray-400 hover:text-gray-600"
                                    title="Kapat"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSaveEdit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Giriş Saati</label>
                                    <input
                                        type="time"
                                        value={editEntryTime}
                                        onChange={(e) => setEditEntryTime(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Çıkış Saati</label>
                                    <input
                                        type="time"
                                        value={editExitTime}
                                        onChange={(e) => setEditExitTime(e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                                    <textarea
                                        value={editNotes}
                                        onChange={(e) => setEditNotes(e.target.value)}
                                        rows={4}
                                        maxLength={1000}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">{editNotes.length}/1000</p>
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <button
                                        type="submit"
                                        disabled={savingEdit}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-lg font-medium transition"
                                    >
                                        {savingEdit ? 'Kaydediliyor...' : 'Kaydet'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeEditModal}
                                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-medium transition"
                                    >
                                        İptal
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">Müdür Giriş Kaydı Oluştur</h2>
                                <button onClick={closeCreateModal} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleCreateRecord} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Personel Seç</label>
                                    <select
                                        required
                                        value={selectedManagerId || ''}
                                        onChange={(e) => setSelectedManagerId(e.target.value || null)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    >
                                        <option value="">-- Lütfen bir müdür seçin --</option>
                                        {availableManagers.map(p => (
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

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Giriş Tarihi</label>
                                        <input
                                            type="date"
                                            value={createEntryDate}
                                            onChange={(e) => setCreateEntryDate(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Çıkış Tarihi (isteğe bağlı)</label>
                                        <input
                                            type="date"
                                            value={createExitDate}
                                            onChange={(e) => setCreateExitDate(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Giriş Saati (isteğe bağlı)</label>
                                        <input
                                            type="time"
                                            value={createEntryTime}
                                            onChange={(e) => setCreateEntryTime(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Çıkış Saati (isteğe bağlı)</label>
                                        <input
                                            type="time"
                                            value={createExitTime}
                                            onChange={(e) => setCreateExitTime(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama (isteğe bağlı)</label>
                                    <textarea
                                        value={createNotes}
                                        onChange={(e) => setCreateNotes(e.target.value)}
                                        rows={3}
                                        maxLength={1000}
                                        placeholder="Not veya açıklama"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">{createNotes.length}/1000</p>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={creatingRecord}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-3 rounded-lg font-medium transition"
                                    >
                                        {creatingRecord ? 'Kaydediliyor...' : 'Kaydet'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={closeCreateModal}
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
