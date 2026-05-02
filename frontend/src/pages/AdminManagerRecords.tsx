import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from '../utils/dayjsConfig';
import 'antd/dist/reset.css';
import axios from 'axios';
import { formatDate, formatTime } from '../utils/dateUtils';
import type { ManagerRecord } from '../types';
import { API_URL } from '../constants';
import ActionButton from '../components/ActionButton';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';

const { RangePicker } = DatePicker;

const normalizeSearchText = (value: string | null | undefined): string => {
    return (value || '').toLocaleLowerCase('tr-TR').normalize('NFC');
};

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
    const [editEntryDate, setEditEntryDate] = useState('');
    const [editExitDate, setEditExitDate] = useState('');
    const [editEntryTime, setEditEntryTime] = useState('');
    const [editExitTime, setEditExitTime] = useState('');
    const [editNotes, setEditNotes] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const navigate = useNavigate();
    const [scrollbarSpacerWidth, setScrollbarSpacerWidth] = useState(0);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async () => {
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
    }, []);

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

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    useRealtimeRefetch({
        topics: ['managers'],
        onMutation: fetchData,
        enabled: true,
    });

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            // Manager name filter
            if (
                filters.manager_name
                && !normalizeSearchText(record.manager).includes(normalizeSearchText(filters.manager_name))
            ) {
                return false;
            }

            // Entry by filter
            if (
                filters.entry_by
                && !normalizeSearchText(record.entry_by).includes(normalizeSearchText(filters.entry_by))
            ) {
                return false;
            }

            // Exit by filter
            if (
                filters.exit_by
                && !normalizeSearchText(record.exit_by).includes(normalizeSearchText(filters.exit_by))
            ) {
                return false;
            }

            // Status filter
            if (filters.status === 'deleted' && !record.deleted_at) {
                return false;
            }
            if (filters.status === 'inside' && (record.deleted_at || record.status !== 'inside')) {
                return false;
            }
            if (filters.status === 'exited' && (record.deleted_at || record.status !== 'exited')) {
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

    // Group by day for both default and filtered views (newest day first)
    const groupedByDay = useMemo(() => {
        const dayGroups = new Map<string, ManagerRecord[]>();

        filteredRecords.forEach((record) => {
            const dayKey = dayjs(record.entry_date).format('YYYY-MM-DD');
            if (!dayGroups.has(dayKey)) {
                dayGroups.set(dayKey, []);
            }
            dayGroups.get(dayKey)!.push(record);
        });

        return Array.from(dayGroups.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([dayKey, items]) => ({
                dayKey,
                dayLabel: dayjs(dayKey).format('DD MMMM YYYY dddd'),
                records: [...items].sort((a, b) => {
                    const dateCompare = (a.entry_date || '').localeCompare(b.entry_date || '');
                    if (dateCompare !== 0) return dateCompare;
                    return (a.entry_time || '').localeCompare(b.entry_time || '');
                })
            }));
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
        setEditEntryDate(record.entry_date ? dayjs(record.entry_date).format('YYYY-MM-DD') : '');
        setEditExitDate(record.exit_date ? dayjs(record.exit_date).format('YYYY-MM-DD') : '');
        setEditEntryTime(record.entry_time ? formatTime(record.entry_time) : '');
        setEditExitTime(record.exit_time ? formatTime(record.exit_time) : '');
        setEditNotes(record.notes || '');
        setShowEditModal(true);
    };

    const closeEditModal = () => {
        setShowEditModal(false);
        setEditingRecord(null);
        setEditEntryDate('');
        setEditExitDate('');
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
                entry_date: editEntryDate || null,
                exit_date: editExitDate || null,
                entry_time: editEntryTime || null,
                exit_time: editExitTime || null,
                notes: editNotes.trim() || null
            };

            await axios.put(`${API_URL}/managers/records/${editingRecord.id}`, payload, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });

            const refreshConfig = {
                headers: { Authorization: `Bearer ${adminToken}` }
            };
            const refreshed = await axios.get(`${API_URL}/managers/records?includeDeleted=true`, refreshConfig);
            setRecords(refreshed.data || []);

            closeEditModal();
        } catch (error: any) {
            console.error('Kayıt güncellenemedi:', error);
            const message = error.response?.data?.message || 'Kayıt güncellenirken bir hata oluştu';
            alert(message);
        } finally {
            setSavingEdit(false);
        }
    };

    useEffect(() => {
        const updateScrollbarWidth = () => {
            const tableScrollWidth = tableScrollRef.current?.scrollWidth ?? 0;
            const tableClientWidth = tableScrollRef.current?.clientWidth ?? 0;
            const barClientWidth = bottomScrollRef.current?.clientWidth ?? 0;
            const normalizedWidth = Math.max(
                tableScrollWidth - tableClientWidth + barClientWidth,
                barClientWidth + 1
            );
            setScrollbarSpacerWidth(normalizedWidth);
        };

        updateScrollbarWidth();

        const resizeObserver = new ResizeObserver(updateScrollbarWidth);
        if (tableScrollRef.current) resizeObserver.observe(tableScrollRef.current);
        if (bottomScrollRef.current) resizeObserver.observe(bottomScrollRef.current);
        window.addEventListener('resize', updateScrollbarWidth);

        return () => {
            window.removeEventListener('resize', updateScrollbarWidth);
            resizeObserver.disconnect();
        };
    }, [filteredRecords.length, loading]);

    const syncBottomScroll = () => {
        const tableNode = tableScrollRef.current;
        const barNode = bottomScrollRef.current;

        if (!tableNode || !barNode) return;
        tableNode.scrollLeft = barNode.scrollLeft;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
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
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Müdür Kayıtları</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Tüm geçmiş kayıtları görüntüleyin ve filtreleyin</p>
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

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 pb-14 flex flex-col gap-4 overflow-hidden">
                {/* Filter Panel */}
                <div className="bg-white rounded-lg shadow px-3 py-2 mb-3 w-full">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-base font-bold text-gray-900">Filtreler</h2>
                        <button
                            onClick={clearFilters}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Temizle
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                        {/* Manager Name */}
                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Müdür Adı</label>
                            <input
                                type="text"
                                value={filters.manager_name}
                                onChange={(e) => setFilters({ ...filters, manager_name: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Entry By */}
                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Giriş Yapan</label>
                            <input
                                type="text"
                                value={filters.entry_by}
                                onChange={(e) => setFilters({ ...filters, entry_by: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Exit By */}
                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Çıkış Yapan</label>
                            <input
                                type="text"
                                value={filters.exit_by}
                                onChange={(e) => setFilters({ ...filters, exit_by: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        {/* Status */}
                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Durum</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="inside">İçeride</option>
                                <option value="exited">Çıkış Yapıldı</option>
                                <option value="deleted">Silinen Kayıtlar</option>
                            </select>
                        </div>

                        {/* Gate */}
                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Kapı</label>
                            <select
                                value={filters.gate}
                                onChange={(e) => setFilters({ ...filters, gate: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="Ana Kapı">Ana Kapı</option>
                                <option value="Sahil Kapı">Sahil Kapı</option>
                            </select>
                        </div>

                        {/* Entry Date Range */}
                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Giriş Tarihi</label>
                            <RangePicker
                                value={[
                                    filters.entryDateStart ? dayjs(filters.entryDateStart) : null,
                                    filters.entryDateEnd ? dayjs(filters.entryDateEnd) : null
                                ]}
                                onChange={(dates) => {
                                    if (!dates || (!dates[0] && !dates[1])) {
                                        setFilters({
                                            ...filters,
                                            entryDateStart: '',
                                            entryDateEnd: ''
                                        });
                                    } else if (dates[0] && dates[1]) {
                                        setFilters({
                                            ...filters,
                                            entryDateStart: dates[0].format('YYYY-MM-DD'),
                                            entryDateEnd: dates[1].format('YYYY-MM-DD')
                                        });
                                    } else if (dates[0] && !dates[1]) {
                                        const singleDate = dates[0].format('YYYY-MM-DD');
                                        setFilters({
                                            ...filters,
                                            entryDateStart: singleDate,
                                            entryDateEnd: singleDate
                                        });
                                    }
                                }}
                                allowEmpty={[false, true]}
                                format="DD/MM/YYYY"
                                placeholder={['Başlangıç', 'Bitiş']}
                                className="w-full"
                                size="small"
                                style={{ width: '100%' }}
                            />
                        </div>

                        {/* Exit Date Range */}
                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Çıkış Tarihi</label>
                            <RangePicker
                                value={[
                                    filters.exitDateStart ? dayjs(filters.exitDateStart) : null,
                                    filters.exitDateEnd ? dayjs(filters.exitDateEnd) : null
                                ]}
                                onChange={(dates) => {
                                    if (!dates || (!dates[0] && !dates[1])) {
                                        setFilters({
                                            ...filters,
                                            exitDateStart: '',
                                            exitDateEnd: ''
                                        });
                                    } else if (dates[0] && dates[1]) {
                                        setFilters({
                                            ...filters,
                                            exitDateStart: dates[0].format('YYYY-MM-DD'),
                                            exitDateEnd: dates[1].format('YYYY-MM-DD')
                                        });
                                    } else if (dates[0] && !dates[1]) {
                                        const singleDate = dates[0].format('YYYY-MM-DD');
                                        setFilters({
                                            ...filters,
                                            exitDateStart: singleDate,
                                            exitDateEnd: singleDate
                                        });
                                    }
                                }}
                                allowEmpty={[false, true]}
                                format="DD/MM/YYYY"
                                placeholder={['Başlangıç', 'Bitiş']}
                                className="w-full"
                                size="small"
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-hidden flex-1 min-h-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-gray-500">Filtrelere uygun kayıt bulunamadı</p>
                        </div>
                    ) : (
                        <div
                            ref={tableScrollRef}
                            className="h-full min-h-0 overflow-x-hidden overflow-y-auto pb-2"
                        >
                            {groupedByDay.map((dayGroup) => (
                                <div key={dayGroup.dayKey} className="mb-4 last:mb-0">
                                    <div className="sticky top-0 bg-gray-100 px-4 py-2 border-l-4 border-blue-500 z-10 shadow-sm">
                                        <h3 className="text-sm font-semibold text-gray-800">{dayGroup.dayLabel}</h3>
                                    </div>

                                    <table className="w-full min-w-[1210px] table-auto divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-10 z-10">
                                            <tr>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kapı</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İsim Soyisim</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Tarihi</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Tarihi</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Yapan</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Yapan</th>
                                                <th className="px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {dayGroup.records.map((record) => (
                                                <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="flex items-center gap-2 whitespace-nowrap">
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
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{record.gate || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm font-bold text-gray-900">{record.manager || '-'}</div>
                                                        {record.manager_title && <div className="text-xs text-gray-500">{record.manager_title}</div>}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{formatDate(record.entry_date)}</div>
                                                        <div className="text-xs text-gray-500">{formatTime(record.entry_time)}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {(record.exit_date || record.exit_time) ? (
                                                            <>
                                                                <div className="text-sm text-gray-900">{record.exit_date ? formatDate(record.exit_date) : '-'}</div>
                                                                <div className="text-xs text-gray-500">{formatTime(record.exit_time)}</div>
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{record.entry_by || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{record.exit_by || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className={`px-2 py-1 inline-flex whitespace-nowrap text-xs leading-5 font-semibold rounded-full ${record.status === 'inside' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
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
                    )}
                </div>
            </main>

            <div className="fixed bottom-0 left-0 right-0 lg:left-[var(--sidebar-width)] z-40 border-t border-gray-200 bg-white/95 backdrop-blur shadow-[0_-8px_20px_rgba(15,23,42,0.08)]">
                <div ref={bottomScrollRef} onScroll={syncBottomScroll} className="h-5 overflow-x-scroll overflow-y-hidden">
                    <div style={{ width: `${scrollbarSpacerWidth}px`, height: 1 }} />
                </div>
            </div>

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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Giriş Tarihi</label>
                                        <input
                                            type="date"
                                            value={editEntryDate}
                                            onChange={(e) => setEditEntryDate(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Çıkış Tarihi</label>
                                        <input
                                            type="date"
                                            value={editExitDate}
                                            onChange={(e) => setEditExitDate(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

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
