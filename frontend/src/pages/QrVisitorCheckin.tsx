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

export default function QrVisitorCheckin() {
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
    const [completedMessage, setCompletedMessage] = useState(
        completionFromUrl ? 'Basarili kayit olusturuldu. Yeni kayit icin QR kodunu tekrar okutmaniz gerekir.' : ''
    );
    const [errorMessage, setErrorMessage] = useState('');
    const [website, setWebsite] = useState('');

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
                setErrorMessage('Form acilamadi. Lutfen QR kodu tekrar okutun.');
            }
        } catch (error) {
            console.error('QR form token alinamadi:', error);
            setErrorMessage('Form acilamadi. Lutfen QR kodu tekrar okutun.');
        } finally {
            setLoadingToken(false);
        }
    }, []);

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
            setErrorMessage('Ad Soyad alani zorunludur.');
            return;
        }

        if (!formToken) {
            setErrorMessage('Form suresi doldu. Lutfen QR kodu tekrar okutun.');
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
                markCompleted('Giris kaydiniz alindi. Yeni kayit icin QR kodunu tekrar okutmaniz gerekir.');
            } else {
                setErrorMessage(response.data?.message || 'Kayit olusturulamadi.');
            }
        } catch (error: any) {
            setErrorMessage(error?.response?.data?.message || 'Kayit olusturulamadi.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">QR Misafir Islemleri</h1>
                <div className="mb-6" />

                {completedMessage ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <h2 className="text-lg font-semibold text-emerald-800 mb-2">Kaydiniz alindi</h2>
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
                            SGK Belgesi Yukle
                        </button>
                        <button
                            type="button"
                            onClick={redirectToVisitorForm}
                            disabled={loadingToken || !formToken}
                            className="w-full rounded-lg bg-slate-900 text-white py-3 font-medium disabled:bg-slate-400 disabled:cursor-not-allowed"
                        >
                            Giris Kaydi Olustur
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
                            <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad (Zorunlu)</label>
                            <input
                                value={formData.full_name}
                                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                placeholder="Ad Soyad"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Plaka (Opsiyonel)</label>
                            <input
                                value={formData.vehicle_plate}
                                onChange={(e) => setFormData({ ...formData, vehicle_plate: e.target.value })}
                                placeholder="34ABC123"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Firma (Opsiyonel)</label>
                            <input
                                value={formData.company_name}
                                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                placeholder="Firma"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Ziyaret Edilen (Opsiyonel)</label>
                            <input
                                value={formData.visiting_person}
                                onChange={(e) => setFormData({ ...formData, visiting_person: e.target.value })}
                                placeholder="Ziyaret edilen kisi"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Kisi Sayisi (Opsiyonel)</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={formData.person_count}
                                    onChange={(e) => setFormData({ ...formData, person_count: e.target.value })}
                                    placeholder="1"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Cocuk Sayisi (Opsiyonel)</label>
                                <input
                                    type="number"
                                    min={0}
                                    value={formData.children_count}
                                    onChange={(e) => setFormData({ ...formData, children_count: e.target.value })}
                                    placeholder="0"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Telefon (Opsiyonel)</label>
                            <input
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="05xxxxxxxxx"
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
                            {submitting ? 'Kaydediliyor...' : 'Giris Kaydini Olustur'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
