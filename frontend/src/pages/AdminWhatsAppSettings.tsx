import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../constants';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';

interface WhatsAppStatus {
    enabled: boolean;
    connected: boolean;
    lastQrAt: string | null;
    targetJid: string | null;
    lastDisconnectReason: string | null;
}

interface WhatsAppGroup {
    id: string;
    name: string;
}

const getAdminHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
};

const formatDateTime = (value: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('tr-TR');
};

export default function AdminWhatsAppSettings() {
    const navigate = useNavigate();
    const [status, setStatus] = useState<WhatsAppStatus | null>(null);
    const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [manualGroup, setManualGroup] = useState('');
    const [loadingStatus, setLoadingStatus] = useState(true);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [qrPayload, setQrPayload] = useState<string | null>(null);
    const [connectionStarted, setConnectionStarted] = useState(false);

    const effectiveGroup = useMemo(() => selectedGroup || manualGroup.trim(), [selectedGroup, manualGroup]);
    const hasHistoricalConnection = useMemo(
        () => Boolean(status?.lastQrAt || status?.targetJid),
        [status?.lastQrAt, status?.targetJid]
    );
    const canShowAdvancedActions = Boolean(status?.connected || connectionStarted || hasHistoricalConnection || qrPayload);
    const isIntegrationEnabled = Boolean(status?.enabled);

    const fetchStatus = useCallback(async () => {
        setLoadingStatus(true);
        setError('');
        try {
            const response = await axios.get(`${API_URL}/admin/whatsapp/status`, {
                headers: getAdminHeaders(),
            });
            const nextStatus: WhatsAppStatus = response.data?.data;
            setStatus(nextStatus);
            if (nextStatus?.targetJid) {
                setSelectedGroup(nextStatus.targetJid);
                setManualGroup(nextStatus.targetJid);
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'WhatsApp durumu alınamadı.');
        } finally {
            setLoadingStatus(false);
        }
    }, []);

    const fetchGroups = useCallback(async () => {
        setLoadingGroups(true);
        setError('');
        setMessage('');
        try {
            const response = await axios.get(`${API_URL}/admin/whatsapp/groups`, {
                headers: getAdminHeaders(),
            });
            const list: WhatsAppGroup[] = response.data?.data || [];
            setGroups(list);
            setMessage(`${list.length} grup bulundu.`);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Grup listesi alınamadı.');
        } finally {
            setLoadingGroups(false);
        }
    }, []);

    const fetchQr = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/admin/whatsapp/qr`, {
                headers: getAdminHeaders(),
            });
            setQrPayload(response.data?.data?.qr || null);
        } catch {
            setQrPayload(null);
        }
    }, []);

    const saveTargetGroup = useCallback(async () => {
        if (!effectiveGroup) {
            setError('Lütfen bir grup seçin veya grup kodunu girin.');
            return;
        }

        setSaving(true);
        setError('');
        setMessage('');
        try {
            await axios.post(
                `${API_URL}/admin/whatsapp/target-group`,
                { targetJid: effectiveGroup },
                { headers: getAdminHeaders() }
            );
            setMessage('WhatsApp hedef grubu kaydedildi.');
            await fetchStatus();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Hedef grup kaydedilemedi.');
        } finally {
            setSaving(false);
        }
    }, [effectiveGroup, fetchStatus]);

    const reconnect = useCallback(async () => {
        setSaving(true);
        setError('');
        setMessage('');
        try {
            const response = await axios.post(
                `${API_URL}/admin/whatsapp/reconnect`,
                {},
                { headers: getAdminHeaders() }
            );
            setConnectionStarted(true);
            setMessage(response.data?.message || 'Yeniden bağlantı başlatıldı.');
            await fetchStatus();
            await fetchQr();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Yeniden bağlantı başlatılamadı.');
        } finally {
            setSaving(false);
        }
    }, [fetchStatus, fetchQr]);

    const resetSession = useCallback(async () => {
        const confirmed = window.confirm(
            'Bu işlem mevcut WhatsApp bağlantısını sıfırlar ve yeni QR okutulmasını ister. Devam edilsin mi?'
        );
        if (!confirmed) return;

        setSaving(true);
        setError('');
        setMessage('');
        try {
            const response = await axios.post(
                `${API_URL}/admin/whatsapp/reset-session`,
                {},
                { headers: getAdminHeaders() }
            );
            setConnectionStarted(true);
            setMessage(response.data?.message || 'WhatsApp oturumu sıfırlandı.');
            await fetchStatus();
            await fetchQr();
        } catch (err: any) {
            setError(err.response?.data?.message || 'WhatsApp oturumu sıfırlanamadı.');
        } finally {
            setSaving(false);
        }
    }, [fetchStatus, fetchQr]);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    useEffect(() => {
        if (status?.connected || status?.lastQrAt || status?.targetJid) {
            setConnectionStarted(true);
        }
    }, [status?.connected, status?.lastQrAt, status?.targetJid]);

    const startInitialConnection = useCallback(async () => {
        setSaving(true);
        setError('');
        setMessage('');
        try {
            const response = await axios.post(
                `${API_URL}/admin/whatsapp/reconnect`,
                {},
                { headers: getAdminHeaders() }
            );
            setConnectionStarted(true);
            setMessage(response.data?.message || 'Yeni bağlantı başlatıldı. QR kodunu okutun.');
            await fetchStatus();
            await fetchQr();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Yeni bağlantı başlatılamadı.');
        } finally {
            setSaving(false);
        }
    }, [fetchStatus, fetchQr]);

    useEffect(() => {
        if (!status?.connected) {
            fetchQr();
        } else {
            setQrPayload(null);
        }
    }, [status?.connected, fetchQr]);

    useEffect(() => {
        if (status?.connected) {
            return;
        }

        const interval = window.setInterval(() => {
            fetchQr();
            fetchStatus();
        }, 4000);

        return () => window.clearInterval(interval);
    }, [status?.connected, fetchQr, fetchStatus]);

    const refreshWhatsAppRealtime = useCallback(async () => {
        await fetchStatus();
        if (!status?.connected) {
            await fetchQr();
        }
    }, [fetchQr, fetchStatus, status?.connected]);

    useRealtimeRefetch({
        topics: ['whatsapp'],
        onMutation: refreshWhatsAppRealtime,
        enabled: true,
    });

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
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
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Admin Paneli</p>
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">WhatsApp Entegrasyonu</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Otomatik WhatsApp bilgilendirme ayarları ve servis durumu</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 max-w-7xl mx-auto">
                {message && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 text-sm shadow-sm animate-fadeIn">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium">{message}</span>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm shadow-sm animate-fadeIn">
                        <div className="flex items-center gap-2">
                            <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="font-medium">{error}</span>
                        </div>
                    </div>
                )}

                {!loadingStatus && status && !isIntegrationEnabled && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 text-sm shadow-sm">
                        <p className="font-semibold mb-1 flex items-center gap-1.5">
                            <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            WhatsApp Entegrasyonu Devre Dışı
                        </p>
                        <p className="mt-1 text-xs">
                            Docker ortam değişkenlerinde <strong>WHATSAPP_ENABLED=true</strong> tanımlanmalıdır. Bu ayar kapalıyken sistem QR kod oluşturamaz veya mesaj gönderemez.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: Connection Info & Steps */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* Status Card */}
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                            <div className="flex items-center justify-between mb-5">
                                <div className="flex items-center gap-2.5">
                                    <div className="relative flex h-3 w-3 shrink-0">
                                        {status?.connected ? (
                                            <>
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                                            </>
                                        )}
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-800">Bağlantı Durumu</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={fetchStatus}
                                    disabled={loadingStatus || saving}
                                    className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition"
                                    title="Yenile"
                                >
                                    <svg className={`w-5 h-5 ${loadingStatus ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.306 7H18" />
                                    </svg>
                                </button>
                            </div>

                            {loadingStatus ? (
                                <div className="flex items-center justify-center py-6">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700"></div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between min-h-[86px]">
                                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Durum</span>
                                        <span className={`text-lg font-bold mt-1 ${status?.connected ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {status?.connected ? 'Bağlantı Kuruldu' : 'Bağlantı Yok'}
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between min-h-[86px]">
                                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Son QR Oluşturma</span>
                                        <span className="text-sm font-bold mt-1 text-slate-800">
                                            {formatDateTime(status?.lastQrAt || null)}
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between min-h-[86px] md:col-span-2">
                                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Aktif Bildirim Grubu (Target JID)</span>
                                        <span className="text-xs font-mono font-bold mt-1 text-slate-800 break-all select-all">
                                            {status?.targetJid || 'Belirlenmemiş'}
                                        </span>
                                    </div>

                                    {status?.lastDisconnectReason && (
                                        <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-100/50 flex flex-col justify-between md:col-span-2">
                                            <span className="text-[11px] font-semibold text-rose-500 uppercase tracking-wider">Son Bağlantı Kesilme Nedeni</span>
                                            <span className="text-xs font-semibold mt-1 text-rose-700">
                                                {status.lastDisconnectReason}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Integration Steps */}
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                            <h2 className="text-lg font-bold text-slate-800 mb-4">Entegrasyon Adımları</h2>
                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-sm shrink-0">1</span>
                                    <div>
                                        <h3 className="font-bold text-slate-850 text-sm sm:text-base">Bağlantıyı Başlatın</h3>
                                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Eğer ilk defa bağlıyorsanız aşağıdan "Yeni Bağlantı Oluştur" veya "Yeniden Bağlan" seçeneğini kullanın.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-sm shrink-0">2</span>
                                    <div>
                                        <h3 className="font-bold text-slate-850 text-sm sm:text-base">QR Kodu Taratın</h3>
                                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Sağ tarafta beliren QR kodunu, telefonunuzdaki WhatsApp uygulamasında "Bağlı Cihazlar" menüsünü kullanarak taratın.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-sm shrink-0">3</span>
                                    <div>
                                        <h3 className="font-bold text-slate-850 text-sm sm:text-base">Bildirim Grubunu Ayarlayın</h3>
                                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Bağlantı kurulduktan sonra "Grup Listesini Getir" diyerek, alarmların/raporların iletileceği hedef WhatsApp grubunu seçin.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Setup Actions */}
                        {!canShowAdvancedActions && (
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
                                <h2 className="text-lg font-bold text-slate-800 mb-3">İlk Kurulum</h2>
                                <p className="text-sm text-slate-500 mb-5">
                                    Bu hesapta daha önce WhatsApp bağlantısı kurulmamış. Entegrasyonu başlatmak için bağlantı işlemini başlatın.
                                </p>
                                <button
                                    type="button"
                                    onClick={startInitialConnection}
                                    disabled={saving || loadingStatus || !isIntegrationEnabled}
                                    className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-sm hover:shadow-md disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
                                >
                                    Yeni Bağlantı Oluştur
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right Column: QR Scan & Group Select */}
                    <div className="lg:col-span-5 space-y-6">
                        {/* QR Scanner Card */}
                        {!status?.connected && canShowAdvancedActions && (
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col items-center">
                                <div className="w-full flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-slate-800">QR Kod Eşleştirme</h2>
                                    <button
                                        type="button"
                                        onClick={fetchQr}
                                        disabled={saving}
                                        className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 shrink-0 text-slate-500 hover:text-slate-800 transition"
                                        title="QR Kod Yenile"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.306 7H18" />
                                        </svg>
                                    </button>
                                </div>
                                <p className="text-xs text-slate-500 text-center mb-5">
                                    WhatsApp - Bağlı Cihazlar ekranından taratın. Sayfa her 4 saniyede bir otomatik yenilenir.
                                </p>

                                {qrPayload ? (
                                    <div className="p-3 border border-slate-100 rounded-2xl bg-white shadow-inner flex justify-center items-center">
                                        <img
                                            alt="WhatsApp QR"
                                            className="w-64 h-64 border border-slate-200 rounded-xl"
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrPayload)}`}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-64 h-64 border border-dashed border-slate-200 rounded-2xl bg-slate-50 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
                                        <svg className="w-8 h-8 text-slate-300 animate-pulse mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                                        </svg>
                                        QR kod yükleniyor veya hazır değil. Bekleyiniz...
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Target Group Selector */}
                        {status?.connected && (
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
                                <h2 className="text-lg font-bold text-slate-800">Hedef Bildirim Grubu</h2>
                                <p className="text-xs text-slate-500">
                                    Sistemdeki alarmların ve olay raporlarının otomatik gönderileceği WhatsApp grubunu belirleyin.
                                </p>

                                <button
                                    type="button"
                                    onClick={fetchGroups}
                                    disabled={loadingGroups || saving}
                                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition shadow-sm"
                                >
                                    {loadingGroups ? (
                                        <>
                                            <svg className="w-4 h-4 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            Yükleniyor...
                                        </>
                                    ) : 'Grup Listesini Getir'}
                                </button>

                                <div className="space-y-3 pt-2">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Listeden Grup Seç</label>
                                        <select
                                            value={selectedGroup}
                                            onChange={(e) => {
                                                setSelectedGroup(e.target.value);
                                                setManualGroup(e.target.value);
                                            }}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-350 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm text-slate-800 transition"
                                        >
                                            <option value="">-- Listeden bir grup seçin --</option>
                                            {groups.map((group) => (
                                                <option key={group.id} value={group.id}>
                                                    {group.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="relative flex py-1 items-center">
                                        <div className="flex-grow border-t border-slate-200"></div>
                                        <span className="flex-shrink mx-4 text-slate-400 text-xs">veya</span>
                                        <div className="flex-grow border-t border-slate-200"></div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Grup Kodunu (JID) Elle Girin</label>
                                        <input
                                            value={manualGroup}
                                            onChange={(e) => {
                                                setManualGroup(e.target.value);
                                                setSelectedGroup('');
                                            }}
                                            placeholder="Örn: 1203630283084839@g.us"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-350 bg-white focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm text-slate-800 transition"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={saveTargetGroup}
                                    disabled={saving || !effectiveGroup}
                                    className="w-full px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-sm hover:shadow-md disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-sm"
                                >
                                    Hedef Grubu Kaydet
                                </button>
                            </div>
                        )}

                        {/* Troubleshooting / Session Management */}
                        {canShowAdvancedActions && (
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
                                <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Sorun Giderme İşlemleri</h2>
                                <p className="text-xs text-slate-500 leading-relaxed">
                                    WhatsApp bağlantısında donma, gecikme veya kopma gibi durumlarda aşağıdaki butonları kullanabilirsiniz.
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={reconnect}
                                        disabled={saving || loadingStatus || !isIntegrationEnabled}
                                        className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-blue-200 hover:bg-blue-50 text-blue-700 font-semibold text-xs transition disabled:opacity-50"
                                    >
                                        Yeniden Bağlan
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetSession}
                                        disabled={saving || loadingStatus || !isIntegrationEnabled}
                                        className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 font-semibold text-xs transition disabled:opacity-50"
                                        title="Kimlik bilgilerini ve oturumu sıfırlar"
                                    >
                                        Oturumu Sıfırla
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
