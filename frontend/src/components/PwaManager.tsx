import { useCallback, useEffect, useRef, useState } from 'react';
import { BRANDING } from '../config/branding';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const isStandalone = (): boolean => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
};

export default function PwaManager() {
    const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [updateWorker, setUpdateWorker] = useState<ServiceWorker | null>(null);
    const [installed, setInstalled] = useState(isStandalone);
    const updateRequestedRef = useRef(false);

    useEffect(() => {
        const handleBeforeInstall = (event: Event) => {
            event.preventDefault();
            setInstallPrompt(event as BeforeInstallPromptEvent);
        };
        const handleInstalled = () => {
            setInstallPrompt(null);
            setInstalled(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        window.addEventListener('appinstalled', handleInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleInstalled);
        };
    }, []);

    useEffect(() => {
        if (!('serviceWorker' in navigator)) return;

        let disposed = false;
        let updateInterval: number | undefined;

        const watchRegistration = (registration: ServiceWorkerRegistration) => {
            if (registration.waiting && navigator.serviceWorker.controller) {
                setUpdateWorker(registration.waiting);
            }

            registration.addEventListener('updatefound', () => {
                const worker = registration.installing;
                if (!worker) return;
                worker.addEventListener('statechange', () => {
                    if (!disposed && worker.state === 'installed' && navigator.serviceWorker.controller) {
                        setUpdateWorker(worker);
                    }
                });
            });
        };

        const handleControllerChange = () => {
            if (updateRequestedRef.current) window.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        const registerServiceWorker = () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
                .then((registration) => {
                    if (disposed) return;
                    watchRegistration(registration);
                    void registration.update();
                    updateInterval = window.setInterval(() => void registration.update(), 60 * 60 * 1000);
                })
                .catch(() => {
                    // PWA desteğinin kurulamaması ana güvenlik kayıt akışını engellemez.
                });
        };

        if (document.readyState === 'complete') {
            registerServiceWorker();
        } else {
            window.addEventListener('load', registerServiceWorker, { once: true });
        }

        return () => {
            disposed = true;
            if (updateInterval) window.clearInterval(updateInterval);
            window.removeEventListener('load', registerServiceWorker);
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
    }, []);

    const installApplication = useCallback(async () => {
        if (!installPrompt) return;
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        if (choice.outcome !== 'accepted') setInstallPrompt(null);
    }, [installPrompt]);

    const applyUpdate = useCallback(() => {
        if (!updateWorker) return;
        updateRequestedRef.current = true;
        updateWorker.postMessage({ type: 'SKIP_WAITING' });
    }, [updateWorker]);

    if (updateWorker) {
        return (
            <aside className="fixed bottom-4 right-4 z-[10000] w-[min(92vw,24rem)] rounded-2xl border border-blue-200 bg-white p-4 shadow-2xl" role="status">
                <p className="font-bold text-slate-900">Yeni sürüm hazır</p>
                <p className="mt-1 text-sm text-slate-600">Güncel arayüzü güvenli biçimde yüklemek için uygulamayı yenileyin.</p>
                <button type="button" onClick={applyUpdate} className="mt-3 w-full rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                    Güncelle ve yeniden aç
                </button>
            </aside>
        );
    }

    if (!installPrompt || installed) return null;

    return (
        <aside className="fixed bottom-4 right-4 z-[10000] w-[min(92vw,24rem)] rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl" role="dialog" aria-label="Uygulama kurulumu">
            <div className="flex items-start gap-3">
                <img src="/branding/icon-192.png" alt="" className="h-12 w-12 rounded-xl border border-slate-200 object-contain" />
                <div className="min-w-0">
                    <p className="font-bold text-slate-900">{BRANDING.siteName}</p>
                    <p className="mt-1 text-sm text-slate-600">Masaüstüne uygulama olarak kurun; adres çubuğu olmadan ayrı pencerede açılsın.</p>
                </div>
            </div>
            <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setInstallPrompt(null)} className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    Şimdi değil
                </button>
                <button type="button" onClick={installApplication} className="flex-1 rounded-xl bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
                    Uygulamayı kur
                </button>
            </div>
        </aside>
    );
}
