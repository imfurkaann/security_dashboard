import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { API_URL } from '../constants';

interface QrVisitorFormData {
    vehicle_plate: string;
    full_name: string;
    company_name: string;
    visiting_person: string;
    person_count: string;
    children_count: string;
    phone: string;
}

const INITIAL_FORM_DATA: QrVisitorFormData = {
    vehicle_plate: '',
    full_name: '',
    company_name: '',
    visiting_person: '',
    person_count: '',
    children_count: '',
    phone: ''
};

const TRANSLATIONS: Record<string, {
    title: string;
    fullNameLabel: string;
    fullNamePlaceholder: string;
    plateLabel: string;
    platePlaceholder: string;
    companyLabel: string;
    companyPlaceholder: string;
    visitingLabel: string;
    visitingPlaceholder: string;
    personCountLabel: string;
    personCountPlaceholder: string;
    childrenCountLabel: string;
    childrenCountPlaceholder: string;
    phoneLabel: string;
    phonePlaceholder: string;
    submitBtn: string;
    submittingBtn: string;
    successTitle: string;
    successMessage: string;
    errFullNameRequired: string;
    errTokenExpired: string;
    errFormOpen: string;
    btnSgk: string;
    btnVisitor: string;
}> = {
    tr: {
        title: "QR Ziyaretçi Girişi",
        fullNameLabel: "Ad Soyad (Zorunlu)",
        fullNamePlaceholder: "Ad Soyad",
        plateLabel: "Plaka",
        platePlaceholder: "34ABC123",
        companyLabel: "Firma",
        companyPlaceholder: "Firma",
        visitingLabel: "Ziyaret Edilen",
        visitingPlaceholder: "Ziyaret edilen kişi",
        personCountLabel: "Kişi Sayısı",
        personCountPlaceholder: "1",
        childrenCountLabel: "Çocuk Sayısı",
        childrenCountPlaceholder: "0",
        phoneLabel: "Telefon",
        phonePlaceholder: "05xxxxxxxxx",
        submitBtn: "Giriş Kaydını Oluştur",
        submittingBtn: "Kaydediliyor...",
        successTitle: "Kaydınız alındı",
        successMessage: "Giriş kaydınız alındı. Yeni kayıt için QR kodunu tekrar okutmanız gerekir.",
        errFullNameRequired: "Ad Soyad alanı zorunludur.",
        errTokenExpired: "Form süresi doldu. Lütfen QR kodu tekrar okutun.",
        errFormOpen: "Form açılamadı. Lütfen QR kodu tekrar okutun.",
        btnSgk: "SGK Belgesi Yükle",
        btnVisitor: "Giriş Kaydı Oluştur"
    },
    en: {
        title: "QR Guest Entry",
        fullNameLabel: "Full Name (Required)",
        fullNamePlaceholder: "Full Name",
        plateLabel: "Plate",
        platePlaceholder: "34ABC123",
        companyLabel: "Company",
        companyPlaceholder: "Company",
        visitingLabel: "Visiting Person",
        visitingPlaceholder: "Person being visited",
        personCountLabel: "Number of People",
        personCountPlaceholder: "1",
        childrenCountLabel: "Number of Children",
        childrenCountPlaceholder: "0",
        phoneLabel: "Phone",
        phonePlaceholder: "05xxxxxxxxx",
        submitBtn: "Create Entry Record",
        submittingBtn: "Saving...",
        successTitle: "Record received",
        successMessage: "Your entry record has been received. You need to scan the QR code again for a new entry.",
        errFullNameRequired: "Full Name field is required.",
        errTokenExpired: "Form session expired. Please scan the QR code again.",
        errFormOpen: "Form could not be opened. Please scan the QR code again.",
        btnSgk: "Upload SGK Document",
        btnVisitor: "Create Entry Record"
    },
    de: {
        title: "QR-Gästeeintrag",
        fullNameLabel: "Vor- und Nachname (Zwingend)",
        fullNamePlaceholder: "Vor- und Nachname",
        plateLabel: "Kennzeichen",
        platePlaceholder: "34ABC123",
        companyLabel: "Firma",
        companyPlaceholder: "Firma",
        visitingLabel: "Besuchte Person",
        visitingPlaceholder: "Zu besuchende Person",
        personCountLabel: "Personenanzahl",
        personCountPlaceholder: "1",
        childrenCountLabel: "Kinderanzahl",
        childrenCountPlaceholder: "0",
        phoneLabel: "Telefon",
        phonePlaceholder: "05xxxxxxxxx",
        submitBtn: "Eintragungsdatensatz erstellen",
        submittingBtn: "Wird gespeichert...",
        successTitle: "Registrierung erhalten",
        successMessage: "Ihr Eintragungsdatensatz wurde registriert. Für einen neuen Eintrag müssen Sie den QR-Code erneut scannen.",
        errFullNameRequired: "Das Feld 'Vor- und Nachname' ist zwingend erforderlich.",
        errTokenExpired: "Formularsitzung abgelaufen. Bitte scannen Sie den QR-Code erneut.",
        errFormOpen: "Formular konnte nicht geöffnet werden. Bitte scannen Sie den QR-Code erneut.",
        btnSgk: "SGK-Dokument hochladen",
        btnVisitor: "Eintragungsdatensatz erstellen"
    },
    ru: {
        title: "QR Вход для гостей",
        fullNameLabel: "Имя Фамилия (Обязательно)",
        fullNamePlaceholder: "Имя Фамилия",
        plateLabel: "Номерной знак",
        platePlaceholder: "34ABC123",
        companyLabel: "Компания",
        companyPlaceholder: "Компания",
        visitingLabel: "Посещаемое лицо",
        visitingPlaceholder: "Посещаемое лицо",
        personCountLabel: "Количество человек",
        personCountPlaceholder: "1",
        childrenCountLabel: "Количество детей",
        childrenCountPlaceholder: "0",
        phoneLabel: "Телефон",
        phonePlaceholder: "05xxxxxxxxx",
        submitBtn: "Создать запись о входе",
        submittingBtn: "Сохранение...",
        successTitle: "Запись принята",
        successMessage: "Ваша запись о входе принята. Для новой записи необходимо снова отсканировать QR-код.",
        errFullNameRequired: "Поле Имя Фамилия обязательно для заполнения.",
        errTokenExpired: "Срок действия формы истек. Пожалуйста, отсканируйте QR-код еще раз.",
        errFormOpen: "Не удалось открыть форму. Пожалуйста, отсканируйте QR-код еще раз.",
        btnSgk: "Загрузить документ SGK",
        btnVisitor: "Создать запись о входе"
    }
};

const LANGUAGES = [
    { code: 'tr', name: 'Türkçe', flagUrl: 'https://flagcdn.com/w40/tr.png' },
    { code: 'en', name: 'English', flagUrl: 'https://flagcdn.com/w40/us.png' },
    { code: 'de', name: 'Deutsch', flagUrl: 'https://flagcdn.com/w40/de.png' },
    { code: 'ru', name: 'Русский', flagUrl: 'https://flagcdn.com/w40/ru.png' }
];

export default function QrVisitorCheckin() {
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

    const initialAction = useMemo(() => {
        if (typeof window === 'undefined') return 'menu';
        const action = new URLSearchParams(window.location.search).get('action');
        return action === 'visitor' ? 'visitor' : 'menu';
    }, []);

    const [formData, setFormData] = useState<QrVisitorFormData>(INITIAL_FORM_DATA);
    const [activeStep] = useState<'menu' | 'visitor'>(initialAction as 'menu' | 'visitor');
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

    const isSubmitDisabled = useMemo(() => {
        return loadingToken || submitting || !!completedMessage || !formToken;
    }, [loadingToken, submitting, completedMessage, formToken]);

    const selectedGate = useMemo(() => {
        if (typeof window === 'undefined') return '';
        return new URLSearchParams(window.location.search).get('gate')?.trim() || '';
    }, []);

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
            console.error('QR form token alinamadi:', error);
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

    const markCompleted = useCallback((message: string) => {
        setCompletedMessage(message);
        setFormToken('');

        if (typeof window !== 'undefined') {
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.set('done', '1');
            currentUrl.searchParams.delete('action');
            window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}`);
        }
    }, []);

    const redirectToVisitorForm = useCallback(() => {
        if (typeof window === 'undefined') return;
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('done');
        currentUrl.searchParams.set('action', 'visitor');
        window.location.assign(`${currentUrl.pathname}${currentUrl.search}`);
    }, []);

    const redirectToSgkUploadPage = useCallback(() => {
        if (typeof window === 'undefined') return;

        const currentUrl = new URL(window.location.href);
        currentUrl.pathname = '/qr/sgk-upload';
        currentUrl.searchParams.delete('done');
        currentUrl.searchParams.delete('action');
        window.location.assign(`${currentUrl.pathname}${currentUrl.search}`);
    }, []);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setErrorMessage('');

        if (!formData.full_name || formData.full_name.trim().length === 0) {
            setErrorMessage(t.errFullNameRequired);
            return;
        }

        if (!formToken) {
            setErrorMessage(t.errTokenExpired);
            return;
        }

        try {
            setSubmitting(true);

            const payload = {
                formToken,
                vehicle_plate: formData.vehicle_plate.trim() || null,
                full_name: formData.full_name.trim(),
                company_name: formData.company_name.trim() || null,
                visiting_person: formData.visiting_person.trim() || null,
                person_count: formData.person_count === '' ? null : Number(formData.person_count),
                children_count: formData.children_count === '' ? 0 : Number(formData.children_count),
                phone: formData.phone.trim() || null,
                gate: selectedGate || null,
                website
            };

            const response = await axios.post(`${API_URL}/visitor-public/records`, payload, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.data?.success) {
                markCompleted(t.successMessage);
            } else {
                setErrorMessage(response.data?.message || 'Kayit olusturulamadi.');
            }
        } catch (error: any) {
            setErrorMessage(error?.response?.data?.message || 'Kayit olusturulamadi.');
        } finally {
            setSubmitting(false);
        }
    };

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
                        <p className="text-sm text-emerald-700">
                            {completedMessage}
                        </p>
                    </div>
                ) : activeStep === 'menu' ? (
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={redirectToSgkUploadPage}
                            disabled={loadingToken || !formToken}
                            className="w-full rounded-lg bg-blue-700 text-white py-3 font-medium disabled:bg-slate-400 disabled:cursor-not-allowed"
                        >
                            {t.btnSgk}
                        </button>
                        <button
                            type="button"
                            onClick={redirectToVisitorForm}
                            disabled={loadingToken || !formToken}
                            className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium disabled:bg-slate-400 disabled:cursor-not-allowed"
                        >
                            {t.btnVisitor}
                        </button>

                        {errorMessage && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {errorMessage}
                            </div>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t.fullNameLabel}</label>
                            <input
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                placeholder={t.fullNamePlaceholder}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t.plateLabel}</label>
                            <input
                                value={formData.vehicle_plate}
                                onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                                placeholder={t.platePlaceholder}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t.companyLabel}</label>
                            <input
                                value={formData.company_name}
                                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                placeholder={t.companyPlaceholder}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t.visitingLabel}</label>
                            <input
                                value={formData.visiting_person}
                                onChange={(e) => setFormData({ ...formData, visiting_person: e.target.value })}
                                placeholder={t.visitingPlaceholder}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t.personCountLabel}</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={formData.person_count}
                                    onChange={(e) => setFormData({ ...formData, person_count: e.target.value })}
                                    placeholder={t.personCountPlaceholder}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t.childrenCountLabel}</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={formData.children_count}
                                    onChange={(e) => setFormData({ ...formData, children_count: e.target.value })}
                                    placeholder={t.childrenCountPlaceholder}
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{t.phoneLabel}</label>
                            <input
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder={t.phonePlaceholder}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
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

                        <button
                            type="submit"
                            disabled={isSubmitDisabled}
                            className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium disabled:bg-slate-400 disabled:cursor-not-allowed"
                        >
                            {submitting ? t.submittingBtn : t.submitBtn}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
