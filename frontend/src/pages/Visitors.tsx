import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate, formatTime, isToday } from '../utils/dateUtils';
import { validateVisitorForm, normalizePlate, normalizePhone } from '../utils/validation';
import type { VisitorRecord, VisitorFormData, VisitorFilterType } from '../types';

// Initial form state
const INITIAL_FORM_DATA: VisitorFormData = {
    vehicle_plate: '',
    full_name: '',
    company_name: '',
    visiting_person: '',
    person_count: '',
    phone: '',
    notes: '',
    subcontractor_worker: false,
    for_electric_station: false,
    send_whatsapp: false,
    entry_time: '',  // Boş string = mevcut saat kullanılacak
    exit_time: ''
};

export default function Visitors() {
    const [records, setRecords] = useState<VisitorRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [whatsappMessage, setWhatsappMessage] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<VisitorFilterType>('today');
    const [formData, setFormData] = useState<VisitorFormData>(INITIAL_FORM_DATA);
    const navigate = useNavigate();

    // Fetch visitor records
    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/visitors/records');
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

    // Reset form to initial state
    const resetForm = useCallback(() => {
        setFormData(INITIAL_FORM_DATA);
        setIsEditing(false);
        setEditingId(null);
    }, []);

    // Open modal for new record
    const openModalForNew = useCallback(() => {
        resetForm();
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
            phone: rec.phone || '',
            notes: rec.notes || '',
            subcontractor_worker: rec.subcontractor_worker ?? false,
            for_electric_station: rec.for_electric_station ?? false,
            send_whatsapp: false,  // WhatsApp sadece yeni kayıtlarda kullanılır
            entry_time: rec.entry_time ? formatTime(rec.entry_time) : '',  // HH:MM formatına çevir
            exit_time: rec.exit_time ? formatTime(rec.exit_time) : ''  // HH:MM formatına çevir
        });
        setIsEditing(true);
        setEditingId(rec.id);
        setShowModal(true);
    }, []);

    // Build payload from form data
    const buildPayload = useCallback(() => ({
        vehicle_plate: normalizePlate(formData.vehicle_plate) || null,
        full_name: formData.full_name?.trim() || null,
        company_name: formData.company_name?.trim() || null,
        visiting_person: formData.visiting_person?.trim() || null,
        person_count: formData.person_count === '' ? null : Number(formData.person_count),
        phone: normalizePhone(formData.phone) || null,
        notes: formData.notes?.trim() || null,
        subcontractor_worker: !!formData.subcontractor_worker,
        for_electric_station: !!formData.for_electric_station,
        send_whatsapp: !!formData.send_whatsapp,  // WhatsApp bildirimi
        entry_time: formData.entry_time || null,  // Giriş saati
        exit_time: formData.exit_time || null  // Çıkış saati
    }), [formData]);

    // Form submission handler
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        // Frontend validasyon
        const validation = validateVisitorForm(formData);
        if (!validation.isValid) {
            alert('Lütfen hataları düzeltin:\n\n' + validation.errors.join('\n'));
            return;
        }

        try {
            const payload = buildPayload();

            if (isEditing && editingId) {
                await api.put(`/visitors/records/${editingId}`, payload);
            } else {
                const response = await api.post('/visitors/records', payload);

                // WhatsApp mesajı varsa modal göster
                if (response.data?.whatsappMessage) {
                    setWhatsappMessage(response.data.whatsappMessage);
                    setShowWhatsAppModal(true);
                }
            }

            setShowModal(false);
            resetForm();
            fetchData();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err?.response?.data?.message || 'İşlem başarısız');
        }
    }, [formData, buildPayload, isEditing, editingId, resetForm, fetchData]);

    // Handle visitor exit
    const handleExit = useCallback(async (id: string) => {
        if (!confirm('Ziyaretçinin çıkışını kaydetmek istediğinize emin misiniz?')) return;
        try {
            const response = await api.post(`/visitors/records/${id}/exit`, { exit_time: null });
            fetchData();

            // WhatsApp mesajı varsa modal göster
            if (response.data?.whatsappMessage) {
                setWhatsappMessage(response.data.whatsappMessage);
                setShowWhatsAppModal(true);
            }
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err?.response?.data?.message || 'Çıkış kaydı başarısız');
        }
    }, [fetchData]);

    // Memoized statistics
    const stats = useMemo(() => ({
        insideCount: records.filter(r => r.status === 'inside').length,
        todayEntries: records.filter(r => isToday(r.entry_date)).length,
        todayExits: records.filter(r => r.exit_date && isToday(r.exit_date)).length,
        subcontractorCount: records.filter(r => r.status === 'inside' && r.subcontractor_worker).length,
        electricStationCount: records.filter(r => r.status === 'inside' && r.for_electric_station).length,
    }), [records]);

    // Memoized filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (filter === 'today') return isToday(r.entry_date) || (r.exit_date && isToday(r.exit_date)); // Bugünün kayıtları
            if (filter === 'inside') return r.status === 'inside'; // Aktif içeridekiler
            if (filter === 'subcontractor') return r.status === 'inside' && r.subcontractor_worker; // Taşeron işçiler
            if (filter === 'electric') return r.status === 'inside' && r.for_electric_station; // Elektrik istasyonu
            if (filter === 'exits') return r.exit_date && isToday(r.exit_date); // Bugün çıkış yapanlar
            return true;
        });
    }, [records, filter]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg transition">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Ziyaretçi Kayıtları</h1>
                                <p className="text-gray-600 mt-1">Ziyaretçi giriş/çıkış kayıtlarını yönetin</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => navigate('/visitor-records')}
                                className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition shadow-md hover:shadow-lg"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                Kayıt Filtrele
                            </button>
                            <button onClick={openModalForNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition shadow-md hover:shadow-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Yeni Kayıt
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-blue-600 text-sm font-medium">İçerideki Ziyaretçi</p>
                                <p className="text-3xl font-bold text-blue-900">{stats.insideCount}</p>
                            </div>
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-green-600 text-sm font-medium">Bugün Giriş Yapan</p>
                                <p className="text-3xl font-bold text-green-900">{stats.todayEntries}</p>
                            </div>
                            <div className="p-3 bg-green-100 rounded-lg">
                                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-orange-600 text-sm font-medium">Bugün Çıkış Yapan</p>
                                <p className="text-3xl font-bold text-orange-900">{stats.todayExits}</p>
                            </div>
                            <div className="p-3 bg-orange-100 rounded-lg">
                                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex flex-wrap gap-2">
                        <button onClick={() => setFilter('today')} className={`px-4 py-2 rounded-lg transition ${filter === 'today' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Bugünün Kayıtları ({records.filter(r => isToday(r.entry_date) || (r.exit_date && isToday(r.exit_date))).length})
                        </button>
                        <button onClick={() => setFilter('inside')} className={`px-4 py-2 rounded-lg transition ${filter === 'inside' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Aktif İçeridekiler ({stats.insideCount})
                        </button>
                        <button onClick={() => setFilter('subcontractor')} className={`px-4 py-2 rounded-lg transition ${filter === 'subcontractor' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Taşeron İşçiler ({stats.subcontractorCount})
                        </button>
                        <button onClick={() => setFilter('electric')} className={`px-4 py-2 rounded-lg transition ${filter === 'electric' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Elektrik İstasyonu ({stats.electricStationCount})
                        </button>
                        <button onClick={() => setFilter('exits')} className={`px-4 py-2 rounded-lg transition ${filter === 'exits' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Bugün Çıkış Yapanlar ({stats.todayExits})
                        </button>
                    </div>
                </div>

                {/* Table (large bordered, scrollable container) */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500">Kayıt bulunmuyor</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="max-h-[600px] overflow-y-auto">
                                <table className="min-w-full table-auto divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Araç Plaka</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İsim Soyisim</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ziyaret Edilen</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kişi Sayısı</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</th>
                                            <th className="px-6 py-3 w-60 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Yapan</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Yapan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredRecords.map(rec => (
                                            <tr key={rec.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                    <div className="inline-flex items-center gap-3">
                                                        {rec.status === 'inside' && (
                                                            <button
                                                                onClick={() => handleExit(rec.id)}
                                                                className="px-3 py-1.5 border border-green-200 text-green-600 bg-green-50 rounded-md hover:bg-green-100 transition"
                                                                title="Çıkış Yap"
                                                            >
                                                                Çıkış Yap
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => openModalForEdit(rec)}
                                                            className="px-3 py-1.5 border border-blue-200 text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition"
                                                        >
                                                            Düzenle
                                                        </button>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-100 rounded">
                                                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-bold text-gray-900">{rec.vehicle_plate || '-'}</span>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <span className="text-sm font-bold text-gray-900">{rec.full_name || '-'}</span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{rec.company_name || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{rec.visiting_person || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{rec.person_count ?? '-'}</div>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-900">{formatDate(rec.entry_date)}</div>
                                                    <div className="text-xs text-gray-500">{formatTime(rec.entry_time)}</div>
                                                </td>

                                                <td className="px-6 py-4">
                                                    {rec.exit_date ? (
                                                        <>
                                                            <div className="text-sm text-gray-900">{formatDate(rec.exit_date)}</div>
                                                            <div className="text-xs text-gray-500">{formatTime(rec.exit_time)}</div>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{rec.phone || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 max-w-[240px]">
                                                    <div className="text-sm text-gray-500 truncate">{rec.notes || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${rec.status === 'inside' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                                        {rec.status === 'inside' ? 'İçeride' : 'Çıkış Yapıldı'}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{rec.entry_by || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{rec.exit_by || '-'}</div>
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

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">{isEditing ? 'Ziyaretçi Düzenle' : 'Yeni Ziyaretçi'}</h2>
                                <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
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

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama / Not</label>
                                        <textarea value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} placeholder="Notlar..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>
                                    <div className="flex items-center gap-6 md:col-span-2 pt-2">
                                        <label className="inline-flex items-center">
                                            <input type="checkbox" checked={!!formData.subcontractor_worker} onChange={(e) => setFormData({ ...formData, subcontractor_worker: e.target.checked })} className="mr-2" />
                                            <span className="text-sm">Taşeron işçi</span>
                                        </label>
                                        <label className="inline-flex items-center">
                                            <input type="checkbox" checked={!!formData.for_electric_station} onChange={(e) => setFormData({ ...formData, for_electric_station: e.target.checked })} className="mr-2" />
                                            <span className="text-sm">Elektrik istasyonu için</span>
                                        </label>
                                        {!isEditing && (
                                            <label className="inline-flex items-center">
                                                <input type="checkbox" checked={!!formData.send_whatsapp} onChange={(e) => setFormData({ ...formData, send_whatsapp: e.target.checked })} className="mr-2" />
                                                <span className="text-sm text-green-700 font-medium">📱 WhatsApp Bildirimi Gönder</span>
                                            </label>
                                        )}
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

                        <div className="flex gap-3">
                            <a
                                href={`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium transition text-center flex items-center justify-center gap-2"
                                onClick={() => setShowWhatsAppModal(false)}
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                </svg>
                                WhatsApp'ta Aç
                            </a>
                            <button
                                type="button"
                                onClick={() => setShowWhatsAppModal(false)}
                                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition"
                            >
                                Kapat
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
