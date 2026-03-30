import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate, formatTime, isToday } from '../utils/dateUtils';
import { validateFireAlarmForm, isValidLength } from '../utils/validation';
import ActionButton from '../components/ActionButton';

interface FireAlarm {
    id: string;
    alarm_number: string | null;
    location: string;
    alarm_time: string;
    resolved: boolean;
    resolution_time: string | null;
    resolution_notes: string | null;
    false_alarm: boolean;
    recorded_by_name: string;
    deleted_at?: string | null;
    created_at: string;
}

type FilterType = 'today' | 'active' | 'resolved';

export default function FireAlarms() {
    const [records, setRecords] = useState<FireAlarm[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [whatsappMessage, setWhatsappMessage] = useState('');
    const [showResolveModal, setShowResolveModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('today');
    const [recordVisibility, setRecordVisibility] = useState<'all' | 'active' | 'deleted'>('all');
    const [alarmNumber, setAlarmNumber] = useState('');
    const [location, setLocation] = useState('');
    const [alarmTime, setAlarmTime] = useState('');
    const [resolutionTime, setResolutionTime] = useState('');
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [falseAlarm, setFalseAlarm] = useState(false);
    const navigate = useNavigate();

    // Fetch fire alarm records
    const fetchData = useCallback(async () => {
        try {
            const res = await api.get('/fire-alarms/records?includeDeleted=true');
            setRecords(res.data?.data || []);
        } catch (err) {
            console.error('Yangın alarm verisi yüklenemedi', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Reset form
    const resetForm = useCallback(() => {
        setAlarmNumber('');
        setLocation('');
        setAlarmTime('');
        setResolutionTime('');
        setResolutionNotes('');
        setFalseAlarm(false);
        setIsEditing(false);
        setEditingId(null);
    }, []);

    // Open modal for new record
    const openModalForNew = useCallback(() => {
        resetForm();
        setShowModal(true);
    }, [resetForm]);

    // Open modal for editing
    const openModalForEdit = useCallback((record: FireAlarm) => {
        setAlarmNumber(record.alarm_number || '');
        setLocation(record.location);
        if (record.alarm_time) {
            setAlarmTime(formatTime(record.alarm_time));
        }
        if (record.resolution_time) {
            setResolutionTime(formatTime(record.resolution_time));
        }
        setResolutionNotes(record.resolution_notes || '');
        setFalseAlarm(record.false_alarm);
        setIsEditing(true);
        setEditingId(record.id);
        setShowModal(true);
    }, []);

    // Open resolve modal
    const openResolveModal = useCallback((id: string) => {
        setResolvingId(id);
        setResolutionNotes('');
        setFalseAlarm(false);
        setShowResolveModal(true);
    }, []);

    // Form submission handler
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        // Frontend validasyon - sadece konum kontrolü
        if (!location.trim()) {
            alert('Konum alanı zorunludur');
            return;
        }

        // Notlar için uzunluk kontrolü
        if (!isValidLength(resolutionNotes, 0, 1000)) {
            alert('Notlar en fazla 1000 karakter olabilir');
            return;
        }

        try {
            const payload = {
                alarm_number: alarmNumber.trim() || null,
                location: location.trim(),
                alarm_time: alarmTime || null,
                resolution_time: isEditing ? (resolutionTime || null) : null,
                false_alarm: falseAlarm,
                resolution_notes: resolutionNotes.trim() || null,
            };

            if (isEditing && editingId) {
                await api.put(`/fire-alarms/records/${editingId}`, payload);
            } else {
                const response = await api.post('/fire-alarms/records', payload);

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
    }, [alarmNumber, location, alarmTime, resolutionTime, resolutionNotes, falseAlarm, isEditing, editingId, resetForm, fetchData]);

    // Handle resolve
    const handleResolve = useCallback(async () => {
        if (!resolvingId) return;

        // Çözüm notları için uzunluk kontrolü
        if (!isValidLength(resolutionNotes, 0, 1000)) {
            alert('Çözüm notları en fazla 1000 karakter olabilir');
            return;
        }

        try {
            const response = await api.post(`/fire-alarms/records/${resolvingId}/resolve`, {
                resolution_notes: resolutionNotes.trim() || null,
                false_alarm: falseAlarm,
            });

            setShowResolveModal(false);
            setResolvingId(null);
            setResolutionNotes('');
            setFalseAlarm(false);
            fetchData();

            // WhatsApp modal göster
            if (response.data?.whatsappMessage) {
                setWhatsappMessage(response.data.whatsappMessage);
                setShowWhatsAppModal(true);
            }
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err?.response?.data?.message || 'Çözümleme başarısız');
        }
    }, [resolvingId, resolutionNotes, falseAlarm, fetchData]);

    const handleDelete = useCallback(async (id: string) => {
        if (!confirm('Bu alarm kaydını silmek istediğinizden emin misiniz?')) return;

        try {
            await api.delete(`/fire-alarms/records/${id}`);
            fetchData();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err?.response?.data?.message || 'Silme işlemi başarısız');
        }
    }, [fetchData]);

    const handleRestore = useCallback(async (id: string) => {
        try {
            await api.post(`/fire-alarms/records/${id}/restore`);
            fetchData();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err?.response?.data?.message || 'Geri alma işlemi başarısız');
        }
    }, [fetchData]);

    // Statistics
    const stats = useMemo(() => {
        const today = records.filter(r => isToday(r.alarm_time));
        const active = records.filter(r => !r.resolved);
        const falseAlarms = records.filter(r => r.false_alarm);

        return {
            totalAlarms: records.length,
            todayAlarms: today.length,
            activeAlarms: active.length,
            falseAlarms: falseAlarms.length,
        };
    }, [records]);

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            const isDeleted = Boolean(r.deleted_at);
            if (recordVisibility === 'active' && isDeleted) return false;
            if (recordVisibility === 'deleted' && !isDeleted) return false;

            if (filter === 'today') return isToday(r.alarm_time);
            if (filter === 'active') return !r.resolved;
            if (filter === 'resolved') return r.resolved;
            return true;
        });
    }, [records, filter, recordVisibility]);

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
                                <h1 className="text-3xl font-bold text-gray-900">Yangın Alarmları Kayıt Sistemi</h1>
                                <p className="text-gray-600 mt-1">Yangın alarm kayıtlarını yönetin</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => navigate('/fire-alarm-records')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition shadow-md hover:shadow-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                Kayıt Filtrele
                            </button>
                            <button onClick={openModalForNew} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition shadow-md hover:shadow-lg">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Yeni Alarm Kaydı
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-red-600 text-sm font-medium">Toplam Alarm</p>
                                <p className="text-3xl font-bold text-red-900">{stats.totalAlarms}</p>
                            </div>
                            <div className="p-3 bg-red-100 rounded-lg">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-orange-600 text-sm font-medium">Bugün Çalan</p>
                                <p className="text-3xl font-bold text-orange-900">{stats.todayAlarms}</p>
                            </div>
                            <div className="p-3 bg-orange-100 rounded-lg">
                                <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-yellow-600 text-sm font-medium">Aktif Alarmlar</p>
                                <p className="text-3xl font-bold text-yellow-900">{stats.activeAlarms}</p>
                            </div>
                            <div className="p-3 bg-yellow-100 rounded-lg">
                                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-gray-600 text-sm font-medium">Yanlış Alarm</p>
                                <p className="text-3xl font-bold text-gray-900">{stats.falseAlarms}</p>
                            </div>
                            <div className="p-3 bg-gray-100 rounded-lg">
                                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex gap-2">
                        <button onClick={() => setFilter('today')} className={`px-4 py-2 rounded-lg transition ${filter === 'today' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Bugünün Alarmları ({stats.todayAlarms})
                        </button>
                        <button onClick={() => setFilter('active')} className={`px-4 py-2 rounded-lg transition ${filter === 'active' ? 'bg-yellow-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Aktif Alarmlar ({stats.activeAlarms})
                        </button>
                        <button onClick={() => setFilter('resolved')} className={`px-4 py-2 rounded-lg transition ${filter === 'resolved' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Çözülen Alarmlar ({records.filter(r => r.resolved).length})
                        </button>
                        <button onClick={() => setRecordVisibility('all')} className={`px-4 py-2 rounded-lg transition ${recordVisibility === 'all' ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Aktif + Silinen
                        </button>
                        <button onClick={() => setRecordVisibility('active')} className={`px-4 py-2 rounded-lg transition ${recordVisibility === 'active' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Sadece Aktif
                        </button>
                        <button onClick={() => setRecordVisibility('deleted')} className={`px-4 py-2 rounded-lg transition ${recordVisibility === 'deleted' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                            Sadece Silinen
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-auto">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500">Kayıt bulunmuyor</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alarm No</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konum</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alarm Zamanı</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çözüm Zamanı</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notlar</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kaydeden</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredRecords.map(record => (
                                        <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <div className="flex items-center gap-3">
                                                    <ActionButton
                                                        onClick={() => openModalForEdit(record)}
                                                        variant="primary"
                                                        disabled={Boolean(record.deleted_at)}
                                                    >
                                                        Düzenle
                                                    </ActionButton>
                                                    {!record.resolved && !record.deleted_at && (
                                                        <ActionButton
                                                            onClick={() => openResolveModal(record.id)}
                                                            variant="success"
                                                        >
                                                            Çözümle
                                                        </ActionButton>
                                                    )}
                                                    {record.deleted_at ? (
                                                        <ActionButton onClick={() => handleRestore(record.id)} variant="success">Geri Al</ActionButton>
                                                    ) : (
                                                        <ActionButton onClick={() => handleDelete(record.id)} variant="danger">Sil</ActionButton>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900">{record.alarm_number || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-bold text-gray-900">{record.location}</div>
                                                {record.false_alarm && <span className="text-xs text-red-600 font-medium">Yanlış Alarm</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900">{formatDate(record.alarm_time)}</div>
                                                <div className="text-xs text-gray-600">{formatTime(record.alarm_time)}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {record.resolution_time ? (
                                                    <>
                                                        <div className="text-sm text-gray-900">{formatDate(record.resolution_time)}</div>
                                                        <div className="text-xs text-gray-600">{formatTime(record.resolution_time)}</div>
                                                    </>
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900 max-w-xs truncate">{record.resolution_notes || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {record.resolved ? (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">Çözüldü</span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">Aktif</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm text-gray-900">{record.recorded_by_name || '-'}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            {isEditing ? 'Alarm Kaydını Düzenle' : 'Yeni Alarm Kaydı'}
                        </h2>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Alarm Numarası</label>
                                <input
                                    type="text"
                                    value={alarmNumber}
                                    onChange={(e) => setAlarmNumber(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    placeholder="Örn: AL-001, Panel 3, Kat 2 Alarm 5"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Konum *</label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    placeholder="Örn: 3. Kat Koridor, Lobi, Mutfak"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Alarm Saati</label>
                                <input
                                    type="time"
                                    value={alarmTime}
                                    onChange={(e) => setAlarmTime(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                            </div>
                            {isEditing && records.find(r => r.id === editingId)?.resolved && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Çözüm Saati</label>
                                    <input
                                        type="time"
                                        value={resolutionTime}
                                        onChange={(e) => setResolutionTime(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    />
                                </div>
                            )}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
                                <textarea
                                    value={resolutionNotes}
                                    onChange={(e) => setResolutionNotes(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                    rows={3}
                                    placeholder="Alarm ile ilgili notlar..."
                                />
                            </div>
                            {isEditing && (
                                <div className="mb-4">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={falseAlarm}
                                            onChange={(e) => setFalseAlarm(e.target.checked)}
                                            className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                        />
                                        <span className="text-sm text-gray-700">Bu bir yanlış alarmdı</span>
                                    </label>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition"
                                >
                                    {isEditing ? 'Güncelle' : 'Kaydet'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        resetForm();
                                    }}
                                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-medium transition"
                                >
                                    İptal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Resolve Modal */}
            {showResolveModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Alarmı Çözümle</h2>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Çözüm Notları</label>
                            <textarea
                                value={resolutionNotes}
                                onChange={(e) => setResolutionNotes(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                                rows={4}
                                placeholder="Alarm nasıl çözüldü? Yangın var mıydı?"
                            />
                        </div>
                        <div className="mb-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={falseAlarm}
                                    onChange={(e) => setFalseAlarm(e.target.checked)}
                                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                />
                                <span className="text-sm text-gray-700">Bu bir yanlış alarmdı</span>
                            </label>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleResolve}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition"
                            >
                                Çözüldü Olarak İşaretle
                            </button>
                            <button
                                onClick={() => {
                                    setShowResolveModal(false);
                                    setResolvingId(null);
                                    setResolutionNotes('');
                                    setFalseAlarm(false);
                                }}
                                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-medium transition"
                            >
                                İptal
                            </button>
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

                        <p className="text-gray-600 mb-4">Yangın alarmı kaydedildi. WhatsApp'tan paylaşmak ister misiniz?</p>

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
