import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker, message, Modal } from 'antd';
import dayjs from '../utils/dayjsConfig';
import 'antd/dist/reset.css';
import api from '../utils/api';
import { formatDate, formatTime } from '../utils/dateUtils';
import type { VisitorRecord } from '../types';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import { exportRecordsToExcelAndZip } from '../utils/exportHelper';
import { formatPhoneNumber } from '../utils/validation';

const { RangePicker } = DatePicker;
const getVisitorTags = (record: VisitorRecord): string[] => {
    const tags: string[] = [];
    if (record.subcontractor_worker) tags.push('Taşeron İşçi');
    if (record.for_electric_station) tags.push('Şarj İstasyonu');
    if (record.daily_guest) tags.push('Günübirlik Misafir');
    if (record.entry_tag) tags.push('Giriş');
    if (record.exit_tag) tags.push('Çıkış');
    if (record.tour_entry) tags.push('Tur Giriş');
    if (record.tour_exit) tags.push('Tur Çıkış');
    if (record.meeting) tags.push('Görüşme');
    if (record.delivery) tags.push('Teslimat');
    return tags;
};

const VISITOR_ROW_BG_COLORS: Record<string, string> = {
    none: '',
    rose: '#fb7185',
    amber: '#fbbf24',
    emerald: '#6ee7b7',
    sky: '#7dd3fc',
    violet: '#a78bfa',
    orange: '#fdba74',
    pink: '#f472b6',
    brown: '#d4a373',
};

const getVisitorRowStyle = (record: VisitorRecord): { backgroundColor: string } | undefined => {
    const color = VISITOR_ROW_BG_COLORS[record.highlight_color || 'none'];
    if (!color) return undefined;
    return { backgroundColor: color };
};

type VisitorEditTagKey =
    | 'subcontractor_worker'
    | 'for_electric_station'
    | 'daily_guest'
    | 'entry_tag'
    | 'exit_tag'
    | 'tour_entry'
    | 'tour_exit'
    | 'meeting'
    | 'delivery';

type VisitorEditFormData = {
    vehicle_plate: string;
    full_name: string;
    company_name: string;
    visiting_person: string;
    person_count: string;
    children_count: string;
    phone: string;
    notes: string;
    highlight_color: string;
    subcontractor_worker: boolean;
    for_electric_station: boolean;
    daily_guest: boolean;
    entry_tag: boolean;
    exit_tag: boolean;
    tour_entry: boolean;
    tour_exit: boolean;
    meeting: boolean;
    delivery: boolean;
    entry_time: string;
    exit_time: string;
};

const VISITOR_EDIT_TAGS: Array<{ key: VisitorEditTagKey; label: string }> = [
    { key: 'subcontractor_worker', label: 'Taşeron İşçi' },
    { key: 'for_electric_station', label: 'Şarj İstasyonu' },
    { key: 'daily_guest', label: 'Günübirlik Misafir' },
    { key: 'entry_tag', label: 'Giriş' },
    { key: 'exit_tag', label: 'Çıkış' },
    { key: 'tour_entry', label: 'Tur Giriş' },
    { key: 'tour_exit', label: 'Tur Çıkış' },
    { key: 'meeting', label: 'Görüşme' },
    { key: 'delivery', label: 'Teslimat' }
];

const VISITOR_HIGHLIGHT_OPTIONS = [
    { value: 'none', label: 'Varsayılan', color: '#f3f4f6' },
    { value: 'rose', label: 'Gül Kırmızısı', color: '#e11d48' },
    { value: 'amber', label: 'Sarı', color: '#d97706' },
    { value: 'emerald', label: 'Yeşil', color: '#059669' },
    { value: 'sky', label: 'Mavi', color: '#0284c7' },
    { value: 'violet', label: 'Mor', color: '#7c3aed' },
    { value: 'orange', label: 'Turuncu', color: '#ea580c' },
    { value: 'pink', label: 'Pembe', color: '#db2777' },
    { value: 'brown', label: 'Kahverengi', color: '#92400e' }
];

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

const createVisitorEditFormData = (record: VisitorRecord | null): VisitorEditFormData => ({
    vehicle_plate: record?.vehicle_plate || '',
    full_name: record?.full_name || '',
    company_name: record?.company_name || '',
    visiting_person: record?.visiting_person || '',
    person_count: record?.person_count !== null && record?.person_count !== undefined ? String(record.person_count) : '',
    children_count: record?.children_count !== null && record?.children_count !== undefined ? String(record.children_count) : '0',
    phone: record?.phone || '',
    notes: record?.notes || '',
    highlight_color: record?.highlight_color || 'none',
    subcontractor_worker: record?.subcontractor_worker ?? false,
    for_electric_station: record?.for_electric_station ?? false,
    daily_guest: record?.daily_guest ?? false,
    entry_tag: record?.entry_tag ?? false,
    exit_tag: record?.exit_tag ?? false,
    tour_entry: record?.tour_entry ?? false,
    tour_exit: record?.tour_exit ?? false,
    meeting: record?.meeting ?? false,
    delivery: record?.delivery ?? false,
    entry_time: record?.entry_time || '',
    exit_time: record?.exit_time || ''
});

export default function AdminVisitorRecords() {
    const [records, setRecords] = useState<VisitorRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 200;
    const [isExporting, setIsExporting] = useState(false);
    const [textPreview, setTextPreview] = useState<{ title: string; value: string } | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState<VisitorRecord | null>(null);
    const [editFormData, setEditFormData] = useState<VisitorEditFormData>(createVisitorEditFormData(null));
    const [openTagsDropdown, setOpenTagsDropdown] = useState(false);
    const [savingEdit, setSavingEdit] = useState(false);
    const [scrollbarSpacerWidth, setScrollbarSpacerWidth] = useState(0);
    const navigate = useNavigate();
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);

    // Filter states (moved before fetchData so callbacks can reference it)
    const [filters, setFilters] = useState({
        full_name: '',
        company_name: '',
        vehicle_plate: '',
        visiting_person: '',
        phone: '',
        entry_by: '',
        exit_by: '',
        status: 'all',
        gate: 'all',
        visitor_tag: 'all',
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

            if (filters.full_name) params.append('full_name', filters.full_name);
            if (filters.company_name) params.append('company_name', filters.company_name);
            if (filters.vehicle_plate) params.append('vehicle_plate', filters.vehicle_plate);
            if (filters.visiting_person) params.append('visiting_person', filters.visiting_person);
            if (filters.phone) params.append('phone', filters.phone);
            if (filters.entry_by) params.append('entry_by', filters.entry_by);
            if (filters.exit_by) params.append('exit_by', filters.exit_by);
            if (filters.status) params.append('status', filters.status);
            if (filters.gate) params.append('gate', filters.gate);

            if (filters.visitor_tag === 'subcontractor') params.append('subcontractor_worker', 'true');
            if (filters.visitor_tag === 'electric') params.append('for_electric_station', 'true');
            if (filters.visitor_tag === 'daily_guest') params.append('daily_guest', 'true');
            if (filters.visitor_tag === 'entry_tag') params.append('entry_tag', 'true');
            if (filters.visitor_tag === 'exit_tag') params.append('exit_tag', 'true');
            if (filters.visitor_tag === 'tour_entry') params.append('tour_entry', 'true');
            if (filters.visitor_tag === 'tour_exit') params.append('tour_exit', 'true');
            if (filters.visitor_tag === 'meeting') params.append('meeting', 'true');
            if (filters.visitor_tag === 'delivery') params.append('delivery', 'true');

            if (filters.entryDateStart) params.append('entryDateStart', filters.entryDateStart);
            if (filters.entryDateEnd) params.append('entryDateEnd', filters.entryDateEnd);
            if (filters.exitDateStart) params.append('exitDateStart', filters.exitDateStart);
            if (filters.exitDateEnd) params.append('exitDateEnd', filters.exitDateEnd);

            const res = await api.get(`/visitors/records?${params.toString()}&_t=${Date.now()}`);
            const fetched: VisitorRecord[] = res.data || [];

            if (append) {
                setRecords(prev => [...prev, ...fetched]);
            } else {
                setRecords(fetched);
            }

            setHasMore(fetched.length === PAGE_SIZE);
        } catch (error) {
            message.error('Veriler yüklenemedi');
            console.error('Veriler yüklenemedi:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filters]);

    useEffect(() => {
        setLoading(true);
        void fetchData(0, false);
    }, [fetchData]);

    useRealtimeRefetch({
        topics: ['visitors'],
        onMutation: () => void fetchData(0, false),
    });

    const openEditModal = useCallback((record: VisitorRecord) => {
        setEditingRecord(record);
        setEditFormData(createVisitorEditFormData(record));
        setShowEditModal(true);
    }, []);

    const closeEditModal = useCallback(() => {
        setEditingRecord(null);
        setShowEditModal(false);
    }, []);

    const handleSaveEdit = async () => {
        if (!editingRecord) return;

        try {
            const response = await api.put(`/visitors/records/${editingRecord.id}`, editFormData);
            if (response.data.success) {
                message.success('Kayıt başarıyla güncellendi');
                closeEditModal();
                fetchData(0, false);
            }
        } catch (error) {
            console.error('Kayıt güncellenemedi:', error);
            message.error('Kayıt güncellenirken bir hata oluştu');
        }
    };

    const handleDeleteRecord = useCallback(async (id: string) => {
        Modal.confirm({
            title: 'Kaydı Sil',
            content: 'Bu kaydı silmek istediğinize emin misiniz?',
            okText: 'Evet',
            cancelText: 'Hayır',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await api.delete(`/visitors/records/${id}`);
                    setRecords(prev => prev.map(r => r.id === id ? { ...r, deleted_at: new Date().toISOString() } : r));
                    message.success('Kayıt silindi');
                } catch (error) {
                    console.error('Kayıt silinemedi:', error);
                    message.error('Kayıt silinirken bir hata oluştu');
                }
            }
        });
    }, []);

    const handleRestoreRecord = useCallback(async (id: string) => {
        Modal.confirm({
            title: 'Kaydı Geri Al',
            content: 'Bu kaydı geri almak istediğinize emin misiniz?',
            okText: 'Evet',
            cancelText: 'Hayır',
            onOk: async () => {
                try {
                    await api.post(`/visitors/records/${id}/restore`, {});
                    setRecords(prev => prev.map(r => r.id === id ? { ...r, deleted_at: null } : r));
                    message.success('Kayıt geri alındı');
                } catch (error) {
                    console.error('Kayıt geri alınamadı:', error);
                    message.error('Kayıt geri alınırken bir hata oluştu');
                }
            }
        });
    }, []);

    // Filtered records
    const filteredRecords = records;

    // Group by day for both default and filtered views (newest day first)
    const groupedByDay = useMemo(() => {
        const dayGroups = new Map<string, VisitorRecord[]>();

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

            if (filters.full_name) params.append('full_name', filters.full_name);
            if (filters.company_name) params.append('company_name', filters.company_name);
            if (filters.vehicle_plate) params.append('vehicle_plate', filters.vehicle_plate);
            if (filters.visiting_person) params.append('visiting_person', filters.visiting_person);
            if (filters.phone) params.append('phone', filters.phone);
            if (filters.entry_by) params.append('entry_by', filters.entry_by);
            if (filters.exit_by) params.append('exit_by', filters.exit_by);
            if (filters.status) params.append('status', filters.status);
            if (filters.gate) params.append('gate', filters.gate);

            if (filters.visitor_tag === 'subcontractor') params.append('subcontractor_worker', 'true');
            if (filters.visitor_tag === 'electric') params.append('for_electric_station', 'true');
            if (filters.visitor_tag === 'daily_guest') params.append('daily_guest', 'true');
            if (filters.visitor_tag === 'entry_tag') params.append('entry_tag', 'true');
            if (filters.visitor_tag === 'exit_tag') params.append('exit_tag', 'true');
            if (filters.visitor_tag === 'tour_entry') params.append('tour_entry', 'true');
            if (filters.visitor_tag === 'tour_exit') params.append('tour_exit', 'true');
            if (filters.visitor_tag === 'meeting') params.append('meeting', 'true');
            if (filters.visitor_tag === 'delivery') params.append('delivery', 'true');

            if (filters.entryDateStart) params.append('entryDateStart', filters.entryDateStart);
            if (filters.entryDateEnd) params.append('entryDateEnd', filters.entryDateEnd);
            if (filters.exitDateStart) params.append('exitDateStart', filters.exitDateStart);
            if (filters.exitDateEnd) params.append('exitDateEnd', filters.exitDateEnd);

            const res = await api.get(`/visitors/records?${params.toString()}`);
            const allRecords: VisitorRecord[] = res.data || [];

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

            const exportGroupsMap = new Map<string, VisitorRecord[]>();

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
                        const dateCompare = (a.entry_date ?? '').localeCompare(b.entry_date ?? '');
                        if (dateCompare !== 0) return dateCompare;
                        return (a.entry_time ?? '').localeCompare(b.entry_time ?? '');
                    })
                }));

            const headerRow = [
                'Kapı',
                'Araç Plakası',
                'İsim Soyisim',
                'Firma Adı',
                'Ziyaret Edilen',
                'Giriş Tarihi',
                'Giriş Saati',
                'Çıkış Tarihi',
                'Çıkış Saati',
                'Etiket',
                'Kişi Sayısı',
                'Çocuk Sayısı',
                'Telefon',
                'Durum',
                'Giriş Yapan',
                'Çıkış Yapan',
                'Açıklama'
            ];

            const worksheetColumnWidths = [14, 14, 18, 18, 18, 14, 12, 14, 12, 20, 12, 12, 14, 14, 14, 14, 32];

            await exportRecordsToExcelAndZip<VisitorRecord>({
                exportGroups,
                headerRow,
                columnWidths: worksheetColumnWidths,
                mapRecordToRow: (record) => [
                    record.gate || '-',
                    record.vehicle_plate || '-',
                    record.full_name || '-',
                    record.company_name || '-',
                    record.visiting_person || '-',
                    formatDate(record.entry_date),
                    formatTime(record.entry_time),
                    record.exit_date ? formatDate(record.exit_date) : '-',
                    record.exit_time ? formatTime(record.exit_time) : '-',
                    getVisitorTags(record).join(', ') || '-',
                    record.person_count ?? '-',
                    record.children_count ?? '-',
                    record.phone || '-',
                    record.status === 'inside' ? 'İçeride' : 'Çıkış Yapıldı',
                    record.entry_by || '-',
                    record.exit_by || '-',
                    record.notes || '-'
                ],
                sheetName: 'Ziyaretçi Kayıtları',
                filePrefix: 'Ziyaretci_Kayitlari_',
                zipNamePrefix: 'Ziyaretci_Kayitlari'
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
            full_name: '',
            company_name: '',
            vehicle_plate: '',
            visiting_person: '',
            phone: '',
            entry_by: '',
            exit_by: '',
            status: 'all',
            gate: 'all',
            visitor_tag: 'all',
            entryDateStart: '',
            entryDateEnd: '',
            exitDateStart: '',
            exitDateEnd: ''
        });
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
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Ziyaretçi Kayıtları</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Tüm geçmiş kayıtları görüntüleyin ve filtreleyin</p>
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
                {/* Filters Panel */}
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
                            <label className="block text-xs font-medium text-gray-700 mb-1">Ad Soyad</label>
                            <input
                                type="text"
                                value={filters.full_name}
                                onChange={(e) => setFilters({ ...filters, full_name: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Firma Adı</label>
                            <input
                                type="text"
                                value={filters.company_name}
                                onChange={(e) => setFilters({ ...filters, company_name: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Araç Plakası</label>
                            <input
                                type="text"
                                value={filters.vehicle_plate}
                                onChange={(e) => setFilters({ ...filters, vehicle_plate: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Ziyaret Edilen</label>
                            <input
                                type="text"
                                value={filters.visiting_person}
                                onChange={(e) => setFilters({ ...filters, visiting_person: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Durum</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="inside">İçeride</option>
                                <option value="exited">Çıkış Yaptı</option>
                                <option value="deleted">Silinen Kayıtlar</option>
                            </select>
                        </div>

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

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Telefon</label>
                            <input
                                type="text"
                                value={filters.phone}
                                onChange={(e) => setFilters({ ...filters, phone: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Giriş Yapan</label>
                            <input
                                type="text"
                                value={filters.entry_by}
                                onChange={(e) => setFilters({ ...filters, entry_by: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Çıkış Yapan</label>
                            <input
                                type="text"
                                value={filters.exit_by}
                                onChange={(e) => setFilters({ ...filters, exit_by: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Etiket</label>
                            <select
                                value={filters.visitor_tag}
                                onChange={(e) => setFilters({ ...filters, visitor_tag: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="subcontractor">Taşeron İşçi</option>
                                <option value="electric">Şarj İstasyonu</option>
                                <option value="daily_guest">Günübirlik Misafir</option>
                                <option value="entry_tag">Giriş</option>
                                <option value="exit_tag">Çıkış</option>
                                <option value="tour_entry">Tur Giriş</option>
                                <option value="tour_exit">Tur Çıkış</option>
                                <option value="meeting">Görüşme</option>
                                <option value="delivery">Teslimat</option>
                            </select>
                        </div>

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

                                    <table className="w-full min-w-[1600px] table-auto divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-10 z-10">
                                            <tr>
                                                <th className="w-[180px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">İşlem</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Kapı</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Araç Plaka</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">İsim Soyisim</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Firma</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Ziyaret Edilen</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Giriş Tarihi</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Çıkış Tarihi</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Etiket</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Kişi Sayısı</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Çocuk Sayısı</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Telefon</th>
                                                <th className="w-[180px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Açıklama</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Giriş Yapan</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Çıkış Yapan</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {dayGroup.records.map((record) => (
                                                <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`} style={getVisitorRowStyle(record)}>
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
                                                        <div className="text-xs font-bold text-gray-900">{record.vehicle_plate || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs font-bold text-gray-900">{record.full_name || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.company_name || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.visiting_person || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{formatDate(record.entry_date)}</div>
                                                        <div className="text-[10px] text-gray-500">{formatTime(record.entry_time)}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        {record.exit_date ? (
                                                            <>
                                                                <div className="text-xs text-gray-900">{formatDate(record.exit_date)}</div>
                                                                <div className="text-[10px] text-gray-500">{formatTime(record.exit_time)}</div>
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="flex flex-wrap gap-1 max-w-[160px] whitespace-normal">
                                                            {getVisitorTags(record).length > 0 ? (
                                                                getVisitorTags(record).map((tag, idx) => (
                                                                    <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30">
                                                                        {tag}
                                                                    </span>
                                                                ))
                                                            ) : (
                                                                <span className="text-gray-400 text-xs">-</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.person_count ?? '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.children_count ?? '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{formatPhoneNumber(record.phone)}</div>
                                                    </td>
                                                    <td className="w-[180px] px-3 py-2.5 pr-2">
                                                        {renderPreviewText(record.notes, 'Açıklama')}
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <span className={`px-2 py-0.5 inline-flex whitespace-nowrap text-[10px] leading-5 font-semibold rounded-full ${record.status === 'inside' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                                            {record.status === 'inside' ? 'İçeride' : 'Çıkış Yapıldı'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.entry_by || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{record.exit_by || '-'}</div>
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
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center gap-4 mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">Ziyaretçi Düzenle</h2>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        {VISITOR_HIGHLIGHT_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setEditFormData((prev) => ({ ...prev, highlight_color: option.value }))}
                                                className={`w-6 h-6 rounded-full border-2 transition ${editFormData.highlight_color === option.value ? 'border-gray-900 scale-110' : 'border-gray-300'}`}
                                                style={{ backgroundColor: option.color }}
                                                title={option.label}
                                                aria-label={option.label}
                                                disabled={savingEdit}
                                            />
                                        ))}
                                    </div>
                                    <button onClick={closeEditModal} className="text-gray-400 hover:text-gray-600" type="button" disabled={savingEdit}>
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); void handleSaveEdit(); }} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Ad Soyad</label>
                                        <input value={editFormData.full_name || ''} onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })} placeholder="Ziyaretçinin adı soyadı" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Plaka</label>
                                        <input value={editFormData.vehicle_plate || ''} onChange={(e) => setEditFormData({ ...editFormData, vehicle_plate: e.target.value })} placeholder="TR 34 XXX 34" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Firma</label>
                                        <input value={editFormData.company_name || ''} onChange={(e) => setEditFormData({ ...editFormData, company_name: e.target.value })} placeholder="Firma adı" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Ziyaret Edilen</label>
                                        <input value={editFormData.visiting_person || ''} onChange={(e) => setEditFormData({ ...editFormData, visiting_person: e.target.value })} placeholder="İsim veya departman" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Kişi Sayısı</label>
                                        <input type="number" value={editFormData.person_count || ''} onChange={(e) => setEditFormData({ ...editFormData, person_count: e.target.value })} placeholder="1" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Çocuk Sayısı</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={editFormData.children_count ?? ''}
                                            onChange={(e) => setEditFormData({ ...editFormData, children_count: e.target.value })}
                                            placeholder="0"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Telefon</label>
                                        <input value={editFormData.phone || ''} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} placeholder="05xx..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Giriş Saati</label>
                                        <input
                                            type="time"
                                            value={editFormData.entry_time || ''}
                                            onChange={(e) => setEditFormData({ ...editFormData, entry_time: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Boş bırakırsanız mevcut saat kullanılır</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Çıkış Saati</label>
                                        <input
                                            type="time"
                                            value={editFormData.exit_time || ''}
                                            onChange={(e) => setEditFormData({ ...editFormData, exit_time: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Çıkış kaydı için saat belirtebilirsiniz</p>
                                    </div>

                                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Etiketler</label>
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenTagsDropdown(!openTagsDropdown)}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left bg-white hover:bg-gray-50 flex justify-between items-center"
                                                >
                                                    <span className="text-sm">
                                                        {[editFormData.subcontractor_worker && 'Taşeron İşçi', editFormData.for_electric_station && 'Şarj İstasyonu', editFormData.daily_guest && 'Günübirlik Misafir', editFormData.entry_tag && 'Giriş', editFormData.exit_tag && 'Çıkış', editFormData.tour_entry && 'Tur Giriş', editFormData.tour_exit && 'Tur Çıkış', editFormData.meeting && 'Görüşme', editFormData.delivery && 'Teslimat'].filter(Boolean).join(', ') || 'Seçiniz...'}
                                                    </span>
                                                    <svg className={`w-5 h-5 transition-transform flex-shrink-0 ${openTagsDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                                    </svg>
                                                </button>
                                                {openTagsDropdown && (
                                                    <div className="absolute z-20 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                                        {VISITOR_EDIT_TAGS.map((option) => (
                                                            <label key={option.key} className="flex items-center px-4 py-2 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!editFormData[option.key]}
                                                                    onChange={(e) => {
                                                                        setEditFormData({ ...editFormData, [option.key]: e.target.checked });
                                                                    }}
                                                                    className="mr-3 w-4 h-4 cursor-pointer"
                                                                />
                                                                <span className="text-sm text-gray-700">{option.label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama / Not</label>
                                            <textarea value={editFormData.notes || ''} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} rows={3} placeholder="Notlar..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition">Güncelle</button>
                                    <button type="button" onClick={closeEditModal} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition">İptal</button>
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
