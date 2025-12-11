import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface IncidentRecord {
    id: string;
    description: string | null;
    reported_by: string | null;
    entry_date: string | null;
    entry_time: string | null;
    status: string | null;
    created_at?: string | null;
}

export default function Incidents() {
    const [records, setRecords] = useState<IncidentRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [description, setDescription] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API_URL}/incidents/records`, { headers: { Authorization: `Bearer ${token}` } });
            setRecords(res.data || []);
        } catch (err) {
            console.warn('Olay verisi yüklenemedi', err);
        } finally {
            setLoading(false);
        }
    };

    const openModal = () => {
        setDescription('');
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/incidents/records`, { description: description || null }, { headers: { Authorization: `Bearer ${token}` } });
            setShowModal(false);
            fetchData();
        } catch (err: any) {
            alert(err?.response?.data?.message || 'Kayıt başarısız');
        }
    };

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
                                <h1 className="text-3xl font-bold text-gray-900">Olay Kayıtları</h1>
                                <p className="text-gray-600 mt-1">Olayları kaydedin ve yönetin (sözel anlatım - A4)</p>
                            </div>
                        </div>
                        <button onClick={openModal} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition shadow-md hover:shadow-lg">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Yeni Olay
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500">Kayıt bulunmuyor</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="max-h-[600px] overflow-y-auto">
                                <table className="min-w-full table-auto divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Olay Özeti</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaydeden</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {records.map(r => (
                                            <tr key={r.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 max-w-[420px]"><div className="text-sm text-gray-500 truncate">{r.description || '-'}</div></td>
                                                <td className="px-6 py-4"><div className="text-sm text-gray-900">{r.reported_by || '-'}</div></td>
                                                <td className="px-6 py-4"><div className="text-sm text-gray-900">{formatDate(r.entry_date)}</div><div className="text-xs text-gray-500">{formatTime(r.entry_time)}</div></td>
                                                <td className="px-6 py-4"><span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${r.status === 'open' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>{r.status === 'open' ? 'Açık' : 'Kapatıldı'}</span></td>
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
                    <div className="bg-white rounded-lg max-w-[840px] w-full max-h-[95vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">Yeni Olay Kaydı</h2>
                                <button onClick={() => { setShowModal(false); }} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="flex justify-center">
                                    <div className="w-full bg-gray-50 p-6 border border-gray-200 shadow-sm" style={{ maxWidth: 794 }}>
                                        <div className="bg-white p-6" style={{ height: 1123 }}>
                                            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full h-full resize-none p-4 text-sm leading-relaxed" placeholder="Olayın ayrıntılarını buraya A4 formatında yazın..."></textarea>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition">Kaydet</button>
                                    <button type="button" onClick={() => { setShowModal(false); }} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition">İptal</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
