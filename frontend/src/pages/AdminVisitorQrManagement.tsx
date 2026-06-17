import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import api from '../utils/api';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
import { ArrowLeft, QrCode, Download, Printer, Plus, Check, Info, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { Modal, message } from 'antd';

const VISITOR_QR_PATH = '/qr';

interface GateOption {
    code: string;
    name: string;
    isActive: boolean;
}

export default function AdminVisitorQrManagement() {
    const navigate = useNavigate();
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
        if (!isLocalhostOrigin) return;

        const resolveLanTarget = async () => {
            try {
                const response = await api.get('/admin/network-info');
                let frontendBaseUrl = response.data?.data?.frontendBaseUrl;

                if (frontendBaseUrl) {
                    frontendBaseUrl = String(frontendBaseUrl).replace(/\/$/, '');
                    const currentPort = window.location.port;

                    if (currentPort) {
                        try {
                            const parsed = new URL(frontendBaseUrl);
                            if (!parsed.port) {
                                frontendBaseUrl = `${frontendBaseUrl}:${currentPort}`;
                            }
                        } catch {
                            // URL parse error
                        }
                    }
                    setQrBaseUrl(frontendBaseUrl);
                }
            } catch (error) {
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
                            margin: 2,
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
                margin: 2,
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

    const handlePrint = (gateCode: string, gateName: string) => {
        const qrDataUrl = qrDataUrlByGate[gateCode];
        if (!qrDataUrl) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            message.error('Yazdırma penceresi açılır pencere engelleyicisi tarafından engellendi.');
            return;
        }

        printWindow.document.write(`
            <html>
            <head>
                <title>QR Kod Yazdır - ${gateName}</title>
                <style>
                    body {
                        margin: 0;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        font-family: system-ui, -apple-system, sans-serif;
                        text-align: center;
                        background: white;
                        color: black;
                    }
                    .container {
                        padding: 30px;
                        border: 2px dashed #cbd5e1;
                        border-radius: 20px;
                        max-width: 400px;
                    }
                    img {
                        width: 300px;
                        height: 300px;
                        object-fit: contain;
                    }
                    h1 {
                        font-size: 26px;
                        font-weight: 800;
                        margin: 20px 0 5px 0;
                        color: #0f172a;
                    }
                    p {
                        color: #64748b;
                        font-size: 14px;
                        margin: 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <img src="${qrDataUrl}" />
                    <h1>${gateName}</h1>
                    <p>Güvenlik Giriş Misafir QR Kodu</p>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 500);
                    }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleCopyUrl = (url: string) => {
        navigator.clipboard.writeText(url);
        message.success('QR hedef URL panoya kopyalandı');
    };

    const handleDownloadAll = async () => {
        const activeGates = sortedGates.filter(g => qrDataUrlByGate[g.code]);
        if (activeGates.length === 0) {
            message.warning('İndirilecek hazır QR kod bulunamadı');
            return;
        }

        message.loading({ content: 'QR kodlar indiriliyor...', key: 'dl_all' });
        for (let i = 0; i < activeGates.length; i++) {
            const gate = activeGates[i];
            const dataUrl = qrDataUrlByGate[gate.code];
            const safeName = (gate.name || gate.code).replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();

            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `misafir-qr-${safeName}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            await new Promise(resolve => setTimeout(resolve, 300));
        }
        message.success({ content: 'Tüm QR kodlar başarıyla indirildi', key: 'dl_all' });
    };

    const handleCreateFromModal = async () => {
        if (!createGateCode) return;
        await ensureQrForGate(createGateCode);
        setExpandedGateCode(createGateCode);
        setShowCreateModal(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                            <button
                                type="button"
                                onClick={() => navigate('/admin/dashboard')}
                                className="p-2.5 hover:bg-slate-800 rounded-xl transition shrink-0 border border-slate-700/60 bg-slate-800/45 text-slate-300 hover:text-white"
                                title="Geri Dön"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-tight break-words">
                                    Misafir QR Yönetimi
                                </h1>
                                <p className="text-sm text-slate-300 mt-1">
                                    Misafirlerin kendi telefonlarından giriş yapabilmesi için kapılara özel karekodları üretin ve indirin.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 w-full sm:w-auto shrink-0">
                            <button
                                type="button"
                                onClick={handleDownloadAll}
                                className="flex-1 sm:flex-none bg-white hover:bg-gray-550 text-slate-700 border border-gray-300 px-4 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all hover:text-slate-900 text-sm shadow-sm"
                            >
                                <Download className="w-4.5 h-4.5" />
                                Toplu QR İndir
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(true)}
                                className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm text-sm"
                            >
                                <Plus className="w-4.5 h-4.5" />
                                Yeni QR Oluştur
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6 max-w-7xl mx-auto">


                {/* QR Cards Grid */}
                {!sortedGates.length ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500 shadow-sm flex flex-col items-center gap-3 justify-center min-h-[300px]">
                        <span className="text-lg font-medium text-gray-700">Tanımlı Geçiş Kapısı Yok</span>
                        <span className="text-sm text-gray-450 max-w-md">Karekod üretebilmek için öncelikle sisteme en az bir kapı eklemeniz gerekmektedir.</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sortedGates.map((gate) => {
                            const qrDataUrl = qrDataUrlByGate[gate.code];
                            const isGenerating = generatingGateCode === gate.code;
                            const targetUrl = getQrTargetUrl(gate.code);

                            return (
                                <div 
                                    key={gate.code}
                                    className="bg-white border border-gray-250 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-gray-300 transition-all duration-300 relative group overflow-hidden"
                                >
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between gap-3 relative z-10">
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-gray-900 text-base truncate" title={gate.name}>
                                                {gate.name}
                                            </h3>
                                            <span className="text-[10px] font-mono text-slate-400 block uppercase tracking-wider mt-0.5">KOD: {gate.code}</span>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                                            gate.isActive 
                                                ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
                                                : 'bg-gray-100 border-gray-200 text-gray-500'
                                        }`}>
                                            {gate.isActive ? 'Aktif' : 'Pasif'}
                                        </span>
                                    </div>

                                    {/* Card Body: QR Frame */}
                                    <div className="relative my-5 flex flex-col items-center justify-center z-10">
                                        <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-center w-[190px] h-[190px] shadow-sm relative group-hover:scale-[1.02] transition-all duration-300">
                                            {qrDataUrl ? (
                                                <img src={qrDataUrl} alt={`${gate.name} QR`} className="w-full h-full object-contain select-none" />
                                            ) : (
                                                <div className="text-gray-400 text-xs text-center flex flex-col items-center gap-2">
                                                    <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
                                                    <span>{isGenerating ? 'QR üretiliyor...' : 'Yükleniyor'}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Target Link preview */}
                                        <div className="w-full mt-4 bg-slate-50 border border-gray-150 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-mono text-slate-650 truncate select-all">{targetUrl}</span>
                                            <div className="flex gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyUrl(targetUrl)}
                                                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-gray-100 rounded transition"
                                                    title="URL'yi Kopyala"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                                <a
                                                    href={targetUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-gray-100 rounded transition"
                                                    title="Hedefe Git"
                                                >
                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                </a>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Footer: Action buttons */}
                                    <div className="flex gap-2 relative z-10 border-t border-gray-100 pt-4 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => handleDownload(gate.code)}
                                            disabled={!qrDataUrl}
                                            className="flex-1 bg-white hover:bg-gray-50 text-slate-700 hover:text-slate-900 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-gray-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <Download className="w-4 h-4" />
                                            İndir
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handlePrint(gate.code, gate.name)}
                                            disabled={!qrDataUrl}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                                        >
                                            <Printer className="w-4 h-4" />
                                            Yazdır
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
                    <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl p-6 text-gray-800 animate-scaleIn">
                        <div className="flex items-center gap-2 mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Yeni QR Karekod Oluştur</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hedef Kapı Seçimi</label>
                                <select
                                    value={createGateCode}
                                    onChange={(e) => setCreateGateCode(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl focus:border-blue-500 outline-none text-gray-900 text-sm transition-all focus:ring-1 focus:ring-blue-500/30"
                                >
                                    <option value="" disabled>Seçiniz...</option>
                                    {sortedGates.map((gate) => (
                                        <option key={gate.code} value={gate.code} className="bg-white text-gray-900">
                                            {gate.name} (Kod: {gate.code})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Kapıya ait QR kod görselini el ile tetikleyerek oluşturabilir ve doğrudan panonuza ekleyebilirsiniz.
                            </p>
                        </div>

                        <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-150">
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 rounded-xl text-sm font-semibold transition"
                            >
                                İptal
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleCreateFromModal()}
                                disabled={!createGateCode}
                                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
