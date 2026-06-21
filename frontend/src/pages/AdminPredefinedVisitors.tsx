import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Modal } from 'antd';
import 'antd/dist/reset.css';
import api from '../utils/api';
import ActionButton from '../components/ActionButton';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import type { PredefinedVisitor } from '../types';
import { normalizePlate, normalizePhone } from '../utils/validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeSearchText = (value: string | null | undefined): string =>
    (value || '').toLocaleLowerCase('tr-TR').normalize('NFC');

const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return '-';
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11 && clean.startsWith('0'))
        return `${clean.slice(0, 4)} ${clean.slice(4, 7)} ${clean.slice(7, 9)} ${clean.slice(9, 11)}`;
    if (clean.length === 10)
        return `0${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 8)} ${clean.slice(8, 10)}`;
    return phone;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TAGS_OPTIONS = [
    { id: 'subcontractor_worker', label: 'Taşeron İşçi' },
    { id: 'for_electric_station', label: 'Şarj İstasyonu' },
    { id: 'daily_guest',          label: 'Günübirlik Misafir' },
    { id: 'entry_tag',            label: 'Giriş' },
    { id: 'exit_tag',             label: 'Çıkış' },
    { id: 'tour_entry',           label: 'Tur Giriş' },
    { id: 'tour_exit',            label: 'Tur Çıkış' },
    { id: 'meeting',              label: 'Görüşme' },
    { id: 'delivery',             label: 'Teslimat' },
] as const;

const HIGHLIGHT_OPTIONS = [
    { value: 'none',    label: 'Varsayılan',    color: '#f3f4f6' },
    { value: 'rose',    label: 'Gül Kırmızısı', color: '#e11d48' },
    { value: 'amber',   label: 'Sarı',           color: '#d97706' },
    { value: 'emerald', label: 'Yeşil',          color: '#059669' },
    { value: 'sky',     label: 'Mavi',           color: '#0284c7' },
    { value: 'violet',  label: 'Mor',            color: '#7c3aed' },
    { value: 'orange',  label: 'Turuncu',        color: '#ea580c' },
    { value: 'pink',    label: 'Pembe',          color: '#db2777' },
    { value: 'brown',   label: 'Kahverengi',     color: '#92400e' },
] as const;

type TagId = typeof TAGS_OPTIONS[number]['id'];
type TagState = Record<TagId | 'guide', boolean>;

const EMPTY_TAGS: TagState = {
    subcontractor_worker:  false,
    for_electric_station:  false,
    daily_guest:           false,
    entry_tag:             false,
    exit_tag:              false,
    tour_entry:            false,
    tour_exit:             false,
    meeting:               false,
    delivery:              false,
    guide:                 false,
};

// ---------------------------------------------------------------------------
// Visitor tag list helper
// ---------------------------------------------------------------------------

const getVisitorTags = (v: PredefinedVisitor): string[] => {
    const a: string[] = [];
    if (v.subcontractor_worker)  a.push('Taşeron İşçi');
    if (v.for_electric_station)  a.push('Şarj İstasyonu');
    if (v.daily_guest)           a.push('Günübirlik Misafir');
    if (v.entry_tag)             a.push('Giriş');
    if (v.exit_tag)              a.push('Çıkış');
    if (v.tour_entry)            a.push('Tur Giriş');
    if (v.tour_exit)             a.push('Tur Çıkış');
    if (v.meeting)               a.push('Görüşme');
    if (v.delivery)              a.push('Teslimat');
    return a;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminPredefinedVisitors() {
    const navigate = useNavigate();

    // ── data
    const [visitors, setVisitors]   = useState<PredefinedVisitor[]>([]);
    const [loading,  setLoading]    = useState(true);

    // ── modal
    const [showModal,      setShowModal]      = useState(false);
    const [editingVisitor, setEditingVisitor] = useState<PredefinedVisitor | null>(null);
    const [openTagsDrop,   setOpenTagsDrop]   = useState(false);

    // ── search / filter
    const [searchTerm, setSearchTerm] = useState('');
    const [tagFilter,  setTagFilter]  = useState('all');

    // ── form fields  (mirrors AdminManagePersonnel pattern: individual states)
    const [fullName,        setFullName]        = useState('');
    const [companyName,     setCompanyName]     = useState('');
    const [phone,           setPhone]           = useState('');
    const [vehiclePlate,    setVehiclePlate]    = useState('');
    const [visitingPerson,  setVisitingPerson]  = useState('');
    const [notes,           setNotes]           = useState('');
    const [highlightColor,  setHighlightColor]  = useState('none');
    const [tags,            setTags]            = useState<TagState>({ ...EMPTY_TAGS });

    // ── fetch
    const fetchVisitors = useCallback(async () => {
        try {
            const res = await api.get('/predefined-visitors/admin?limit=1000');
            setVisitors(res.data.data || []);
        } catch {
            message.error('Tanımlı ziyaretçi verileri yüklenirken bir hata oluştu');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void fetchVisitors(); }, [fetchVisitors]);

    useRealtimeRefetch({ topics: ['predefined-visitors'], onMutation: fetchVisitors, enabled: true });

    // ── modal helpers
    const resetForm = () => {
        setFullName(''); setCompanyName(''); setPhone('');
        setVehiclePlate(''); setVisitingPerson(''); setNotes('');
        setHighlightColor('none'); setTags({ ...EMPTY_TAGS }); setOpenTagsDrop(false);
    };

    const openAddModal = () => { setEditingVisitor(null); resetForm(); setShowModal(true); };

    const openEditModal = (v: PredefinedVisitor) => {
        setEditingVisitor(v);
        setFullName(v.full_name);
        setCompanyName(v.company_name    || '');
        setPhone(v.phone                 || '');
        setVehiclePlate(v.vehicle_plate  || '');
        setVisitingPerson(v.visiting_person || '');
        setNotes(v.notes                 || '');
        setHighlightColor(v.highlight_color || 'none');
        setTags({
            subcontractor_worker:  !!v.subcontractor_worker,
            for_electric_station:  !!v.for_electric_station,
            daily_guest:           !!v.daily_guest,
            entry_tag:             !!v.entry_tag,
            exit_tag:              !!v.exit_tag,
            tour_entry:            !!v.tour_entry,
            tour_exit:             !!v.tour_exit,
            meeting:               !!v.meeting,
            delivery:              !!v.delivery,
            guide:                 !!v.guide,
        });
        setOpenTagsDrop(false);
        setShowModal(true);
    };

    const closeModal = () => { setShowModal(false); setEditingVisitor(null); resetForm(); };

    // ── submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim()) { message.warning('Lütfen Ad Soyad alanını doldurun'); return; }

        const payload = {
            full_name:            fullName.trim(),
            company_name:         companyName.trim()    || null,
            phone:                normalizePhone(phone)  || null,
            vehicle_plate:        normalizePlate(vehiclePlate) || null,
            visiting_person:      visitingPerson.trim() || null,
            notes:                notes.trim()          || null,
            highlight_color:      highlightColor,
            subcontractor_worker: !!tags.subcontractor_worker,
            for_electric_station: !!tags.for_electric_station,
            daily_guest:          !!tags.daily_guest,
            entry_tag:            !!tags.entry_tag,
            exit_tag:             !!tags.exit_tag,
            tour_entry:           !!tags.tour_entry,
            tour_exit:            !!tags.tour_exit,
            meeting:              !!tags.meeting,
            delivery:             !!tags.delivery,
            guide:                !!tags.guide,
        };

        try {
            if (editingVisitor) {
                await api.put(`/predefined-visitors/admin/${editingVisitor.id}`, payload);
                message.success('Tanımlı ziyaretçi başarıyla güncellendi');
            } else {
                await api.post('/predefined-visitors/admin', payload);
                message.success('Tanımlı ziyaretçi başarıyla eklendi');
            }
            closeModal();
            void fetchVisitors();
        } catch (error: any) {
            message.error(error.response?.data?.message || 'İşlem sırasında bir hata oluştu');
        }
    };

    // ── delete
    const handleDelete = (id: string, name: string) => {
        Modal.confirm({
            title: 'Tanımlı Ziyaretçiyi Sil',
            content: `${name} kaydını silmek istediğinizden emin misiniz?`,
            okText: 'Evet, Sil', okType: 'danger', cancelText: 'Vazgeç',
            onOk: async () => {
                try {
                    await api.delete(`/predefined-visitors/admin/${id}`);
                    message.success('Tanımlı ziyaretçi başarıyla silindi');
                    void fetchVisitors();
                } catch (error: any) {
                    message.error(error.response?.data?.message || 'Silme işlemi sırasında bir hata oluştu');
                }
            },
        });
    };

    // ── filtered list
    const filteredVisitors = useMemo(() => visitors.filter(v => {
        const q = normalizeSearchText(searchTerm);
        const matchesSearch =
            q === '' ||
            normalizeSearchText(v.full_name).includes(q) ||
            normalizeSearchText(v.company_name).includes(q) ||
            normalizeSearchText(v.vehicle_plate).includes(q);
        const matchesTag = tagFilter === 'all' || !!v[tagFilter as keyof PredefinedVisitor];
        return matchesSearch && matchesTag;
    }), [visitors, searchTerm, tagFilter]);

    const selectedTagLabels = TAGS_OPTIONS
        .filter(opt => tags[opt.id as TagId])
        .map(opt => opt.label)
        .join(', ') || 'Seçiniz...';

    // ── loading
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-gray-600">Yükleniyor...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">

            {/* ── Header — AdminManagePersonnel ile aynı yapı ── */}
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/admin/visitor-records')}
                                className="p-2 hover:bg-slate-800 rounded-lg transition shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">
                                    Önceden Tanımlı Ziyaretçiler
                                </h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">
                                    Sık gelen ziyaretçileri ekleyerek kayıt ekranında otomatik dolmasını sağlayın
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={openAddModal}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Yeni Tanımlı Ziyaretçi Ekle
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Main ── */}
            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4">

                {/* Filters — AdminManagePersonnel ile birebir aynı kart yapısı */}
                <div className="bg-white rounded-lg shadow px-3 py-2 mb-3 w-full">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-base font-bold text-gray-900">Filtreler</h2>
                        <button
                            onClick={() => { setSearchTerm(''); setTagFilter('all'); }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Temizle
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Ara</label>
                            <input
                                type="text"
                                placeholder="İsim, firma veya plaka ile ara..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Etiket Filtresi</label>
                            <select
                                value={tagFilter}
                                onChange={(e) => setTagFilter(e.target.value)}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                {TAGS_OPTIONS.map(opt => (
                                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* List — AdminManagePersonnel ile birebir aynı kart yapısı */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-auto flex-1 min-h-0">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Tanımlı Ziyaretçi Listesi</h2>
                            <p className="text-sm text-gray-500 mt-1">İsim sırasına göre listelenir</p>
                        </div>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                            {filteredVisitors.length} / {visitors.length} kayıt
                        </span>
                    </div>

                    {filteredVisitors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <p className="text-gray-500">
                                {searchTerm || tagFilter !== 'all'
                                    ? 'Arama kriterlerine uygun tanımlı ziyaretçi bulunamadı.'
                                    : 'Henüz tanımlı ziyaretçi eklenmemiş.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] table-auto divide-y divide-gray-200">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">İşlem</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Ad Soyad</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Firma</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Telefon</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Plaka</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Ziyaret Edilen</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Etiketler</th>
                                        <th className="px-3 py-2.5 whitespace-nowrap text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider w-[180px]">Not</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredVisitors.map((visitor) => {
                                        const ROW_COLORS: Record<string, string> = {
                                            rose: '#fb7185', amber: '#fbbf24', emerald: '#6ee7b7',
                                            sky: '#7dd3fc', violet: '#a78bfa', orange: '#fdba74',
                                            pink: '#f472b6', brown: '#d4a373',
                                        };
                                        const rowBg = ROW_COLORS[visitor.highlight_color || 'none'];
                                        return (
                                            <tr
                                                key={visitor.id}
                                                className="hover:bg-gray-50"
                                                style={rowBg ? { backgroundColor: rowBg } : undefined}
                                            >
                                                {/* İşlem */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <ActionButton onClick={() => openEditModal(visitor)} variant="primary" title="Düzenle" className="shrink-0">
                                                            Düzenle
                                                        </ActionButton>
                                                        <ActionButton onClick={() => handleDelete(visitor.id, visitor.full_name)} variant="danger" title="Sil" className="shrink-0">
                                                            Sil
                                                        </ActionButton>
                                                    </div>
                                                </td>

                                                {/* Ad Soyad */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <span className="text-xs font-bold text-gray-900">{visitor.full_name}</span>
                                                </td>

                                                {/* Firma */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <span className="text-xs text-gray-900">{visitor.company_name || '-'}</span>
                                                </td>

                                                {/* Telefon */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <span className="text-xs text-gray-900">{visitor.phone ? formatPhoneNumber(visitor.phone) : '-'}</span>
                                                </td>

                                                {/* Plaka */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <span className="text-xs font-bold text-gray-900">{visitor.vehicle_plate || '-'}</span>
                                                </td>

                                                {/* Ziyaret Edilen */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <span className="text-xs text-gray-900">{visitor.visiting_person || '-'}</span>
                                                </td>

                                                {/* Etiketler */}
                                                <td className="px-3 py-2.5 whitespace-nowrap">
                                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                                        {getVisitorTags(visitor).length > 0
                                                            ? getVisitorTags(visitor).map((tag, idx) => (
                                                                <span key={idx} className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                                                                    {tag}
                                                                </span>
                                                            ))
                                                            : <span className="text-gray-400 text-xs">-</span>
                                                        }
                                                    </div>
                                                </td>

                                                {/* Not */}
                                                <td className="px-3 py-2.5 whitespace-nowrap w-[180px]">
                                                    {visitor.notes
                                                        ? <span className="text-xs text-gray-600 italic truncate block max-w-[160px]" title={visitor.notes}>{visitor.notes}</span>
                                                        : <span className="text-xs text-gray-400">-</span>
                                                    }
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>


            {/* ── Add / Edit Modal — AdminManagePersonnel ile aynı inline modal yapısı ── */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="px-6 py-4 border-b border-gray-200 sticky top-0 bg-white flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-gray-900">
                                {editingVisitor ? 'Tanımlı Ziyaretçi Düzenle' : 'Yeni Tanımlı Ziyaretçi Ekle'}
                            </h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition p-1">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">

                            {/* Vurgu Rengi */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Vurgu Rengi</label>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {HIGHLIGHT_OPTIONS.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setHighlightColor(option.value)}
                                            className={`w-7 h-7 rounded-full border-2 transition-transform ${
                                                highlightColor === option.value
                                                    ? 'border-gray-900 scale-110'
                                                    : 'border-gray-300'
                                            }`}
                                            style={{ backgroundColor: option.color }}
                                            title={option.label}
                                            aria-label={option.label}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Ad Soyad */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Ad Soyad <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Ziyaretçinin adı soyadı"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Firma */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Firma</label>
                                    <input
                                        type="text"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        placeholder="Firma adı"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Plaka */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Plaka</label>
                                    <input
                                        type="text"
                                        value={vehiclePlate}
                                        onChange={(e) => setVehiclePlate(e.target.value)}
                                        placeholder="TR 34 XXX 34"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Telefon */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                                    <input
                                        type="text"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="05xx..."
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                {/* Ziyaret Edilen */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Ziyaret Edilen</label>
                                    <input
                                        type="text"
                                        value={visitingPerson}
                                        onChange={(e) => setVisitingPerson(e.target.value)}
                                        placeholder="İsim veya departman"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                            </div>

                            {/* Etiketler */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Etiketler</label>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setOpenTagsDrop(prev => !prev)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left bg-white hover:bg-gray-50 flex justify-between items-center"
                                    >
                                        <span className="text-sm truncate pr-2">{selectedTagLabels}</span>
                                        <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${openTagsDrop ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    {openTagsDrop && (
                                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                                            {TAGS_OPTIONS.map((opt) => (
                                                <label key={opt.id} className="flex items-center px-4 py-2 hover:bg-gray-50 border-b last:border-b-0 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!tags[opt.id as TagId]}
                                                        onChange={(e) => setTags(prev => ({ ...prev, [opt.id]: e.target.checked }))}
                                                        className="mr-3 w-4 h-4 cursor-pointer"
                                                    />
                                                    <span className="text-sm text-gray-700">{opt.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Açıklama */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama / Not</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={3}
                                    placeholder="Ziyaretçiye ait not..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                                >
                                    {editingVisitor ? 'Güncelle' : 'Ekle'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
