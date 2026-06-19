import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker, message, Modal } from 'antd';
import dayjs from '../utils/dayjsConfig';
import 'antd/dist/reset.css';
import api from '../utils/api';
import { formatDate, formatTime } from '../utils/dateUtils';
import type { VehicleUsage, Vehicle, Manager } from '../types';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import { exportRecordsToExcelAndZip } from '../utils/exportHelper';
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
interface VehicleEditFormData {
    vehicle_id: string;
    manager_id: string;
    manager_name: string;
    destination: string;
    notes: string;
    given_time: string;
    return_time: string;
}

const INITIAL_FORM_DATA: VehicleEditFormData = {
    vehicle_id: '',
    manager_id: '',
    manager_name: '',
    destination: '',
    notes: '',
    given_time: '',
    return_time: ''
};

export default function AdminVehicleRecords() {
    const [records, setRecords] = useState<VehicleUsage[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [managers, setManagers] = useState<Manager[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [textPreview, setTextPreview] = useState<{ title: string; value: string } | null>(null);
    const [scrollbarSpacerWidth, setScrollbarSpacerWidth] = useState(0);
    const navigate = useNavigate();
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);
    const isScrollingTable = useRef(false);
    const isScrollingBar = useRef(false);

    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUsage, setEditingUsage] = useState<VehicleUsage | null>(null);
    const [formData, setFormData] = useState<VehicleEditFormData>(INITIAL_FORM_DATA);
    const [showCustomManager, setShowCustomManager] = useState(false);

    // Filter states
    const [filters, setFilters] = useState({
        vehicle_plate: '',
        manager: '',
        destination: '',
        given_by: '',
        returned_by: '',
        status: 'all',
        gate: 'all',
        givenDateStart: '',
        givenDateEnd: '',
        returnDateStart: '',
        returnDateEnd: ''
    });

    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const PAGE_SIZE = 200;

    const fetchData = useCallback(async (offset = 0, append = false) => {
        try {
            const params = new URLSearchParams();
            params.append('includeDeleted', 'true');
            params.append('limit', String(PAGE_SIZE));
            params.append('offset', String(offset));

            if (filters.vehicle_plate) params.append('vehicle_plate', filters.vehicle_plate);
            if (filters.manager) params.append('manager', filters.manager);
            if (filters.destination) params.append('destination', filters.destination);
            if (filters.given_by) params.append('given_by', filters.given_by);
            if (filters.returned_by) params.append('returned_by', filters.returned_by);
            if (filters.status) params.append('status', filters.status);
            if (filters.gate) params.append('gate', filters.gate);
            if (filters.givenDateStart) params.append('givenDateStart', filters.givenDateStart);
            if (filters.givenDateEnd) params.append('givenDateEnd', filters.givenDateEnd);
            if (filters.returnDateStart) params.append('returnDateStart', filters.returnDateStart);
            if (filters.returnDateEnd) params.append('returnDateEnd', filters.returnDateEnd);

            const [recordsRes, vehiclesRes, managersRes] = await Promise.all([
                api.get(`/vehicles/records?${params.toString()}&_t=${Date.now()}`),
                vehicles.length === 0 ? api.get('/vehicles') : Promise.resolve(null),
                managers.length === 0 ? api.get('/vehicles/managers') : Promise.resolve(null)
            ]);

            const fetchedRecords = recordsRes.data || [];

            if (append) {
                setRecords(prev => [...prev, ...fetchedRecords]);
            } else {
                setRecords(fetchedRecords);
            }

            setHasMore(fetchedRecords.length === PAGE_SIZE);
            if (vehiclesRes) {
                setVehicles(vehiclesRes.data || []);
            }
            if (managersRes) {
                setManagers(managersRes.data || []);
            }
        } catch (error) {
            message.error('Veriler yüklenemedi');
            console.error('Veriler yüklenemedi:', error);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filters, vehicles.length, managers.length]);

    useEffect(() => {
        setLoading(true);
        void fetchData(0, false);
    }, [fetchData]);

    // Infinite scroll: load more on scroll near bottom
    useEffect(() => {
        const node = tableScrollRef.current;
        if (!node) return;

        const onScroll = () => {
            if (loadingMore || !hasMore) return;
            const threshold = 300;
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

    useRealtimeRefetch({
        topics: ['vehicles'],
        onMutation: () => void fetchData(0, false),
        enabled: true,
    });

    // Filtered records are handled on backend now
    const filteredRecords = records;

    // Check if any filter is active
    const hasActiveFilters = useMemo(() => {
        return filters.vehicle_plate !== '' ||
            filters.manager !== '' ||
            filters.destination !== '' ||
            filters.given_by !== '' ||
            filters.returned_by !== '' ||
            filters.status !== 'all' ||
            filters.gate !== 'all' ||
            filters.givenDateStart !== '' ||
            filters.givenDateEnd !== '' ||
            filters.returnDateStart !== '' ||
            filters.returnDateEnd !== '';
    }, [filters]);

    // Group by day for both default and filtered views (newest day first)
    const groupedByDay = useMemo(() => {
        const dayGroups = new Map<string, VehicleUsage[]>();

        filteredRecords.forEach((record) => {
            const dayKey = dayjs(record.given_date).format('YYYY-MM-DD');
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
                    const dateCompare = a.given_date.localeCompare(b.given_date);
                    if (dateCompare !== 0) return dateCompare;
                    return a.given_time.localeCompare(b.given_time);
                })
            }));
    }, [filteredRecords]);

    const handleDownloadRecords = useCallback(async () => {
        if (isExporting) return;

        const givenRangeSelected = !!(filters.givenDateStart || filters.givenDateEnd);
        const returnRangeSelected = !!(filters.returnDateStart || filters.returnDateEnd);

        if (!givenRangeSelected && !returnRangeSelected) {
            message.warning('Lütfen teslim veya iade tarih aralığı seçin.');
            return;
        }

        let rangeStart: string | null = null;
        let rangeEnd: string | null = null;
        let filterBy: 'given' | 'return' = 'given';

        if (givenRangeSelected) {
            filterBy = 'given';
            rangeStart = filters.givenDateStart || filters.givenDateEnd || null;
            rangeEnd = filters.givenDateEnd || filters.givenDateStart || null;
        } else {
            filterBy = 'return';
            rangeStart = filters.returnDateStart || filters.returnDateEnd || null;
            rangeEnd = filters.returnDateEnd || filters.returnDateStart || null;
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
            if (filters.vehicle_plate) params.append('vehicle_plate', filters.vehicle_plate);
            if (filters.manager) params.append('manager', filters.manager);
            if (filters.destination) params.append('destination', filters.destination);
            if (filters.given_by) params.append('given_by', filters.given_by);
            if (filters.returned_by) params.append('returned_by', filters.returned_by);
            if (filters.status) params.append('status', filters.status);
            if (filters.gate) params.append('gate', filters.gate);
            if (filters.givenDateStart) params.append('givenDateStart', filters.givenDateStart);
            if (filters.givenDateEnd) params.append('givenDateEnd', filters.givenDateEnd);
            if (filters.returnDateStart) params.append('returnDateStart', filters.returnDateStart);
            if (filters.returnDateEnd) params.append('returnDateEnd', filters.returnDateEnd);

            const res = await api.get(`/vehicles/records?${params.toString()}`);
            const allRecords: VehicleUsage[] = res.data || [];

            const start = dayjs(rangeStart).startOf('day');
            const end = dayjs(rangeEnd).endOf('day');

            const exportableRecords = allRecords
                .filter((record) => {
                    const dateValue = filterBy === 'given' ? record.given_date : record.return_date;
                    if (!dateValue) return false;
                    const d = dayjs(dateValue);
                    return d.isBetween(start, end, 'millisecond', '[]');
                })
                .filter(record => !record.deleted_at);

            if (exportableRecords.length === 0) {
                message.warning('Seçilen tarih aralığında indirilecek kayıt bulunamadı.');
                return;
            }

            const exportGroupsMap = new Map<string, VehicleUsage[]>();

            exportableRecords.forEach((record) => {
                const dayKey = dayjs(record.given_date).format('YYYY-MM-DD');
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
                        const dateCompare = a.given_date.localeCompare(b.given_date);
                        if (dateCompare !== 0) return dateCompare;
                        return a.given_time.localeCompare(b.given_time);
                    })
                }));

            const headerRow = [
                'Araç',
                'Araç Plakası',
                'Müdür',
                'Müdür Ünvanı',
                'Gidilen Yer',
                'Kapı',
                'Teslim Tarihi',
                'Teslim Saati',
                'İade Tarihi',
                'İade Saati',
                'Teslim Eden',
                'Teslim Alan',
                'Durum',
                'Açıklama'
            ];

            const worksheetColumnWidths = [18, 16, 20, 16, 24, 12, 14, 12, 14, 12, 18, 18, 14, 32];

            await exportRecordsToExcelAndZip<VehicleUsage>({
                exportGroups,
                headerRow,
                columnWidths: worksheetColumnWidths,
                mapRecordToRow: (record) => [
                    record.vehicle,
                    record.vehicle_plate,
                    record.manager,
                    record.manager_title,
                    record.destination || '-',
                    record.gate || '-',
                    formatDate(record.given_date),
                    formatTime(record.given_time),
                    record.return_date ? formatDate(record.return_date) : '-',
                    record.return_time ? formatTime(record.return_time) : '-',
                    record.given_by || '-',
                    record.returned_by || '-',
                    record.status === 'in_use' ? 'Kullanımda' : 'Teslim Alındı',
                    record.notes || '-'
                ],
                sheetName: 'Araç Kayıtları',
                filePrefix: 'Arac_Kayitlari_',
                zipNamePrefix: 'Arac_Kayitlari'
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
            vehicle_plate: '',
            manager: '',
            destination: '',
            given_by: '',
            returned_by: '',
            status: 'all',
            gate: 'all',
            givenDateStart: '',
            givenDateEnd: '',
            returnDateStart: '',
            returnDateEnd: ''
        });
    };

    const resetForm = useCallback(() => {
        setFormData(INITIAL_FORM_DATA);
        setShowCustomManager(false);
    }, []);

    const openEditModal = useCallback((usage: VehicleUsage) => {
        setEditingUsage(usage);

        const vehicleMatch = vehicles.find(v => v.plate === usage.vehicle_plate);
        const vehicleId = vehicleMatch?.id || '';

        const managerMatch = managers.find(m =>
            `${m.first_name} ${m.last_name}` === usage.manager
        );
        const managerId = managerMatch?.id || '';

        setFormData({
            vehicle_id: vehicleId,
            manager_id: managerId,
            manager_name: managerId ? '' : (usage.manager || ''),
            destination: usage.destination || '',
            notes: usage.notes || '',
            given_time: usage.given_time ? formatTime(usage.given_time) : '',
            return_time: usage.return_time ? formatTime(usage.return_time) : ''
        });

        setShowCustomManager(!managerId);
        setShowEditModal(true);
    }, [vehicles, managers]);

    const handleEditSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUsage) return;

        try {
            await api.put(`/vehicles/records/${editingUsage.id}`, {
                vehicle_id: formData.vehicle_id,
                manager_id: formData.manager_id || null,
                manager_name: formData.manager_name || null,
                destination: formData.destination,
                notes: formData.notes || null,
                given_time: formData.given_time || null,
                return_time: formData.return_time || null
            });
            setShowEditModal(false);
            setEditingUsage(null);
            resetForm();
            fetchData(0, false);
            message.success('Kayıt başarıyla güncellendi');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            message.error(err.response?.data?.message || 'İşlem başarısız');
        }
    }, [formData, editingUsage, fetchData, resetForm]);

    const handleDeleteRecord = async (id: string) => {
        Modal.confirm({
            title: 'Kaydı Sil',
            content: 'Bu kaydı silmek istediğinize emin misiniz?',
            okText: 'Evet',
            cancelText: 'Hayır',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await api.delete(`/vehicles/records/${id}`);
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
                    await api.post(`/vehicles/records/${id}/restore`);
                    setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: null } : record));
                    message.success('Kayıt geri alındı');
                } catch (error) {
                    console.error('Kayıt geri alınamadı:', error);
                    message.error('Kayıt geri alınırken bir hata oluştu');
                }
            }
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

    useEffect(() => {
        if (!infoMessage) return;
        const t = setTimeout(() => setInfoMessage(null), 3000);
        return () => clearTimeout(t);
    }, [infoMessage]);

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
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Araç Kayıtları</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Tüm geçmiş kayıtları görüntüleyin ve filtreleyin</p>
                            </div>
                        </div>
                        <div className="w-full lg:w-auto flex justify-start lg:justify-end gap-3">
                            <button
                                onClick={handleDownloadRecords}
                                disabled={isExporting || loading || filteredRecords.length === 0}
                                className="flex lg:flex-1 lg:flex-none items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg transition shadow-md hover:shadow-lg text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
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
                                onClick={() => navigate('/admin/manage-vehicles')}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 text-sm sm:text-base w-full sm:w-auto"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                                Araç Ekle / Sil
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 pb-14 flex flex-col gap-4 overflow-hidden">
                {infoMessage && (
                    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
                        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-md text-sm">{infoMessage}</div>
                    </div>
                )}
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
                            <label className="block text-xs font-medium text-gray-700 mb-1">Araç Plakası</label>
                            <select
                                value={filters.vehicle_plate}
                                onChange={(e) => setFilters({ ...filters, vehicle_plate: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Tüm Araçlar</option>
                                {vehicles.map(vehicle => (
                                    <option key={vehicle.id} value={vehicle.plate}>{vehicle.plate}</option>
                                ))}
                            </select>
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Teslim Edilen</label>
                            <input
                                type="text"
                                value={filters.manager}
                                onChange={(e) => setFilters({ ...filters, manager: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Gidilen Yer</label>
                            <input
                                type="text"
                                value={filters.destination}
                                onChange={(e) => setFilters({ ...filters, destination: e.target.value })}
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
                                <option value="in_use">Kullanımda</option>
                                <option value="returned">Teslim Alındı</option>
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

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Teslim Eden</label>
                            <input
                                type="text"
                                value={filters.given_by}
                                onChange={(e) => setFilters({ ...filters, given_by: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Teslim Alan</label>
                            <input
                                type="text"
                                value={filters.returned_by}
                                onChange={(e) => setFilters({ ...filters, returned_by: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Teslim Tarihi</label>
                            <RangePicker
                                value={[
                                    filters.givenDateStart ? dayjs(filters.givenDateStart) : null,
                                    filters.givenDateEnd ? dayjs(filters.givenDateEnd) : null
                                ]}
                                onChange={(dates) => {
                                    if (!dates || (!dates[0] && !dates[1])) {
                                        setFilters({
                                            ...filters,
                                            givenDateStart: '',
                                            givenDateEnd: ''
                                        });
                                    } else if (dates[0] && dates[1]) {
                                        setFilters({
                                            ...filters,
                                            givenDateStart: dates[0].format('YYYY-MM-DD'),
                                            givenDateEnd: dates[1].format('YYYY-MM-DD')
                                        });
                                    } else if (dates[0] && !dates[1]) {
                                        const singleDate = dates[0].format('YYYY-MM-DD');
                                        setFilters({
                                            ...filters,
                                            givenDateStart: singleDate,
                                            givenDateEnd: singleDate
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
                            <label className="block text-xs font-medium text-gray-700 mb-1">İade Tarihi</label>
                            <RangePicker
                                value={[
                                    filters.returnDateStart ? dayjs(filters.returnDateStart) : null,
                                    filters.returnDateEnd ? dayjs(filters.returnDateEnd) : null
                                ]}
                                onChange={(dates) => {
                                    if (!dates || (!dates[0] && !dates[1])) {
                                        setFilters({
                                            ...filters,
                                            returnDateStart: '',
                                            returnDateEnd: ''
                                        });
                                    } else if (dates[0] && dates[1]) {
                                        setFilters({
                                            ...filters,
                                            returnDateStart: dates[0].format('YYYY-MM-DD'),
                                            returnDateEnd: dates[1].format('YYYY-MM-DD')
                                        });
                                    } else if (dates[0] && !dates[1]) {
                                        const singleDate = dates[0].format('YYYY-MM-DD');
                                        setFilters({
                                            ...filters,
                                            returnDateStart: singleDate,
                                            returnDateEnd: singleDate
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

                {/* Records Table */}
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
 
                                    <table className="w-full min-w-[1300px] table-auto divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-10 z-10">
                                            <tr>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Araç</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Müdür</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Gidilen Yer</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Kapı</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Teslim Tarihi</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">İade Tarihi</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Teslim Eden</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Teslim Alan</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                                                <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Açıklama</th>
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
                                                                    icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.306 7H18" /></svg>}
                                                                />
                                                            ) : (
                                                                <>
                                                                    <CompactActionButton
                                                                        onClick={() => openEditModal(record)}
                                                                        variant="primary"
                                                                        label="Düzenle"
                                                                        icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
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
                                                        <div className="text-xs font-bold text-gray-900">{record.vehicle_plate}</div>
                                                        <div className="text-[10px] text-gray-500">{record.vehicle_brand}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900 whitespace-nowrap">{record.manager || '-'}</div>
                                                        <div className="text-[10px] text-gray-500">{record.manager_title}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900 whitespace-nowrap">{record.destination || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900 whitespace-nowrap">{record.gate || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900">{formatDate(record.given_date)}</div>
                                                        <div className="text-[10px] text-gray-500">{formatTime(record.given_time)}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        {record.return_date ? (
                                                            <>
                                                                <div className="text-xs text-gray-900">{formatDate(record.return_date)}</div>
                                                                <div className="text-[10px] text-gray-500">{formatTime(record.return_time)}</div>
                                                            </>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900 whitespace-nowrap">{record.given_by || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        <div className="text-xs text-gray-900 whitespace-nowrap">{record.returned_by || '-'}</div>
                                                    </td>
                                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                                        {record.deleted_at ? (
                                                            <span className="px-2 py-0.5 inline-flex whitespace-nowrap text-[10px] leading-5 font-semibold rounded-full bg-red-100 text-red-700">
                                                                Silindi
                                                            </span>
                                                        ) : record.status === 'in_use' ? (
                                                            <span className="px-2 py-0.5 inline-flex whitespace-nowrap text-[10px] leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                                                                Kullanımda
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 inline-flex whitespace-nowrap text-[10px] leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                                Teslim Alındı
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 pr-6">
                                                        {renderPreviewText(record.notes, 'Açıklama')}
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

            {showEditModal && editingUsage && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    Araç Kaydını Düzenle
                                </h2>
                                <button
                                    onClick={() => { setShowEditModal(false); setEditingUsage(null); resetForm(); }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleEditSubmit} className="space-y-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Araç Seçin <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            required
                                            value={formData.vehicle_id}
                                            onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                                            disabled={editingUsage?.status === 'returned'}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                        >
                                            <option value="">Araç seçiniz...</option>
                                            {vehicles.map(vehicle => (
                                                <option key={vehicle.id} value={vehicle.id}>
                                                    {vehicle.plate} - {vehicle.brand}
                                                </option>
                                            ))}
                                        </select>
                                        {editingUsage?.status === 'returned' && (
                                            <p className="text-xs text-gray-500 mt-1">
                                                Teslim alınmış kayıtlarda araç değiştirilemez
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Aracı Alan Müdür <span className="text-red-500">*</span>
                                        </label>
                                        {!showCustomManager ? (
                                            <>
                                                <select
                                                    required={!showCustomManager}
                                                    value={formData.manager_id}
                                                    onChange={(e) => {
                                                        if (e.target.value === 'custom') {
                                                            setShowCustomManager(true);
                                                            setFormData({ ...formData, manager_id: '', manager_name: '' });
                                                        } else {
                                                            setFormData({ ...formData, manager_id: e.target.value, manager_name: '' });
                                                        }
                                                    }}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                >
                                                    <option value="">Müdür seçiniz...</option>
                                                    {managers.map(manager => (
                                                        <option key={manager.id} value={manager.id}>
                                                            {manager.first_name} {manager.last_name} - {manager.title}
                                                        </option>
                                                    ))}
                                                    <option value="custom">🔽 Listede Yok - Elle Gir</option>
                                                </select>
                                            </>
                                        ) : (
                                            <div className="space-y-2">
                                                <input
                                                    type="text"
                                                    required={showCustomManager}
                                                    value={formData.manager_name}
                                                    onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                                                    placeholder="Müdür adı soyadı"
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowCustomManager(false);
                                                        setFormData({ ...formData, manager_id: '', manager_name: '' });
                                                    }}
                                                    className="text-sm text-blue-600 hover:text-blue-800"
                                                >
                                                    ← Listeye Dön
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Gidilen Yer <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.destination}
                                            onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                                            placeholder="Örn: Havalimanı, Şehir Merkezi"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Teslim Saati
                                        </label>
                                        <input
                                            type="time"
                                            value={formData.given_time}
                                            onChange={(e) => setFormData({ ...formData, given_time: e.target.value })}
                                            step="60"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            style={{ colorScheme: 'light' }}
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Boş bırakırsanız mevcut saat korunur
                                        </p>
                                    </div>

                                    {editingUsage && editingUsage.status === 'returned' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Teslim Alınma Saati
                                            </label>
                                            <input
                                                type="time"
                                                value={formData.return_time}
                                                onChange={(e) => setFormData({ ...formData, return_time: e.target.value })}
                                                step="60"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                style={{ colorScheme: 'light' }}
                                            />
                                            <p className="text-xs text-gray-500 mt-1">
                                                Boş bırakırsanız mevcut saat korunur
                                            </p>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Açıklama / Not
                                        </label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            rows={3}
                                            placeholder="Kullanım amacı, ek notlar..."
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition"
                                    >
                                        Güncelle
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowEditModal(false); setEditingUsage(null); resetForm(); }}
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
