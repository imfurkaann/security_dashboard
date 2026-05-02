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

export default function QrSgkUpload() {
    const completionFromUrl = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return new URLSearchParams(window.location.search).get('done') === '1';
    }, []);

    const [formData, setFormData] = useState<QrSgkFormData>(INITIAL_SGK_FORM_DATA);
    const [formToken, setFormToken] = useState('');
    const [loadingToken, setLoadingToken] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [completedMessage, setCompletedMessage] = useState(
        completionFromUrl ? 'SGK belgesi basariyla kaydedildi. Yeni kayit icin QR kodunu tekrar okutmaniz gerekir.' : ''
    );
    const [errorMessage, setErrorMessage] = useState('');
    const [website, setWebsite] = useState('');

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
            console.error('QR SGK form token alinamadi:', error);
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
            setErrorMessage('Sadece PDF, JPG, JPEG ve PNG dosyalari yuklenebilir.');
            return;
        }

        const maxTotalBytes = 50 * 1024 * 1024;
        const totalBytes = selectedFiles.reduce((sum, file) => sum + (file.size || 0), 0);

        if (totalBytes > maxTotalBytes) {
            setErrorMessage('Toplam dosya boyutu en fazla 50MB olabilir.');
            return;
        }

        setErrorMessage('');
        setFormData((prev) => ({ ...prev, pdf_files: selectedFiles }));
    }, []);

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
            setErrorMessage('Form suresi doldu. Lutfen QR kodu tekrar okutun.');
            return;
        }

        if (!formData.full_name.trim()) {
            setErrorMessage('Isim Soyisim zorunludur.');
            return;
        }

        if (!formData.company_name.trim()) {
            setErrorMessage('Firma Ismi zorunludur.');
            return;
        }

        if (!formData.pdf_files || formData.pdf_files.length === 0) {
            setErrorMessage('Belge alani zorunludur.');
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
                markCompleted('SGK belgesi basariyla kaydedildi. Yeni kayit icin QR kodunu tekrar okutmaniz gerekir.');
            } else {
                setErrorMessage(response.data?.message || 'SGK kaydi olusturulamadi.');
            }
        } catch (error: any) {
            setErrorMessage(error?.response?.data?.message || 'SGK kaydi olusturulamadi.');
        } finally {
            setSubmitting(false);
        }
    }, [formData, formToken, markCompleted, website]);

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 py-10">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-slate-200 p-6">
                <h1 className="text-2xl font-bold text-slate-900 mb-1">SGK Belgesi Yukleme</h1>
                <div className="mb-6" />

                {completedMessage ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <h2 className="text-lg font-semibold text-emerald-800 mb-2">Kaydiniz alindi</h2>
                        <p className="text-sm text-emerald-700">{completedMessage}</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Isim Soyisim (Zorunlu)</label>
                            <input
                                value={formData.full_name}
                                onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Firma Ismi (Zorunlu)</label>
                            <input
                                value={formData.company_name}
                                onChange={(e) => setFormData((prev) => ({ ...prev, company_name: e.target.value }))}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-slate-900/20 focus:outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Belge (Zorunlu)</label>
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
                                Geri Don
                            </button>
                            <button
                                type="submit"
                                disabled={loadingToken || submitting || !formToken}
                                className="flex-1 rounded-lg bg-slate-900 text-white py-2.5 font-medium disabled:bg-slate-400 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Kaydediliyor...' : 'SGK Belgesini Kaydet'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
