import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate, formatTime } from '../utils/dateUtils';
import dayjs from '../utils/dayjsConfig';
import { isValidLength } from '../utils/validation';
import type { ManagerRecord, Manager, ManagerFilterType } from '../types';
import ActionButton from '../components/ActionButton';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import { message, Modal } from 'antd';
import 'antd/dist/reset.css';

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
    primary: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30',
    danger: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30',
    neutral: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700/50'
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
    const [entryDate, setEntryDate] = useState('');
    const [exitDate, setExitDate] = useState('');
    const [entryTime, setEntryTime] = useState('');
    const [exitTime, setExitTime] = useState('');
    const [textPreview, setTextPreview] = useState<{ title: string; value: string } | null>(null);
    const [filterMode, setFilterMode] = useState<ManagerFilterType>('all');
    const [scrollbarSpacerWidth, setScrollbarSpacerWidth] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();
    const isAdminPage = location.pathname.startsWith('/admin');
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);

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

    const refreshManagersRealtime = useCallback(async () => {
        await Promise.all([fetchData(), fetchManagers()]);
    }, [fetchData, fetchManagers]);

    useRealtimeRefetch({
        topics: ['managers'],
        onMutation: refreshManagersRealtime,
        enabled: true,
    });

    // Reset form to initial state
    const resetForm = useCallback(() => {
        setIsEditing(false);
        setEditingId(null);
        setSelectedManagerId(null);
        setNotes('');
        setEntryDate('');
        setExitDate('');
        setEntryTime('');
        setExitTime('');
    }, []);

    // Open modal for new record
    const openModalForNew = useCallback(() => {
        resetForm();
        if (isAdminPage) {
            setEntryDate(dayjs().format('YYYY-MM-DD'));
        }
        setShowModal(true);
    }, [resetForm, isAdminPage]);

    // Open modal for editing
    const openModalForEdit = useCallback((rec: ManagerRecord) => {
        const found = managersList.find(p => {
            const name = p.first_name ? `${p.first_name} ${p.last_name}` : p.full_name;
            return name === (rec.manager || '');
        });
        setSelectedManagerId(found ? found.id : null);
        setNotes(rec.notes || '');
        setEntryDate(rec.entry_date ? dayjs(rec.entry_date).format('YYYY-MM-DD') : '');
        setExitDate(rec.exit_date ? dayjs(rec.exit_date).format('YYYY-MM-DD') : '');
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
            message.warning('Lütfen listeden bir müdür seçin.');
            return;
        }

        // Frontend validasyon
        if (!isValidLength(notes, 0, 1000)) {
            message.error('Açıklama en fazla 1000 karakter olabilir');
            return;
        }

        if (isAdminPage && !isEditing && entryDate && exitDate && exitDate < entryDate) {
            message.error('Çıkış tarihi giriş tarihinden önce olamaz');
            return;
        }

        try {
            const payload = {
                manager_id: selectedManagerId,
                notes: notes?.trim() || null,
                entry_date: isAdminPage && !isEditing ? (entryDate || null) : null,
                exit_date: isAdminPage && !isEditing ? (exitDate || null) : null,
                entry_time: entryTime || null,
                exit_time: exitTime || null
            };

            if (isEditing && editingId) {
                await api.put(`/managers/records/${editingId}`, payload);
                message.success('Müdür kaydı güncellendi');
            } else {
                await api.post('/managers/records', payload);
                message.success('Müdür giriş kaydı oluşturuldu');
            }

            setShowModal(false);
            resetForm();
            fetchData();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            message.error(err?.response?.data?.message || 'İşlem başarısız');
        }
    }, [selectedManagerId, notes, entryDate, exitDate, entryTime, exitTime, isAdminPage, isEditing, editingId, resetForm, fetchData]);

    // Handle manager exit
    const handleExit = useCallback(async (id: string) => {
        Modal.confirm({
            title: 'Çıkış Kaydı',
            content: 'Seçili müdür için çıkış kaydı oluşturulsun mu?',
            okText: 'Evet',
            cancelText: 'Hayır',
            onOk: async () => {
                try {
                    await api.post(`/managers/records/${id}/exit`, { exit_time: null });
                    fetchData();
                    message.success('Çıkış kaydedildi');
                } catch (error) {
                    const err = error as { response?: { data?: { message?: string } } };
                    message.error(err?.response?.data?.message || 'Çıkış işlemi başarısız');
                }
            }
        });
    }, [fetchData]);

    const handleDelete = useCallback(async (id: string) => {
        Modal.confirm({
            title: 'Kaydı Sil',
            content: 'Bu kaydı silmek istediğinize emin misiniz?',
            okText: 'Evet',
            cancelText: 'Hayır',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await api.delete(`/managers/records/${id}`);
                    fetchData();
                    message.success('Kayıt silindi');
                } catch (error) {
                    const err = error as { response?: { data?: { message?: string } } };
                    message.error(err?.response?.data?.message || 'Silme işlemi başarısız');
                }
            }
        });
    }, [fetchData]);

    const handleRestore = useCallback(async (id: string) => {
        try {
            await api.post(`/managers/records/${id}/restore`);
            fetchData();
            message.success('Kayıt geri alındı');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            message.error(err?.response?.data?.message || 'Geri alma işlemi başarısız');
        }
    }, [fetchData]);

    const nonDeletedRecords = useMemo(() => records.filter(r => !r.deleted_at), [records]);

    // Memoized statistics
    const stats = useMemo(() => {
        const today = dayjs().format('YYYY-MM-DD');
        const todayRecords = nonDeletedRecords.filter(r => {
            const entryDate = r.entry_date ? dayjs(r.entry_date).format('YYYY-MM-DD') : null;
            const exitDate = r.exit_date ? dayjs(r.exit_date).format('YYYY-MM-DD') : null;
            return entryDate === today || exitDate === today;
        });
        return {
            totalManagers: managersList.length,
            insideCount: nonDeletedRecords.filter(r => r.status === 'inside').length,
            todayCount: todayRecords.length,
        };
    }, [nonDeletedRecords, managersList]);

    // Memoized filtered records
    const todayDeletedRecords = useMemo(() => {
        const today = dayjs().format('YYYY-MM-DD');
        return records.filter(r => {
            if (!r.deleted_at) return false;
            const deletedDate = dayjs(r.deleted_at).format('YYYY-MM-DD');
            return deletedDate === today;
        });
    }, [records]);

    const filteredRecords = useMemo(() => {
        const today = dayjs().format('YYYY-MM-DD');
        if (filterMode === 'deleted') {
            return todayDeletedRecords;
        }

        return nonDeletedRecords.filter(r => {
            if (filterMode === 'all') {
                // Bugünün kayıtları: bugün giriş yapan veya bugün çıkış yapan
                const entryDate = r.entry_date ? dayjs(r.entry_date).format('YYYY-MM-DD') : null;
                const exitDate = r.exit_date ? dayjs(r.exit_date).format('YYYY-MM-DD') : null;
                return entryDate === today || exitDate === today;
            }
            if (filterMode === 'inside') return r.status === 'inside'; // Aktif içeridekiler
            return true;
        });
    }, [nonDeletedRecords, filterMode, todayDeletedRecords]);

    // Memoized available managers for select
    const selectManagers = useMemo(() => {
        const insideManagerIds = new Set(
            records
                .filter(r => {
                    if (!r.manager_id) return false;
                    if (r.deleted_at) return false;
                    if (r.status !== 'inside') return false;
                    if (r.exit_date) return false;
                    return true;
                })
                .map(r => r.manager_id)
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

    const renderPreviewText = (value: string | null | undefined, title: string) => {
        const text = (value || '-').toString();
        const isLong = text.length > 15;

        if (!isLong) {
            return <div className="text-xs text-gray-900 block max-w-[140px] truncate whitespace-nowrap overflow-hidden" title={text}>{text}</div>;
        }

        return (
            <button
                type="button"
                onClick={() => setTextPreview({ title, value: text })}
                className="text-xs text-blue-700 hover:text-blue-900 underline text-left block max-w-[140px] truncate whitespace-nowrap overflow-hidden"
                title="Tamamını görmek için tıklayın"
            >
                {text}
            </button>
        );
    };


    useEffect(() => {
        const updateScrollbarWidth = () => {
            const tableScrollWidth = tableScrollRef.current?.scrollWidth ?? 0;
            const tableClientWidth = tableScrollRef.current?.clientWidth ?? 0;
            const barClientWidth = bottomScrollRef.current?.clientWidth ?? 0;
            const normalizedWidth = Math.max(tableScrollWidth - tableClientWidth + barClientWidth, barClientWidth + 1);
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

    const isScrollingTable = useRef(false);
    const isScrollingBar = useRef(false);

    const syncTableScroll = () => {
        if (isScrollingBar.current) return;
        const tableNode = tableScrollRef.current;
        const barNode = bottomScrollRef.current;
        if (!tableNode || !barNode) return;

        isScrollingTable.current = true;
        barNode.scrollLeft = tableNode.scrollLeft;
        requestAnimationFrame(() => {
            isScrollingTable.current = false;
        });
    };

    const syncBottomScroll = () => {
        if (isScrollingTable.current) return;
        const tableNode = tableScrollRef.current;
        const barNode = bottomScrollRef.current;
        if (!tableNode || !barNode) return;

        isScrollingBar.current = true;
        tableNode.scrollLeft = barNode.scrollLeft;
        requestAnimationFrame(() => {
            isScrollingBar.current = false;
        });
    };


    const dashboardCardBase = 'rounded-xl shadow-sm p-3 min-h-[92px] border';
    const dashboardIconBase = 'p-2 bg-white/20 rounded-lg border shrink-0 text-white';
    const dashboardLabelBase = 'text-[11px] font-medium text-white/90 uppercase tracking-wider leading-none';
    const dashboardValueBase = 'text-xl font-bold text-white leading-none mt-1';

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button onClick={() => navigate(isAdminPage ? '/admin/dashboard' : '/dashboard')} className="p-2 hover:bg-slate-800 rounded-lg transition shrink-0">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Otel Müdür Kayıt Sayfası</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Otel müdür kayıtlarını yönetin.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-3 w-full lg:w-auto">
                            <button
                                onClick={() => navigate(isAdminPage ? '/admin/manager-records' : '/manager-records')}
                                className="flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-3 sm:px-5 py-2.5 sm:py-3 rounded-lg transition shadow-md hover:shadow-lg text-sm sm:text-base"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                Kayıt Filtrele
                            </button>
                            <button onClick={openModalForNew} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg transition shadow-md hover:shadow-lg text-sm sm:text-base">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                {isAdminPage ? 'Müdür Giriş Kaydı' : 'Müdür Kaydı Aç'}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 pb-14 flex flex-col gap-4 overflow-hidden">
                <div className="w-full">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                        <div className={`${dashboardCardBase} border-blue-500 bg-gradient-to-br from-blue-500 to-blue-700`}>
                            <div className="flex items-center gap-3 min-h-[48px]">
                                <div className={`${dashboardIconBase} border-blue-300/60`}>
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div className="min-w-0 flex-1 text-center">
                                    <p className={dashboardLabelBase}>Toplam Müdür Sayısı</p>
                                    <p className={dashboardValueBase}>{stats.totalManagers}</p>
                                </div>
                            </div>
                        </div>

                        <div className={`${dashboardCardBase} border-emerald-500 bg-gradient-to-br from-emerald-500 to-emerald-700`}>
                            <div className="flex items-center gap-3 min-h-[48px]">
                                <div className={`${dashboardIconBase} border-emerald-300/60`}>
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7" />
                                    </svg>
                                </div>
                                <div className="min-w-0 flex-1 text-center">
                                    <p className={dashboardLabelBase}>Aktif İçerideki Müdür</p>
                                    <p className={dashboardValueBase}>{stats.insideCount}</p>
                                </div>
                            </div>
                        </div>

                    </div>

                    <div className="bg-white rounded-lg shadow px-3 py-2 mb-3 w-full">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <button
                                onClick={() => setFilterMode('all')}
                                className={`px-3 sm:px-3.5 py-1.5 rounded-md transition text-sm ${filterMode === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                Bugünün Kayıtları ({stats.todayCount})
                            </button>

                            <button
                                onClick={() => setFilterMode('inside')}
                                className={`px-3 sm:px-3.5 py-1.5 rounded-md transition text-sm ${filterMode === 'inside' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                Aktif İçeridekiler ({stats.insideCount})
                            </button>

                            <button
                                onClick={() => setFilterMode('deleted')}
                                className={`px-3 sm:px-3.5 py-1.5 rounded-md transition text-sm ${filterMode === 'deleted' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                Silinen Kayıtlar ({todayDeletedRecords.length})
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-hidden flex-1 min-h-0">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : filteredRecords.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-gray-500">Kayıt bulunmuyor</p>
                            </div>
                        ) : (
                            <div ref={tableScrollRef} onScroll={syncTableScroll} className="h-full min-h-0 overflow-x-auto scrollbar-hide overflow-y-auto pb-2">
                                <div className="min-h-full">
                                    <table className="w-full min-w-[1100px] table-auto divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">İşlem</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Kapı</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">İsim Soyisim</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Giriş Tarihi</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Çıkış Tarihi</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Açıklama</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Giriş Yapan</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Çıkış Yapan</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {filteredRecords.map(rec => (
                                                <tr key={rec.id} className={`hover:bg-gray-50 ${rec.deleted_at ? 'opacity-60' : ''}`}>
                                                    {/* İşlem */}
                                                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                                                        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap">
                                                            {rec.status === 'inside' && !rec.deleted_at && (
                                                                <CompactActionButton
                                                                    onClick={() => handleExit(rec.id)}
                                                                    variant="success"
                                                                    label="Çıkış Yap"
                                                                    icon={
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                                        </svg>
                                                                    }
                                                                />
                                                            )}
                                                            {rec.deleted_at ? (
                                                                <CompactActionButton
                                                                    onClick={() => handleRestore(rec.id)}
                                                                    variant="success"
                                                                    label="Geri Al"
                                                                    icon={
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89" />
                                                                        </svg>
                                                                    }
                                                                />
                                                            ) : (
                                                                <CompactActionButton
                                                                    onClick={() => handleDelete(rec.id)}
                                                                    variant="danger"
                                                                    label="Sil"
                                                                    icon={
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                    }
                                                                />
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="px-3 py-2.5 whitespace-nowrap align-top">
                                                        <div className="text-xs text-gray-900">{rec.gate || '-'}</div>
                                                    </td>

                                                    {/* İsim Soyisim */}
                                                    <td className="px-3 py-2.5 align-top">
                                                        <div className="text-xs font-bold text-gray-900">{rec.manager || '-'}</div>
                                                        <div className="text-[10px] text-gray-500 mt-0.5">{rec.manager_title || '-'}</div>
                                                    </td>

                                                    {/* Giriş Tarihi */}
                                                    <td className="px-3 py-2.5 align-top">
                                                        <div className="text-xs text-gray-900">{formatDate(rec.entry_date)}</div>
                                                        <div className="text-[10px] text-gray-600 mt-0.5">{formatTime(rec.entry_time)}</div>
                                                    </td>

                                                    {/* Çıkış Tarihi */}
                                                    <td className="px-3 py-2.5 align-top">
                                                        {rec.exit_date ? (
                                                            <>
                                                                <div className="text-xs text-gray-900">{formatDate(rec.exit_date)}</div>
                                                                <div className="text-[10px] text-gray-600 mt-0.5">{formatTime(rec.exit_time)}</div>
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">-</span>
                                                        )}
                                                    </td>

                                                    {/* Açıklama */}
                                                    <td className="px-3 py-2.5 align-top">
                                                        {renderPreviewText(rec.notes, 'Açıklama')}
                                                    </td>

                                                    {/* Giriş Yapan */}
                                                    <td className="px-3 py-2.5 align-top">
                                                        <div className="text-xs text-gray-900">{rec.entry_by || '-'}</div>
                                                    </td>

                                                    {/* Çıkış Yapan */}
                                                    <td className="px-3 py-2.5 align-top">
                                                        <div className="text-xs text-gray-900">{rec.exit_by || '-'}</div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <div className="fixed bottom-0 left-0 right-0 lg:left-[var(--sidebar-width)] z-40 border-t border-gray-200 bg-white/95 backdrop-blur shadow-[0_-8px_20px_rgba(15,23,42,0.08)]">
                <div ref={bottomScrollRef} onScroll={syncBottomScroll} className="h-5 overflow-x-scroll overflow-y-hidden">
                    <div style={{ width: `${scrollbarSpacerWidth}px`, height: 1 }} />
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">{isEditing ? 'Müdür Düzenle' : (isAdminPage ? 'Müdür Giriş Kaydı' : 'Müdür Kaydı Aç')}</h2>
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
                                </div>

                                {/* Entry Time */}
                                {isAdminPage && !isEditing && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Giriş Tarihi
                                            </label>
                                            <input
                                                type="date"
                                                value={entryDate}
                                                onChange={(e) => setEntryDate(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Çıkış Tarihi (isteğe bağlı)
                                            </label>
                                            <input
                                                type="date"
                                                value={exitDate}
                                                onChange={(e) => setExitDate(e.target.value)}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>
                                )}

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
                                {(isAdminPage || (isEditing && records.find(r => r.id === editingId)?.status === 'exited')) && (
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

            {textPreview && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900">{textPreview.title}</h3>
                            <button
                                type="button"
                                onClick={() => setTextPreview(null)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                Kapat
                            </button>
                        </div>
                        <div className="px-4 py-4">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{textPreview.value}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
