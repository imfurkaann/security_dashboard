import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { message, Modal } from 'antd';
import api from '../utils/api';
import { formatDate } from '../utils/dateUtils';
import type { SgkRecord, SgkFormData, SgkFileMeta } from '../types';
import ActionButton from '../components/ActionButton';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';

interface CompactActionButtonProps {
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    variant?: 'primary' | 'success' | 'danger' | 'neutral';
    title?: string;
    disabled?: boolean;
    className?: string;
}

const actionVariantClasses = {
    primary: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30',
    danger: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30',
    neutral: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 dark:bg-gray-800/40 dark:text-gray-300 dark:border-gray-700/50'
};

function CompactActionButton({
    onClick,
    icon,
    label,
    variant = 'neutral',
    title,
    disabled = false,
    className = ''
}: CompactActionButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title || label}
            className={`compact-btn inline-flex items-center justify-center h-8 min-w-[32px] px-2 hover:px-3 rounded-full border transition-all duration-300 ease-in-out disabled:cursor-not-allowed disabled:opacity-50 ${actionVariantClasses[variant]} ${className}`.trim()}
        >
            <span className="flex items-center justify-center shrink-0">
                {icon}
            </span>
            <span className="compact-btn-text text-[11px] font-bold">
                {label}
            </span>
        </button>
    );
}

// Initial form states
const INITIAL_FORM_DATA: SgkFormData = {
    tc_no: '',
    passport_no: '',
    full_name: '',
    company_name: '',
    notes: '',
    pdf_files: []
};

const ZOOM_STEPS: number[] = [1, 2, 4, 8];

const looksLikeMojibake = (value: string): boolean => /Ã|Å|Ä|Ð|Ñ|â/.test(value);

const normalizeDisplayFileName = (value: string): string => {
    if (!value || !looksLikeMojibake(value)) {
        return value;
    }

    try {
        const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0));
        const fixed = new TextDecoder('utf-8').decode(bytes);
        return fixed.includes('�') ? value : fixed;
    } catch (_error) {
        return value;
    }
};

const normalizeSearchText = (value: string | null | undefined): string => {
    return (value || '').toLocaleLowerCase('tr-TR').normalize('NFC');
};

export default function Sgk() {
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState<SgkFormData>(INITIAL_FORM_DATA);
    const [editAppendFiles, setEditAppendFiles] = useState<File[]>([]);
    const [editReplaceFiles, setEditReplaceFiles] = useState<File[]>([]);
    const [editingRecord, setEditingRecord] = useState<SgkRecord | null>(null);
    const [allRecords, setAllRecords] = useState<SgkRecord[]>([]);
    const [previewRecord, setPreviewRecord] = useState<SgkRecord | null>(null);
    const [pdfUrl, setPdfUrl] = useState<string>('');
    const [previewContentType, setPreviewContentType] = useState('');
    const [previewLoading, setPreviewLoading] = useState(false);
    const [selectedFileIndex, setSelectedFileIndex] = useState(0);
    const [isMobilePreview, setIsMobilePreview] = useState(false);
    const [imageZoom, setImageZoom] = useState(1);
    const [zoomOrigin, setZoomOrigin] = useState('50% 50%');
    const location = useLocation();
    const navigate = useNavigate();
    const isAdminView = location.pathname.startsWith('/admin/');

    const getRecordFiles = useCallback((record: SgkRecord | null): SgkFileMeta[] => {
        if (!record) return [];
        if (record.files && record.files.length > 0) return record.files;
        if (!record.file_path) return [];

        return [
            {
                id: '',
                record_id: record.id,
                file_name: record.file_path,
                original_file_name: record.file_path,
                mime_type: null,
                size_bytes: null,
                sort_order: 0,
                created_at: record.created_at || record.upload_date
            }
        ];
    }, []);

    const previewFiles = useMemo(() => getRecordFiles(previewRecord), [getRecordFiles, previewRecord]);
    const selectedPreviewFile = previewFiles[selectedFileIndex] || null;

    const handleImageWheel = useCallback((e: React.WheelEvent<HTMLImageElement>) => {
        e.preventDefault();

        const imgRect = e.currentTarget.getBoundingClientRect();
        const xPercent = ((e.clientX - imgRect.left) / imgRect.width) * 100;
        const yPercent = ((e.clientY - imgRect.top) / imgRect.height) * 100;

        setZoomOrigin(`${xPercent}% ${yPercent}%`);
        setImageZoom((currentZoom) => {
            const currentIndex = ZOOM_STEPS.indexOf(currentZoom);

            if (e.deltaY < 0) {
                if (currentIndex === -1) return 2;
                return ZOOM_STEPS[Math.min(currentIndex + 1, ZOOM_STEPS.length - 1)];
            }

            if (e.deltaY > 0) {
                if (currentIndex <= 0) return 1;
                return ZOOM_STEPS[currentIndex - 1];
            }

            return currentZoom;
        });
    }, []);

    useEffect(() => {
        const fileName = selectedPreviewFile?.file_name || '';
        if (!showPreviewModal || !fileName.match(/\.(jpg|jpeg|png)$/i)) {
            setImageZoom(1);
            setZoomOrigin('50% 50%');
        }
    }, [showPreviewModal, selectedPreviewFile]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const updateViewport = () => {
            setIsMobilePreview(window.matchMedia('(max-width: 768px)').matches);
        };

        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, []);

    // Filter states
    const [filters, setFilters] = useState({
        tc_no: '',
        passport_no: '',
        full_name: '',
        company_name: ''
    });

    // Search mode: 'all' = tüm kayıtlar, 'tc' = TC araması, 'passport' = pasaport araması
    const [searchMode, setSearchMode] = useState<'all' | 'tc' | 'passport'>('all');
    const [searching, setSearching] = useState(false);

    const fetchAllSgkRecords = useCallback(async () => {
        try {
            const response = await api.get('/sgk/records');
            setAllRecords(response.data || []);
        } catch (error) {
            console.error('SGK kayıtları yüklenemedi:', error);
        }
    }, []);

    // Fetch all records on mount
    useEffect(() => {
        const fetchRecords = async () => {
            await fetchAllSgkRecords();
            setLoading(false);
        };
        void fetchRecords();
    }, [fetchAllSgkRecords]);

    // Filtered records with useMemo
    const filteredRecords = useMemo(() => {
        return allRecords.filter(record => {
            // Full name filter
            if (filters.full_name && !normalizeSearchText(record.full_name).includes(normalizeSearchText(filters.full_name))) {
                return false;
            }

            // Company name filter
            if (filters.company_name && !normalizeSearchText(record.company_name).includes(normalizeSearchText(filters.company_name))) {
                return false;
            }

            return true;
        });
    }, [allRecords, filters]);

    // Check if any filter is active
    const hasActiveFilters = useMemo(() => {
        return filters.full_name !== '' || filters.company_name !== '' || filters.tc_no !== '' || filters.passport_no !== '';
    }, [filters]);

    // Handle TC/Pasaport search
    const handleTcPassportSearch = useCallback(async () => {
        if (filters.tc_no) {
            const cleanTC = filters.tc_no.replace(/\D/g, '');
            if (cleanTC.length !== 11) {
                message.warning('TC Kimlik No 11 haneli olmalıdır');
                return;
            }

            setSearching(true);
            setSearchMode('tc');
            try {
                const response = await api.post('/sgk/records/search', {
                    search_type: 'tc',
                    tc_no: cleanTC
                });
                setAllRecords(response.data.data || []);
                if (!response.data.data || response.data.data.length === 0) {
                    message.warning('Bu TC Kimlik No ile kayıt bulunamadı');
                }
            } catch (error) {
                console.error('TC araması başarısız:', error);
                message.error('Arama sırasında hata oluştu');
            } finally {
                setSearching(false);
            }
        } else if (filters.passport_no) {
            const cleanPassport = filters.passport_no.trim().toUpperCase();
            if (cleanPassport.length < 6 || cleanPassport.length > 20) {
                message.warning('Pasaport numarası 6-20 karakter arasında olmalıdır');
                return;
            }

            setSearching(true);
            setSearchMode('passport');
            try {
                const response = await api.post('/sgk/records/search', {
                    search_type: 'passport',
                    passport_no: cleanPassport
                });
                setAllRecords(response.data.data || []);
                if (!response.data.data || response.data.data.length === 0) {
                    message.warning('Bu Pasaport No ile kayıt bulunamadı');
                }
            } catch (error) {
                console.error('Pasaport araması başarısız:', error);
                message.error('Arama sırasında hata oluştu');
            } finally {
                setSearching(false);
            }
        }
    }, [filters.tc_no, filters.passport_no]);

    // Reset to show all records
    const resetToAllRecords = useCallback(async () => {
        setSearchMode('all');
        setLoading(true);
        await fetchAllSgkRecords();
        setLoading(false);
    }, [fetchAllSgkRecords]);

    useRealtimeRefetch({
        topics: ['sgk'],
        onMutation: async () => {
            if (searchMode !== 'all') return;
            await fetchAllSgkRecords();
        },
        enabled: true,
    });

    // Reset filters
    const resetFilters = useCallback(() => {
        setFilters({
            tc_no: '',
            passport_no: '',
            full_name: '',
            company_name: ''
        });
        if (searchMode !== 'all') {
            resetToAllRecords();
        }
    }, [searchMode, resetToAllRecords]);

    // Reset upload form
    const resetUploadForm = useCallback(() => {
        setFormData(INITIAL_FORM_DATA);
        setEditAppendFiles([]);
        setEditReplaceFiles([]);
    }, []);

    const validateSelectedFiles = useCallback((selectedFiles: File[]): File[] | null => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

        const hasInvalidType = selectedFiles.some((file) => !allowedTypes.includes(file.type));
        if (hasInvalidType) {
            message.warning('Sadece PDF, JPG, JPEG ve PNG dosyaları yüklenebilir');
            return null;
        }

        const maxTotalBytes = 50 * 1024 * 1024;
        const totalBytes = selectedFiles.reduce((sum, file) => sum + (file.size || 0), 0);

        if (totalBytes > maxTotalBytes) {
            message.warning('Toplam dosya boyutu en fazla 50MB olabilir');
            return null;
        }

        return selectedFiles;
    }, []);

    // Handle upload modal file selection
    const handleUploadFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = validateSelectedFiles(Array.from(e.target.files || []));
        if (!selectedFiles) {
            return;
        }

        setFormData((previous) => ({ ...previous, pdf_files: selectedFiles }));
    }, [validateSelectedFiles]);

    // Handle edit modal append file selection (keeps existing files)
    const handleEditAppendFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = validateSelectedFiles(Array.from(e.target.files || []));
        if (!selectedFiles) {
            return;
        }

        setEditAppendFiles(selectedFiles);
        setEditReplaceFiles([]);
    }, [validateSelectedFiles]);

    // Handle edit modal replace file selection (replaces all existing files)
    const handleEditReplaceFilesChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = validateSelectedFiles(Array.from(e.target.files || []));
        if (!selectedFiles) {
            return;
        }

        setEditReplaceFiles(selectedFiles);
        setEditAppendFiles([]);
    }, [validateSelectedFiles]);

    // Handle upload submission
    const handleUploadSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        // Frontend validasyon
        // TC ve pasaport her ikisi de girilmiş mi?
        if (formData.tc_no?.trim() && formData.passport_no?.trim()) {
            message.warning('TC Kimlik No ve Pasaport Numarası aynı anda girilemez. Sadece birini giriniz.');
            return;
        }

        // TC kontrolü
        if (formData.tc_no?.trim()) {
            const cleanTC = formData.tc_no.replace(/\D/g, '');
            if (cleanTC.length !== 11) {
                message.warning('TC Kimlik No 11 haneli olmalıdır');
                return;
            }
        }

        // Pasaport kontrolü
        if (formData.passport_no?.trim()) {
            const cleanPassport = formData.passport_no.trim().toUpperCase();
            if (cleanPassport.length < 6 || cleanPassport.length > 20) {
                message.warning('Pasaport numarası 6-20 karakter arasında olmalıdır');
                return;
            }
        }

        if (!formData.full_name?.trim()) {
            message.warning('Ad Soyad zorunludur');
            return;
        }

        if (!formData.pdf_files || formData.pdf_files.length === 0) {
            message.warning('En az bir belge dosyası seçmelisiniz');
            return;
        }

        try {
            // FormData oluştur
            const uploadData = new FormData();

            if (formData.tc_no?.trim()) {
                const cleanTC = formData.tc_no.replace(/\D/g, '');
                uploadData.append('tc_no', cleanTC);
            }

            if (formData.passport_no?.trim()) {
                uploadData.append('passport_no', formData.passport_no.trim().toUpperCase());
            }

            uploadData.append('full_name', formData.full_name.trim());
            uploadData.append('company_name', formData.company_name?.trim() || '');
            uploadData.append('notes', formData.notes?.trim() || '');
            formData.pdf_files.forEach((file) => {
                uploadData.append('pdf_files', file);
            });

            const response = await api.post('/sgk/records', uploadData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            message.success('SGK belgeleri başarıyla kaydedildi');
            setShowUploadModal(false);
            resetUploadForm();

            // Listeyi yenile
            const recordsResponse = await api.get('/sgk/records');
            setAllRecords(recordsResponse.data || []);
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            message.error(err?.response?.data?.message || 'Kayıt başarısız');
        }
    }, [formData, resetUploadForm]);

    // Handle preview
    const handlePreview = useCallback((record: SgkRecord) => {
        setPreviewRecord(record);
        setSelectedFileIndex(0);
        setShowPreviewModal(true);
        setPreviewContentType('');
    }, []);

    useEffect(() => {
        const fetchSelectedPreviewFile = async () => {
            if (!showPreviewModal || !previewRecord || !selectedPreviewFile) {
                return;
            }

            setPreviewLoading(true);

            try {
                const endpoint = selectedPreviewFile.id
                    ? `/sgk/records/${previewRecord.id}/files/${selectedPreviewFile.id}`
                    : `/sgk/records/${previewRecord.id}/file`;

                const response = await api.get(endpoint, { responseType: 'blob' });

                const blob = new Blob([response.data], {
                    type: response.headers['content-type'] || 'application/octet-stream'
                });

                const url = URL.createObjectURL(blob);
                const contentType = response.headers['content-type'] || '';

                setPdfUrl((previousUrl) => {
                    if (previousUrl) {
                        URL.revokeObjectURL(previousUrl);
                    }
                    return url;
                });
                setPreviewContentType(contentType);
            } catch (error) {
                message.error('Belge önizlenirken hata oluştu');
                setShowPreviewModal(false);
                setPreviewRecord(null);
                setPdfUrl('');
                setPreviewContentType('');
            } finally {
                setPreviewLoading(false);
            }
        };

        fetchSelectedPreviewFile();
    }, [showPreviewModal, previewRecord, selectedPreviewFile]);

    // Unmount cleanup for pdfUrl to prevent memory leaks
    useEffect(() => {
        return () => {
            if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
            }
        };
    }, [pdfUrl]);

    // Handle edit
    const handleEdit = useCallback((record: SgkRecord) => {
        setEditingRecord(record);
        setFormData({
            tc_no: '', // TC güvenlik için gösterilmez
            passport_no: '', // Pasaport güvenlik için gösterilmez
            full_name: record.full_name,
            company_name: record.company_name || '',
            notes: record.notes || '',
            pdf_files: []
        });
        setEditAppendFiles([]);
        setEditReplaceFiles([]);
        setShowEditModal(true);
    }, []);

    // Handle delete
    const handleDelete = useCallback(async (record: SgkRecord) => {
        Modal.confirm({
            title: 'SGK Kaydını Sil',
            content: `"${record.full_name}" isimli kişinin SGK kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve tüm ilişkili belge dosyaları silinecektir.`,
            okText: 'Evet, Sil',
            okType: 'danger',
            cancelText: 'Vazgeç',
            onOk: async () => {
                try {
                    await api.delete(`/sgk/records/${record.id}`);
                    message.success('Kayıt ve belge başarıyla silindi');

                    // Listeyi yenile
                    const response = await api.get('/sgk/records');
                    setAllRecords(response.data || []);
                } catch (error) {
                    const err = error as { response?: { data?: { message?: string } } };
                    message.error(err?.response?.data?.message || 'Silme işlemi sırasında hata oluştu');
                }
            }
        });
    }, []);

    // Handle edit submission
    const handleEditSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingRecord) return;

        // TC ve pasaport her ikisi de girilmiş mi?
        if (formData.tc_no?.trim() && formData.passport_no?.trim()) {
            message.warning('TC Kimlik No ve Pasaport Numarası aynı anda girilemez. Sadece birini giriniz.');
            return;
        }

        // TC veya Pasaport girilmişse format kontrolü yap (zorunlu değil)
        // TC kontrolü
        if (formData.tc_no?.trim()) {
            const cleanTC = formData.tc_no.replace(/\D/g, '');
            if (cleanTC.length !== 11) {
                message.warning('TC Kimlik No 11 haneli olmalıdır');
                return;
            }
        }

        // Pasaport kontrolü
        if (formData.passport_no?.trim()) {
            const cleanPassport = formData.passport_no.trim().toUpperCase();
            if (cleanPassport.length < 6 || cleanPassport.length > 20) {
                message.warning('Pasaport numarası 6-20 karakter arasında olmalıdır');
                return;
            }
        }

        if (!formData.full_name?.trim()) {
            message.warning('Ad Soyad zorunludur');
            return;
        }

        if (editAppendFiles.length > 0 && editReplaceFiles.length > 0) {
            message.warning('Aynı anda hem yeni dosya ekleme hem tam yenileme seçemezsiniz. Lütfen birini seçin.');
            return;
        }

        setLoading(true);

        try {
            const formDataToSend = new FormData();

            if (formData.tc_no?.trim()) {
                const cleanTC = formData.tc_no.replace(/\D/g, '');
                formDataToSend.append('tc_no', cleanTC);
            }

            if (formData.passport_no?.trim()) {
                formDataToSend.append('passport_no', formData.passport_no.trim().toUpperCase());
            }

            formDataToSend.append('full_name', formData.full_name.trim());

            if (formData.company_name?.trim()) {
                formDataToSend.append('company_name', formData.company_name.trim());
            }
            if (formData.notes?.trim()) {
                formDataToSend.append('notes', formData.notes.trim());
            }
            if (editAppendFiles.length > 0) {
                editAppendFiles.forEach((file) => {
                    formDataToSend.append('pdf_files', file);
                });
                formDataToSend.append('file_action', 'append');
            }

            if (editReplaceFiles.length > 0) {
                editReplaceFiles.forEach((file) => {
                    formDataToSend.append('pdf_files', file);
                });
                formDataToSend.append('file_action', 'replace');
            }

            await api.put(`/sgk/records/${editingRecord.id}`, formDataToSend, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            message.success('Kayıt başarıyla güncellendi');
            setShowEditModal(false);
            setEditingRecord(null);
            resetUploadForm();

            // Listeyi yenile
            const recordsResponse = await api.get('/sgk/records');
            setAllRecords(recordsResponse.data || []);
        } catch (error) {
            const err = error as { response?: { data?: { message?: string } } };
            message.error(err?.response?.data?.message || 'Güncelleme sırasında hata oluştu');
        } finally {
            setLoading(false);
        }
    }, [editAppendFiles, editReplaceFiles, editingRecord, formData, resetUploadForm]);

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-slate-800 rounded-lg transition shrink-0">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Otel SGK Belge Kayıt Sayfası</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Otel SGK belgelerini yönetin.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => { resetUploadForm(); setShowUploadModal(true); }}
                            className="flex items-center justify-center gap-2 bg-slate-600 hover:bg-slate-700 text-white px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg transition shadow-md hover:shadow-lg text-sm sm:text-base w-full sm:w-auto"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            SGK Belgesi Kaydet
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-4">
                {/* Filter Section */}
                <div className="w-full bg-white rounded-lg shadow border border-gray-200 p-4 sm:p-5 mb-2">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
                        <h2 className="text-xl font-bold text-gray-900">
                            SGK Belgeleri
                            <span className="block sm:inline sm:ml-3 text-sm font-normal text-gray-500">
                                ({filteredRecords.length} kayıt{hasActiveFilters && ` - ${allRecords.length} toplam`})
                            </span>
                        </h2>
                        {hasActiveFilters && (
                            <button
                                onClick={resetFilters}
                                className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Filtreleri Temizle
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                TC Kimlik No
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={filters.tc_no}
                                    onChange={(e) => setFilters({ ...filters, tc_no: e.target.value, passport_no: '' })}
                                    placeholder="11 haneli TC No"
                                    maxLength={11}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <button
                                    onClick={handleTcPassportSearch}
                                    disabled={!filters.tc_no || searching}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition"
                                    title="TC ile ara"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Pasaport No
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={filters.passport_no}
                                    onChange={(e) => setFilters({ ...filters, passport_no: e.target.value, tc_no: '' })}
                                    placeholder="6-20 karakter"
                                    maxLength={20}
                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <button
                                    onClick={handleTcPassportSearch}
                                    disabled={!filters.passport_no || searching}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition"
                                    title="Pasaport ile ara"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Ad Soyad
                            </label>
                            <input
                                type="text"
                                value={filters.full_name}
                                onChange={(e) => setFilters({ ...filters, full_name: e.target.value })}
                                placeholder="İsim ile filtrele..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Firma Adı
                            </label>
                            <input
                                type="text"
                                value={filters.company_name}
                                onChange={(e) => setFilters({ ...filters, company_name: e.target.value })}
                                placeholder="Firma adı ile filtrele..."
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                    </div>
                </div>

                {/* Records List */}
                {loading ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500">Yükleniyor...</p>
                    </div>
                ) : filteredRecords.length > 0 ? (
                    <div className="bg-white rounded-lg shadow border border-gray-200 w-full flex-1 min-h-0 overflow-hidden">
                        <div className="p-3 sm:p-4 h-full min-h-0 overflow-auto">
                            <div className="space-y-2">
                                {filteredRecords.map((record) => (
                                    <div key={record.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition w-full">
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                            <div className={`flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs min-w-0 ${isAdminView ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
                                                <div>
                                                    <span className="text-gray-500 block text-[11px] font-semibold uppercase tracking-wider mb-0.5">Ad Soyad</span>
                                                    <span className="font-normal text-gray-900 break-words">{record.full_name}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500 block text-[11px] font-semibold uppercase tracking-wider mb-0.5">Firma</span>
                                                    <span className="font-normal text-gray-900 break-words">{record.company_name || '-'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500 block text-[11px] font-semibold uppercase tracking-wider mb-0.5">Yüklenme Tarihi</span>
                                                    <span className="font-normal text-gray-900">{formatDate(record.upload_date)}</span>
                                                </div>
                                                {isAdminView && (
                                                    <div>
                                                        <span className="text-gray-500 block text-[11px] font-semibold uppercase tracking-wider mb-0.5">Kaydeden</span>
                                                        <span className="font-normal text-gray-900 break-words">{record.personnel || '-'}</span>
                                                    </div>
                                                )}
                                                <div>
                                                    <span className="text-gray-500 block text-[11px] font-semibold uppercase tracking-wider mb-0.5">Dosya</span>
                                                    <span className="font-normal text-gray-900">{record.file_count || record.files?.length || 0} adet</span>
                                                </div>
                                            </div>
                                            <div className="flex-shrink-0 flex flex-nowrap items-center gap-2 sm:gap-3 overflow-x-auto whitespace-nowrap">
                                                <CompactActionButton
                                                    onClick={() => handleEdit(record)}
                                                    variant="primary"
                                                    label="Düzenle"
                                                    icon={
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                        </svg>
                                                    }
                                                />
                                                <CompactActionButton
                                                    onClick={() => handlePreview(record)}
                                                    variant="success"
                                                    label="Görüntüle"
                                                    icon={
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    }
                                                />
                                                <CompactActionButton
                                                    onClick={() => handleDelete(record)}
                                                    variant="danger"
                                                    label="Sil"
                                                    icon={
                                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    }
                                                />
                                            </div>
                                        </div>
                                        {record.notes && (
                                            <div className="mt-2 pt-2 border-t border-gray-200">
                                                <span className="text-gray-500 font-semibold text-xs">Not: </span>
                                                <span className="text-gray-900 text-xs">{record.notes}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center w-full">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">Kayıt bulunamadı</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            {hasActiveFilters ? 'Filtrelere uygun kayıt bulunamadı.' : 'Henüz SGK belgesi kaydı yok.'}
                        </p>
                        {hasActiveFilters && (
                            <button
                                onClick={resetFilters}
                                className="mt-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Filtreleri Temizle
                            </button>
                        )}
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            TC Kimlik No
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.tc_no}
                                            onChange={(e) => setFormData({ ...formData, tc_no: e.target.value, passport_no: '' })}
                                            placeholder="11 haneli TC No"
                                            maxLength={11}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">TC veya Pasaport seçiniz</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Pasaport Numarası
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.passport_no}
                                            onChange={(e) => setFormData({ ...formData, passport_no: e.target.value, tc_no: '' })}
                                            placeholder="Pasaport No (6-20 karakter)"
                                            maxLength={20}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">TC vatandaşı değilse</p>
                                    </div>
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
                                        Belge Dosyaları (PDF, JPG, PNG) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept="application/pdf,image/jpeg,image/jpg,image/png"
                                        multiple
                                        onChange={handleUploadFileChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                                        required
                                    />
                                    {formData.pdf_files.length > 0 && (
                                        <p className="mt-2 text-sm text-gray-600">
                                            Seçili dosyalar: {formData.pdf_files.length} adet
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
                                    <ActionButton type="submit" variant="primary" className="flex-1 py-3 text-sm">
                                        Kaydet
                                    </ActionButton>
                                    <ActionButton type="button" variant="neutral" onClick={() => { setShowUploadModal(false); resetUploadForm(); }} className="flex-1 py-3 text-sm">
                                        İptal
                                    </ActionButton>
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
                                    <strong>Not:</strong> TC/Pasaport güncellemek için tekrar girmeniz gerekiyor.
                                    Dosya işlemleri için aşağıdaki iki seçenekten yalnızca birini kullanın.
                                </p>
                            </div>

                            <form onSubmit={handleEditSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            TC Kimlik No
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.tc_no}
                                            onChange={(e) => setFormData({ ...formData, tc_no: e.target.value, passport_no: '' })}
                                            placeholder="11 haneli TC No"
                                            maxLength={11}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">TC veya Pasaport seçiniz</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Pasaport Numarası
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.passport_no}
                                            onChange={(e) => setFormData({ ...formData, passport_no: e.target.value, tc_no: '' })}
                                            placeholder="Pasaport No (6-20 karakter)"
                                            maxLength={20}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <p className="mt-1 text-xs text-gray-500">TC vatandaşı değilse</p>
                                    </div>
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
                                        Yeni Dosya Ekle (Mevcutlar silinmez) <span className="text-gray-500">(Opsiyonel)</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept="application/pdf,image/jpeg,image/jpg,image/png"
                                        multiple
                                        disabled={editReplaceFiles.length > 0}
                                        onChange={handleEditAppendFilesChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                    {editAppendFiles.length > 0 ? (
                                        <p className="mt-2 text-sm text-green-600">
                                            Eklenecek yeni dosyalar: {editAppendFiles.length} adet
                                        </p>
                                    ) : (
                                        <p className="mt-2 text-sm text-gray-600">
                                            Mevcut dosya: {editingRecord.file_count || editingRecord.files?.length || 0} adet
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Dosyaları Yeniden Yükle (Tümünü değiştir) <span className="text-gray-500">(Opsiyonel)</span>
                                    </label>
                                    <input
                                        type="file"
                                        accept="application/pdf,image/jpeg,image/jpg,image/png"
                                        multiple
                                        disabled={editAppendFiles.length > 0}
                                        onChange={handleEditReplaceFilesChange}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                                    />
                                    {editReplaceFiles.length > 0 && (
                                        <p className="mt-2 text-sm text-red-600">
                                            Yeniden yüklenecek dosyalar: {editReplaceFiles.length} adet (mevcut dosyalar silinir)
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
                                    <ActionButton
                                        type="submit"
                                        variant="primary"
                                        disabled={loading}
                                        className="flex-1 py-3 text-sm"
                                    >
                                        {loading ? 'Güncelleniyor...' : 'Güncelle'}
                                    </ActionButton>
                                    <ActionButton
                                        type="button"
                                        variant="neutral"
                                        onClick={() => { setShowEditModal(false); setEditingRecord(null); resetUploadForm(); }}
                                        className="flex-1 py-3 text-sm"
                                    >
                                        İptal
                                    </ActionButton>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal */}
            {showPreviewModal && previewRecord && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-2 sm:p-4 z-50">
                    <div className="bg-white rounded-none sm:rounded-lg max-w-5xl w-full h-[95vh] sm:h-[90vh] flex flex-col">
                        <div className="p-3 sm:p-4 border-b border-gray-200 flex justify-between items-start gap-3">
                            <div className="min-w-0">
                                <h2 className="text-base sm:text-xl font-bold text-gray-900 break-words">{previewRecord.full_name} - SGK Belgesi</h2>
                                <p className="text-xs sm:text-sm text-gray-600 break-words">{previewRecord.company_name || 'Firma belirtilmemiş'}</p>
                                {previewFiles.length > 0 && (
                                    <p className="text-xs sm:text-sm text-gray-600 mt-1">
                                        Dosya {selectedFileIndex + 1} / {previewFiles.length}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {(previewContentType.includes('pdf') || (selectedPreviewFile?.file_name || '').match(/\.pdf$/i)) && pdfUrl && (
                                    <a
                                        href={pdfUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs sm:text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition"
                                    >
                                        Yeni Sekmede Aç
                                    </a>
                                )}
                                <button onClick={() => {
                                    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                                    setShowPreviewModal(false);
                                    setPdfUrl('');
                                    setPreviewRecord(null);
                                    setPreviewContentType('');
                                    setSelectedFileIndex(0);
                                }} className="text-gray-400 hover:text-gray-600">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        {previewFiles.length > 1 && (
                            <div className="border-b border-gray-200 px-3 py-2 flex items-center gap-2 overflow-x-auto">
                                {previewFiles.map((file, index) => (
                                    <button
                                        key={file.id || `${file.file_name}-${index}`}
                                        onClick={() => setSelectedFileIndex(index)}
                                        className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap ${selectedFileIndex === index ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                    >
                                        {normalizeDisplayFileName(file.original_file_name || file.file_name)}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="flex-1 min-h-0 overflow-auto bg-gray-100 flex items-center justify-center">
                            {previewLoading ? (
                                <div className="text-gray-700 text-sm sm:text-base">Belge yükleniyor...</div>
                            ) : (previewContentType.startsWith('image/') || (selectedPreviewFile?.file_name || '').match(/\.(jpg|jpeg|png)$/i)) ? (
                                // Resim dosyası için img tag kullan
                                <img
                                    src={pdfUrl}
                                    alt={previewRecord.full_name}
                                    onWheel={handleImageWheel}
                                    className="max-w-full max-h-full object-contain select-none transition-transform duration-200"
                                    style={{
                                        transform: `scale(${imageZoom})`,
                                        transformOrigin: zoomOrigin,
                                        cursor: imageZoom > 1 ? 'zoom-out' : 'zoom-in'
                                    }}
                                />
                            ) : (previewContentType.includes('pdf') || (selectedPreviewFile?.file_name || '').match(/\.pdf$/i)) ? (
                                isMobilePreview ? (
                                    <div className="text-center p-6 sm:p-8">
                                        <p className="text-gray-700 mb-3">Mobil cihazlarda PDF yeni sekmede açılır.</p>
                                        {pdfUrl && (
                                            <a
                                                href={pdfUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition text-sm"
                                            >
                                                PDF'i Yeni Sekmede Aç
                                            </a>
                                        )}
                                    </div>
                                ) : (
                                    <iframe
                                        src={pdfUrl}
                                        className="w-full h-full"
                                        title="SGK PDF Önizleme"
                                    />
                                )
                            ) : (
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
