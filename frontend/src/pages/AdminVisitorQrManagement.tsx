import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import api from '../utils/api';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';

const VISITOR_QR_PATH = '/qr';

interface GateOption {
    code: string;
    name: string;
    isActive: boolean;
}

export default function AdminVisitorQrManagement() {
    const [qrDataUrlByGate, setQrDataUrlByGate] = useState<Record<string, string>>({});
    const [generatingGateCode, setGeneratingGateCode] = useState('');
    const [qrBaseUrl, setQrBaseUrl] = useState(() => {
        if (typeof window === 'undefined') {
            return '';
        }

        return window.location.origin;
    });
    const [gates, setGates] = useState<GateOption[]>([]);
    const [expandedGateCode, setExpandedGateCode] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createGateCode, setCreateGateCode] = useState('');

    const isLocalhostOrigin = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    }, []);

    const getQrTargetUrl = (gateCode: string): string => {
        const baseUrl = qrBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
        const normalizedBase = baseUrl.replace(/\/$/, '');
        const url = new URL(`${normalizedBase}${VISITOR_QR_PATH}`);

        if (gateCode) {
            url.searchParams.set('gate', gateCode);
        }

        return url.toString();
    };

    const sortedGates = useMemo(() => {
        return [...gates].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, 'tr'));
    }, [gates]);

    const loadGates = async () => {
        try {
            const response = await api.get('/admin/equipment-config');
            const gateOptions = (response.data?.data || [])
                .map((gate: any) => ({
                    code: String(gate.code || '').trim(),
                    name: String(gate.name || '').trim(),
                    isActive: Boolean(gate.isActive)
                }))
                .filter((gate: GateOption) => gate.code && gate.name);

            setGates(gateOptions);

            const preferred = gateOptions.find((gate: GateOption) => gate.isActive) || gateOptions[0];
            if (preferred) {
                setExpandedGateCode(preferred.code);
                setCreateGateCode(preferred.code);
            }
        } catch (error) {
            console.error('Kapı listesi alınamadı:', error);
        }
    };

    useEffect(() => {
        void loadGates();
    }, []);

    useRealtimeRefetch({
        topics: ['gate-config'],
        onMutation: loadGates,
    });

    useEffect(() => {
    const resolveLanTarget = async () => {
        try {
            const response = await api.get('/admin/network-info');
            let frontendBaseUrl = response.data?.data?.frontendBaseUrl;

            if (frontendBaseUrl) {
                // 1. Backend'den gelen IP'nin sonundaki "/" işaretini temizle
                frontendBaseUrl = String(frontendBaseUrl).replace(/\/$/, '');
                
                // 2. Tarayıcıdan o anki portu al (Örn: "5173")
                const currentPort = window.location.port;

                // 3. Eğer backend'den gelen adreste explicit port yoksa ve tarayıcıda bir port varsa, portu ekle
                if (currentPort) {
                    try {
                        const parsed = new URL(frontendBaseUrl);
                        if (!parsed.port) {
                            frontendBaseUrl = `${frontendBaseUrl}:${currentPort}`;
                        }
                    } catch {
                        // URL parse edilemezse mevcut davranisi bozma
                    }
                }

                setQrBaseUrl(frontendBaseUrl);
            }
        } catch (error) {
            // Eğer admin endpoint erişilemezse mevcut qrBaseUrl (window.origin) kullanılacak
            console.error('LAN adresi alınamadı; mevcut origin kullanılacak:', error);
        }
    };

    void resolveLanTarget();
}, [isLocalhostOrigin]);

    useEffect(() => {
        setQrDataUrlByGate({});
    }, [qrBaseUrl]);

    useEffect(() => {
        if (expandedGateCode) {
            void ensureQrForGate(expandedGateCode);
        }
    }, [expandedGateCode, qrBaseUrl]);

    useEffect(() => {
        const generateAllGateQrs = async () => {
            if (!sortedGates.length) return;

            const missingGates = sortedGates.filter((gate) => !qrDataUrlByGate[gate.code]);
            if (!missingGates.length) return;

            try {
                const generatedEntries = await Promise.all(
                    missingGates.map(async (gate) => {
                        const dataUrl = await QRCode.toDataURL(getQrTargetUrl(gate.code), {
                            errorCorrectionLevel: 'M',
                            margin: 1,
                            width: 320,
                            color: {
                                dark: '#0f172a',
                                light: '#ffffff'
                            }
                        });

                        return [gate.code, dataUrl] as const;
                    })
                );

                setQrDataUrlByGate((prev) => {
                    const next = { ...prev };
                    for (const [code, dataUrl] of generatedEntries) {
                        next[code] = dataUrl;
                    }
                    return next;
                });
            } catch (error) {
                console.error('Kapılar için toplu QR üretimi başarısız:', error);
            }
        };

        void generateAllGateQrs();
    }, [sortedGates, qrBaseUrl, qrDataUrlByGate]);

    const ensureQrForGate = async (gateCode: string): Promise<void> => {
        if (!gateCode) return;
        if (qrDataUrlByGate[gateCode]) return;

        try {
            setGeneratingGateCode(gateCode);
            const dataUrl = await QRCode.toDataURL(getQrTargetUrl(gateCode), {
                errorCorrectionLevel: 'M',
                margin: 1,
                width: 320,
                color: {
                    dark: '#0f172a',
                    light: '#ffffff'
                }
            });

            setQrDataUrlByGate((prev) => ({
                ...prev,
                [gateCode]: dataUrl
            }));
        } catch (error) {
            console.error('QR kod oluşturulamadı:', error);
        } finally {
            setGeneratingGateCode('');
        }
    };

    const handleToggleGate = async (gateCode: string) => {
        if (expandedGateCode === gateCode) {
            setExpandedGateCode('');
            return;
        }

        setExpandedGateCode(gateCode);
        await ensureQrForGate(gateCode);
    };

    const handleDownload = (gateCode: string) => {
        const qrDataUrl = qrDataUrlByGate[gateCode];
        if (!qrDataUrl) return;

        const gate = gates.find((item) => item.code === gateCode);
        const safeName = (gate?.name || gateCode || 'misafir').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();

        const link = document.createElement('a');
        link.href = qrDataUrl;
        link.download = `misafir-qr-${safeName}.png`;
        link.click();
    };

    const handleCreateFromModal = async () => {
        if (!createGateCode) return;
        await ensureQrForGate(createGateCode);
        setExpandedGateCode(createGateCode);
        setShowCreateModal(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex items-center justify-between gap-4">
                        <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">Misafir QR Yönetimi</h1>
                        <button
                            type="button"
                            onClick={() => setShowCreateModal(true)}
                            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
                        >
                            Yeni QR Oluştur
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8">
                <div className="max-w-5xl bg-white rounded-lg shadow border border-gray-100 overflow-hidden">
                    {!sortedGates.length ? (
                        <div className="p-6 text-sm text-amber-700">Kapı bulunamadı.</div>
                    ) : (
                        <ul className="divide-y divide-gray-200">
                            {sortedGates.map((gate) => {
                                const isExpanded = expandedGateCode === gate.code;
                                const qrDataUrl = qrDataUrlByGate[gate.code];
                                const isGenerating = generatingGateCode === gate.code;

                                return (
                                    <li key={gate.code}>
                                        <button
                                            type="button"
                                            onClick={() => void handleToggleGate(gate.code)}
                                            className="w-full flex items-center justify-between px-4 sm:px-6 py-4 text-left hover:bg-gray-50 transition"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm sm:text-base font-semibold text-gray-900">{gate.name}</span>
                                                {gate.isActive && (
                                                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Aktif</span>
                                                )}
                                            </div>
                                            <svg className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>

                                        {isExpanded && (
                                            <div className="px-4 sm:px-6 pb-5">
                                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 sm:p-5">
                                                    <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                                                        <div className="flex items-center justify-center rounded-lg bg-white border border-gray-200 p-3 w-full md:w-[320px] md:h-[320px]">
                                                            {qrDataUrl ? (
                                                                <img src={qrDataUrl} alt={`${gate.name} QR`} className="w-full max-w-[280px]" />
                                                            ) : (
                                                                <div className="text-sm text-gray-500">{isGenerating ? 'QR oluşturuluyor...' : 'QR hazır değil'}</div>
                                                            )}
                                                        </div>

                                                        <div className="w-full md:max-w-sm space-y-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDownload(gate.code)}
                                                                disabled={!qrDataUrl}
                                                                className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                                                            >
                                                                QR İndir
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </main>

            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-gray-200 p-5">
                        <h2 className="text-xl font-bold text-gray-900">Yeni QR Oluştur</h2>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Kapı Seçimi</label>
                            <select
                                value={createGateCode}
                                onChange={(e) => setCreateGateCode(e.target.value)}
                                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                            >
                                {sortedGates.map((gate) => (
                                    <option key={gate.code} value={gate.code}>
                                        {gate.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                İptal
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleCreateFromModal()}
                                disabled={!createGateCode}
                                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                            >
                                Oluştur
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
