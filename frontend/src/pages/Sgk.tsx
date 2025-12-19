import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate } from '../utils/dateUtils';
import type { SgkRecord, SgkFormData, SgkSearchData } from '../types';

// Initial form states
const INITIAL_FORM_DATA: SgkFormData = {
    tc_no: '',
    full_name: '',
    company_name: '',
    notes: '',
    pdf_file: null
};

const INITIAL_SEARCH_DATA: SgkSearchData = {
    search_type: 'tc',
    tc_no: '',
    full_name: '',
    company_name: ''
};

export default function Sgk() {
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<SgkFormData>(INITIAL_FORM_DATA);
    const [editingRecord, setEditingRecord] = useState<SgkRecord | null>(null);
    const [searchData, setSearchData] = useState<SgkSearchData>(INITIAL_SEARCH_DATA);
    const [searchResults, setSearchResults] = useState<SgkRecord[]>([]);
    const [previewRecord, setPreviewRecord] = useState<SgkRecord | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string>('');
    const navigate = useNavigate();

    // Reset upload form
    const resetUploadForm = useCallback(() => {
        setFormData(INITIAL_FORM_DATA);
    }, []);

    // Reset search form
    const resetSearchForm = useCallback(() => {
        setSearchData(INITIAL_SEARCH_DATA);
        setSearchResults([]);
    }, []);

    // Handle file selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        if (file) {
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(file.type)) {
                alert('Sadece PDF, JPG, JPEG ve PNG dosyaları yüklenebilir');
                return;
            }
        }
        setFormData({ ...formData, pdf_file: file });
    };

    // Handle upload submission
    const handleUploadSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        // Frontend validasyon
        if (!formData.tc_no?.trim()) {
            alert('TC Kimlik No zorunludur');
            return;
        }

        const cleanTC = formData.tc_no.replace(/\D/g, '');
        if (cleanTC.length !== 11) {
            alert('TC Kimlik No 11 haneli olmalıdır');
            return;
        }

        if (!formData.full_name?.trim()) {
            alert('Ad Soyad zorunludur');
            return;
        }

        if (!formData.pdf_file) {
            alert('Belge dosyası seçmelisiniz');
            return;
        }

        try {
            // FormData oluştur
            const uploadData = new FormData();
            uploadData.append('tc_no', cleanTC);
            uploadData.append('full_name', formData.full_name.trim());
            uploadData.append('company_name', formData.company_name?.trim() || '');
            uploadData.append('notes', formData.notes?.trim() || '');
            uploadData.append('pdf_file', formData.pdf_file);

            await api.post('/sgk/records', uploadData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            alert('SGK belgesi başarıyla kaydedildi');
            setShowUploadModal(false);
            resetUploadForm();
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err?.response?.data?.message || 'Kayıt başarısız');
        }
    }, [formData, resetUploadForm]);

    // Handle search submission
    const handleSearchSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        // Validasyon
        if (searchData.search_type === 'tc') {
            if (!searchData.tc_no?.trim()) {
                alert('TC Kimlik No zorunludur');
                return;
            }
            const cleanTC = searchData.tc_no.replace(/\D/g, '');
            if (cleanTC.length !== 11) {
                alert('TC Kimlik No 11 haneli olmalıdır');
                return;
            }
        } else if (searchData.search_type === 'name') {
            if (!searchData.full_name?.trim()) {
                alert('Ad Soyad zorunludur');
                return;
            }
        } else if (searchData.search_type === 'company') {
            if (!searchData.company_name?.trim()) {
                alert('Firma adı zorunludur');
                return;
            }
        }

        try {
            const payload: any = { search_type: searchData.search_type };

            if (searchData.search_type === 'tc') {
                payload.tc_no = searchData.tc_no!.replace(/\D/g, '');
            } else if (searchData.search_type === 'name') {
                payload.full_name = searchData.full_name!.trim();
            } else if (searchData.search_type === 'company') {
                payload.company_name = searchData.company_name!.trim();
            }

            const response = await api.post('/sgk/records/search', payload);
            setSearchResults(response.data.data || []);

            if (!response.data.data || response.data.data.length === 0) {
                alert('Arama kriterlerine uygun kayıt bulunamadı');
            }
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err?.response?.data?.message || 'Arama sırasında hata oluştu');
            setSearchResults([]);
        }
    }, [searchData]);

    // Handle preview
    const handlePreview = useCallback(async (record: SgkRecord) => {
        try {
            const response = await api.get(`/sgk/records/${record.id}/file`, {
                responseType: 'blob'
            });

            // Blob URL oluştur
            const blob = new Blob([response.data], {
                type: response.headers['content-type'] || 'application/octet-stream'
            });
            const url = URL.createObjectURL(blob);

            setPdfUrl(url);
            setPreviewRecord(record);
            setShowPreviewModal(true);
        } catch (error) {
            alert('Belge önizlenirken hata oluştu');
        }
    }, []);

    // Handle edit
    const handleEdit = useCallback((record: SgkRecord) => {
        setEditingRecord(record);
        setFormData({
            tc_no: '', // TC güvenlik için gösterilmez
            full_name: record.full_name,
            company_name: record.company_name || '',
            notes: record.notes || '',
            pdf_file: null
        });
        setShowEditModal(true);
    }, []);

    // Handle edit submission
    const handleEditSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingRecord) return;

        if (!formData.tc_no?.trim()) {
            alert('TC Kimlik No zorunludur');
            return;
        }

        const cleanTC = formData.tc_no.replace(/\D/g, '');
        if (cleanTC.length !== 11) {
            alert('TC Kimlik No 11 haneli olmalıdır');
            return;
        }

        if (!formData.full_name?.trim()) {
            alert('Ad Soyad zorunludur');
            return;
        }

        setLoading(true);

        try {
            const formDataToSend = new FormData();
            formDataToSend.append('tc_no', cleanTC);
            formDataToSend.append('full_name', formData.full_name.trim());
            if (formData.company_name?.trim()) {
                formDataToSend.append('company_name', formData.company_name.trim());
            }
            if (formData.notes?.trim()) {
                formDataToSend.append('notes', formData.notes.trim());
            }
            if (formData.pdf_file) {
                formDataToSend.append('pdf_file', formData.pdf_file);
            }

            await api.put(`/sgk/records/${editingRecord.id}`, formDataToSend, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert('Kayıt başarıyla güncellendi');
            setShowEditModal(false);
            setEditingRecord(null);
            resetUploadForm();

            // Arama sonuçlarını güncelle
            if (searchResults.length > 0) {
                handleSearchSubmit(new Event('submit') as any);
            }
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            alert(err?.response?.data?.message || 'Güncelleme sırasında hata oluştu');
        } finally {
            setLoading(false);
        }
    }, [editingRecord, formData, resetUploadForm, searchResults.length, handleSearchSubmit]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg transition">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">SGK Belge Yönetimi</h1>
                                <p className="text-gray-600 mt-1">SGK belgelerini kaydedin ve arayın</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { resetUploadForm(); setShowUploadModal(true); }}
                            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg transition shadow-md hover:shadow-lg"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            SGK Belgesi Kaydet
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Search Form */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Belge Ara</h2>
                    <form onSubmit={handleSearchSubmit} className="space-y-4">
                        {/* Search Type Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Arama Türü
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSearchData({ ...INITIAL_SEARCH_DATA, search_type: 'tc' })}
                                    className={`px-4 py-3 rounded-lg border-2 transition ${searchData.search_type === 'tc'
                                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                                        : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
                                        }`}
                                >
                                    TC Kimlik No
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSearchData({ ...INITIAL_SEARCH_DATA, search_type: 'name' })}
                                    className={`px-4 py-3 rounded-lg border-2 transition ${searchData.search_type === 'name'
                                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                                        : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
                                        }`}
                                >
                                    Ad Soyad
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSearchData({ ...INITIAL_SEARCH_DATA, search_type: 'company' })}
                                    className={`px-4 py-3 rounded-lg border-2 transition ${searchData.search_type === 'company'
                                        ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                                        : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400'
                                        }`}
                                >
                                    Firma Adı
                                </button>
                            </div>
                        </div>

                        {/* Search Input based on type */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="md:col-span-3">
                                {searchData.search_type === 'tc' && (
                                    <input
                                        type="text"
                                        value={searchData.tc_no || ''}
                                        onChange={(e) => setSearchData({ ...searchData, tc_no: e.target.value })}
                                        placeholder="11 haneli TC No"
                                        maxLength={11}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                )}

                                {searchData.search_type === 'name' && (
                                    <input
                                        type="text"
                                        value={searchData.full_name || ''}
                                        onChange={(e) => setSearchData({ ...searchData, full_name: e.target.value })}
                                        placeholder="Örn: Ahmet Yılmaz"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                )}

                                {searchData.search_type === 'company' && (
                                    <input
                                        type="text"
                                        value={searchData.company_name || ''}
                                        onChange={(e) => setSearchData({ ...searchData, company_name: e.target.value })}
                                        placeholder="Örn: ABC Şirketi"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition flex items-center justify-center gap-2">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    Ara
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        resetSearchForm();
                                    }}
                                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
                                >
                                    Temizle
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Records List */}
                {searchResults.length > 0 && (
                    <div className="bg-white rounded-lg shadow border border-gray-200">
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">
                                Arama Sonuçları ({searchResults.length})
                            </h2>

                            <div className="space-y-3">
                                {searchResults.map((record) => (
                                    <div key={record.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-600 block mb-1">Ad Soyad</span>
                                                    <span className="font-medium text-gray-900">{record.full_name}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-600 block mb-1">Firma</span>
                                                    <span className="font-medium text-gray-900">{record.company_name || '-'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-600 block mb-1">Yüklenme Tarihi</span>
                                                    <span className="font-medium text-gray-900">{formatDate(record.upload_date)}</span>
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0 flex gap-2">
                                                <button
                                                    onClick={() => handleEdit(record)}
                                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg font-medium transition flex items-center gap-2"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                    Düzenle
                                                </button>
                                                <button
                                                    onClick={() => handlePreview(record)}
                                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-medium transition flex items-center gap-2"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                    Görüntüle
                                                </button>
                                            </div>
                                        </div>
                                        {record.notes && (
                                            <div className="mt-3 pt-3 border-t border-gray-200">
                                                <span className="text-gray-600 text-sm">Not: </span>
                                                <span className="text-gray-900 text-sm">{record.notes}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">SGK Belgesi Kaydet</h2>
                                <button onClick={() => { setShowUploadModal(false); resetUploadForm(); }} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <form onSubmit={handleUploadSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        TC Kimlik No <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.tc_no}
                                        onChange={(e) => setFormData({ ...formData, tc_no: e.target.value })}
                                        placeholder="11 haneli TC No"
                                        maxLength={11}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Ad Soyad <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        placeholder="Tam ad soyad"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Firma Adı</label>
                                    <input
                                        type="text"
                                        value={formData.company_name}
                                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                        placeholder="Firma adı (opsiyonel)"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Belge Dosyası (PDF, JPG, PNG) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept="application/pdf,image/jpeg,image/jpg,image/png"
                                        onChange={handleFileChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        required
                                    />
                                    {formData.pdf_file && (
                                        <p className="mt-2 text-sm text-gray-600">
                                            Seçili dosya: {formData.pdf_file.name}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows={3}
                                        placeholder="Ek notlar..."
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button type="submit" className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-3 rounded-lg font-medium transition">
                                        Kaydet
                                    </button>
                                    <button type="button" onClick={() => { setShowUploadModal(false); resetUploadForm(); }} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition">
                                        İptal
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && editingRecord && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">SGK Kaydını Düzenle</h2>
                                <button onClick={() => { setShowEditModal(false); setEditingRecord(null); resetUploadForm(); }} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                                <p className="text-sm text-yellow-800">
                                    <strong>Not:</strong> TC Kimlik No güncellemek için tekrar girmeniz gerekiyor.
                                    Dosya değiştirmek isterseniz yeni dosya seçin, aksi halde mevcut dosya korunur.
                                </p>
                            </div>

                            <form onSubmit={handleEditSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        TC Kimlik No <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.tc_no}
                                        onChange={(e) => setFormData({ ...formData, tc_no: e.target.value })}
                                        placeholder="11 haneli TC No (güncelleme için tekrar girin)"
                                        maxLength={11}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Ad Soyad <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        placeholder="Tam ad soyad"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Firma Adı</label>
                                    <input
                                        type="text"
                                        value={formData.company_name}
                                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                        placeholder="Firma adı (opsiyonel)"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Belge Dosyası (PDF, JPG, PNG) <span className="text-gray-500">(Opsiyonel)</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept="application/pdf,image/jpeg,image/jpg,image/png"
                                        onChange={handleFileChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    {formData.pdf_file ? (
                                        <p className="mt-2 text-sm text-green-600">
                                            Yeni dosya: {formData.pdf_file.name}
                                        </p>
                                    ) : (
                                        <p className="mt-2 text-sm text-gray-600">
                                            Mevcut dosya: {editingRecord.file_path}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Notlar</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows={3}
                                        placeholder="Ek notlar..."
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-3 rounded-lg font-medium transition"
                                    >
                                        {loading ? 'Güncelleniyor...' : 'Güncelle'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowEditModal(false); setEditingRecord(null); resetUploadForm(); }}
                                        className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-medium transition"
                                    >
                                        İptal
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {showPreviewModal && previewRecord && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg max-w-5xl w-full h-[90vh] flex flex-col">
                        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{previewRecord.full_name} - SGK Belgesi</h2>
                                <p className="text-sm text-gray-600">{previewRecord.company_name || 'Firma belirtilmemiş'}</p>
                            </div>
                            <button onClick={() => {
                                if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                                setShowPreviewModal(false);
                                setPdfUrl('');
                                setPreviewRecord(null);
                            }} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden bg-gray-100 flex items-center justify-center">
                            {previewRecord.file_path.match(/\.(jpg|jpeg|png)$/i) ? (
                                // Resim dosyası için img tag kullan
                                <img
                                    src={pdfUrl}
                                    alt={previewRecord.full_name}
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : (
                                // PDF için iframe kullan
                                <iframe
                                    src={pdfUrl}
                                    className="w-full h-full"
                                    title="SGK Belgesi Önizleme"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
