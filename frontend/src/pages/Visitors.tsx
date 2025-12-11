import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface VisitorRecord {
    id: string;
    vehicle_plate: string | null;
    full_name: string | null;
    company_name: string | null;
    visiting_person: string | null;
    person_count: number | null;
    phone: string | null;
    notes: string | null;
    entry_date: string | null;
    entry_time: string | null;
    exit_date: string | null;
    exit_time: string | null;
    status: 'inside' | 'exited' | string;
    personnel: string | null;
    created_at: string | null;
}

export default function Visitors() {
    const [records, setRecords] = useState<VisitorRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<'today' | 'inside' | 'exits' | 'all'>('today');
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        vehicle_plate: '',
        full_name: '',
        company_name: '',
        visiting_person: '',
        person_count: '' as string | number,
        phone: '',
        notes: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/visitors/records`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRecords(res.data || []);
        } catch (err) {
            console.error('Ziyaretçi verisi yüklenemedi', err);
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            vehicle_plate: '',
            full_name: '',
            company_name: '',
            visiting_person: '',
            person_count: '',
            phone: '',
            notes: ''
        });
        setIsEditing(false);
        setEditingId(null);
    };

    const openModalForNew = () => {
        resetForm();
        setShowModal(true);
    };

    const openModalForEdit = (rec: VisitorRecord) => {
        setFormData({
            vehicle_plate: rec.vehicle_plate || '',
            full_name: rec.full_name || '',
            company_name: rec.company_name || '',
            visiting_person: rec.visiting_person || '',
            person_count: rec.person_count ?? '',
            phone: rec.phone || '',
            notes: rec.notes || ''
        });
        setIsEditing(true);
        setEditingId(rec.id);
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const payload: any = {
                vehicle_plate: formData.vehicle_plate || null,
                full_name: formData.full_name || null,
                company_name: formData.company_name || null,
                visiting_person: formData.visiting_person || null,
                person_count: formData.person_count === '' ? null : Number(formData.person_count),
                phone: formData.phone || null,
                notes: formData.notes || null
            };

            if (isEditing && editingId) {
                await axios.put(`${API_URL}/visitors/records/${editingId}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else {
                await axios.post(`${API_URL}/visitors/records`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            setShowModal(false);
            resetForm();
            fetchData();
        } catch (error: any) {
            alert(error?.response?.data?.message || 'İşlem başarısız');
        }
    };

    const handleExit = async (id: string) => {
        if (!confirm('Ziyaretçinin çıkışını kaydetmek istediğinize emin misiniz?')) return;
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/visitors/records/${id}/exit`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchData();
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Çıkış kaydı başarısız');
        }
    };

    // Stats calculations
    const insideCount = records.filter(r => r.status === 'inside').length;
    const today = new Date();
    const isSameDate = (d: string | null) => {
        if (!d) return false;
        const dt = new Date(d);
        return dt.getFullYear() === today.getFullYear() && dt.getMonth() === today.getMonth() && dt.getDate() === today.getDate();
    };
    const todayEntries = records.filter(r => isSameDate(r.entry_date)).length;
    const todayExits = records.filter(r => r.exit_date && isSameDate(r.exit_date)).length;

    const filtered = records.filter(r => {
        if (filter === 'today') return isSameDate(r.entry_date) || (r.exit_date && isSameDate(r.exit_date));
        if (filter === 'inside') return r.status === 'inside';
        if (filter === 'exits') return !!r.exit_date;
        return true;
    });

    const formatDate = (d: string | null) => {
        if (!d) return '-';
        const date = new Date(d);
        return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    };

    const formatTime = (t: string | null) => {
        if (!t) return '-';
        return t.substring(0, 5);
    };

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
                        <button onClick={openModalForNew} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition shadow-md hover:shadow-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Yeni Kayıt
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-blue-600 text-sm font-medium">İçerideki Ziyaretçi</p>
                                <p className="text-3xl font-bold text-blue-900">{insideCount}</p>
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
                                <p className="text-3xl font-bold text-green-900">{todayEntries}</p>
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
                                <p className="text-3xl font-bold text-orange-900">{todayExits}</p>
                            </div>
                            <div className="p-3 bg-orange-100 rounded-lg">
                                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-purple-600 text-sm font-medium">Toplam Kayıt</p>
                                <p className="text-3xl font-bold text-purple-900">{records.length}</p>
                            </div>
                            <div className="p-3 bg-purple-100 rounded-lg">
                                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex gap-2">
                        <button onClick={() => setFilter('today')} className={`px-4 py-2 rounded-lg transition ${filter === 'today' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Bugünün Kayıtları ({records.filter(r => isSameDate(r.entry_date) || (r.exit_date && isSameDate(r.exit_date))).length})
                        </button>
                        <button onClick={() => setFilter('inside')} className={`px-4 py-2 rounded-lg transition ${filter === 'inside' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            İçeridekiler ({records.filter(r => r.status === 'inside').length})
                        </button>
                        <button onClick={() => setFilter('exits')} className={`px-4 py-2 rounded-lg transition ${filter === 'exits' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Çıkış Yapanlar ({records.filter(r => r.exit_date).length})
                        </button>
                    </div>
                </div>

                {/* Table (large bordered, scrollable container) */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500">Kayıt bulunmuyor</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="max-h-[600px] overflow-y-auto">
                                <table className="min-w-full table-auto divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Araç</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ad Soyad</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ziyaret Edilen</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kişi</th>
                                            {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Personel</th> */}
                                            <th className="px-6 py-3 w-60 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verilme Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İade Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>

                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filtered.map(rec => (
                                            <tr key={rec.id} className="hover:bg-gray-50">
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
                                                <td className="px-6 py-4 max-w-[240px]">
                                                    <div className="text-sm text-gray-500 truncate">{rec.notes || '-'}</div>
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
                                                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${rec.status === 'inside' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                                        {rec.status === 'inside' ? 'İçeride' : 'Çıkış Yapıldı'}
                                                    </span>
                                                </td>


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
                                        <input value={String(formData.full_name)} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} placeholder="Ziyaretçinin adı soyadı" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Plaka</label>
                                        <input value={String(formData.vehicle_plate)} onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })} placeholder="TR 34 XXX 34" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Firma</label>
                                        <input value={String(formData.company_name)} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} placeholder="Firma adı" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Ziyaret Edilen</label>
                                        <input value={String(formData.visiting_person)} onChange={(e) => setFormData({ ...formData, visiting_person: e.target.value })} placeholder="İsim veya departman" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Kişi Sayısı</label>
                                        <input type="number" min={1} value={String(formData.person_count)} onChange={(e) => setFormData({ ...formData, person_count: e.target.value })} placeholder="1" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Telefon</label>
                                        <input value={String(formData.phone)} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="05xx..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama / Not</label>
                                        <textarea value={String(formData.notes)} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} placeholder="Notlar..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
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
        </div>
    );
}
