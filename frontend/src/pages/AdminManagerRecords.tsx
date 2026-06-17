import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker, message, Modal } from 'antd';
import dayjs from '../utils/dayjsConfig';
import 'antd/dist/reset.css';
import api from '../utils/api';
import { formatDate, formatTime } from '../utils/dateUtils';
import type { ManagerRecord } from '../types';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import { exportRecordsToExcelAndZip } from '../utils/exportHelper';

const { RangePicker } = DatePicker;

const normalizeSearchText = (value: string | null | undefined): string => {
    return (value || '').toLocaleLowerCase('tr-TR').normalize('NFC');
};

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

export default function AdminManagerRecords() {
    const [records, setRecords] = useState<ManagerRecord[]>([]);
    const [managersList, setManagersList] = useState<Array<{ id: string; full_name: string; first_name?: string; last_name?: string; title?: string; department?: string | null; phone?: string | null; email?: string | null }>>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 200;
    const [isExporting, setIsExporting] = useState(false);
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
    const [textPreview, setTextPreview] = useState<{ title: string; value: string } | null>(null);
    const navigate = useNavigate();
    const [scrollbarSpacerWidth, setScrollbarSpacerWidth] = useState(0);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);

    

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

    const fetchData = useCallback(async (offset = 0, append = false) => {
        try {
            const params = new URLSearchParams();
            params.append('includeDeleted', 'true');
            params.append('limit', String(PAGE_SIZE));
            params.append('offset', String(offset));

            if (filters.manager_name) params.append('manager_name', filters.manager_name);
            if (filters.entry_by) params.append('entry_by', filters.entry_by);
            if (filters.exit_by) params.append('exit_by', filters.exit_by);
            if (filters.status) params.append('status', filters.status);
            if (filters.gate) params.append('gate', filters.gate);
            if (filters.entryDateStart) params.append('entryDateStart', filters.entryDateStart);
            if (filters.entryDateEnd) params.append('entryDateEnd', filters.entryDateEnd);
            if (filters.exitDateStart) params.append('exitDateStart', filters.exitDateStart);
            if (filters.exitDateEnd) params.append('exitDateEnd', filters.exitDateEnd);

            const [recordsRes, managersRes] = await Promise.all([
                api.get(`/managers/records?${params.toString()}&_t=${Date.now()}`),
                managersList.length === 0 ? api.get('/vehicles/managers') : Promise.resolve(null)
            ]);

            const fetched: ManagerRecord[] = recordsRes.data || [];
            if (append) {
                setRecords(prev => [...prev, ...fetched]);
            } else {
                setRecords(fetched);
            }

            if (managersRes) setManagersList(managersRes.data || []);

            setHasMore(fetched.length === PAGE_SIZE);
        } catch (error) {
            message.error('Veriler yüklenemedi');
            console.error('Veriler yüklenemedi:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filters, managersList.length]);

    useEffect(() => {
        setLoading(true);
        void fetchData(0, false);
    }, [fetchData]);

    useRealtimeRefetch({
        topics: ['managers'],
        onMutation: () => void fetchData(0, false),
        enabled: true,
    });

    // Filtered records are handled on backend now
    const filteredRecords = records;

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

    const handleDownloadRecords = useCallback(async () => {
        if (isExporting) return;

        const entryRangeSelected = !!(filters.entryDateStart || filters.entryDateEnd);
        const exitRangeSelected = !!(filters.exitDateStart || filters.exitDateEnd);

        if (!entryRangeSelected && !exitRangeSelected) {
            message.warning('Lütfen giriş veya çıkış tarih aralığı seçin.');
            return;
        }

        let rangeStart: string | null = null;
        let rangeEnd: string | null = null;
        let filterBy: 'entry' | 'exit' = 'entry';

        if (entryRangeSelected) {
            filterBy = 'entry';
            rangeStart = filters.entryDateStart || filters.entryDateEnd || null;
            rangeEnd = filters.entryDateEnd || filters.entryDateStart || null;
        } else {
            filterBy = 'exit';
            rangeStart = filters.exitDateStart || filters.exitDateEnd || null;
            rangeEnd = filters.exitDateEnd || filters.exitDateStart || null;
        }

        if (!rangeStart || !rangeEnd) {
            message.warning('Lütfen geçerli bir tarih aralığı seçin.');
            return;
        }

        setIsExporting(true);

        try {
            const params = new URLSearchParams();
            params.append('includeDeleted', 'true');
            params.append('unlimited', 'true');

            if (filters.manager_name) params.append('manager_name', filters.manager_name);
            if (filters.entry_by) params.append('entry_by', filters.entry_by);
            if (filters.exit_by) params.append('exit_by', filters.exit_by);
            if (filters.status) params.append('status', filters.status);
            if (filters.gate) params.append('gate', filters.gate);
            if (filters.entryDateStart) params.append('entryDateStart', filters.entryDateStart);
            if (filters.entryDateEnd) params.append('entryDateEnd', filters.entryDateEnd);
            if (filters.exitDateStart) params.append('exitDateStart', filters.exitDateStart);
            if (filters.exitDateEnd) params.append('exitDateEnd', filters.exitDateEnd);

            const res = await api.get(`/managers/records?${params.toString()}`);
            const allRecords: ManagerRecord[] = res.data || [];

            const start = dayjs(rangeStart).startOf('day');
            const end = dayjs(rangeEnd).endOf('day');

            const exportableRecords = allRecords
                .filter((record) => {
                    const dateValue = filterBy === 'entry' ? record.entry_date : record.exit_date;
                    if (!dateValue) return false;
                    const d = dayjs(dateValue);
                    return d.isBetween(start, end, 'millisecond', '[]');
                })
                .filter(record => !record.deleted_at);

            if (exportableRecords.length === 0) {
                message.warning('Seçilen tarih aralığında indirilecek kayıt bulunamadı.');
                return;
            }

            const exportGroupsMap = new Map<string, ManagerRecord[]>();

            exportableRecords.forEach((record) => {
                const dayKey = dayjs(record.entry_date).format('YYYY-MM-DD');
                if (!exportGroupsMap.has(dayKey)) {
                    exportGroupsMap.set(dayKey, []);
                }
                exportGroupsMap.get(dayKey)!.push(record);
            });

            const exportGroups = Array.from(exportGroupsMap.entries())
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

            const headerRow = [
                'Müdür Adı',
                'Kapı',
                'Giriş Tarihi',
                'Giriş Saati',
                'Çıkış Tarihi',
                'Çıkış Saati',
                'Durum',
                'Giriş Yapan',
                'Çıkış Yapan',
                'Açıklama'
            ];

            const worksheetColumnWidths = [20, 14, 14, 12, 14, 12, 14, 14, 14, 32];

            await exportRecordsToExcelAndZip<ManagerRecord>({
                exportGroups,
                headerRow,
                columnWidths: worksheetColumnWidths,
                mapRecordToRow: (record) => [
                    record.manager || '-',
                    record.gate || '-',
                    record.entry_date ? formatDate(record.entry_date) : '-',
                    record.entry_time ? formatTime(record.entry_time) : '-',
                    record.exit_date ? formatDate(record.exit_date) : '-',
                    record.exit_time ? formatTime(record.exit_time) : '-',
                    record.status === 'inside' ? 'İçeride' : 'Çıkış Yapıldı',
                    record.entry_by || '-',
                    record.exit_by || '-',
                    record.notes || '-'
                ],
                sheetName: 'Müdür Kayıtları',
                filePrefix: 'Mudir_Kayitlari_',
                zipNamePrefix: 'Mudir_Kayitlari'
            });

            message.success('Kayıtlar başarıyla indirildi');
        } catch (error) {
            console.error('Export hatası:', error);
            message.error('Kayıtlar indirilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
        } finally {
            setIsExporting(false);
        }
    }, [filters, isExporting]);

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
        Modal.confirm({
            title: 'Kaydı Sil',
            content: 'Bu kaydı silmek istediğinize emin misiniz?',
            okText: 'Evet',
            cancelText: 'Hayır',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await api.delete(`/managers/records/${id}`);
                    setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: new Date().toISOString() } : record));
                    message.success('Kayıt silindi');
                } catch (error) {
                    console.error('Kayıt silinemedi:', error);
                    message.error('Kayıt silinirken bir hata oluştu');
                }
            }
        });
    };

    const handleRestoreRecord = async (id: string) => {
        Modal.confirm({
            title: 'Kaydı Geri Al',
            content: 'Bu kaydı geri almak istediğinize emin misiniz?',
            okText: 'Evet',
            cancelText: 'Hayır',
            onOk: async () => {
                try {
                    await api.post(`/managers/records/${id}/restore`, {});
                    setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: null } : record));
                    message.success('Kayıt geri alındı');
                } catch (error) {
                    console.error('Kayıt geri alınamadı:', error);
                    message.error('Kayıt geri alınırken bir hata oluştu');
                }
            }
        });
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
            message.warning('Lütfen listeden bir müdür seçin.');
            return;
        }

        if (createNotes.length > 1000) {
            message.warning('Açıklama en fazla 1000 karakter olabilir');
            return;
        }

        if (createEntryDate && createExitDate && createExitDate < createEntryDate) {
            message.warning('Çıkış tarihi giriş tarihinden önce olamaz');
            return;
        }

        try {
            setCreatingRecord(true);
            await api.post(`/managers/records`, {
                manager_id: selectedManagerId,
                entry_date: createEntryDate || null,
                exit_date: createExitDate || null,
                entry_time: createEntryTime || null,
                exit_time: createExitTime || null,
                notes: createNotes.trim() || null
            });

            void fetchData(0, false);
            closeCreateModal();
            message.success('Kayıt başarıyla oluşturuldu');
        } catch (error: any) {
            console.error('Kayıt oluşturulamadı:', error);
            const errMsg = error.response?.data?.message || 'Kayıt oluşturulurken bir hata oluştu';
            message.error(errMsg);
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
            message.warning('Açıklama en fazla 1000 karakter olabilir');
            return;
        }

        try {
            setSavingEdit(true);
            const payload = {
                entry_date: editEntryDate || null,
                exit_date: editExitDate || null,
                entry_time: editEntryTime || null,
                exit_time: editExitTime || null,
                notes: editNotes.trim() || null
            };

            await api.put(`/managers/records/${editingRecord.id}`, payload);

            void fetchData(0, false);
            closeEditModal();
            message.success('Kayıt başarıyla güncellendi');
        } catch (error: any) {
            console.error('Kayıt güncellenemedi:', error);
            const errMsg = error.response?.data?.message || 'Kayıt güncellenirken bir hata oluştu';
            message.error(errMsg);
        } finally {
            setSavingEdit(false);
        }
    };

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

    // Infinite scroll: load more when scrolling near bottom (container + window fallback)
    useEffect(() => {
        const node = tableScrollRef.current;
        if (!node) return;

        const onScroll = () => {
            if (loadingMore || !hasMore) return;
            const threshold = 300; // px from bottom to trigger
            const remaining = node.scrollHeight - node.clientHeight - node.scrollTop;
            if (remaining < threshold) {
                setLoadingMore(true);
                void fetchData(records.length, true);
            }
        };

        node.addEventListener('scroll', onScroll);

        const onWindowScroll = () => {
            if (loadingMore || !hasMore) return;
            const threshold = 400;
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const windowHeight = window.innerHeight || document.documentElement.clientHeight;
            const docHeight = document.documentElement.scrollHeight;
            const remaining = docHeight - windowHeight - scrollTop;
            if (remaining < threshold) {
                setLoadingMore(true);
                void fetchData(records.length, true);
            }
        };

        window.addEventListener('scroll', onWindowScroll);

        return () => {
            node.removeEventListener('scroll', onScroll);
            window.removeEventListener('scroll', onWindowScroll);
        };
    }, [fetchData, loadingMore, hasMore, records.length]);

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
                        <div className="flex w-full sm:w-auto gap-2 flex-col sm:flex-row">
                            <button
                                onClick={handleDownloadRecords}
                                disabled={isExporting || loading || filteredRecords.length === 0}
                                className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg transition shadow-md hover:shadow-lg text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isExporting ? (
                                    <>
                                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        İndiriliyor...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Kayıt İndir
                                    </>
                                )}
                            </button>
                            <button
                                onClick={openCreateModal}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Müdür Giriş Kaydı Oluştur
                            </button>
                            <button
                                onClick={() => navigate('/admin/manage-managers')}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
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

                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-visible flex-1 min-h-0">
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
                            onScroll={syncTableScroll}
                            className="h-full min-h-0 overflow-x-auto scrollbar-hide overflow-y-auto pb-2"
                        >
                            {groupedByDay.map((dayGroup) => (
                                <div key={dayGroup.dayKey} className="mb-4 last:mb-0">
                                    <div className="sticky top-0 bg-gray-100 px-4 py-2 border-l-4 border-blue-500 z-10 shadow-sm">
                                        <h3 className="text-sm font-semibold text-gray-800">{dayGroup.dayLabel}</h3>
                                    </div>

                                    <table className="w-full min-w-[1150px] table-auto divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-10 z-10">
                                            <tr>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Kapı</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">İsim Soyisim</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Giriş Tarihi</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Çıkış Tarihi</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Giriş Yapan</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Çıkış Yapan</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Açıklama</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {dayGroup.records.map((record) => (
                                                <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="flex items-center gap-2 whitespace-nowrap">
                                                            <CompactActionButton
                                                                onClick={() => openEditModal(record)}
                                                                variant="primary"
                                                                label="Düzenle"
                                                                disabled={Boolean(record.deleted_at)}
                                                                title={record.deleted_at ? 'Silinmiş kayıt düzenlenemez' : 'Düzenle'}
                                                                icon={
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                    </svg>
                                                                }
                                                            />
                                                            {record.deleted_at ? (
                                                                <CompactActionButton
                                                                    onClick={() => handleRestoreRecord(record.id)}
                                                                    variant="success"
                                                                    label="Geri Al"
                                                                    title="Geri Al"
                                                                    icon={
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89" />
                                                                        </svg>
                                                                    }
                                                                />
                                                            ) : (
                                                                <CompactActionButton
                                                                    onClick={() => handleDeleteRecord(record.id)}
                                                                    variant="danger"
                                                                    label="Sil"
                                                                    title="Sil"
                                                                    icon={
                                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                    }
                                                                />
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.gate || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs font-bold text-gray-900">{record.manager || '-'}</div>
                                                        {record.manager_title && <div className="text-[10px] text-gray-500">{record.manager_title}</div>}
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{formatDate(record.entry_date)}</div>
                                                        <div className="text-[10px] text-gray-500">{formatTime(record.entry_time)}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        {(record.exit_date || record.exit_time) ? (
                                                            <>
                                                                <div className="text-xs text-gray-900">{record.exit_date ? formatDate(record.exit_date) : '-'}</div>
                                                                <div className="text-[10px] text-gray-500">{formatTime(record.exit_time)}</div>
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.entry_by || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.exit_by || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        {renderPreviewText(record.notes, 'Açıklama')}
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <span className={`px-2 py-0.5 inline-flex whitespace-nowrap text-[10px] leading-5 font-semibold rounded-full ${record.status === 'inside' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
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
