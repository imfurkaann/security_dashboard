import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker, message, Modal } from 'antd';
import dayjs from '../utils/dayjsConfig';
import 'antd/dist/reset.css';
import { formatDate, formatTime } from '../utils/dateUtils';
import api from '../utils/api';
import { exportRecordsToExcelAndZip } from '../utils/exportHelper';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import { isValidLength } from '../utils/validation';

const { RangePicker } = DatePicker;

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


interface FireAlarmRecord {
    id: string;
    alarm_number: string | null;
    location: string;
    gate?: string | null;
    alarm_time: string;
    resolved: boolean;
    resolution_time: string | null;
    resolution_notes: string | null;
    false_alarm: boolean;
    recorded_by_name: string;
    resolved_by_name: string | null;
    deleted_at?: string | null;
    created_at: string;
}

export default function AdminFireAlarmRecords() {
    const [records, setRecords] = useState<FireAlarmRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 200;
    const [isExporting, setIsExporting] = useState(false);
    const [textPreview, setTextPreview] = useState<{ title: string; value: string } | null>(null);
    const [scrollbarSpacerWidth, setScrollbarSpacerWidth] = useState(0);
    const latestFetchId = useRef(0);
    const navigate = useNavigate();
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);

    // Edit states
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editAlarmNumber, setEditAlarmNumber] = useState('');
    const [editLocation, setEditLocation] = useState('');
    const [editAlarmTime, setEditAlarmTime] = useState('');
    const [editResolutionTime, setEditResolutionTime] = useState('');
    const [editResolutionNotes, setEditResolutionNotes] = useState('');
    const [editFalseAlarm, setEditFalseAlarm] = useState(false);

    // Filter states
    const [alarmNumber, setAlarmNumber] = useState('');
    const [location, setLocation] = useState('');
    const [recordedBy, setRecordedBy] = useState('');
    const [resolvedBy, setResolvedBy] = useState('');
    const [status, setStatus] = useState('all');
    const [gateFilter, setGateFilter] = useState('all');
    const [falseAlarmFilter, setFalseAlarmFilter] = useState('all');
    const [alarmDateStart, setAlarmDateStart] = useState('');
    const [alarmDateEnd, setAlarmDateEnd] = useState('');
    const [resolutionDateStart, setResolutionDateStart] = useState('');
    const [resolutionDateEnd, setResolutionDateEnd] = useState('');

    const fetchData = useCallback(async (offset = 0, append = false) => {
        const fetchId = ++latestFetchId.current;
        try {
            const params = new URLSearchParams();
            params.append('includeDeleted', 'true');
            params.append('limit', String(PAGE_SIZE));
            params.append('offset', String(offset));

            if (alarmNumber) params.append('alarm_number', alarmNumber);
            if (location) params.append('location', location);
            if (recordedBy) params.append('recorded_by', recordedBy);
            if (resolvedBy) params.append('resolved_by', resolvedBy);
            if (status) params.append('status', status);
            if (gateFilter && gateFilter !== 'all') params.append('gate', gateFilter);
            if (falseAlarmFilter && falseAlarmFilter !== 'all') params.append('false_alarm', falseAlarmFilter);
            if (alarmDateStart) params.append('alarmDateStart', alarmDateStart);
            if (alarmDateEnd) params.append('alarmDateEnd', alarmDateEnd);
            if (resolutionDateStart) params.append('resolutionDateStart', resolutionDateStart);
            if (resolutionDateEnd) params.append('resolutionDateEnd', resolutionDateEnd);

            const res = await api.get(`/fire-alarms/records?${params.toString()}&_t=${Date.now()}`);

            if (fetchId !== latestFetchId.current) return;

            const fetched = res.data?.data || [];
            if (append) {
                setRecords(prev => [...prev, ...fetched]);
            } else {
                setRecords(fetched);
            }

            setHasMore(fetched.length === PAGE_SIZE);
        } catch (error) {
            if (fetchId !== latestFetchId.current) return;
            console.error('Veriler yuklenemedi:', error);
            message.error('Veriler yüklenemedi');
        } finally {
            if (fetchId !== latestFetchId.current) return;
            setLoading(false);
            setLoadingMore(false);
        }
    }, [alarmNumber, location, recordedBy, resolvedBy, status, gateFilter, falseAlarmFilter, alarmDateStart, alarmDateEnd, resolutionDateStart, resolutionDateEnd]);

    // Fetch records (paginated)
    useEffect(() => {
        setLoading(true);
        void fetchData(0, false);
    }, [fetchData]);

    useRealtimeRefetch({
        topics: ['fire-alarms'],
        onMutation: fetchData,
        enabled: true,
    });

    useEffect(() => {
        const handleFocus = () => {
            void fetchData();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void fetchData();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchData]);

    // Filtered records
    const filteredRecords = records;

    // Group by day for both default and filtered views (newest day first)
    const groupedByDay = useMemo(() => {
        const dayGroups = new Map<string, FireAlarmRecord[]>();

        filteredRecords.forEach((record) => {
            const dayKey = dayjs(record.alarm_time).format('YYYY-MM-DD');
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
                    return dayjs(a.alarm_time).valueOf() - dayjs(b.alarm_time).valueOf();
                })
            }));
    }, [filteredRecords]);

    const handleDownloadRecords = useCallback(async () => {
        if (isExporting) return;

        const alarmRangeSelected = !!(alarmDateStart || alarmDateEnd);
        const resolutionRangeSelected = !!(resolutionDateStart || resolutionDateEnd);

        if (!alarmRangeSelected && !resolutionRangeSelected) {
            message.warning('Lütfen alarm veya çözüm tarih aralığı seçin.');
            return;
        }

        let rangeStart: string | null = null;
        let rangeEnd: string | null = null;
        let filterBy: 'alarm' | 'resolution' = 'alarm';

        if (alarmRangeSelected) {
            filterBy = 'alarm';
            rangeStart = alarmDateStart || alarmDateEnd || null;
            rangeEnd = alarmDateEnd || alarmDateStart || null;
        } else {
            filterBy = 'resolution';
            rangeStart = resolutionDateStart || resolutionDateEnd || null;
            rangeEnd = resolutionDateEnd || resolutionDateStart || null;
        }

        if (!rangeStart || !rangeEnd) {
            message.warning('Lütfen geçerli bir tarih aralığı seçin.');
            return;
        }

        setIsExporting(true);

        try {
            const res = await api.get('/fire-alarms/records?includeDeleted=true&unlimited=true');
            const allRecords: FireAlarmRecord[] = res.data?.data || [];

            const start = dayjs(rangeStart).startOf('day');
            const end = dayjs(rangeEnd).endOf('day');

            const exportableRecords = allRecords
                .filter(record => !record.deleted_at)
                .filter((record) => {
                    const dateValue = filterBy === 'alarm' ? record.alarm_time : record.resolution_time;
                    if (!dateValue) return false;
                    const d = dayjs(dateValue);
                    return d.isBetween(start, end, 'millisecond', '[]');
                });

            if (exportableRecords.length === 0) {
                message.warning('Seçilen tarih aralığında indirilecek kayıt bulunamadı.');
                return;
            }

            const exportGroupsMap = new Map<string, FireAlarmRecord[]>();

            exportableRecords.forEach((record) => {
                const dayKey = dayjs(record.alarm_time).format('YYYY-MM-DD');
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
                        return dayjs(a.alarm_time).valueOf() - dayjs(b.alarm_time).valueOf();
                    })
                }));

            const headerRow = [
                'Alarm Numarası',
                'Konum',
                'Kapı',
                'Alarm Tarihi',
                'Alarm Saati',
                'Çözülmüş',
                'Çözüm Tarihi',
                'Çözüm Saati',
                'Yanlış Alarm',
                'Kaydeden',
                'Çözümleyen',
                'Çözüm Notu'
            ];

            const columnWidths = [14, 18, 12, 14, 12, 12, 14, 12, 12, 16, 16, 32];

            await exportRecordsToExcelAndZip<FireAlarmRecord>({
                exportGroups,
                headerRow,
                columnWidths,
                sheetName: 'Alarm Kayıtları',
                filePrefix: 'Yangin_Alarm_Kayitlari_',
                zipNamePrefix: 'Yangin_Alarm_Kayitlari',
                mapRecordToRow: (record) => [
                    record.alarm_number || '-',
                    record.location || '-',
                    record.gate || '-',
                    formatDate(record.alarm_time),
                    formatTime(record.alarm_time),
                    record.resolved ? 'Evet' : 'Hayır',
                    record.resolution_time ? formatDate(record.resolution_time) : '-',
                    record.resolution_time ? formatTime(record.resolution_time) : '-',
                    record.false_alarm ? 'Evet' : 'Hayır',
                    record.recorded_by_name || '-',
                    record.resolved_by_name || '-',
                    record.resolution_notes || '-'
                ]
            });
        } catch (error) {
            console.error('Export hatası:', error);
            message.error('Kayıtlar indirilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
        } finally {
            setIsExporting(false);
        }
    }, [alarmDateStart, alarmDateEnd, resolutionDateStart, resolutionDateEnd, isExporting]);

    // Clear all filters
    const clearFilters = () => {
        setAlarmNumber('');
        setLocation('');
        setRecordedBy('');
        setResolvedBy('');
        setStatus('all');
        setGateFilter('all');
        setFalseAlarmFilter('all');
        setAlarmDateStart('');
        setAlarmDateEnd('');
        setResolutionDateStart('');
        setResolutionDateEnd('');
    };

    const resetForm = useCallback(() => {
        setEditAlarmNumber('');
        setEditLocation('');
        setEditAlarmTime('');
        setEditResolutionTime('');
        setEditResolutionNotes('');
        setEditFalseAlarm(false);
        setIsEditing(false);
        setEditingId(null);
    }, []);

    const openModalForEdit = useCallback((record: FireAlarmRecord) => {
        setEditAlarmNumber(record.alarm_number || '');
        setEditLocation(record.location);
        if (record.alarm_time) {
            setEditAlarmTime(formatTime(record.alarm_time));
        }
        if (record.resolution_time) {
            setEditResolutionTime(formatTime(record.resolution_time));
        }
        setEditResolutionNotes(record.resolution_notes || '');
        setEditFalseAlarm(record.false_alarm);
        setIsEditing(true);
        setEditingId(record.id);
        setShowModal(true);
    }, []);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        if (!editLocation.trim()) {
            message.error('Konum alanı zorunludur');
            return;
        }

        if (!isValidLength(editResolutionNotes, 0, 1000)) {
            message.error('Notlar en fazla 1000 karakter olabilir');
            return;
        }

        try {
            const payload = {
                alarm_number: editAlarmNumber.trim() || null,
                location: editLocation.trim(),
                alarm_time: editAlarmTime && editAlarmTime !== '-' ? editAlarmTime : null,
                resolution_time: editResolutionTime && editResolutionTime !== '-' ? editResolutionTime : null,
                false_alarm: editFalseAlarm,
                resolution_notes: editResolutionNotes.trim() || null,
            };

            if (editingId) {
                await api.put(`/fire-alarms/records/${editingId}`, payload);
                message.success('Alarm kaydı güncellendi');
                setShowModal(false);
                resetForm();
                void fetchData(0, false);
            }
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            message.error(err?.response?.data?.message || 'İşlem başarısız');
        }
    }, [editAlarmNumber, editLocation, editAlarmTime, editResolutionTime, editResolutionNotes, editFalseAlarm, editingId, resetForm, fetchData]);

    const handleDeleteRecord = async (id: string) => {
        Modal.confirm({
            title: 'Kaydı Sil',
            content: 'Bu kaydı silmek istediğinize emin misiniz?',
            okText: 'Evet, Sil',
            okType: 'danger',
            cancelText: 'Vazgeç',
            onOk: async () => {
                try {
                    await api.delete(`/fire-alarms/records/${id}`);
                    setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: new Date().toISOString() } : record));
                    message.success('Kayıt başarıyla silindi');
                } catch (error) {
                    console.error('Kayit silinemedi:', error);
                    message.error('Kayıt silinirken bir hata oluştu');
                }
            }
        });
    };

    const handleRestoreRecord = async (id: string) => {
        try {
            await api.post(`/fire-alarms/records/${id}/restore`);
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: null } : record));
            message.success('Kayıt başarıyla geri yüklendi');
        } catch (error) {
            console.error('Kayit geri alinamadi:', error);
            message.error('Kayıt geri alınırken bir hata oluştu');
        }
    };

    const renderPreviewText = (value: string | null | undefined, title: string) => {
        const text = (value || '-').toString();
        const isLong = text.length > 15;

        if (!isLong) {
            return <div className="text-sm text-gray-900 block max-w-[240px] truncate whitespace-nowrap overflow-hidden" title={text}>{text}</div>;
        }

        return (
            <button
                type="button"
                onClick={() => setTextPreview({ title, value: text })}
                className="text-sm text-blue-700 hover:text-blue-900 underline text-left block max-w-[240px] truncate whitespace-nowrap overflow-hidden"
                title="Tamamini gormek icin tiklayin"
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
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Yangin Alarm Kayitlari</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Tum alarm kayitlarini filtreleyin ve inceleyin</p>
                            </div>
                        </div>
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
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 pb-14 flex flex-col gap-4 overflow-hidden">
                {/* Filters */}
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
                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Alarm Numarasi</label>
                            <input
                                type="text"
                                value={alarmNumber}
                                onChange={(e) => setAlarmNumber(e.target.value)}
                                placeholder="Alarm numarasi ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Konum</label>
                            <input
                                type="text"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="Konum ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Kaydeden</label>
                            <input
                                type="text"
                                value={recordedBy}
                                onChange={(e) => setRecordedBy(e.target.value)}
                                placeholder="Kaydeden ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Cozumleyen</label>
                            <input
                                type="text"
                                value={resolvedBy}
                                onChange={(e) => setResolvedBy(e.target.value)}
                                placeholder="Cozumleyen ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Durum</label>
                            <select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tumu</option>
                                <option value="active">Aktif</option>
                                <option value="resolved">Cozuldu</option>
                                <option value="deleted">Silinen Kayitlar</option>
                            </select>
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Kapi</label>
                            <select
                                value={gateFilter}
                                onChange={(e) => setGateFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tumu</option>
                                <option value="Ana Kapi">Ana Kapi</option>
                                <option value="Sahil Kapi">Sahil Kapi</option>
                            </select>
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Yanlis Alarm</label>
                            <select
                                value={falseAlarmFilter}
                                onChange={(e) => setFalseAlarmFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tumu</option>
                                <option value="true">Yanlis Alarm</option>
                                <option value="false">Gercek Alarm</option>
                            </select>
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Alarm Tarihi</label>
                            <RangePicker
                                value={[
                                    alarmDateStart ? dayjs(alarmDateStart) : null,
                                    alarmDateEnd ? dayjs(alarmDateEnd) : null
                                ]}
                                onChange={(dates) => {
                                    if (!dates || (!dates[0] && !dates[1])) {
                                        setAlarmDateStart('');
                                        setAlarmDateEnd('');
                                    } else if (dates[0] && dates[1]) {
                                        setAlarmDateStart(dates[0].format('YYYY-MM-DD'));
                                        setAlarmDateEnd(dates[1].format('YYYY-MM-DD'));
                                    } else if (dates[0] && !dates[1]) {
                                        const singleDate = dates[0].format('YYYY-MM-DD');
                                        setAlarmDateStart(singleDate);
                                        setAlarmDateEnd(singleDate);
                                    }
                                }}
                                allowEmpty={[false, true]}
                                format="DD/MM/YYYY"
                                placeholder={['Baslangic', 'Bitis']}
                                className="w-full"
                                size="small"
                            />
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Cozum Tarihi</label>
                            <RangePicker
                                value={[
                                    resolutionDateStart ? dayjs(resolutionDateStart) : null,
                                    resolutionDateEnd ? dayjs(resolutionDateEnd) : null
                                ]}
                                onChange={(dates) => {
                                    if (!dates || (!dates[0] && !dates[1])) {
                                        setResolutionDateStart('');
                                        setResolutionDateEnd('');
                                    } else if (dates[0] && dates[1]) {
                                        setResolutionDateStart(dates[0].format('YYYY-MM-DD'));
                                        setResolutionDateEnd(dates[1].format('YYYY-MM-DD'));
                                    } else if (dates[0] && !dates[1]) {
                                        const singleDate = dates[0].format('YYYY-MM-DD');
                                        setResolutionDateStart(singleDate);
                                        setResolutionDateEnd(singleDate);
                                    }
                                }}
                                allowEmpty={[false, true]}
                                format="DD/MM/YYYY"
                                placeholder={['Baslangic', 'Bitis']}
                                className="w-full"
                                size="small"
                            />
                        </div>
                    </div>
                </div>

                {/* Records */}
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
                            <p className="text-gray-500">Filtrelere uygun kayit bulunamadi</p>
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

                                    <table className="w-full min-w-[1550px] table-auto divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-10 z-10">
                                            <tr>
                                                <th className="w-[150px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">İşlem</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Alarm No</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Konum</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Kapi</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Alarm Zamani</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Cozum Zamani</th>
                                                <th className="w-[250px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Notlar</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Kaydeden</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Cozumleyen</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {dayGroup.records.map((record) => (
                                                <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
                                                            {record.deleted_at ? (
                                                                <CompactActionButton
                                                                    onClick={() => handleRestoreRecord(record.id)}
                                                                    variant="success"
                                                                    label="Geri Al"
                                                                    icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>}
                                                                />
                                                            ) : (
                                                                <>
                                                                    <CompactActionButton
                                                                        onClick={() => openModalForEdit(record)}
                                                                        variant="primary"
                                                                        label="Düzenle"
                                                                        icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                                                                    />
                                                                    <CompactActionButton
                                                                        onClick={() => handleDeleteRecord(record.id)}
                                                                        variant="danger"
                                                                        label="Sil"
                                                                        icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                                                                    />
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs font-medium text-gray-900">{record.alarm_number || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs font-bold text-gray-900 whitespace-nowrap">{record.location}</div>
                                                        {record.false_alarm && <span className="text-[10px] text-red-600 font-medium block">Yanlis Alarm</span>}
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.gate || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{formatDate(record.alarm_time)}</div>
                                                        <div className="text-[10px] text-gray-500">{formatTime(record.alarm_time)}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        {record.resolution_time ? (
                                                            <>
                                                                <div className="text-xs text-gray-900">{formatDate(record.resolution_time)}</div>
                                                                <div className="text-[10px] text-gray-500">{formatTime(record.resolution_time)}</div>
                                                            </>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="w-[250px] px-3 py-2.5 pr-6">
                                                        {renderPreviewText(record.resolution_notes, 'Notlar')}
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        {record.deleted_at ? (
                                                            <span className="px-2 py-0.5 inline-flex whitespace-nowrap text-[10px] font-semibold rounded-full bg-red-100 text-red-700">Silindi</span>
                                                        ) : record.resolved ? (
                                                            <span className="px-2 py-0.5 inline-flex whitespace-nowrap text-[10px] font-semibold rounded-full bg-green-100 text-green-800">Cozuldu</span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 inline-flex whitespace-nowrap text-[10px] font-semibold rounded-full bg-red-100 text-red-800">Aktif</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.recorded_by_name || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.resolved_by_name || '-'}</div>
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

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-900">
                                Alarm Kaydını Düzenle
                            </h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowModal(false);
                                    resetForm();
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Alarm Numarası</label>
                                <input
                                    type="text"
                                    value={editAlarmNumber}
                                    onChange={(e) => setEditAlarmNumber(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    placeholder="Örn: AL-001, Panel 3, Kat 2 Alarm 5"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Konum *</label>
                                <input
                                    type="text"
                                    value={editLocation}
                                    onChange={(e) => setEditLocation(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    placeholder="Örn: 3. Kat Koridor, Lobi, Mutfak"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Alarm Saati</label>
                                <input
                                    type="time"
                                    value={editAlarmTime === '-' ? '' : editAlarmTime}
                                    onChange={(e) => setEditAlarmTime(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Çözüm Saati</label>
                                <input
                                    type="time"
                                    value={editResolutionTime === '-' ? '' : editResolutionTime}
                                    onChange={(e) => setEditResolutionTime(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    style={{ colorScheme: 'light' }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notlar / Açıklama</label>
                                <textarea
                                    value={editResolutionNotes}
                                    onChange={(e) => setEditResolutionNotes(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    rows={3}
                                    placeholder="Çözüm notları, yanlış alarm gerekçesi vb..."
                                />
                            </div>
                            <div className="flex items-center gap-2 py-1">
                                <input
                                    type="checkbox"
                                    id="editFalseAlarm"
                                    checked={editFalseAlarm}
                                    onChange={(e) => setEditFalseAlarm(e.target.checked)}
                                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                />
                                <label htmlFor="editFalseAlarm" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
                                    Bu bir yanlış alarmdı
                                </label>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-medium transition"
                                >
                                    Güncelle
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        resetForm();
                                    }}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2.5 rounded-lg font-medium transition"
                                >
                                    İptal
                                </button>
                            </div>
                        </form>
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
