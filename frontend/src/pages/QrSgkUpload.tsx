import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';

interface QrSgkFormData {
    full_name: string;
    company_name: string;
    pdf_files: File[];
}

const INITIAL_SGK_FORM_DATA: QrSgkFormData = {
    full_name: '',
    company_name: '',
    pdf_files: []
};

const TRANSLATIONS: Record<string, {
    title: string;
    fullNameLabel: string;
    companyNameLabel: string;
    documentLabel: string;
    backBtn: string;
    submitBtn: string;
    submittingBtn: string;
    successTitle: string;
    successMessage: string;
    errFullNameRequired: string;
    errCompanyNameRequired: string;
    errDocumentRequired: string;
    errFileType: string;
    errFileSize: string;
    errFormOpen: string;
    errTokenExpired: string;
}> = {
    tr: {
        title: "SGK Belgesi Yükleme",
        fullNameLabel: "İsim Soyisim (Zorunlu)",
        companyNameLabel: "Firma İsmi (Zorunlu)",
        documentLabel: "Belge (Zorunlu)",
        backBtn: "Geri Dön",
        submitBtn: "SGK Belgesini Kaydet",
        submittingBtn: "Kaydediliyor...",
        successTitle: "Kaydınız alındı",
        successMessage: "SGK belgesi başarıyla kaydedildi. Yeni kayıt için QR kodunu tekrar okutmanız gerekir.",
        errFullNameRequired: "İsim Soyisim zorunludur.",
        errCompanyNameRequired: "Firma İsmi zorunludur.",
        errDocumentRequired: "Belge alanı zorunludur.",
        errFileType: "Sadece PDF, JPG, JPEG ve PNG dosyaları yüklenebilir.",
        errFileSize: "Toplam dosya boyutu en fazla 50MB olabilir.",
        errFormOpen: "Form açılamadı. Lütfen QR kodu tekrar okutun.",
        errTokenExpired: "Form süresi doldu. Lütfen QR kodu tekrar okutun."
    },
    en: {
        title: "SGK Document Upload",
        fullNameLabel: "Full Name (Required)",
        companyNameLabel: "Company Name (Required)",
        documentLabel: "Document (Required)",
        backBtn: "Back",
        submitBtn: "Save SGK Document",
        submittingBtn: "Saving...",
        successTitle: "Record received",
        successMessage: "SGK document saved successfully. You need to scan the QR code again for a new entry.",
        errFullNameRequired: "Full Name is required.",
        errCompanyNameRequired: "Company Name is required.",
        errDocumentRequired: "Document field is required.",
        errFileType: "Only PDF, JPG, JPEG, and PNG files can be uploaded.",
        errFileSize: "Total file size can be up to 50MB.",
        errFormOpen: "Form could not be opened. Please scan the QR code again.",
        errTokenExpired: "Form session expired. Please scan the QR code again."
    },
    de: {
        title: "SGK-Dokument hochladen",
        fullNameLabel: "Vor- und Nachname (Zwingend)",
        companyNameLabel: "Firmenname (Zwingend)",
        documentLabel: "Dokument (Zwingend)",
        backBtn: "Zurück",
        submitBtn: "SGK-Dokument speichern",
        submittingBtn: "Wird gespeichert...",
        successTitle: "Registrierung erhalten",
        successMessage: "SGK-Dokument successfully gespeichert. Für einen neuen Eintrag müssen Sie den QR-Code erneut scannen.",
        errFullNameRequired: "Vor- und Nachname ist zwingend erforderlich.",
        errCompanyNameRequired: "Firmenname ist zwingend erforderlich.",
        errDocumentRequired: "Dokumentenfeld ist zwingend erforderlich.",
        errFileType: "Es können nur PDF-, JPG-, JPEG- und PNG-Dateien hochgeladen werden.",
        errFileSize: "Die Gesamtdateigröße darf maximal 50 MB betragen.",
        errFormOpen: "Formular konnte nicht geöffnet werden. Bitte scannen Sie den QR-Code erneut.",
        errTokenExpired: "Formularsitzung abgelaufen. Bitte scannen Sie den QR-Code erneut."
    },
    ru: {
        title: "Загрузка документа SGK",
        fullNameLabel: "Имя Фамилия (Обязательно)",
        companyNameLabel: "Название компании (Обязательно)",
        documentLabel: "Документ (Обязательно)",
        backBtn: "Назад",
        submitBtn: "Сохранить документ SGK",
        submittingBtn: "Сохранение...",
        successTitle: "Запись принята",
        successMessage: "Документ SGK успешно сохранен. Для новой записи необходимо снова отсканировать QR-код.",
        errFullNameRequired: "Имя Фамилия обязательно для заполнения.",
        errCompanyNameRequired: "Название компании обязательно для заполнения.",
        errDocumentRequired: "Поле Документ обязательно для заполнения.",
        errFileType: "Можно загружать только файлы PDF, JPG, JPEG и PNG.",
        errFileSize: "Общий размер файлов не должен превышать 50 МБ.",
        errFormOpen: "Не удалось открыть форму. Пожалуйста, отсканируйте QR-код еще раз.",
        errTokenExpired: "Срок действия формы isteik. Пожалуйста, отсканируйте QR-код еще раз."
    }
};

const LANGUAGES = [
    { code: 'tr', name: 'Türkçe', flagUrl: 'https://flagcdn.com/w40/tr.png' },
    { code: 'en', name: 'English', flagUrl: 'https://flagcdn.com/w40/us.png' },
    { code: 'de', name: 'Deutsch', flagUrl: 'https://flagcdn.com/w40/de.png' },
    { code: 'ru', name: 'Русский', flagUrl: 'https://flagcdn.com/w40/ru.png' }
];

export default function QrSgkUpload() {
    const [currentLang, setCurrentLang] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('qr_lang') || 'tr';
        }
        return 'tr';
    });
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const completionFromUrl = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return new URLSearchParams(window.location.search).get('done') === '1';
    }, []);

    const [formData, setFormData] = useState<QrSgkFormData>(INITIAL_SGK_FORM_DATA);
    const [formToken, setFormToken] = useState('');
    const [loadingToken, setLoadingToken] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [completedMessage, setCompletedMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [website, setWebsite] = useState('');

    const t = TRANSLATIONS[currentLang] || TRANSLATIONS.tr;
    const selectedLanguageObj = LANGUAGES.find(l => l.code === currentLang) || LANGUAGES[0];

    useEffect(() => {
        if (completionFromUrl) {
            setCompletedMessage(t.successMessage);
        }
    }, [completionFromUrl, t.successMessage]);

    const loadToken = useCallback(async () => {
        try {
            setLoadingToken(true);
            setErrorMessage('');

            const response = await axios.get(`${API_URL}/visitor-public/form-token`);
            if (response.data?.success && response.data?.data?.formToken) {
                setFormToken(response.data.data.formToken);
            } else {
                setErrorMessage(t.errFormOpen);
            }
        } catch (error) {
            console.error('QR SGK form token alinamadi:', error);
            setErrorMessage(t.errFormOpen);
        } finally {
            setLoadingToken(false);
        }
    }, [t.errFormOpen]);

    useEffect(() => {
        if (completedMessage) {
            setLoadingToken(false);
            return;
        }

        void loadToken();
    }, [completedMessage, loadToken]);

    const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || []);
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png'];

        const hasInvalidType = selectedFiles.some((file) => {
            if (allowedTypes.includes(file.type)) return false;
            const name = file.name || '';
            const dot = name.lastIndexOf('.');
            if (dot === -1) return true;
            const ext = name.slice(dot).toLowerCase();
            return !allowedExts.includes(ext);
        });

        if (hasInvalidType) {
            setErrorMessage(t.errFileType);
            return;
        }

        const maxTotalBytes = 50 * 1024 * 1024;
        const totalBytes = selectedFiles.reduce((sum, file) => sum + (file.size || 0), 0);

        if (totalBytes > maxTotalBytes) {
            setErrorMessage(t.errFileSize);
            return;
        }

        setErrorMessage('');
        setFormData((prev) => ({ ...prev, pdf_files: selectedFiles }));
    }, [t.errFileType, t.errFileSize]);

    const markCompleted = useCallback((message: string) => {
        setCompletedMessage(message);
        setFormToken('');

        if (typeof window !== 'undefined') {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('done', '1');
            window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}`);
        }
    }, []);

    const goBackToMenu = useCallback(() => {
        if (typeof window === 'undefined') return;
        const currentUrl = new URL(window.location.href);
        currentUrl.pathname = '/qr';
        currentUrl.searchParams.delete('done');
        currentUrl.searchParams.delete('action');
        window.location.assign(`${currentUrl.pathname}${currentUrl.search}`);
    }, []);

    const handleSubmit = useCallback(async (event: FormEvent) => {
        event.preventDefault();
        setErrorMessage('');

        if (!formToken) {
            setErrorMessage(t.errTokenExpired);
            return;
        }

        if (!formData.full_name.trim()) {
            setErrorMessage(t.errFullNameRequired);
            return;
        }

        if (!formData.company_name.trim()) {
            setErrorMessage(t.errCompanyNameRequired);
            return;
        }

        if (!formData.pdf_files || formData.pdf_files.length === 0) {
            setErrorMessage(t.errDocumentRequired);
            return;
        }

        try {
            setSubmitting(true);

            const uploadData = new FormData();
            uploadData.append('formToken', formToken);
            uploadData.append('website', website);
            uploadData.append('full_name', formData.full_name.trim());
            uploadData.append('company_name', formData.company_name.trim());

            formData.pdf_files.forEach((file) => {
                uploadData.append('pdf_files', file);
            });

            const response = await axios.post(`${API_URL}/visitor-public/sgk-records`, uploadData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data?.success) {
                markCompleted(t.successMessage);
            } else {
                setErrorMessage(response.data?.message || 'SGK kaydi olusturulamadi.');
            }
        } catch (error: any) {
            setErrorMessage(error?.response?.data?.message || 'SGK kaydi olusturulamadi.');
        } finally {
            setSubmitting(false);
        }
    }, [formData, formToken, markCompleted, website, t.errTokenExpired, t.errFullNameRequired, t.errCompanyNameRequired, t.errDocumentRequired, t.successMessage]);

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
                <h1 className="text-2xl font-bold text-slate-900 mb-1">{t.title}</h1>
                <div className="mb-6" />

                {completedMessage ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <h2 className="text-lg font-semibold text-emerald-800 mb-2">{t.successTitle}</h2>
                        <p className="text-sm text-emerald-700">{completedMessage}</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t.fullNameLabel}</label>
                            <input
                                value={formData.full_name}
                                onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t.companyNameLabel}</label>
                            <input
                                value={formData.company_name}
                                onChange={(e) => setFormData((prev) => ({ ...prev, company_name: e.target.value }))}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t.documentLabel}</label>
                            <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                multiple
                                onChange={handleFileChange}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                                required
                            />
                        </div>

                        <input
                            type="text"
                            tabIndex={-1}
                            autoComplete="off"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            className="hidden"
                            aria-hidden="true"
                        />

                        {errorMessage && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {errorMessage}
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={goBackToMenu}
                                className="flex-1 rounded-lg border border-slate-300 text-slate-700 py-2.5 font-medium"
                            >
                                {t.backBtn}
                            </button>
                            <button
                                type="submit"
                                disabled={loadingToken || submitting || !formToken}
                                className="flex-1 rounded-lg bg-slate-900 text-white py-2.5 font-medium disabled:bg-slate-400 disabled:cursor-not-allowed"
                            >
                                {submitting ? t.submittingBtn : t.submitBtn}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
