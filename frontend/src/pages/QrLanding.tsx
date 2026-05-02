import { useCallback, useMemo } from 'react';

export default function QrLanding() {
    const selectedGate = useMemo(() => {
        if (typeof window === 'undefined') return '';
        return new URLSearchParams(window.location.search).get('gate')?.trim() || '';
    }, []);

    const goToVisitor = useCallback(() => {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        url.pathname = '/qr/visitor-checkin';
        if (selectedGate) url.searchParams.set('gate', selectedGate);
        url.searchParams.set('action', 'visitor');
        window.location.assign(`${url.pathname}${url.search}`);
    }, [selectedGate]);

    const goToSgk = useCallback(() => {
        if (typeof window === 'undefined') return;
        const url = new URL(window.location.href);
        url.pathname = '/qr/sgk-upload';
        if (selectedGate) url.searchParams.set('gate', selectedGate);
        window.location.assign(`${url.pathname}${url.search}`);
    }, [selectedGate]);

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                <h1 className="text-2xl font-bold text-slate-900 mb-4">QR Islemleri</h1>

                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={goToSgk}
                        className="w-full rounded-lg bg-blue-700 text-white py-3 font-medium"
                    >
                        SGK Belgesi Yukle
                    </button>

                    <button
                        type="button"
                        onClick={goToVisitor}
                        className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium"
                    >
                        Giris Kaydi Olustur
                    </button>
                </div>
            </div>
        </div>
    );
}
