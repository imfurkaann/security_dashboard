import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';

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

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6">
                    <h1 className="text-2xl font-bold text-gray-900">WhatsApp Bağlantı Yönetimi</h1>
                    <p className="text-sm text-gray-600 mt-2">
                        Bu ekran sadece admin için tasarlanmıştır. Teknik bilgi gerektirmez; adımları sırayla uygulayın.
                    </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-3">Kullanım Adımları</h2>
                    <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1">
                        <li>İlk kurulumda Yeni Bağlantı Oluştur butonuna basın.</li>
                        <li>QR kodu telefondaki WhatsApp - Bağlı Cihazlar ekranından okutun.</li>
                        <li>Bağlantı kurulduktan sonra grup listesini çekip hedef grubu kaydedin.</li>
                        <li>Bağlantı koparsa önce Yeniden Bağlan, olmazsa Oturumu Sıfırla kullanın.</li>
                    </ol>
                </div>

                {!canShowAdvancedActions && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">1) İlk Kurulum</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            Bu hesapta daha önce WhatsApp bağlantısı yok. İlk bağlantıyı başlatmak için aşağıdaki butona basın.
                        </p>
                        <button
                            type="button"
                            onClick={startInitialConnection}
                            disabled={saving || loadingStatus}
                            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400"
                        >
                            Yeni Bağlantı Oluştur
                        </button>
                    </div>
                )}

                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-semibold text-gray-900">Bağlantı Durumu</h2>
                        <button
                            type="button"
                            onClick={fetchStatus}
                            disabled={loadingStatus || saving}
                            className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
                        >
                            Yenile
                        </button>
                    </div>

                    {loadingStatus ? (
                        <p className="text-sm text-gray-600">Durum yükleniyor...</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                                <p className="text-gray-500">Bağlantı</p>
                                <p className={`font-semibold ${status?.connected ? 'text-green-700' : 'text-red-700'}`}>
                                    {status?.connected ? 'Bağlı' : 'Bağlı Değil'}
                                </p>
                            </div>
                            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                                <p className="text-gray-500">Hedef Grup</p>
                                <p className="font-semibold text-gray-900 break-all">{status?.targetJid || '-'}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                                <p className="text-gray-500">Son QR Oluşturma</p>
                                <p className="font-semibold text-gray-900">{formatDateTime(status?.lastQrAt || null)}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                                <p className="text-gray-500">Son Kopma Nedeni</p>
                                <p className="font-semibold text-gray-900">{status?.lastDisconnectReason || '-'}</p>
                            </div>
                        </div>
                    )}
                </div>

                {status?.connected && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">Hedef WhatsApp Grubu</h2>

                        <div className="flex flex-col sm:flex-row gap-2 mb-3">
                            <button
                                type="button"
                                onClick={fetchGroups}
                                disabled={loadingGroups || saving}
                                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
                            >
                                {loadingGroups ? 'Gruplar Yükleniyor...' : 'Grup Listesini Getir'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm text-gray-700 mb-1">Listeden Grup Seç</label>
                                <select
                                    value={selectedGroup}
                                    onChange={(e) => {
                                        setSelectedGroup(e.target.value);
                                        setManualGroup(e.target.value);
                                    }}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                >
                                    <option value="">-- Grup Seçin --</option>
                                    {groups.map((group) => (
                                        <option key={group.id} value={group.id}>
                                            {group.name} ({group.id})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-gray-700 mb-1">Veya Grup Kodunu Elle Gir</label>
                                <input
                                    value={manualGroup}
                                    onChange={(e) => {
                                        setManualGroup(e.target.value);
                                        setSelectedGroup('');
                                    }}
                                    placeholder="120363...@g.us"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-300"
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={saveTargetGroup}
                            disabled={saving}
                            className="mt-3 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400"
                        >
                            Hedef Grubu Kaydet
                        </button>
                    </div>
                )}

                {!status?.connected && canShowAdvancedActions && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold text-gray-900">2) QR Kod ile Eşleştirme</h2>
                            <button
                                type="button"
                                onClick={fetchQr}
                                disabled={saving}
                                className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:bg-gray-100"
                            >
                                QR Yenile
                            </button>
                        </div>

                        <p className="text-sm text-gray-600 mb-4">
                            WhatsApp uygulamasında Bağlı Cihazlar ekranını açın ve bu QR kodu okutun.
                        </p>

                        {qrPayload ? (
                            <div className="flex justify-center">
                                <img
                                    alt="WhatsApp QR"
                                    className="w-64 h-64 border border-gray-200 rounded-lg"
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrPayload)}`}
                                />
                            </div>
                        ) : (
                            <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3">
                                QR henüz hazır değil. Birkaç saniye bekleyip QR Yenile butonuna basın.
                            </div>
                        )}
                    </div>
                )}

                {canShowAdvancedActions && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3">3) Sorun Giderme İşlemleri</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            Bağlantı kopması yaşarsanız bu işlemleri kullanın.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                type="button"
                                onClick={reconnect}
                                disabled={saving || loadingStatus}
                                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-400"
                            >
                                Yeniden Bağlan
                            </button>
                            <button
                                type="button"
                                onClick={resetSession}
                                disabled={saving || loadingStatus}
                                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-400"
                            >
                                Oturumu Sıfırla (Auth Dosyalarını Temizle)
                            </button>
                        </div>
                    </div>
                )}

                {message && (
                    <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg p-3 text-sm">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-sm">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
