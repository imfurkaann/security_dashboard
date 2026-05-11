import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from '../utils/dayjsConfig';
import 'antd/dist/reset.css';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import axios from 'axios';
import { formatDate, formatTime } from '../utils/dateUtils';
import type { VehicleUsage, Vehicle } from '../types';
import { API_URL } from '../constants';
import { useRealtimeRefetch } from '../realtime/useRealtimeRefetch';
const { RangePicker } = DatePicker;

const normalizeSearchText = (value: string | null | undefined): string => {
    return (value || '').toLocaleLowerCase('tr-TR').normalize('NFC');
};

export default function AdminVehicleRecords() {
    const [records, setRecords] = useState<VehicleUsage[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [infoMessage, setInfoMessage] = useState<string | null>(null);
    const [textPreview, setTextPreview] = useState<{ title: string; value: string } | null>(null);
    const [scrollbarSpacerWidth, setScrollbarSpacerWidth] = useState(0);
    const navigate = useNavigate();
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const bottomScrollRef = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async () => {
        try {
            const adminToken = localStorage.getItem('adminToken');
            const config = {
                headers: {
                    Authorization: `Bearer ${adminToken}`
                }
            };

            const [recordsRes, vehiclesRes] = await Promise.all([
                axios.get(`${API_URL}/vehicles/records?includeDeleted=true`, config),
                axios.get(`${API_URL}/vehicles`, config)
            ]);
            setRecords(recordsRes.data || []);
            setVehicles(vehiclesRes.data || []);
        } catch (error) {
            console.error('Veriler yüklenemedi:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Filter states
    const [filters, setFilters] = useState({
        vehicle_plate: '',
        manager: '',
        destination: '',
        given_by: '',
        returned_by: '',
        status: 'all',
        gate: 'all',
        givenDateStart: '',
        givenDateEnd: '',
        returnDateStart: '',
        returnDateEnd: ''
    });

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    useRealtimeRefetch({
        topics: ['vehicles'],
        onMutation: fetchData,
        enabled: true,
    });

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            // Vehicle plate filter - exact match
            if (filters.vehicle_plate && record.vehicle_plate !== filters.vehicle_plate) {
                return false;
            }

            // Manager filter
            if (filters.manager && !normalizeSearchText(record.manager).includes(normalizeSearchText(filters.manager))) {
                return false;
            }

            // Destination filter
            if (filters.destination && !normalizeSearchText(record.destination).includes(normalizeSearchText(filters.destination))) {
                return false;
            }

            // Given by filter
            if (filters.given_by && !normalizeSearchText(record.given_by).includes(normalizeSearchText(filters.given_by))) {
                return false;
            }

            // Returned by filter
            if (filters.returned_by && !normalizeSearchText(record.returned_by).includes(normalizeSearchText(filters.returned_by))) {
                return false;
            }

            // Status filter
            if (filters.status === 'deleted') {
                if (!record.deleted_at) {
                    return false;
                }
            } else if (filters.status === 'in_use') {
                if (record.status !== 'in_use' || Boolean(record.deleted_at)) {
                    return false;
                }
            } else if (filters.status === 'returned') {
                if (record.status !== 'returned' || Boolean(record.deleted_at)) {
                    return false;
                }
            }

            // Gate filter
            if (filters.gate !== 'all' && (record.gate || '') !== filters.gate) {
                return false;
            }

            // Given date range filter - dayjs ile yerel tarihe çevir
            const givenDateOnly = record.given_date ? dayjs(record.given_date).format('YYYY-MM-DD') : '';
            if (filters.givenDateStart && givenDateOnly) {
                if (givenDateOnly < filters.givenDateStart) {
                    return false;
                }
            }

            if (filters.givenDateEnd && givenDateOnly) {
                if (givenDateOnly > filters.givenDateEnd) {
                    return false;
                }
            }

            // Return date range filter - dayjs ile yerel tarihe çevir
            const returnDateOnly = record.return_date ? dayjs(record.return_date).format('YYYY-MM-DD') : '';
            if (filters.returnDateStart && returnDateOnly) {
                if (returnDateOnly < filters.returnDateStart) {
                    return false;
                }
            }

            if (filters.returnDateEnd && returnDateOnly) {
                if (returnDateOnly > filters.returnDateEnd) {
                    return false;
                }
            }

            return true;
        });
    }, [records, filters]);

    // Check if any filter is active
    const hasActiveFilters = useMemo(() => {
        return filters.vehicle_plate !== '' ||
            filters.manager !== '' ||
            filters.destination !== '' ||
            filters.given_by !== '' ||
            filters.returned_by !== '' ||
            filters.status !== 'all' ||
            filters.gate !== 'all' ||
            filters.givenDateStart !== '' ||
            filters.givenDateEnd !== '' ||
            filters.returnDateStart !== '' ||
            filters.returnDateEnd !== '';
    }, [filters]);

    // Group by day for both default and filtered views (newest day first)
    const groupedByDay = useMemo(() => {
        const dayGroups = new Map<string, VehicleUsage[]>();

        filteredRecords.forEach((record) => {
            const dayKey = dayjs(record.given_date).format('YYYY-MM-DD');
            if (!dayGroups.has(dayKey)) {
                dayGroups.set(dayKey, []);
            }
            dayGroups.get(dayKey)!.push(record);
        });

        return Array.from(dayGroups.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([dayKey, items]) => ({
                dayKey,
                dayLabel: dayjs(dayKey).format('DD MMMM YYYY dddd'),
                records: [...items].sort((a, b) => {
                    const dateCompare = a.given_date.localeCompare(b.given_date);
                    if (dateCompare !== 0) return dateCompare;
                    return a.given_time.localeCompare(b.given_time);
                })
            }));
    }, [filteredRecords]);

    const handleDownloadRecords = useCallback(async () => {
        // Race condition guard: don't allow concurrent exports
        if (isExporting) {
            return;
        }

        const exportableRecords = filteredRecords.filter(record => !record.deleted_at);

        if (exportableRecords.length === 0) {
            alert('İndirilecek kayıt bulunamadı.');
            return;
        }

        setIsExporting(true);

        try {
            const exportGroupsMap = new Map<string, VehicleUsage[]>();

            exportableRecords.forEach((record) => {
                const dayKey = dayjs(record.given_date).format('YYYY-MM-DD');
                if (!exportGroupsMap.has(dayKey)) {
                    exportGroupsMap.set(dayKey, []);
                }
                exportGroupsMap.get(dayKey)!.push(record);
            });

            const exportGroups = Array.from(exportGroupsMap.entries())
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([dayKey, items]) => ({
                    dayKey,
                    dayLabel: dayjs(dayKey).format('DD MMMM YYYY dddd'),
                    records: [...items].sort((a, b) => {
                        const dateCompare = a.given_date.localeCompare(b.given_date);
                        if (dateCompare !== 0) return dateCompare;
                        return a.given_time.localeCompare(b.given_time);
                    })
                }));

            const headerRow = [
                'Araç',
                'Araç Plakası',
                'Müdür',
                'Müdür Ünvanı',
                'Gidilen Yer',
                'Kapı',
                'Teslim Tarihi',
                'Teslim Saati',
                'İade Tarihi',
                'İade Saati',
                'Teslim Eden',
                'Teslim Alan',
                'Durum',
                'Açıklama'
            ];

            const worksheetColumnWidths = [18, 16, 20, 16, 24, 12, 14, 12, 14, 12, 18, 18, 14, 32];

            const plateSuffix = filters.vehicle_plate
                ? `_${filters.vehicle_plate.replace(/[^a-zA-Z0-9_-]/g, '')}`
                : '';

            const dayFiles: Array<{ fileName: string; data: ArrayBuffer }> = [];

            for (const dayGroup of exportGroups) {
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Araç Kayıtları');

                worksheet.columns = worksheetColumnWidths.map(width => ({ width }));

                const header = worksheet.addRow(headerRow);
                header.height = 24;
                header.eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF1D4ED8' }
                    };
                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
                    };
                });

                dayGroup.records.forEach((record) => {
                    const row = worksheet.addRow([
                        record.vehicle,
                        record.vehicle_plate,
                        record.manager,
                        record.manager_title,
                        record.destination || '-',
                        record.gate || '-',
                        formatDate(record.given_date),
                        formatTime(record.given_time),
                        record.return_date ? formatDate(record.return_date) : '-',
                        record.return_time ? formatTime(record.return_time) : '-',
                        record.given_by || '-',
                        record.returned_by || '-',
                        record.status === 'in_use' ? 'Kullanımda' : 'Teslim Alındı',
                        record.notes || '-'
                    ]);

                    row.eachCell((cell) => {
                        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                        };
                    });
                });

                const formattedDayForFileName = dayjs(dayGroup.dayKey).format('DD-MM-YYYY');
                const fileName = `Arac_Kayitlari${plateSuffix}_${formattedDayForFileName}.xlsx`;
                const workbookBuffer = await workbook.xlsx.writeBuffer();
                dayFiles.push({ fileName, data: workbookBuffer as ArrayBuffer });
            }

            // Helper function to trigger download with proper cleanup
            const triggerDownload = (blob: Blob, fileName: string) => {
                return new Promise<void>((resolve) => {
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = fileName;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    
                    // Delayed cleanup to ensure download starts
                    setTimeout(() => {
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                        resolve();
                    }, 500);
                });
            };

            if (dayFiles.length === 1) {
                const [singleFile] = dayFiles;
                const blob = new Blob([singleFile.data], {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                });
                await triggerDownload(blob, singleFile.fileName);
                return;
            }

            const zip = new JSZip();
            dayFiles.forEach((file) => {
                zip.file(file.fileName, file.data);
            });

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const timestamp = dayjs().format('DD-MM-YYYY_HH-mm');
            await triggerDownload(zipBlob, `Arac_Kayitlari_Toplu_${timestamp}.zip`);
        } catch (error) {
            console.error('Export hatası:', error);
            alert('Kayıtlar indirilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
        } finally {
            setIsExporting(false);
        }
    }, [filteredRecords, filters.vehicle_plate, isExporting]);

    // Clear all filters
    const clearFilters = () => {
        setFilters({
            vehicle_plate: '',
            manager: '',
            destination: '',
            given_by: '',
            returned_by: '',
            status: 'all',
            gate: 'all',
            givenDateStart: '',
            givenDateEnd: '',
            returnDateStart: '',
            returnDateEnd: ''
        });
    };

    const handleDeleteRecord = async (id: string) => {
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

        try {
            const adminToken = localStorage.getItem('adminToken');
            await axios.delete(`${API_URL}/vehicles/records/${id}`, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: new Date().toISOString() } : record));
        } catch (error) {
            console.error('Kayıt silinemedi:', error);
            alert('Kayıt silinirken bir hata oluştu');
        }
    };

    const handleRestoreRecord = async (id: string) => {
        if (!confirm('Bu kaydı geri almak istediğinize emin misiniz?')) return;

        try {
            const adminToken = localStorage.getItem('adminToken');
            await axios.post(`${API_URL}/vehicles/records/${id}/restore`, {}, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: null } : record));
            setInfoMessage('Kayıt geri alındı.');
        } catch (error) {
            console.error('Kayıt geri alınamadı:', error);
            alert('Kayıt geri alınırken bir hata oluştu');
        }
    };

    const renderPreviewText = (value: string | null | undefined, title: string) => {
        const text = (value || '-').toString();
        const isLong = text.length > 15;

        if (!isLong) {
            return <div className="text-sm text-gray-900 block max-w-[240px] truncate whitespace-nowrap overflow-hidden" title={text}>{text}</div>;
        }

        return (
            <button
                type="button"
                onClick={() => setTextPreview({ title, value: text })}
                className="text-sm text-blue-700 hover:text-blue-900 underline text-left block max-w-[240px] truncate whitespace-nowrap overflow-hidden"
                title="Tamamını görmek için tıklayın"
            >
                {text}
            </button>
        );
    };

    useEffect(() => {
        const updateScrollbarWidth = () => {
            const tableScrollWidth = tableScrollRef.current?.scrollWidth ?? 0;
            const tableClientWidth = tableScrollRef.current?.clientWidth ?? 0;
            const barClientWidth = bottomScrollRef.current?.clientWidth ?? 0;
            const normalizedWidth = Math.max(
                tableScrollWidth - tableClientWidth + barClientWidth,
                barClientWidth + 1
            );
            setScrollbarSpacerWidth(normalizedWidth);
        };

        updateScrollbarWidth();

        const resizeObserver = new ResizeObserver(updateScrollbarWidth);
        if (tableScrollRef.current) resizeObserver.observe(tableScrollRef.current);
        if (bottomScrollRef.current) resizeObserver.observe(bottomScrollRef.current);
        window.addEventListener('resize', updateScrollbarWidth);

        return () => {
            window.removeEventListener('resize', updateScrollbarWidth);
            resizeObserver.disconnect();
        };
    }, [filteredRecords.length, loading]);

    useEffect(() => {
        if (!infoMessage) return;
        const t = setTimeout(() => setInfoMessage(null), 3000);
        return () => clearTimeout(t);
    }, [infoMessage]);

    const syncBottomScroll = () => {
        const tableNode = tableScrollRef.current;
        const barNode = bottomScrollRef.current;

        if (!tableNode || !barNode) return;
        tableNode.scrollLeft = barNode.scrollLeft;
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="p-2 hover:bg-slate-800 rounded-lg transition shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight break-words">Araç Kayıtları</h1>
                                <p className="text-sm sm:text-base text-slate-200 mt-1">Tüm geçmiş kayıtları görüntüleyin ve filtreleyin</p>
                            </div>
                        </div>
                        <div className="w-full lg:w-auto flex justify-start lg:justify-end gap-3">
                            <button
                                onClick={handleDownloadRecords}
                                disabled={isExporting || loading || filteredRecords.length === 0}
                                className="flex lg:flex-1 lg:flex-none items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-6 py-2.5 sm:py-3 rounded-lg transition shadow-md hover:shadow-lg text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isExporting ? (
                                    <>
                                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        İndiriliyor...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Kayıt İndir
                                    </>
                                )}
                            </button>
                            <button
                                onClick={() => navigate('/admin/manage-vehicles')}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 text-sm sm:text-base w-full sm:w-auto"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                                Araç Ekle / Sil
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 min-h-0 w-full px-4 sm:px-6 lg:px-8 py-8 pb-14 flex flex-col gap-4 overflow-hidden">
                {infoMessage && (
                    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
                        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-2 rounded-md text-sm">{infoMessage}</div>
                    </div>
                )}
                {/* Filters Panel */}
                <div className="bg-white rounded-lg shadow px-3 py-2 mb-3 w-full">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-base font-bold text-gray-900">Filtreler</h2>
                        <button
                            onClick={clearFilters}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Temizle
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Araç Plakası</label>
                            <select
                                value={filters.vehicle_plate}
                                onChange={(e) => setFilters({ ...filters, vehicle_plate: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Tüm Araçlar</option>
                                {vehicles.map(vehicle => (
                                    <option key={vehicle.id} value={vehicle.plate}>{vehicle.plate}</option>
                                ))}
                            </select>
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Teslim Edilen</label>
                            <input
                                type="text"
                                value={filters.manager}
                                onChange={(e) => setFilters({ ...filters, manager: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Gidilen Yer</label>
                            <input
                                type="text"
                                value={filters.destination}
                                onChange={(e) => setFilters({ ...filters, destination: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Durum</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="in_use">Kullanımda</option>
                                <option value="returned">Teslim Alındı</option>
                                <option value="deleted">Silinen Kayıtlar</option>
                            </select>
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Kapı</label>
                            <select
                                value={filters.gate}
                                onChange={(e) => setFilters({ ...filters, gate: e.target.value })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="Ana Kapı">Ana Kapı</option>
                                <option value="Sahil Kapı">Sahil Kapı</option>
                            </select>
                        </div>

                        <div className="xl:col-span-1">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Teslim Eden</label>
                            <input
                                type="text"
                                value={filters.given_by}
                                onChange={(e) => setFilters({ ...filters, given_by: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Teslim Alan</label>
                            <input
                                type="text"
                                value={filters.returned_by}
                                onChange={(e) => setFilters({ ...filters, returned_by: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Teslim Tarihi</label>
                            <RangePicker
                                value={[
                                    filters.givenDateStart ? dayjs(filters.givenDateStart) : null,
                                    filters.givenDateEnd ? dayjs(filters.givenDateEnd) : null
                                ]}
                                onChange={(dates) => {
                                    if (!dates || (!dates[0] && !dates[1])) {
                                        setFilters({
                                            ...filters,
                                            givenDateStart: '',
                                            givenDateEnd: ''
                                        });
                                    } else if (dates[0] && dates[1]) {
                                        setFilters({
                                            ...filters,
                                            givenDateStart: dates[0].format('YYYY-MM-DD'),
                                            givenDateEnd: dates[1].format('YYYY-MM-DD')
                                        });
                                    } else if (dates[0] && !dates[1]) {
                                        const singleDate = dates[0].format('YYYY-MM-DD');
                                        setFilters({
                                            ...filters,
                                            givenDateStart: singleDate,
                                            givenDateEnd: singleDate
                                        });
                                    }
                                }}
                                allowEmpty={[false, true]}
                                format="DD/MM/YYYY"
                                placeholder={['Başlangıç', 'Bitiş']}
                                className="w-full"
                                size="small"
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div className="xl:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">İade Tarihi</label>
                            <RangePicker
                                value={[
                                    filters.returnDateStart ? dayjs(filters.returnDateStart) : null,
                                    filters.returnDateEnd ? dayjs(filters.returnDateEnd) : null
                                ]}
                                onChange={(dates) => {
                                    if (!dates || (!dates[0] && !dates[1])) {
                                        setFilters({
                                            ...filters,
                                            returnDateStart: '',
                                            returnDateEnd: ''
                                        });
                                    } else if (dates[0] && dates[1]) {
                                        setFilters({
                                            ...filters,
                                            returnDateStart: dates[0].format('YYYY-MM-DD'),
                                            returnDateEnd: dates[1].format('YYYY-MM-DD')
                                        });
                                    } else if (dates[0] && !dates[1]) {
                                        const singleDate = dates[0].format('YYYY-MM-DD');
                                        setFilters({
                                            ...filters,
                                            returnDateStart: singleDate,
                                            returnDateEnd: singleDate
                                        });
                                    }
                                }}
                                allowEmpty={[false, true]}
                                format="DD/MM/YYYY"
                                placeholder={['Başlangıç', 'Bitiş']}
                                className="w-full"
                                size="small"
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>
                </div>

                {/* Records Table */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-4 min-h-[520px] overflow-hidden flex-1 min-h-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="text-center py-12">
                            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-gray-500">Filtrelere uygun kayıt bulunamadı</p>
                        </div>
                    ) : (
                        <div
                            ref={tableScrollRef}
                            className="h-full min-h-0 overflow-x-hidden overflow-y-auto pb-2"
                        >
                            {groupedByDay.map((dayGroup) => (
                                <div key={dayGroup.dayKey} className="mb-4 last:mb-0">
                                    <div className="sticky top-0 bg-gray-100 px-4 py-2 border-l-4 border-blue-500 z-10 shadow-sm">
                                        <h3 className="text-sm font-semibold text-gray-800">{dayGroup.dayLabel}</h3>
                                    </div>

                                    <table className="w-full min-w-[1560px] table-fixed divide-y divide-gray-200">
                                        <thead className="bg-gray-50 sticky top-10 z-10">
                                            <tr>
                                                <th className="w-[170px] px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Araç</th>
                                                <th className="w-[170px] px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Müdür</th>
                                                <th className="w-[180px] px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gidilen Yer</th>
                                                <th className="w-[95px] px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kapı</th>
                                                <th className="w-[130px] px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teslim Tarihi</th>
                                                <th className="w-[130px] px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İade Tarihi</th>
                                                <th className="w-[160px] px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teslim Eden</th>
                                                <th className="w-[160px] px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teslim Alan</th>
                                                <th className="w-[110px] px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                                <th className="w-[250px] px-4 py-3 whitespace-nowrap text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {dayGroup.records.map((record) => (
                                                <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm font-bold text-gray-900">{record.vehicle_plate}</div>
                                                        <div className="text-xs text-gray-500">{record.vehicle_brand}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900 whitespace-nowrap">{record.manager || '-'}</div>
                                                        <div className="text-xs text-gray-500">{record.manager_title}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900 whitespace-nowrap">{record.destination || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900 whitespace-nowrap">{record.gate || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900">{formatDate(record.given_date)}</div>
                                                        <div className="text-xs text-gray-500">{formatTime(record.given_time)}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {record.return_date ? (
                                                            <>
                                                                <div className="text-sm text-gray-900">{formatDate(record.return_date)}</div>
                                                                <div className="text-xs text-gray-500">{formatTime(record.return_time)}</div>
                                                            </>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900 whitespace-nowrap">{record.given_by || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="text-sm text-gray-900 whitespace-nowrap">{record.returned_by || '-'}</div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        {record.deleted_at ? (
                                                            <span className="px-2 py-1 inline-flex whitespace-nowrap text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-700">
                                                                Silindi
                                                            </span>
                                                        ) : record.status === 'in_use' ? (
                                                            <span className="px-2 py-1 inline-flex whitespace-nowrap text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                                                                Kullanımda
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-1 inline-flex whitespace-nowrap text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                                Teslim Alındı
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 pr-6">
                                                        {renderPreviewText(record.notes, 'Açıklama')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            <div className="fixed bottom-0 left-0 right-0 lg:left-[var(--sidebar-width)] z-40 border-t border-gray-200 bg-white/95 backdrop-blur shadow-[0_-8px_20px_rgba(15,23,42,0.08)]">
                <div ref={bottomScrollRef} onScroll={syncBottomScroll} className="h-5 overflow-x-scroll overflow-y-hidden">
                    <div style={{ width: `${scrollbarSpacerWidth}px`, height: 1 }} />
                </div>
            </div>

            {textPreview && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900">{textPreview.title}</h3>
                            <button
                                type="button"
                                onClick={() => setTextPreview(null)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                Kapat
                            </button>
                        </div>
                        <div className="px-4 py-4">
                            <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{textPreview.value}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
