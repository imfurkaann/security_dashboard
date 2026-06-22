import { useState, useEffect, useCallback, useMemo } from 'react';
import { message, Modal } from 'antd';
import { useLocation } from 'react-router-dom';
import CustomModal from './Modal';
import api from '../utils/api';
import { subscribeToApiMutations, type ApiMutationEvent } from '../realtime/socket';
import { validateVisitorForm, normalizePlate, normalizePhone } from '../utils/validation';

interface PendingQrVisitorData {
    id: string;
    vehicle_plate: string | null;
    full_name: string;
    company_name: string | null;
    visiting_person: string | null;
    person_count: number;
    children_count: number;
    phone: string | null;
    gate: string | null;
    created_at: string;
}

interface PendingQrVisitor extends PendingQrVisitorData {
    type: 'visitor';
}

interface SgkPendingFile {
    id: string;
    record_id: string;
    file_name: string;
    original_file_name: string | null;
    mime_type: string | null;
    size_bytes: number | null;
    sort_order: number;
    created_at: string;
}

interface PendingQrSgkData {
    id: string;
    hashed_tc: string | null;
    hashed_passport: string | null;
    full_name: string;
    company_name: string;
    notes: string | null;
    status: string;
    created_at: string;
    files: SgkPendingFile[];
    file_count: number;
    file_path: string | null;
    gate?: string | null;
}

interface PendingQrSgk extends PendingQrSgkData {
    type: 'sgk';
}

type QueueItem = PendingQrVisitor | PendingQrSgk;

interface VisitorFormData {
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
    send_whatsapp: boolean;
    entry_time: string;
}

interface SgkFormData {
    tc_no: string;
    passport_no: string;
    full_name: string;
    company_name: string;
    notes: string;
}

const INITIAL_FORM_DATA = (visitor?: PendingQrVisitor): VisitorFormData => ({
    vehicle_plate: visitor?.vehicle_plate || '',
    full_name: visitor?.full_name || '',
    company_name: visitor?.company_name || '',
    visiting_person: visitor?.visiting_person || '',
    person_count: visitor?.person_count !== undefined ? String(visitor.person_count) : '1',
    children_count: visitor?.children_count !== undefined ? String(visitor.children_count) : '0',
    phone: visitor?.phone || '',
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
    entry_time: ''
});

const INITIAL_SGK_FORM_DATA = (sgk?: PendingQrSgk): SgkFormData => ({
    tc_no: '',
    passport_no: '',
    full_name: sgk?.full_name || '',
    company_name: sgk?.company_name || '',
    notes: sgk?.notes || ''
});

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
];

export default function QrApprovalQueue() {
    const location = useLocation();
    const [selectedGate, setSelectedGate] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('selectedGate');
        }
        return null;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setSelectedGate(localStorage.getItem('selectedGate'));
        }
    }, [location]);

    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [formData, setFormData] = useState<VisitorFormData>(INITIAL_FORM_DATA());
    const [sgkFormData, setSgkFormData] = useState<SgkFormData>(INITIAL_SGK_FORM_DATA());
    const [openTagsDropdown, setOpenTagsDropdown] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // SGK preview states
    const [pdfUrl, setPdfUrl] = useState<string>('');
    const [previewContentType, setPreviewContentType] = useState('');
    const [previewLoading, setPreviewLoading] = useState(false);
    const [selectedFileIndex, setSelectedFileIndex] = useState(0);
    const [isMobilePreview, setIsMobilePreview] = useState(false);

    // QR public pages should never display the approval modal
    const isQrPage = typeof window !== 'undefined' && window.location.pathname.startsWith('/qr');
    const token = typeof window !== 'undefined' ? (localStorage.getItem('token') || localStorage.getItem('adminToken')) : null;
    const isAuthenticated = !!token;

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const updateViewport = () => {
            setIsMobilePreview(window.matchMedia('(max-width: 768px)').matches);
        };

        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, []);

    // Play notification sound
    const playNotificationSound = () => {
        try {
            const audio = new Audio('/notification.mp3');
            void audio.play();
        } catch (e) {
            // ignore
        }
    };

    // Load pending queue from DB on mount/auth
    const fetchQueue = useCallback(async () => {
        if (!isAuthenticated || isQrPage) return;
        try {
            const [visitorsResponse, sgkResponse] = await Promise.all([
                api.get('/visitors/pending-qr'),
                api.get('/sgk/pending-qr')
            ]);

            const visitors = (visitorsResponse.data || []).map((v: any) => ({ ...v, type: 'visitor' as const }));
            const sgk = (sgkResponse.data || []).map((s: any) => ({ ...s, type: 'sgk' as const }));

            const merged = [...visitors, ...sgk].sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );

            setQueue(merged);
        } catch (error) {
            console.error('Onay sirasi yuklenemedi:', error);
        }
    }, [isAuthenticated, isQrPage]);

    useEffect(() => {
        void fetchQueue();
    }, [fetchQueue]);

    // WebSocket event listener
    useEffect(() => {
        if (!isAuthenticated || isQrPage) return;

        const unsubscribe = subscribeToApiMutations((event: ApiMutationEvent) => {
            // New pending QR visitor
            if (
                event.path === '/api/visitors/pending-qr' &&
                event.method === 'POST' &&
                event.statusCode === 201 &&
                event.payload
            ) {
                const newVisitor = { ...event.payload, type: 'visitor' as const };
                setQueue(prev => {
                    if (prev.some(v => v.id === newVisitor.id)) return prev;
                    const nextQueue = [...prev, newVisitor].sort(
                        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );
                    const currentGate = typeof window !== 'undefined' ? localStorage.getItem('selectedGate') : null;
                    if (!currentGate || !newVisitor.gate || newVisitor.gate === currentGate) {
                        playNotificationSound();
                    }
                    return nextQueue;
                });
            }
            // A pending visitor processed
            else if (
                event.path === '/api/visitors/pending-qr' &&
                event.method === 'POST' &&
                event.statusCode === 200 &&
                event.payload
            ) {
                const { id } = event.payload;
                setQueue(prev => prev.filter(v => v.id !== id));
            }
            // New pending QR SGK
            else if (
                event.path === '/api/sgk/pending-qr' &&
                event.method === 'POST' &&
                event.statusCode === 201 &&
                event.payload
            ) {
                const newSgk = { ...event.payload, type: 'sgk' as const };
                setQueue(prev => {
                    if (prev.some(s => s.id === newSgk.id)) return prev;
                    const nextQueue = [...prev, newSgk].sort(
                        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                    );
                    const currentGate = typeof window !== 'undefined' ? localStorage.getItem('selectedGate') : null;
                    if (!currentGate || !newSgk.gate || newSgk.gate === currentGate) {
                        playNotificationSound();
                    }
                    return nextQueue;
                });
            }
            // A pending SGK processed
            else if (
                event.path === '/api/sgk/pending-qr' &&
                event.method === 'POST' &&
                event.statusCode === 200 &&
                event.payload
            ) {
                const { id } = event.payload;
                setQueue(prev => prev.filter(s => s.id !== id));
            }
        });

        return () => {
            unsubscribe();
        };
    }, [isAuthenticated, isQrPage]);

    // Filter queue to only show items matching current user's gate
    const filteredQueue = useMemo(() => {
        if (!selectedGate) return queue;
        return queue.filter(item => !item.gate || item.gate === selectedGate);
    }, [queue, selectedGate]);

    // Active record at the head of the queue
    const activeRecord = useMemo(() => {
        return filteredQueue.length > 0 ? filteredQueue[0] : null;
    }, [filteredQueue]);

    const previewFiles = useMemo(() => {
        if (activeRecord?.type === 'sgk') {
            return activeRecord.files || [];
        }
        return [];
    }, [activeRecord]);

    const selectedPreviewFile = previewFiles[selectedFileIndex] || null;

    // Fetch SGK file preview
    useEffect(() => {
        const fetchSelectedPreviewFile = async () => {
            if (!activeRecord || activeRecord.type !== 'sgk' || !selectedPreviewFile) {
                return;
            }

            setPreviewLoading(true);

            try {
                const endpoint = `/sgk/pending-qr/${activeRecord.id}/files/${selectedPreviewFile.id}`;
                const response = await api.get(endpoint, { responseType: 'blob' });

                const blob = new Blob([response.data], {
                    type: response.headers['content-type'] || 'application/octet-stream'
                });

                const url = URL.createObjectURL(blob);
                const contentType = response.headers['content-type'] || '';

                setPdfUrl((previousUrl) => {
                    if (previousUrl) {
                        URL.revokeObjectURL(previousUrl);
                    }
                    return url;
                });
                setPreviewContentType(contentType);
            } catch (error) {
                message.error('Belge önizlenirken hata oluştu');
                setPdfUrl('');
                setPreviewContentType('');
            } finally {
                setPreviewLoading(false);
            }
        };

        fetchSelectedPreviewFile();
    }, [activeRecord, selectedPreviewFile]);

    // Unmount cleanup for pdfUrl
    useEffect(() => {
        return () => {
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
            }
        };
    }, [pdfUrl]);

    // Reset/update form when active record changes
    useEffect(() => {
        if (activeRecord) {
            if (activeRecord.type === 'visitor') {
                setFormData(INITIAL_FORM_DATA(activeRecord));
            } else {
                setSgkFormData(INITIAL_SGK_FORM_DATA(activeRecord));
                setSelectedFileIndex(0);
                setPdfUrl('');
                setPreviewContentType('');
            }
        } else {
            setFormData(INITIAL_FORM_DATA());
            setSgkFormData(INITIAL_SGK_FORM_DATA());
            setPdfUrl('');
            setPreviewContentType('');
        }
        setOpenTagsDropdown(false);
    }, [activeRecord]);

    if (isQrPage || !isAuthenticated || !activeRecord) {
        return null;
    }

    const handleApprove = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        // Frontend validation
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
            setSubmitting(true);

            const payload = {
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
                send_whatsapp: !!formData.send_whatsapp,
                entry_time: formData.entry_time || null
            };

            const response = await api.post(`/visitors/pending-qr/${activeRecord.id}/approve`, payload);
            if (response.data?.success) {
                message.success('Ziyaretçi girişi onaylandı ve kaydedildi');
                setQueue(prev => prev.filter(v => v.id !== activeRecord.id));
            } else {
                message.error(response.data?.message || 'İşlem başarısız');
            }
        } catch (error: any) {
            message.error(error?.response?.data?.message || 'Onaylama kaydedilirken hata oluştu');
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = () => {
        Modal.confirm({
            title: 'Kayıt Başvurusunu Reddet',
            content: 'Bu QR misafir kayıt başvurusunu reddetmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
            okText: 'Evet, Reddet',
            okButtonProps: { danger: true },
            cancelText: 'Vazgeç',
            onOk: async () => {
                try {
                    setSubmitting(true);
                    const response = await api.post(`/visitors/pending-qr/${activeRecord.id}/reject`, {});
                    if (response.data?.success) {
                        message.success('Ziyaretçi başvurusu reddedildi');
                        setQueue(prev => prev.filter(v => v.id !== activeRecord.id));
                    }
                } catch (error) {
                    message.error('Kayıt reddedilirken hata oluştu');
                } finally {
                    setSubmitting(false);
                }
            }
        });
    };

    const handleSgkApprove = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;

        if (!sgkFormData.full_name?.trim()) {
            message.warning('Ad Soyad zorunludur');
            return;
        }

        if (!sgkFormData.company_name?.trim()) {
            message.warning('Firma Adı zorunludur');
            return;
        }

        if (sgkFormData.tc_no?.trim() && sgkFormData.passport_no?.trim()) {
            message.warning('TC Kimlik No ve Pasaport Numarası aynı anda girilemez. Sadece birini giriniz.');
            return;
        }

        if (sgkFormData.tc_no?.trim()) {
            const cleanTC = sgkFormData.tc_no.replace(/\D/g, '');
            if (cleanTC.length !== 11) {
                message.warning('TC Kimlik No 11 haneli olmalıdır');
                return;
            }
        }

        if (sgkFormData.passport_no?.trim()) {
            const cleanPassport = sgkFormData.passport_no.trim().toUpperCase();
            if (cleanPassport.length < 6 || cleanPassport.length > 20) {
                message.warning('Pasaport numarası 6-20 karakter arasında olmalıdır');
                return;
            }
        }

        try {
            setSubmitting(true);
            const payload = {
                tc_no: sgkFormData.tc_no?.trim() || null,
                passport_no: sgkFormData.passport_no?.trim() || null,
                full_name: sgkFormData.full_name.trim(),
                company_name: sgkFormData.company_name.trim(),
                notes: sgkFormData.notes?.trim() || null
            };

            const response = await api.post(`/sgk/pending-qr/${activeRecord.id}/approve`, payload);
            if (response.data?.success) {
                message.success('SGK kaydı onaylandı ve kaydedildi');
                setQueue(prev => prev.filter(s => s.id !== activeRecord.id));
            } else {
                message.error(response.data?.message || 'İşlem başarısız');
            }
        } catch (error: any) {
            message.error(error?.response?.data?.message || 'Onaylama kaydedilirken hata oluştu');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSgkReject = () => {
        Modal.confirm({
            title: 'SGK Kayıt Başvurusunu Reddet',
            content: 'Bu QR SGK kayıt başvurusunu reddetmek istediğinize emin misiniz? Yüklenen tüm dosyalar silinecektir ve bu işlem geri alınamaz.',
            okText: 'Evet, Reddet',
            okButtonProps: { danger: true },
            cancelText: 'Vazgeç',
            onOk: async () => {
                try {
                    setSubmitting(true);
                    const response = await api.post(`/sgk/pending-qr/${activeRecord.id}/reject`, {});
                    if (response.data?.success) {
                        message.success('SGK başvurusu reddedildi ve dosyalar silindi');
                        setQueue(prev => prev.filter(s => s.id !== activeRecord.id));
                    }
                } catch (error) {
                    message.error('Kayıt reddedilirken hata oluştu');
                } finally {
                    setSubmitting(false);
                }
            }
        });
    };

    return (
        <CustomModal
            isOpen={true}
            onClose={() => {}}
            size={activeRecord.type === 'sgk' ? '5xl' : '2xl'}
            closeOnBackdropClick={false}
        >
            {activeRecord.type === 'visitor' ? (
                <>
                    <div className="mb-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 animate-pulse">
                            QR KOD KAYIT İSTEĞİ ({filteredQueue.length} Bekleyen)
                        </span>
                        <h2 className="text-xl font-bold text-slate-900 mt-2">Ziyaretçi Girişini Onayla</h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Misafir tarafından kapıda doldurulan bilgiler aşağıdadır. İlgili alanları düzenleyebilir veya eksik alanları doldurarak onaylayabilirsiniz.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 mb-4 justify-start border-t border-b border-slate-100 py-3">
                        <span className="text-xs font-semibold text-gray-600 mr-2">Vurgu Rengi:</span>
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

                    <form onSubmit={handleApprove} className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
                                <input
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="Ziyaretçinin adı soyadı"
                                    className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Plaka</label>
                                <input
                                    value={formData.vehicle_plate}
                                    onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                                    placeholder="TR 34 XXX 34"
                                    className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Firma</label>
                                <input
                                    value={formData.company_name}
                                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                    placeholder="Firma adı"
                                    className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Ziyaret Edilen</label>
                                <input
                                    value={formData.visiting_person}
                                    onChange={(e) => setFormData({ ...formData, visiting_person: e.target.value })}
                                    placeholder="İsim veya departman"
                                    className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kişi Sayısı</label>
                                <input
                                    type="number"
                                    value={formData.person_count}
                                    onChange={(e) => setFormData({ ...formData, person_count: e.target.value })}
                                    placeholder="1"
                                    className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Çocuk Sayısı</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={formData.children_count}
                                    onChange={(e) => setFormData({ ...formData, children_count: e.target.value })}
                                    placeholder="0"
                                    className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                                <input
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="05xx..."
                                    className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Giriş Saati</label>
                                <input
                                    type="time"
                                    value={formData.entry_time}
                                    onChange={(e) => setFormData({ ...formData, entry_time: e.target.value })}
                                    style={{ colorScheme: 'light' }}
                                    className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <p className="text-[11px] text-gray-500 mt-0.5">Boş bırakırsanız onaylama saati kullanılır</p>
                            </div>

                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Etiketler</label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setOpenTagsDropdown(!openTagsDropdown)}
                                            className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left bg-white hover:bg-gray-50 flex justify-between items-center"
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

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama / Not</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows={2}
                                        placeholder="Notlar..."
                                        className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="md:col-span-2 flex items-center gap-3 py-1">
                                <label className="inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={formData.send_whatsapp}
                                        onChange={(e) => setFormData({ ...formData, send_whatsapp: e.target.checked })}
                                        className="mr-2"
                                    />
                                    <span className="text-sm">WhatsApp Bildirimi Gönder</span>
                                </label>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-200">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition"
                            >
                                {submitting ? 'Onaylanıyor...' : 'Girişi Onayla ve Kaydet'}
                            </button>
                            <button
                                type="button"
                                onClick={handleReject}
                                disabled={submitting}
                                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition"
                            >
                                Reddet
                            </button>
                        </div>
                    </form>
                </>
            ) : (
                <div className="flex flex-col lg:flex-row gap-6 h-[75vh]">
                    {/* Left Side: Form */}
                    <div className="w-full lg:w-2/5 flex flex-col justify-between overflow-y-auto pr-2">
                        <div>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-3">
                                QR KOD SGK YÜKLEME İSTEĞİ ({filteredQueue.length} Bekleyen)
                            </span>
                            <h2 className="text-xl font-bold text-slate-900 font-sans">SGK Belgesini Onayla</h2>
                            <p className="text-xs text-slate-500 mt-0.5 mb-4">
                                Kişinin yüklediği belgeler sağ taraftadır. Bilgileri düzenleyebilir ve doğrulayarak kaydedebilirsiniz.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
                                    <input
                                        value={sgkFormData.full_name}
                                        onChange={(e) => setSgkFormData({ ...sgkFormData, full_name: e.target.value })}
                                        placeholder="Ad soyad"
                                        className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Firma Adı</label>
                                    <input
                                        value={sgkFormData.company_name}
                                        onChange={(e) => setSgkFormData({ ...sgkFormData, company_name: e.target.value })}
                                        placeholder="Firma adı"
                                        className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">TC Kimlik No</label>
                                        <input
                                            value={sgkFormData.tc_no}
                                            onChange={(e) => setSgkFormData({ ...sgkFormData, tc_no: e.target.value, passport_no: '' })}
                                            placeholder="11 haneli TC No"
                                            maxLength={11}
                                            className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Pasaport No</label>
                                        <input
                                            value={sgkFormData.passport_no}
                                            onChange={(e) => setSgkFormData({ ...sgkFormData, passport_no: e.target.value, tc_no: '' })}
                                            placeholder="Pasaport No"
                                            maxLength={20}
                                            className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Notlar / Açıklama</label>
                                    <textarea
                                        value={sgkFormData.notes}
                                        onChange={(e) => setSgkFormData({ ...sgkFormData, notes: e.target.value })}
                                        rows={3}
                                        placeholder="Notlar..."
                                        className="w-full px-4 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-200 mt-4">
                            <button
                                type="button"
                                onClick={handleSgkApprove}
                                disabled={submitting}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition"
                            >
                                {submitting ? 'Onaylanıyor...' : 'Onayla ve Kaydet'}
                            </button>
                            <button
                                type="button"
                                onClick={handleSgkReject}
                                disabled={submitting}
                                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-medium transition"
                            >
                                Reddet
                            </button>
                        </div>
                    </div>

                    {/* Right Side: Document Preview */}
                    <div className="w-full lg:w-3/5 flex flex-col bg-gray-50 border border-gray-200 rounded-xl p-4 min-h-0">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-bold text-gray-700">Yüklenen Belgeler ({previewFiles.length} Adet)</span>
                            {pdfUrl && (previewContentType.includes('pdf') || selectedPreviewFile?.file_name?.match(/\.pdf$/i)) && (
                                <a
                                    href={pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
                                >
                                    Yeni Sekmede Aç
                                </a>
                            )}
                        </div>

                        {previewFiles.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
                                {previewFiles.map((file, idx) => (
                                    <button
                                        key={file.id}
                                        onClick={() => setSelectedFileIndex(idx)}
                                        className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition ${selectedFileIndex === idx ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                                    >
                                        {file.original_file_name || file.file_name}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex-1 min-h-0 bg-gray-200 flex items-center justify-center rounded-lg overflow-hidden relative">
                            {previewLoading ? (
                                <div className="text-gray-700 text-sm font-medium animate-pulse">Belge yükleniyor...</div>
                            ) : (previewContentType.startsWith('image/') || selectedPreviewFile?.file_name?.match(/\.(jpg|jpeg|png)$/i)) ? (
                                <img
                                    src={pdfUrl}
                                    alt="Preview"
                                    className="max-w-full max-h-full object-contain select-none"
                                />
                            ) : (previewContentType.includes('pdf') || selectedPreviewFile?.file_name?.match(/\.pdf$/i)) ? (
                                isMobilePreview ? (
                                    <div className="text-center p-6">
                                        <p className="text-gray-700 mb-3 text-sm">Mobil cihazlarda PDF önizlemesi için aşağıdaki butonu kullanın.</p>
                                        {pdfUrl && (
                                            <a
                                                href={pdfUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition text-xs font-semibold"
                                            >
                                                PDF'i Yeni Sekmede Aç
                                            </a>
                                        )}
                                    </div>
                                ) : (
                                    <iframe
                                        src={pdfUrl}
                                        className="w-full h-full border-none"
                                        title="Pending SGK PDF Preview"
                                    />
                                )
                            ) : (
                                <iframe
                                    src={pdfUrl}
                                    className="w-full h-full border-none"
                                    title="Pending SGK Preview"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </CustomModal>
    );
}
