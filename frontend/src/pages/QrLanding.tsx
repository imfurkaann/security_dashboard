import { useCallback, useMemo, useState } from 'react';

const TRANSLATIONS: Record<string, { title: string; sgkBtn: string; visitorBtn: string }> = {
    tr: {
        title: "QR İşlemleri",
        sgkBtn: "SGK Belgesi Yükle",
        visitorBtn: "Giriş Kaydı Oluştur"
    },
    en: {
        title: "QR Operations",
        sgkBtn: "Upload SGK Document",
        visitorBtn: "Create Entry Record"
    },
    de: {
        title: "QR-Aktionen",
        sgkBtn: "SGK-Dokument hochladen",
        visitorBtn: "Eintragungsdatensatz erstellen"
    },
    ru: {
        title: "QR Операции",
        sgkBtn: "Загрузить документ SGK",
        visitorBtn: "Создать запись о входе"
    }
};

const LANGUAGES = [
    { code: 'tr', name: 'Türkçe', flagUrl: 'https://flagcdn.com/w40/tr.png' },
    { code: 'en', name: 'English', flagUrl: 'https://flagcdn.com/w40/us.png' },
    { code: 'de', name: 'Deutsch', flagUrl: 'https://flagcdn.com/w40/de.png' },
    { code: 'ru', name: 'Русский', flagUrl: 'https://flagcdn.com/w40/ru.png' }
];

export default function QrLanding() {
    const [currentLang, setCurrentLang] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('qr_lang') || 'tr';
        }
        return 'tr';
    });
    const [dropdownOpen, setDropdownOpen] = useState(false);

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

    const t = TRANSLATIONS[currentLang] || TRANSLATIONS.tr;
    const selectedLanguageObj = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

    const changeLanguage = (code: string) => {
        setCurrentLang(code);
        if (typeof window !== 'undefined') {
            localStorage.setItem('qr_lang', code);
        }
        setDropdownOpen(false);
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10 relative">
            {/* Dil Seçici (Sağ Üst - CDN Bayrak Resimleri) */}
            <div className="absolute top-4 right-4 z-50 inline-block text-left">
                <div>
                    <button
                        type="button"
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="inline-flex items-center justify-center w-12 h-10 rounded-lg border border-slate-300 shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/20 hover:bg-slate-50"
                        title={selectedLanguageObj.name}
                    >
                        <img
                            src={selectedLanguageObj.flagUrl}
                            alt={selectedLanguageObj.name}
                            className="w-6 h-auto object-cover rounded-sm border border-slate-200"
                        />
                    </button>
                </div>

                {dropdownOpen && (
                    <div className="origin-top-right absolute right-0 mt-1 w-12 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
                        <div className="py-1 flex flex-col items-center gap-1">
                            {LANGUAGES.map((lang) => (
                                <button
                                    key={lang.code}
                                    type="button"
                                    onClick={() => changeLanguage(lang.code)}
                                    className={`flex items-center justify-center w-10 h-10 rounded-md hover:bg-slate-100 ${
                                        currentLang === lang.code ? 'bg-slate-50 font-semibold' : ''
                                    }`}
                                    title={lang.name}
                                >
                                    <img
                                        src={lang.flagUrl}
                                        alt={lang.name}
                                        className="w-6 h-auto object-cover rounded-sm border border-slate-200"
                                    />
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                <h1 className="text-2xl font-bold text-slate-900 mb-4">{t.title}</h1>

                <div className="space-y-3">
                    <button
                        type="button"
                        onClick={goToSgk}
                        className="w-full rounded-lg bg-blue-700 text-white py-3 font-medium"
                    >
                        {t.sgkBtn}
                    </button>

                    <button
                        type="button"
                        onClick={goToVisitor}
                        className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium"
                    >
                        {t.visitorBtn}
                    </button>
                </div>
            </div>
        </div>
    );
}
