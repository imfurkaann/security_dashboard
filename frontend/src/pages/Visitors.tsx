import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate, formatTime, isToday } from '../utils/dateUtils';
import { validateVisitorForm, normalizePlate, normalizePhone, formatPhoneNumber } from '../utils/validation';
import type { VisitorRecord, VisitorFormData, VisitorFilterType } from '../types';
import ActionButton from '../components/ActionButton';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import { message, Modal } from 'antd';
import 'antd/dist/reset.css';

// Tag options for dropdowns
const VISITOR_TAGS_OPTIONS = [
    { id: 'subcontractor_worker', label: 'Taşeron İşçi' },
    { id: 'for_electric_station', label: 'Şarj İstasyonu' },
    { id: 'daily_guest', label: 'Günübirlik Misafir' },
    { id: 'entry_tag', label: 'Giriş' },
    { id: 'exit_tag', label: 'Çıkış' },
    { id: 'tour_entry', label: 'Tur Giriş' },
    { id: 'tour_exit', label: 'Tur Çıkış' },
    { id: 'meeting', label: 'Görüşme' },
    { id: 'delivery', label: 'Teslimat' },
];

const PARKING_CAPACITY_STORAGE_KEY = 'adminParkingCapacity';
const PARKING_RESERVED_STORAGE_KEY = 'adminParkingReserved';

const normalizeSearchText = (value: string | null | undefined): string => {
    return (value || '').toLocaleLowerCase('tr-TR').normalize('NFC');
};

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

const VISITOR_HIGHLIGHT_OPTIONS = [
    { value: 'none', label: 'Varsayılan', color: '#f3f4f6' },
    { value: 'rose', label: 'Gül Kırmızısı', color: '#e11d48' },
    { value: 'amber', label: 'Sarı', color: '#d97706' },
    { value: 'emerald', label: 'Yeşil', color: '#059669' },
    { value: 'sky', label: 'Mavi', color: '#0284c7' },
    { value: 'violet', label: 'Mor', color: '#7c3aed' },
    { value: 'orange', label: 'Turuncu', color: '#ea580c' },
    { value: 'pink', label: 'Pembe', color: '#db2777' },
    { value: 'brown', label: 'Kahverengi', color: '#92400e' },
] as const;

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

// Initial form state
const INITIAL_FORM_DATA: VisitorFormData = {
    vehicle_plate: '',
    full_name: '',
    company_name: '',
    visiting_person: '',
    person_count: '',
    children_count: '',
    phone: '',
    notes: '',
    highlight_color: 'none',
    subcontractor_worker: false,
    for_electric_station: false,
    daily_guest: false,
    entry_tag: false,
    exit_tag: false,
    tour_entry: false,
    tour_exit: false,
    meeting: false,
    delivery: false,
    send_whatsapp: true,
    entry_time: '',  // Boş string = mevcut saat kullanılacak
    exit_time: ''
};

export default function Visitors() {
    const WHATSAPP_AUTO_SEND_TIMEOUT_MS = 20000;
    const [records, setRecords] = useState<VisitorRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [whatsappMessage, setWhatsappMessage] = useState('');
    const [autoSendFailed, setAutoSendFailed] = useState(false);
    const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<VisitorFilterType>('today');
    const [columnFilters, setColumnFilters] = useState({
        fullName: '',
        vehiclePlate: '',
        companyName: '',
        visitingPerson: ''
    });
    const [formData, setFormData] = useState<VisitorFormData>(INITIAL_FORM_DATA);
    const [textPreview, setTextPreview] = useState<{ title: string; value: string } | null>(null);
    const [scrollbarSpacerWidth, setScrollbarSpacerWidth] = useState(0);
    const [openTagsDropdown, setOpenTagsDropdown] = useState(false);
    const navigate = useNavigate();
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);

    // Fetch visitor records
    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/visitors/records?includeDeleted=true');
            setRecords(res.data || []);
        } catch (err) {
            console.error('Ziyaretçi verisi yüklenemedi', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const refreshRecordsWithRealtimeNotification = useCallback(async () => {
        if (document.hidden) return;

        try {
            const res = await api.get('/visitors/records?includeDeleted=true');
            const nextRecords: VisitorRecord[] = res.data || [];
            setRecords(nextRecords);
        } catch (error) {
            console.error('Ziyaretçi canlı yenileme hatası:', error);
        }
    }, []);

    useRealtimeRefetch({
        topics: ['visitors'],
        onMutation: refreshRecordsWithRealtimeNotification,
    });

    useEffect(() => {
        // Websocket baglantisi ag/proxy nedeniyle koparsa, sayfayi arka planda taze tut.
        const intervalId = window.setInterval(() => {
            void refreshRecordsWithRealtimeNotification();
        }, 7000);

        const handleFocus = () => {
            void refreshRecordsWithRealtimeNotification();
        };

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                void refreshRecordsWithRealtimeNotification();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [refreshRecordsWithRealtimeNotification]);

    // Reset form to initial state
    const resetForm = useCallback(() => {
        setFormData(INITIAL_FORM_DATA);
        setIsEditing(false);
        setEditingId(null);
        setOpenTagsDropdown(false);
    }, []);

    // Open modal for new record
    const openModalForNew = useCallback(() => {
        resetForm();
        setOpenTagsDropdown(false);
        setShowModal(true);
    }, [resetForm]);

    // Open modal for editing
    const openModalForEdit = useCallback((rec: VisitorRecord) => {
        setFormData({
            vehicle_plate: rec.vehicle_plate || '',
            full_name: rec.full_name || '',
            company_name: rec.company_name || '',
            visiting_person: rec.visiting_person || '',
            person_count: rec.person_count ?? '',
            children_count: rec.children_count ?? 0,
            phone: rec.phone || '',
            notes: rec.notes || '',
            highlight_color: rec.highlight_color || 'none',
            subcontractor_worker: rec.subcontractor_worker ?? false,
            for_electric_station: rec.for_electric_station ?? false,
            daily_guest: rec.daily_guest ?? false,
            entry_tag: rec.entry_tag ?? false,
            exit_tag: rec.exit_tag ?? false,
            tour_entry: rec.tour_entry ?? false,
            tour_exit: rec.tour_exit ?? false,
            meeting: rec.meeting ?? false,
            delivery: rec.delivery ?? false,
            send_whatsapp: false,  // WhatsApp sadece yeni kayıtlarda kullanılır
            entry_time: rec.entry_time ? formatTime(rec.entry_time) : '',  // HH:MM formatına çevir
            exit_time: rec.exit_time ? formatTime(rec.exit_time) : ''  // HH:MM formatına çevir
        });
        setIsEditing(true);
        setEditingId(rec.id);
        setOpenTagsDropdown(false);
        setShowModal(true);
    }, []);

    // Build payload from form data
    const buildPayload = useCallback(() => ({
        vehicle_plate: normalizePlate(formData.vehicle_plate) || null,
        full_name: formData.full_name?.trim() || null,
        company_name: formData.company_name?.trim() || null,
        visiting_person: formData.visiting_person?.trim() || null,
        person_count: formData.person_count === '' ? null : Number(formData.person_count),
        children_count: formData.children_count === '' ? 0 : Number(formData.children_count),
        phone: normalizePhone(formData.phone) || null,
        notes: formData.notes?.trim() || null,
        highlight_color: formData.highlight_color || 'none',
        subcontractor_worker: !!formData.subcontractor_worker,
        for_electric_station: !!formData.for_electric_station,
        daily_guest: !!formData.daily_guest,
        entry_tag: !!formData.entry_tag,
        exit_tag: !!formData.exit_tag,
        tour_entry: !!formData.tour_entry,
        tour_exit: !!formData.tour_exit,
        meeting: !!formData.meeting,
        delivery: !!formData.delivery,
        send_whatsapp: !!formData.send_whatsapp,  // WhatsApp modalı her yeni kayıtta otomatik açılsın (kullanıcının seçimine göre)
        entry_time: formData.entry_time || null,  // Giriş saati
        exit_time: formData.exit_time || null  // Çıkış saati
    }), [formData]);

    // Form submission handler
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        // Frontend validasyon
        const validation = validateVisitorForm(formData);
        if (!validation.isValid) {
            Modal.error({
                title: 'Lütfen hataları düzeltin',
                content: (
                    <ul className="list-disc pl-4 mt-2">
                        {validation.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                        ))}
                    </ul>
                )
            });
            return;
        }

        try {
            const payload = buildPayload();

            if (isEditing && editingId) {
                await api.put(`/visitors/records/${editingId}`, payload);
                message.success('Ziyaretçi kaydı başarıyla güncellendi');
            } else {
                const response = await api.post('/visitors/records', payload);

                // WhatsApp mesajı varsa modal göster
                if (response.data?.whatsappMessage) {
                    setWhatsappMessage(response.data.whatsappMessage);
                    setAutoSendFailed(false);
                    setShowWhatsAppModal(true);
                } else {
                    message.success('Ziyaretçi kaydı başarıyla oluşturuldu');
                }
            }

            setShowModal(false);
            resetForm();
            fetchData();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            message.error(err?.response?.data?.message || 'İşlem başarısız');
        }
    }, [formData, buildPayload, isEditing, editingId, resetForm, fetchData]);

    // Handle visitor exit
    const handleExit = useCallback(async (id: string) => {
        Modal.confirm({
            title: 'Çıkış Yap',
            content: 'Ziyaretçinin çıkışını kaydetmek istediğinize emin misiniz?',
            okText: 'Evet',
            cancelText: 'Hayır',
            onOk: async () => {
                try {
                    const response = await api.post(`/visitors/records/${id}/exit`, { exit_time: null });
                    fetchData();

                    // WhatsApp mesajı varsa modal göster
                    if (response.data?.whatsappMessage) {
                        setWhatsappMessage(response.data.whatsappMessage);
                        setAutoSendFailed(false);
                        setShowWhatsAppModal(true);
                    } else {
                        message.success('Ziyaretçi çıkışı kaydedildi');
                    }
                } catch (error) {
                    const err = error as { response?: { data?: { message?: string } } };
                    message.error(err?.response?.data?.message || 'Çıkış kaydı başarısız');
                }
            }
        });
    }, [fetchData]);

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
                    setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: new Date().toISOString() } : record));
                    message.success('Kayıt silindi');
                } catch (error) {
                    const err = error as { response?: { data?: { message?: string } } };
                    message.error(err?.response?.data?.message || 'Kayıt silinemedi');
                }
            }
        });
    }, []);

    const handleRestoreRecord = useCallback(async (id: string) => {
        try {
            await api.post(`/visitors/records/${id}/restore`);
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: null } : record));
            message.success('Kayıt geri alındı');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            message.error(err?.response?.data?.message || 'Kayıt geri alınamadı');
        }
    }, []);

    const handleUndoExit = useCallback(async (id: string) => {
        Modal.confirm({
            title: 'Çıkışı Geri Al',
            content: 'Bu çıkışı geri almak istediğinize emin misiniz?',
            okText: 'Evet',
            cancelText: 'Hayır',
            onOk: async () => {
                try {
                    await api.post(`/visitors/records/${id}/undo-exit`);
                    setRecords(prev => prev.map(record => record.id === id
                        ? { ...record, status: 'inside', exit_date: null, exit_time: null, exit_by: null }
                        : record
                    ));
                    message.success('Çıkış işlemi geri alındı');
                } catch (error) {
                    const err = error as { response?: { data?: { message?: string } } };
                    message.error(err?.response?.data?.message || 'Çıkış geri alınamadı');
                }
            }
        });
    }, []);

    const handleSendWhatsAppAutomatic = useCallback(async () => {
        setSendingWhatsApp(true);
        try {
            const response = await api.post('/visitors/send-whatsapp-message', {
                message: whatsappMessage,
            }, {
                timeout: WHATSAPP_AUTO_SEND_TIMEOUT_MS,
            });

            if (response.data?.success) {
                setShowWhatsAppModal(false);
                setAutoSendFailed(false);
                message.success('WhatsApp mesajı gönderildi');
            } else {
                setAutoSendFailed(true);
                const errorCode = response.data?.errorCode || 'WHATSAPP_SEND_FAILED';
                const reason = response.data?.reason || 'Bilinmeyen hata';
                const debugRef = response.data?.debugId ? ` Referans: ${response.data.debugId}` : '';
                message.error(`Otomatik gönderim başarısız (${errorCode}): ${reason}.${debugRef} Lütfen Manuel Mesaj Gönder butonunu kullanın.`);
            }
        } catch (error: any) {
            setAutoSendFailed(true);
            const isTimeout = error?.code === 'ECONNABORTED';
            const details = isTimeout
                ? 'Otomatik gönderim zaman aşımına uğradı.'
                : (error.response?.data?.message || error.message);
            message.error(`WhatsApp mesajı gönderilemedi: ${details} Lütfen Manuel Mesaj Gönder butonunu kullanın.`);
        } finally {
            setSendingWhatsApp(false);
        }
    }, [whatsappMessage]);

    const handleSendWhatsAppManual = useCallback(() => {
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
        setAutoSendFailed(false);
        setShowWhatsAppModal(false);
    }, [whatsappMessage]);

    const nonDeletedRecords = useMemo(() => records.filter(record => !record.deleted_at), [records]);
    const todayDeletedRecords = useMemo(
        () => records.filter(record => Boolean(record.deleted_at) && isToday(record.deleted_at)),
        [records]
    );

    // Memoized statistics
    const stats = useMemo(() => ({
        insideCount: nonDeletedRecords.filter(r => r.status === 'inside').length,
        todayEntries: nonDeletedRecords.filter(r => isToday(r.entry_date)).length,
        subcontractorCount: nonDeletedRecords.filter(r => r.status === 'inside' && r.subcontractor_worker).length,
        electricStationCount: nonDeletedRecords.filter(r => r.status === 'inside' && r.for_electric_station).length,
        dailyGuestCount: nonDeletedRecords.filter(r => r.status === 'inside' && r.daily_guest).length,
        entryTagCount: nonDeletedRecords.filter(r => r.entry_tag || r.tour_entry).length,
        exitTagCount: nonDeletedRecords.filter(r => r.exit_tag || r.tour_exit).length,
    }), [nonDeletedRecords]);

    const visitorVehicleCount = useMemo(() => {
        const uniquePlates = new Set<string>();

        nonDeletedRecords.forEach((record) => {
            if (record.status !== 'inside') return;

            const normalizedPlate = normalizePlate(record.vehicle_plate || '');
            const compactPlate = (normalizedPlate || '').replace(/\s+/g, '').toLocaleUpperCase('tr-TR');

            if (!compactPlate || compactPlate === 'YAYA') return;
            if (compactPlate.length < 4 || compactPlate.length > 12) return;
            if (!/[A-ZÇĞİÖŞÜ]/.test(compactPlate) || !/\d/.test(compactPlate)) return;

            uniquePlates.add(compactPlate);
        });

        return uniquePlates.size;
    }, [nonDeletedRecords]);

    const parkingCapacity = useMemo(() => {
        const rawValue = localStorage.getItem(PARKING_CAPACITY_STORAGE_KEY);
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue) || numericValue < 0) {
            return null;
        }
        return Math.floor(numericValue);
    }, []);

    const parkingReserved = useMemo(() => {
        const rawValue = localStorage.getItem(PARKING_RESERVED_STORAGE_KEY);
        const numericValue = Number(rawValue);
        if (!Number.isFinite(numericValue) || numericValue < 0) {
            return 0;
        }
        return Math.floor(numericValue);
    }, []);

    const parkingOccupancyValue = useMemo(() => {
        const totalOccupied = visitorVehicleCount + parkingReserved;
        if (parkingCapacity === null) {
            return `${totalOccupied}/-`;
        }
        return `${totalOccupied}/${parkingCapacity}`;
    }, [visitorVehicleCount, parkingReserved, parkingCapacity]);

    // Memoized filtered records
    const filteredRecords = useMemo(() => {
        const normalizedFullName = normalizeSearchText(columnFilters.fullName.trim());
        const normalizedPlate = normalizeSearchText(normalizePlate(columnFilters.vehiclePlate.trim()) || '');
        const normalizedCompany = normalizeSearchText(columnFilters.companyName.trim());
        const normalizedVisitingPerson = normalizeSearchText(columnFilters.visitingPerson.trim());

        const sourceRecords = filter === 'deleted' ? todayDeletedRecords : nonDeletedRecords;

        return sourceRecords.filter(r => {
            const matchesTopFilter = (() => {
                if (filter === 'today') return isToday(r.entry_date) || (r.exit_date && isToday(r.exit_date));
                if (filter === 'inside') return r.status === 'inside';
                if (filter === 'subcontractor') return r.status === 'inside' && r.subcontractor_worker;
                if (filter === 'electric') return r.status === 'inside' && r.for_electric_station;
                if (filter === 'daily_guest') return r.status === 'inside' && r.daily_guest;
                if (filter === 'entry_tag') return Boolean(r.entry_tag || r.tour_entry);
                if (filter === 'exit_tag') return Boolean(r.exit_tag || r.tour_exit);
                if (filter === 'deleted') return true;
                return true;
            })();

            if (!matchesTopFilter) return false;

            if (normalizedFullName && !normalizeSearchText(r.full_name).includes(normalizedFullName)) {
                return false;
            }

            if (normalizedPlate) {
                const recordPlate = normalizeSearchText(normalizePlate(r.vehicle_plate || '') || '');
                if (!recordPlate.includes(normalizedPlate)) {
                    return false;
                }
            }

            if (normalizedCompany && !normalizeSearchText(r.company_name).includes(normalizedCompany)) {
                return false;
            }

            if (normalizedVisitingPerson && !normalizeSearchText(r.visiting_person).includes(normalizedVisitingPerson)) {
                return false;
            }

            return true;
        });
    }, [nonDeletedRecords, todayDeletedRecords, filter, columnFilters]);

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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 sm:py-2">
                    <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <button onClick={() => navigate('/dashboard')} className="p-1.5 hover:bg-slate-800 rounded-lg transition shrink-0">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-lg sm:text-xl font-bold text-white leading-tight break-words">Otel Ziyaretçi Kayıt Sayfası</h1>
                                <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">Otel ziyaretçi kayıtlarını yönetin</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:flex gap-2 w-full lg:w-auto">
                            <button
                                onClick={() => navigate('/visitor-records')}
                                className="flex items-center justify-center gap-1.5 bg-slate-600 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg transition shadow-sm text-xs sm:text-sm font-semibold"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                Kayıt Filtrele
                            </button>
                            <button onClick={openModalForNew} className="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition shadow-sm text-xs sm:text-sm font-semibold">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Yeni Kayıt
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-3 pb-14 flex flex-col gap-3">
                <div className="w-full">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mb-2.5">
                        <div className="rounded-xl shadow-sm p-2.5 border border-blue-500 bg-gradient-to-br from-blue-500 to-blue-700">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-400/30 rounded-lg border border-blue-300/60 shrink-0 text-white">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-bold text-white/95 uppercase tracking-wider">İçerideki Ziyaretçi</span>
                                </div>
                                <span className="text-xl font-extrabold text-white">{stats.insideCount}</span>
                            </div>
                        </div>

                        <div className="rounded-xl shadow-sm p-2.5 border border-emerald-500 bg-gradient-to-br from-emerald-500 to-emerald-700">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-emerald-400/30 rounded-lg border border-emerald-300/60 shrink-0 text-white">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-bold text-white/95 uppercase tracking-wider">Bugün Giriş Yapan</span>
                                </div>
                                <span className="text-xl font-extrabold text-white">{stats.todayEntries}</span>
                            </div>
                        </div>

                        <div className="rounded-xl shadow-sm p-2.5 border border-amber-500 bg-gradient-to-br from-amber-500 to-orange-700">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-amber-400/30 rounded-lg border border-amber-300/60 shrink-0 text-white">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13l1-3a2 2 0 011.9-1.37h12.2A2 2 0 0120 10l1 3M5 13h14M6 16a1 1 0 100 2 1 1 0 000-2zm12 0a1 1 0 100 2 1 1 0 000-2zM5 13v5m14-5v5" />
                                        </svg>
                                    </div>
                                    <span className="text-xs font-bold text-white/95 uppercase tracking-wider">Otopark Doluluk</span>
                                </div>
                                <span className="text-xl font-extrabold text-white">{parkingOccupancyValue}</span>
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="bg-white rounded-lg shadow px-3 py-1.5 mb-2.5 w-full">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <button onClick={() => setFilter('today')} className={`px-3 py-1 rounded-md transition text-xs sm:text-sm ${filter === 'today' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                Bugünün Kayıtları ({nonDeletedRecords.filter(r => isToday(r.entry_date) || (r.exit_date && isToday(r.exit_date))).length})
                            </button>
                            <button onClick={() => setFilter('inside')} className={`px-3 py-1 rounded-md transition text-xs sm:text-sm ${filter === 'inside' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                Aktif İçeridekiler ({stats.insideCount})
                            </button>
                            <button onClick={() => setFilter('subcontractor')} className={`px-3 py-1 rounded-md transition text-xs sm:text-sm ${filter === 'subcontractor' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                Taşeron İşçiler ({stats.subcontractorCount})
                            </button>
                            <button onClick={() => setFilter('electric')} className={`px-3 py-1 rounded-md transition text-xs sm:text-sm ${filter === 'electric' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                Şarj İstasyonu ({stats.electricStationCount})
                            </button>
                            <button onClick={() => setFilter('daily_guest')} className={`px-3 py-1 rounded-md transition text-xs sm:text-sm ${filter === 'daily_guest' ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                Günübirlik Misafir ({stats.dailyGuestCount})
                            </button>
                            <button onClick={() => setFilter('entry_tag')} className={`px-3 py-1 rounded-md transition text-xs sm:text-sm ${filter === 'entry_tag' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                Giriş ({stats.entryTagCount})
                            </button>
                            <button onClick={() => setFilter('exit_tag')} className={`px-3 py-1 rounded-md transition text-xs sm:text-sm ${filter === 'exit_tag' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                Çıkış ({stats.exitTagCount})
                            </button>
                            <button onClick={() => setFilter('deleted')} className={`px-3 py-1 rounded-md transition text-xs sm:text-sm ${filter === 'deleted' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                Silinen Kayıtlar ({todayDeletedRecords.length})
                            </button>
                        </div>

                        <div className="mt-2 border-t border-gray-200 pt-2">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">İsim Soyisim</label>
                                    <input
                                        type="text"
                                        value={columnFilters.fullName}
                                        onChange={(e) => setColumnFilters((prev) => ({ ...prev, fullName: e.target.value }))}
                                        placeholder="İsim soyisim ara..."
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Araç Plaka</label>
                                    <input
                                        type="text"
                                        value={columnFilters.vehiclePlate}
                                        onChange={(e) => setColumnFilters((prev) => ({ ...prev, vehiclePlate: e.target.value }))}
                                        placeholder="Plaka ara..."
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Firma</label>
                                    <input
                                        type="text"
                                        value={columnFilters.companyName}
                                        onChange={(e) => setColumnFilters((prev) => ({ ...prev, companyName: e.target.value }))}
                                        placeholder="Firma ara..."
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Ziyaret Edilen</label>
                                    <input
                                        type="text"
                                        value={columnFilters.visitingPerson}
                                        onChange={(e) => setColumnFilters((prev) => ({ ...prev, visitingPerson: e.target.value }))}
                                        placeholder="Ziyaret edilen ara..."
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Table (large bordered, scrollable container) */}
                </div>

                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 overflow-visible">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500">Kayıt bulunmuyor</p>
                        </div>
                    ) : (
                        <div ref={tableScrollRef} onScroll={syncTableScroll} className="overflow-x-auto scrollbar-hide overflow-y-auto pb-2">
                            <div>
                                <table className="w-full min-w-[1250px] table-auto divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="w-[245px] px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">İşlem</th>
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
                                            <th className="px-3 py-2.5 whitespace-nowrap w-[180px] text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Açıklama</th>
                                            <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                                            <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Giriş Yapan</th>
                                            <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Çıkış Yapan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredRecords.map(rec => (
                                            <tr key={rec.id} className={`hover:bg-gray-50 ${rec.deleted_at ? 'opacity-60' : ''}`} style={getVisitorRowStyle(rec)}>
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
                                                        {rec.deleted_at ? (
                                                            <CompactActionButton
                                                                onClick={() => handleRestoreRecord(rec.id)}
                                                                variant="success"
                                                                icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>}
                                                                label="Geri Al"
                                                            />
                                                        ) : (
                                                            <>
                                                                <CompactActionButton
                                                                    onClick={() => openModalForEdit(rec)}
                                                                    variant="primary"
                                                                    icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>}
                                                                    label="Düzenle"
                                                                />
                                                                {rec.status === 'inside' && (
                                                                    <CompactActionButton
                                                                        onClick={() => handleExit(rec.id)}
                                                                        variant="success"
                                                                        icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>}
                                                                        label="Çıkış Yap"
                                                                    />
                                                                )}
                                                                {rec.status === 'exited' && (
                                                                    <CompactActionButton
                                                                        onClick={() => handleUndoExit(rec.id)}
                                                                        variant="success"
                                                                        icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>}
                                                                        label="Geri Al"
                                                                    />
                                                                )}
                                                                <CompactActionButton
                                                                    onClick={() => handleDeleteRecord(rec.id)}
                                                                    variant="danger"
                                                                    icon={<svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
                                                                    label="Sil"
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="text-xs text-gray-900">{rec.gate || '-'}</div>
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div>
                                                        <span className="text-xs font-bold text-gray-900">{rec.vehicle_plate || '-'}</span>
                                                    </div>
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div>
                                                        <span className="text-xs font-bold text-gray-900">{rec.full_name || '-'}</span>
                                                    </div>
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="text-xs text-gray-900">{rec.company_name || '-'}</div>
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="text-xs text-gray-900">{rec.visiting_person || '-'}</div>
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="text-xs text-gray-900">{formatDate(rec.entry_date)}</div>
                                                    <div className="text-[10px] text-gray-500">{formatTime(rec.entry_time)}</div>
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    {rec.exit_date ? (
                                                        <>
                                                            <div className="text-xs text-gray-900">{formatDate(rec.exit_date)}</div>
                                                            <div className="text-[10px] text-gray-500">{formatTime(rec.exit_time)}</div>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">-</span>
                                                    )}
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="flex flex-wrap gap-1 max-w-[160px]">
                                                        {getVisitorTags(rec).length > 0 ? (
                                                            getVisitorTags(rec).map((tag, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">-</span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="text-xs text-gray-900">{rec.person_count ?? '-'}</div>
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="text-xs text-gray-900">{rec.children_count ?? 0}</div>
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="text-xs text-gray-900">{formatPhoneNumber(rec.phone)}</div>
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap w-[180px]">
                                                    {renderPreviewText(rec.notes, 'Açıklama')}
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <span className={`px-2 py-0.5 inline-flex text-[11px] leading-5 font-semibold rounded-full ${rec.status === 'inside' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                                        {rec.status === 'inside' ? 'İçeride' : 'Çıkış Yapıldı'}
                                                    </span>
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="text-xs text-gray-900">{rec.entry_by || '-'}</div>
                                                </td>

                                                <td className="px-3 py-2.5 whitespace-nowrap">
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
            </main>

            <div className="fixed bottom-0 left-0 right-0 lg:left-[var(--sidebar-width)] z-40 border-t border-gray-200 bg-white/95 backdrop-blur shadow-[0_-8px_20px_rgba(15,23,42,0.08)]">
                <div ref={bottomScrollRef} onScroll={syncBottomScroll} className="h-5 overflow-x-scroll overflow-y-hidden">
                    <div style={{ width: `${scrollbarSpacerWidth}px`, height: 1 }} />
                </div>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center gap-4 mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">{isEditing ? 'Ziyaretçi Düzenle' : 'Yeni Ziyaretçi'}</h2>
                                <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                        {VISITOR_HIGHLIGHT_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, highlight_color: option.value })}
                                                className={`w-6 h-6 rounded-full border-2 transition ${formData.highlight_color === option.value ? 'border-gray-900 scale-110' : 'border-gray-300'}`}
                                                style={{ backgroundColor: option.color }}
                                                title={option.label}
                                                aria-label={option.label}
                                            />
                                        ))}
                                    </div>
                                        {/* WhatsApp toggle removed from header; placed with other tag checkboxes below */}
                                        <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Ad Soyad</label>
                                        <input value={formData.full_name || ''} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} placeholder="Ziyaretçinin adı soyadı" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Plaka</label>
                                        <input value={formData.vehicle_plate || ''} onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })} placeholder="TR 34 XXX 34" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Firma</label>
                                        <input value={formData.company_name || ''} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} placeholder="Firma adı" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Ziyaret Edilen</label>
                                        <input value={formData.visiting_person || ''} onChange={(e) => setFormData({ ...formData, visiting_person: e.target.value })} placeholder="İsim veya departman" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Kişi Sayısı</label>
                                        <input type="number" value={formData.person_count || ''} onChange={(e) => setFormData({ ...formData, person_count: e.target.value })} placeholder="1" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Çocuk Sayısı</label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={formData.children_count ?? ''}
                                            onChange={(e) => setFormData({ ...formData, children_count: e.target.value })}
                                            placeholder="0"
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Telefon</label>
                                        <input value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="05xx..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Giriş Saati</label>
                                        <input
                                            type="time"
                                            value={formData.entry_time || ''}
                                            onChange={(e) => setFormData({ ...formData, entry_time: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Boş bırakırsanız mevcut saat kullanılır</p>
                                    </div>

                                    {isEditing && records.find(r => r.id === editingId)?.status === 'exited' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Çıkış Saati</label>
                                            <input
                                                type="time"
                                                value={formData.exit_time || ''}
                                                onChange={(e) => setFormData({ ...formData, exit_time: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">Çıkış kaydı için saat belirtebilirsiniz</p>
                                        </div>
                                    )}

                                    {/* Tags Dropdown and Description in a grid */}
                                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Tags Dropdown */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Etiketler</label>
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={() => setOpenTagsDropdown(!openTagsDropdown)}
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left bg-white hover:bg-gray-50 flex justify-between items-center"
                                                >
                                                    <span className="text-sm">
                                                        {[formData.subcontractor_worker && 'Taşeron İşçi', formData.for_electric_station && 'Şarj İstasyonu', formData.daily_guest && 'Günübirlik Misafir', formData.entry_tag && 'Giriş', formData.exit_tag && 'Çıkış', formData.tour_entry && 'Tur Giriş', formData.tour_exit && 'Tur Çıkış', formData.meeting && 'Görüşme', formData.delivery && 'Teslimat'].filter(Boolean).join(', ') || 'Seçiniz...'}
                                                    </span>
                                                    <svg className={`w-5 h-5 transition-transform flex-shrink-0 ${openTagsDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                                    </svg>
                                                </button>
                                                {openTagsDropdown && (
                                                    <div className="absolute z-20 w-full mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                                        {VISITOR_TAGS_OPTIONS.map((option) => (
                                                            <label key={option.id} className="flex items-center px-4 py-2 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!formData[option.id as keyof VisitorFormData]}
                                                                    onChange={(e) => {
                                                                        setFormData({ ...formData, [option.id]: e.target.checked });
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

                                        {/* Description / Notes */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama / Not</label>
                                            <textarea value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} placeholder="Notlar..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                        </div>
                                    </div>

                                    {/* WhatsApp Checkbox */}
                                    <div className="md:col-span-2 flex items-center gap-3">
                                        <label className="inline-flex items-center">
                                            <input type="checkbox" checked={!!formData.send_whatsapp} onChange={(e) => setFormData({ ...formData, send_whatsapp: e.target.checked })} className="mr-2" />
                                            <span className="text-sm">WhatsApp Mesajı Gönder</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition">{isEditing ? 'Güncelle' : 'Kaydet'}</button>
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

            {/* WhatsApp Modal */}
            {showWhatsAppModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">WhatsApp ile Paylaş</h3>
                        </div>

                        <p className="text-gray-600 mb-4">Kayıt başarıyla oluşturuldu. WhatsApp'tan paylaşmak ister misiniz?</p>

                        <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-48 overflow-y-auto">
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{whatsappMessage}</pre>
                        </div>

                        <div className="flex flex-col gap-2">
                            {!autoSendFailed && (
                                <button
                                    type="button"
                                    onClick={handleSendWhatsAppAutomatic}
                                    disabled={sendingWhatsApp}
                                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition"
                                >
                                    {sendingWhatsApp ? 'Gönderiliyor...' : 'Otomatik Mesaj Gönder'}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleSendWhatsAppManual}
                                disabled={sendingWhatsApp}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition"
                            >
                                Manuel Mesaj Gönder
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setAutoSendFailed(false);
                                    setShowWhatsAppModal(false);
                                }}
                                disabled={sendingWhatsApp}
                                className="w-full bg-gray-200 hover:bg-gray-300 disabled:bg-gray-300 disabled:cursor-not-allowed text-gray-800 py-3 rounded-lg font-medium transition"
                            >
                                Kapat
                            </button>
                        </div>

                        {autoSendFailed && (
                            <p className="text-sm text-red-600 mt-3">
                                Otomatik gönderim başarısız oldu. Lütfen Manuel Mesaj Gönder butonunu kullanın.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
