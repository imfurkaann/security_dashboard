import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate, formatTime, isToday } from '../utils/dateUtils';
import type { Vehicle, VehicleUsage, Manager, VehicleFormData, VehicleFilterType } from '../types';
import ActionButton from '../components/ActionButton';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';

// Initial form state
const INITIAL_FORM_DATA: VehicleFormData = {
    vehicle_id: '',
    manager_id: '',
    manager_name: '',
    destination: '',
    notes: '',
    given_time: '', // Empty means current time
    return_time: '' // Empty means no return time
};

export default function Vehicles() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [usages, setUsages] = useState<VehicleUsage[]>([]);
    const [managers, setManagers] = useState<Manager[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false); const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
    const [whatsappMessage, setWhatsappMessage] = useState(''); const [showCustomManager, setShowCustomManager] = useState(false);
    const [autoSendFailed, setAutoSendFailed] = useState(false);
    const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
    const [filter, setFilter] = useState<VehicleFilterType>('all');
    const [formData, setFormData] = useState<VehicleFormData>(INITIAL_FORM_DATA);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUsage, setEditingUsage] = useState<VehicleUsage | null>(null);
    const [textPreview, setTextPreview] = useState<{ title: string; value: string } | null>(null);
    const [scrollbarSpacerWidth, setScrollbarSpacerWidth] = useState(0);
    const navigate = useNavigate();
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);

    // Fetch all data in parallel
    const fetchData = useCallback(async () => {
        try {
            const [vehiclesRes, recordsRes, managersRes] = await Promise.all([
                api.get('/vehicles'),
                api.get('/vehicles/records?includeDeleted=true'),
                api.get('/vehicles/managers'),
            ]);
            setVehicles(vehiclesRes.data || []);
            setUsages(recordsRes.data || []);
            setManagers(managersRes.data || []);
        } catch (error) {
            console.error('Veri yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useRealtimeRefetch({
        topics: ['vehicles', 'managers'],
        onMutation: fetchData,
        enabled: true,
    });



    // Form submission handler
    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await api.post('/vehicles/records', formData);
            setShowModal(false);
            setFormData(INITIAL_FORM_DATA);
            setShowCustomManager(false);
            fetchData();

            // WhatsApp mesajı varsa modal göster
            if (response.data?.whatsappMessage) {
                setWhatsappMessage(response.data.whatsappMessage);
                setAutoSendFailed(false);
                setShowWhatsAppModal(true);
            }
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err.response?.data?.message || 'İşlem başarısız');
        }
    }, [formData, fetchData]);

    // Vehicle return handler
    const handleReturn = useCallback(async (usageId: string) => {
        if (!confirm('Aracın iadesini kaydetmek istediğinize emin misiniz?')) return;

        try {
            const response = await api.post(`/vehicles/records/${usageId}/return`, {});
            fetchData();

            // WhatsApp mesajı varsa modal göster
            if (response.data?.whatsappMessage) {
                setWhatsappMessage(response.data.whatsappMessage);
                setAutoSendFailed(false);
                setShowWhatsAppModal(true);
            }
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err.response?.data?.message || 'İade kaydı başarısız');
        }
    }, [fetchData]);

    const handleUndoReturn = useCallback(async (usageId: string) => {
        if (!confirm('Yanlış teslim alma işlemini geri almak istediğinize emin misiniz?')) return;

        try {
            await api.post(`/vehicles/records/${usageId}/undo-return`, {});
            fetchData();
            alert('Teslim alma işlemi geri alındı. Doğru araç için tekrar işlem yapabilirsiniz.');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err.response?.data?.message || 'Teslim alma geri alma işlemi başarısız');
        }
    }, [fetchData]);

    const handleDeleteRecord = useCallback(async (usageId: string) => {
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

        try {
            await api.delete(`/vehicles/records/${usageId}`);
            setUsages(prev => prev.map(usage => usage.id === usageId ? { ...usage, deleted_at: new Date().toISOString() } : usage));
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err.response?.data?.message || 'Kayıt silinemedi');
        }
    }, []);

    const handleRestoreRecord = useCallback(async (usageId: string) => {
        try {
            await api.post(`/vehicles/records/${usageId}/restore`);
            setUsages(prev => prev.map(usage => usage.id === usageId ? { ...usage, deleted_at: null } : usage));
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err.response?.data?.message || 'Kayıt geri alınamadı');
        }
    }, []);

    const handleSendWhatsAppAutomatic = useCallback(async () => {
        setSendingWhatsApp(true);
        try {
            const response = await api.post('/vehicles/send-whatsapp-message', {
                message: whatsappMessage,
            });

            if (response.data?.success) {
                setShowWhatsAppModal(false);
                setAutoSendFailed(false);
            } else {
                setAutoSendFailed(true);
                alert(`Mesaj gönderilemedi: ${response.data?.reason || 'Bilinmeyen hata'}. Lütfen Manuel Mesaj Gönder butonunu kullanın.`);
            }
        } catch (error: any) {
            setAutoSendFailed(true);
            alert(`WhatsApp mesajı gönderilemedi: ${error.response?.data?.message || error.message}. Lütfen Manuel Mesaj Gönder butonunu kullanın.`);
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

    // Reset form to initial state
    const resetForm = useCallback(() => {
        setFormData(INITIAL_FORM_DATA);
        setShowCustomManager(false);
    }, []);

    // Open modal with reset form
    const openModal = useCallback(() => {
        resetForm();
        setShowModal(true);
    }, [resetForm]);

    // Open edit modal
    const openEditModal = useCallback((usage: VehicleUsage) => {
        setEditingUsage(usage);

        // Parse vehicle_id from the usage record
        const vehicleMatch = vehicles.find(v => v.plate === usage.vehicle_plate);
        const vehicleId = vehicleMatch?.id || '';

        // Parse manager_id if exists (check if manager is in the list)
        const managerMatch = managers.find(m =>
            `${m.first_name} ${m.last_name}` === usage.manager
        );
        const managerId = managerMatch?.id || '';

        // Pre-fill form with existing data
        setFormData({
            vehicle_id: vehicleId,
            manager_id: managerId,
            manager_name: managerId ? '' : usage.manager, // Use manager_name if not in list
            destination: usage.destination || '',
            notes: usage.notes || '',
            given_time: usage.given_time ? formatTime(usage.given_time) : '',
            return_time: usage.return_time ? formatTime(usage.return_time) : ''
        });

        // If manager not in list, show custom input
        setShowCustomManager(!managerId);
        setShowEditModal(true);
    }, [vehicles, managers]);

    // Handle edit submit
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
            setFormData(INITIAL_FORM_DATA);
            setShowCustomManager(false);
            fetchData();
            alert('Kayıt başarıyla güncellendi');
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err.response?.data?.message || 'İşlem başarısız');
        }
    }, [formData, editingUsage, fetchData]);

    // Memoized calculations for performance
    const todayUsages = useMemo(() =>
        usages.filter(u => !u.deleted_at && (isToday(u.given_date) || (u.return_date && isToday(u.return_date)))),
        [usages]
    );

    const todayDeletedUsages = useMemo(
        () => usages.filter(u => Boolean(u.deleted_at) && isToday(u.deleted_at)),
        [usages]
    );

    const filteredUsages = useMemo(() => {
        if (filter === 'all') return todayUsages; // Bugünün kayıtları
        if (filter === 'in_use') return usages.filter(u => u.status === 'in_use' && !u.deleted_at); // Kullanımda olan araçlar
        if (filter === 'deleted') return todayDeletedUsages; // Bugün soft silinen kayıtlar
        return usages;
    }, [usages, filter, todayUsages, todayDeletedUsages]);

    const normalizeVehiclePlate = useCallback(
        (plate: string | null | undefined) => (plate || '').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ''),
        []
    );

    const activeInUseVehicleIds = useMemo(() => (
        new Set(
            usages
                .filter(u => u.status === 'in_use' && !u.deleted_at && u.vehicle_id)
                .map(u => u.vehicle_id as string)
        )
    ), [usages]);

    const activeInUseVehiclePlates = useMemo(() => (
        new Set(
            usages
                .filter(u => u.status === 'in_use' && !u.deleted_at)
                .map(u => normalizeVehiclePlate(u.vehicle_plate))
                .filter(Boolean)
        )
    ), [usages, normalizeVehiclePlate]);

    const inUseCount = useMemo(() => usages.filter(u => u.status === 'in_use' && !u.deleted_at).length, [usages]);
    const availableVehicles = useMemo(
        () => vehicles.filter(v => {
            if (activeInUseVehicleIds.has(v.id)) return false;
            return !activeInUseVehiclePlates.has(normalizeVehiclePlate(v.plate));
        }),
        [vehicles, activeInUseVehicleIds, activeInUseVehiclePlates, normalizeVehiclePlate]
    );

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
    }, [filteredUsages.length, loading]);

    const syncBottomScroll = () => {
        const tableNode = tableScrollRef.current;
        const barNode = bottomScrollRef.current;
        if (!tableNode || !barNode) return;
        tableNode.scrollLeft = barNode.scrollLeft;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="p-2 hover:bg-slate-800 rounded-lg transition shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Otel Araç Kayıt Sayfası</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Otel araçlarının kullanım kayıtlarını yönetin</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-3 w-full lg:w-auto">
                            <button
                                onClick={() => navigate('/vehicle-records')}
                                className="flex items-center justify-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg transition shadow-md hover:shadow-lg text-sm sm:text-base"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                                Kayıt Filtrele
                            </button>
                            <button
                                onClick={() => openModal()}
                                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg transition shadow-md hover:shadow-lg text-sm sm:text-base"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Araç Teslim Et
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 pb-14 flex flex-col gap-4 overflow-hidden">
                <div className="w-full">
                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                        <div className="rounded-xl shadow-sm p-3 min-h-[92px] border border-blue-500 bg-gradient-to-br from-blue-500 to-blue-700">
                            <div className="flex items-center gap-3 min-h-[48px]">
                                <div className="p-2 bg-blue-400/30 rounded-lg border border-blue-300/60 shrink-0 text-white">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                    </svg>
                                </div>
                                <div className="min-w-0 flex-1 text-center">
                                    <p className="text-[11px] font-bold text-white/90 uppercase tracking-wider leading-none">Toplam Araç</p>
                                    <p className="text-xl font-bold text-white leading-none mt-1">{vehicles.length}</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-xl shadow-sm p-3 min-h-[92px] border border-emerald-500 bg-gradient-to-br from-emerald-500 to-emerald-700">
                            <div className="flex items-center gap-3 min-h-[48px]">
                                <div className="p-2 bg-emerald-400/30 rounded-lg border border-emerald-300/60 shrink-0 text-white">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div className="min-w-0 flex-1 text-center">
                                    <p className="text-[11px] font-bold text-white/90 uppercase tracking-wider leading-none">Kullanımda</p>
                                    <p className="text-xl font-bold text-white leading-none mt-1">{inUseCount}</p>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Filters */}
                    <div className="bg-white rounded-lg shadow px-3 py-2 mb-4 w-full">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-3 sm:px-3.5 py-1.5 rounded-md transition text-sm ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Bugünün Kayıtları ({todayUsages.length})
                            </button>
                            <button
                                onClick={() => setFilter('in_use')}
                                className={`px-3 sm:px-3.5 py-1.5 rounded-md transition text-sm ${filter === 'in_use' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Kullanımda Olan Araçlar ({inUseCount})
                            </button>
                            <button
                                onClick={() => setFilter('deleted')}
                                className={`px-3 sm:px-3.5 py-1.5 rounded-md transition text-sm ${filter === 'deleted' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                Silinen Kayıtlar ({todayDeletedUsages.length})
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden w-full flex-1 min-h-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-full min-h-[240px] py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredUsages.length === 0 ? (
                        <div className="text-center h-full min-h-[240px] flex items-center justify-center py-12">
                            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                            <p className="text-gray-500">Kayıt bulunmuyor</p>
                        </div>
                    ) : (
                        <div
                            ref={tableScrollRef}
                            className="h-full min-h-0 overflow-x-hidden overflow-y-auto pb-2"
                        >
                            <div className="min-h-full">
                                <table className="w-full min-w-[1610px] table-fixed divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="w-[220px] px-3 lg:px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                                            <th className="w-[80px] px-3 lg:px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kapı</th>
                                            <th className="w-[180px] px-3 lg:px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Araç</th>
                                            <th className="w-[170px] px-3 lg:px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Alan Kişi</th>
                                            <th className="w-[180px] px-3 lg:px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konum</th>
                                            <th className="w-[140px] px-3 lg:px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teslim Edilme</th>
                                            <th className="w-[140px] px-3 lg:px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teslim Alınma</th>
                                            <th className="w-[220px] px-3 lg:px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                                            <th className="w-[140px] px-3 lg:px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teslim Eden</th>
                                            <th className="w-[140px] px-3 lg:px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teslim Alan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredUsages.map((usage) => (
                                            <tr key={usage.id} className={`hover:bg-gray-50 ${usage.deleted_at ? 'opacity-60' : ''}`}>
                                                <td className="px-3 lg:px-4 py-4 text-sm align-top">
                                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                                        {usage.deleted_at ? (
                                                            <ActionButton onClick={() => handleRestoreRecord(usage.id)} variant="success" className="shrink-0">Geri Al</ActionButton>
                                                        ) : (
                                                            <>
                                                                <ActionButton onClick={() => openEditModal(usage)} variant="primary" className="shrink-0">Düzenle</ActionButton>
                                                                {usage.status === 'in_use' && (
                                                                    <ActionButton onClick={() => handleReturn(usage.id)} variant="success" className="shrink-0">Teslim Al</ActionButton>
                                                                )}
                                                                {usage.status === 'returned' && (
                                                                    <ActionButton onClick={() => handleUndoReturn(usage.id)} variant="neutral" className="shrink-0">Geri Al</ActionButton>
                                                                )}
                                                                <ActionButton onClick={() => handleDeleteRecord(usage.id)} variant="danger" className="shrink-0">Sil</ActionButton>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 lg:px-4 py-4 align-top whitespace-nowrap">
                                                    <div className="text-sm text-gray-900 whitespace-nowrap">{usage.gate || '-'}</div>
                                                </td>
                                                <td className="px-3 lg:px-4 py-4 align-top">
                                                    <div className="flex items-center">
                                                        <div className="ml-0">
                                                            <div className="text-sm font-bold text-gray-900 break-words">{usage.vehicle_plate}</div>
                                                            <div className="text-xs text-gray-500 break-words">{usage.vehicle_brand}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 lg:px-4 py-4 align-top">
                                                    <div className="text-sm text-gray-900 break-words">{usage.manager || '-'}</div>
                                                    <div className="text-xs text-gray-500 break-words">{usage.manager_title}</div>
                                                </td>
                                                <td className="px-3 lg:px-4 py-4 align-top">
                                                    <div className="text-sm text-gray-900 break-words">{usage.destination || '-'}</div>
                                                </td>
                                                <td className="px-3 lg:px-4 py-4 align-top">
                                                    <div className="text-sm text-gray-900">{formatDate(usage.given_date)}</div>
                                                    <div className="text-xs text-gray-500">{formatTime(usage.given_time)}</div>
                                                </td>
                                                <td className="px-3 lg:px-4 py-4 align-top">
                                                    {usage.return_date ? (
                                                        <>
                                                            <div className="text-sm text-gray-900">{formatDate(usage.return_date)}</div>
                                                            <div className="text-xs text-gray-500">{formatTime(usage.return_time)}</div>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 lg:px-4 py-4 align-top">
                                                    {renderPreviewText(usage.notes, 'Açıklama')}
                                                </td>
                                                <td className="px-3 lg:px-4 py-4 align-top">
                                                    <div className="text-sm text-gray-900 break-words">{usage.given_by || '-'}</div>
                                                </td>
                                                <td className="px-3 lg:px-4 py-4 align-top">
                                                    <div className="text-sm text-gray-900 break-words">{usage.returned_by || '-'}</div>
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

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">
                                    Araç Kullanımı Kaydı
                                </h2>
                                <button
                                    onClick={() => { setShowModal(false); resetForm(); }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Araç Seçin <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            required
                                            value={formData.vehicle_id}
                                            onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        >
                                            <option value="">Araç seçiniz...</option>
                                            {availableVehicles.map(vehicle => (
                                                <option key={vehicle.id} value={vehicle.id}>
                                                    {vehicle.plate} - {vehicle.brand}
                                                </option>
                                            ))}
                                        </select>
                                        {availableVehicles.length === 0 && (
                                            <p className="text-sm text-red-600 mt-1">Müsait araç bulunmamaktadır</p>
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
                                            Boş bırakırsanız anlık saat kaydedilir
                                        </p>
                                    </div>

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
                                        disabled={availableVehicles.length === 0}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                                    >
                                        Araç Teslim Et
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowModal(false); resetForm(); }}
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

            {/* Edit Modal */}
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