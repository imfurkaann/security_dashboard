import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from '../utils/dayjsConfig';
import type { Dayjs } from 'dayjs';
import 'antd/dist/reset.css';
import api from '../utils/api';
import { formatDate, formatTime } from '../utils/dateUtils';
import type { VisitorRecord } from '../types';
import ActionButton from '../components/ActionButton';

const { RangePicker } = DatePicker;

export default function VisitorRecords() {
    const [records, setRecords] = useState<VisitorRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Filter states
    const [filters, setFilters] = useState({
        full_name: '',
        company_name: '',
        vehicle_plate: '',
        visiting_person: '',
        phone: '',
        entry_by: '',
        exit_by: '',
        status: 'all',
        subcontractor_worker: 'all',
        for_electric_station: 'all',
        entryDateStart: '',
        entryDateEnd: '',
        exitDateStart: '',
        exitDateEnd: ''
    });

    // Fetch all records
    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get('/visitors/records?includeDeleted=true');
                setRecords(res.data || []);
            } catch (error) {
                console.error('Veriler yüklenemedi:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Filtered records
    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            // Full name filter
            if (filters.full_name && (!record.full_name || !record.full_name.toLowerCase().includes(filters.full_name.toLowerCase()))) {
                return false;
            }

            // Company name filter
            if (filters.company_name && (!record.company_name || !record.company_name.toLowerCase().includes(filters.company_name.toLowerCase()))) {
                return false;
            }

            // Vehicle plate filter
            if (filters.vehicle_plate && (!record.vehicle_plate || !record.vehicle_plate.toLowerCase().includes(filters.vehicle_plate.toLowerCase()))) {
                return false;
            }

            // Visiting person filter
            if (filters.visiting_person && (!record.visiting_person || !record.visiting_person.toLowerCase().includes(filters.visiting_person.toLowerCase()))) {
                return false;
            }

            // Phone filter
            if (filters.phone && (!record.phone || !record.phone.includes(filters.phone))) {
                return false;
            }

            // Entry by filter
            if (filters.entry_by && record.entry_by && !record.entry_by.toLowerCase().includes(filters.entry_by.toLowerCase())) {
                return false;
            }

            // Exit by filter
            if (filters.exit_by && record.exit_by && !record.exit_by.toLowerCase().includes(filters.exit_by.toLowerCase())) {
                return false;
            }

            // Status filter
            if (filters.status !== 'all' && record.status !== filters.status) {
                return false;
            }

            // Subcontractor filter
            if (filters.subcontractor_worker === 'yes' && !record.subcontractor_worker) {
                return false;
            }
            if (filters.subcontractor_worker === 'no' && record.subcontractor_worker) {
                return false;
            }

            // Electric station filter
            if (filters.for_electric_station === 'yes' && !record.for_electric_station) {
                return false;
            }
            if (filters.for_electric_station === 'no' && record.for_electric_station) {
                return false;
            }

            // Entry date range filter - dayjs ile yerel tarihe çevir
            const entryDateOnly = record.entry_date ? dayjs(record.entry_date).format('YYYY-MM-DD') : '';
            if (filters.entryDateStart && entryDateOnly) {
                if (entryDateOnly < filters.entryDateStart) {
                    return false;
                }
            }
            if (filters.entryDateEnd && entryDateOnly) {
                if (entryDateOnly > filters.entryDateEnd) {
                    return false;
                }
            }

            // Exit date range filter - dayjs ile yerel tarihe çevir
            const exitDateOnly = record.exit_date ? dayjs(record.exit_date).format('YYYY-MM-DD') : '';
            if (filters.exitDateStart && exitDateOnly) {
                if (exitDateOnly < filters.exitDateStart) {
                    return false;
                }
            }
            if (filters.exitDateEnd && exitDateOnly) {
                if (exitDateOnly > filters.exitDateEnd) {
                    return false;
                }
            }

            return true;
        });
    }, [records, filters]);

    // Check if any filter is active
    const hasActiveFilters = useMemo(() => {
        return filters.full_name !== '' ||
            filters.company_name !== '' ||
            filters.vehicle_plate !== '' ||
            filters.visiting_person !== '' ||
            filters.phone !== '' ||
            filters.entry_by !== '' ||
            filters.exit_by !== '' ||
            filters.status !== 'all' ||
            filters.subcontractor_worker !== 'all' ||
            filters.for_electric_station !== 'all' ||
            filters.entryDateStart !== '' ||
            filters.entryDateEnd !== '' ||
            filters.exitDateStart !== '' ||
            filters.exitDateEnd !== '';
    }, [filters]);

    // Group records by month and day - only when no filters active
    const groupedRecords = useMemo(() => {
        const monthGroups: { [key: string]: { [key: string]: VisitorRecord[] } } = {};

        filteredRecords.forEach(record => {
            const date = dayjs(record.entry_date);
            const monthKey = date.format('YYYY-MM');
            const dayKey = date.format('YYYY-MM-DD');

            if (!monthGroups[monthKey]) {
                monthGroups[monthKey] = {};
            }

            if (!monthGroups[monthKey][dayKey]) {
                monthGroups[monthKey][dayKey] = [];
            }

            monthGroups[monthKey][dayKey].push(record);
        });

        // Sort months in descending order (newest first)
        const sortedMonths = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a));

        return sortedMonths.map(monthKey => {
            // Sort days within month in descending order (newest first)
            const sortedDays = Object.keys(monthGroups[monthKey]).sort((a, b) => b.localeCompare(a));

            const dayGroups = sortedDays.map(dayKey => ({
                dayKey,
                dayLabel: dayjs(dayKey).format('DD MMMM YYYY dddd'),
                records: monthGroups[monthKey][dayKey].sort((a, b) =>
                    // Sort records by time in ascending order (earliest first)
                    (a.entry_time || '').localeCompare(b.entry_time || '')
                )
            }));

            return {
                monthKey,
                monthLabel: dayjs(monthKey + '-01').format('MMMM YYYY'),
                dayGroups,
                totalRecords: sortedDays.reduce((sum, dayKey) => sum + monthGroups[monthKey][dayKey].length, 0)
            };
        });
    }, [filteredRecords]);

    // Sorted records for filtered view (newest first)
    const sortedFilteredRecords = useMemo(() => {
        return [...filteredRecords].sort((a, b) => {
            // Sort by date (newest first), then by time
            const dateCompare = (b.entry_date || '').localeCompare(a.entry_date || '');
            if (dateCompare !== 0) return dateCompare;
            return (b.entry_time || '').localeCompare(a.entry_time || '');
        });
    }, [filteredRecords]);

    // Clear all filters
    const clearFilters = () => {
        setFilters({
            full_name: '',
            company_name: '',
            vehicle_plate: '',
            visiting_person: '',
            phone: '',
            entry_by: '',
            exit_by: '',
            status: 'all',
            subcontractor_worker: 'all',
            for_electric_station: 'all',
            entryDateStart: '',
            entryDateEnd: '',
            exitDateStart: '',
            exitDateEnd: ''
        });
    };

    // Handle date range change for entry dates
    const handleEntryDateChange = (dates: null | [Dayjs | null, Dayjs | null], dateStrings: [string, string]) => {
        if (!dates || (!dates[0] && !dates[1])) {
            // Takvim temizlendi
            setFilters({
                ...filters,
                entryDateStart: '',
                entryDateEnd: ''
            });
        } else if (dates[0] && dates[1]) {
            // İki tarih de seçildi
            setFilters({
                ...filters,
                entryDateStart: dates[0].format('YYYY-MM-DD'),
                entryDateEnd: dates[1].format('YYYY-MM-DD')
            });
        } else if (dates[0] && !dates[1]) {
            // Sadece başlangıç tarihi seçili - tek gün olarak kullan
            const singleDate = dates[0].format('YYYY-MM-DD');
            setFilters({
                ...filters,
                entryDateStart: singleDate,
                entryDateEnd: singleDate
            });
        }
    };

    // Handle date range change for exit dates
    const handleExitDateChange = (dates: null | [Dayjs | null, Dayjs | null], dateStrings: [string, string]) => {
        if (!dates || (!dates[0] && !dates[1])) {
            // Takvim temizlendi
            setFilters({
                ...filters,
                exitDateStart: '',
                exitDateEnd: ''
            });
        } else if (dates[0] && dates[1]) {
            // İki tarih de seçildi
            setFilters({
                ...filters,
                exitDateStart: dates[0].format('YYYY-MM-DD'),
                exitDateEnd: dates[1].format('YYYY-MM-DD')
            });
        } else if (dates[0] && !dates[1]) {
            // Sadece başlangıç tarihi seçili - tek gün olarak kullan
            const singleDate = dates[0].format('YYYY-MM-DD');
            setFilters({
                ...filters,
                exitDateStart: singleDate,
                exitDateEnd: singleDate
            });
        }
    };

    const handleDeleteRecord = async (id: string) => {
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

        try {
            await api.delete(`/visitors/records/${id}`);
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: new Date().toISOString() } : record));
        } catch (error) {
            console.error('Kayıt silinemedi:', error);
            alert('Kayıt silinirken bir hata oluştu');
        }
    };

    const handleRestoreRecord = async (id: string) => {
        try {
            await api.post(`/visitors/records/${id}/restore`);
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: null } : record));
        } catch (error) {
            console.error('Kayıt geri alınamadı:', error);
            alert('Kayıt geri alınırken bir hata oluştu');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/visitors')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Ziyaretçi Kayıtları</h1>
                                <p className="text-gray-600 mt-1">Tüm geçmiş kayıtları görüntüleyin ve filtreleyin</p>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600">
                            Toplam: <span className="font-bold text-gray-900">{filteredRecords.length}</span> kayıt
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filters Panel */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-4">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-base font-bold text-gray-900">Filtreler</h2>
                        <button
                            onClick={clearFilters}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                            Temizle
                        </button>
                    </div>

                    <div className="space-y-3">
                        {/* First Row - Basic Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                            {/* Full Name Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Ad Soyad
                                </label>
                                <input
                                    type="text"
                                    value={filters.full_name}
                                    onChange={(e) => setFilters({ ...filters, full_name: e.target.value })}
                                    placeholder="Ara..."
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Company Name Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Firma Adı
                                </label>
                                <input
                                    type="text"
                                    value={filters.company_name}
                                    onChange={(e) => setFilters({ ...filters, company_name: e.target.value })}
                                    placeholder="Ara..."
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Vehicle Plate Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Araç Plakası
                                </label>
                                <input
                                    type="text"
                                    value={filters.vehicle_plate}
                                    onChange={(e) => setFilters({ ...filters, vehicle_plate: e.target.value })}
                                    placeholder="Ara..."
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Visiting Person Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Ziyaret Edilen
                                </label>
                                <input
                                    type="text"
                                    value={filters.visiting_person}
                                    onChange={(e) => setFilters({ ...filters, visiting_person: e.target.value })}
                                    placeholder="Ara..."
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Status Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Durum
                                </label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="all">Tümü</option>
                                    <option value="inside">İçeride</option>
                                    <option value="exited">Çıkış Yaptı</option>
                                </select>
                            </div>
                        </div>

                        {/* Second Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                            {/* Phone Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Telefon
                                </label>
                                <input
                                    type="text"
                                    value={filters.phone}
                                    onChange={(e) => setFilters({ ...filters, phone: e.target.value })}
                                    placeholder="Ara..."
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Entry By Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Giriş Kaydeden
                                </label>
                                <input
                                    type="text"
                                    value={filters.entry_by}
                                    onChange={(e) => setFilters({ ...filters, entry_by: e.target.value })}
                                    placeholder="Ara..."
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Exit By Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Çıkış Kaydeden
                                </label>
                                <input
                                    type="text"
                                    value={filters.exit_by}
                                    onChange={(e) => setFilters({ ...filters, exit_by: e.target.value })}
                                    placeholder="Ara..."
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Subcontractor Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Taşeron İşçi
                                </label>
                                <select
                                    value={filters.subcontractor_worker}
                                    onChange={(e) => setFilters({ ...filters, subcontractor_worker: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="all">Tümü</option>
                                    <option value="yes">Evet</option>
                                    <option value="no">Hayır</option>
                                </select>
                            </div>

                            {/* Electric Station Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Elektrik İstasyonu
                                </label>
                                <select
                                    value={filters.for_electric_station}
                                    onChange={(e) => setFilters({ ...filters, for_electric_station: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="all">Tümü</option>
                                    <option value="yes">Evet</option>
                                    <option value="no">Hayır</option>
                                </select>
                            </div>
                        </div>

                        {/* Third Row - Date Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Entry Date Range */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Giriş Tarihi
                                </label>
                                <RangePicker
                                    value={[
                                        filters.entryDateStart ? dayjs(filters.entryDateStart) : null,
                                        filters.entryDateEnd ? dayjs(filters.entryDateEnd) : null
                                    ]}
                                    onChange={handleEntryDateChange}
                                    allowEmpty={[false, true]}
                                    format="DD/MM/YYYY"
                                    placeholder={['Başlangıç', 'Bitiş']}
                                    className="w-full text-sm"
                                    style={{ height: '34px' }}
                                />
                            </div>

                            {/* Exit Date Range */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Çıkış Tarihi
                                </label>
                                <RangePicker
                                    value={[
                                        filters.exitDateStart ? dayjs(filters.exitDateStart) : null,
                                        filters.exitDateEnd ? dayjs(filters.exitDateEnd) : null
                                    ]}
                                    onChange={handleExitDateChange}
                                    allowEmpty={[false, true]}
                                    format="DD/MM/YYYY"
                                    placeholder={['Başlangıç', 'Bitiş']}
                                    className="w-full text-sm"
                                    style={{ height: '34px' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-2 text-gray-600">Yükleniyor...</p>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-8 text-center">
                        <p className="text-gray-500">Kayıt bulunamadı</p>
                    </div>
                ) : hasActiveFilters ? (
                    /* Flat table view when filters are active */
                    <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
                        <div className="overflow-x-auto">
                            <div className="max-h-[600px] overflow-y-auto">
                                <table className="min-w-full table-auto divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Araç Plaka</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İsim Soyisim</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ziyaret Edilen</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kişi Sayısı</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</th>
                                            <th className="px-6 py-3 w-60 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Yapan</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Yapan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sortedFilteredRecords.map((record) => (
                                            <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-100 rounded">
                                                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-bold text-gray-900">{record.vehicle_plate || '-'}</span>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <span className="text-sm font-bold text-gray-900">{record.full_name || '-'}</span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.company_name || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.visiting_person || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.person_count ?? '-'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-900">{formatDate(record.entry_date)}</div>
                                                    <div className="text-xs text-gray-500">{formatTime(record.entry_time)}</div>
                                                </td>

                                                <td className="px-6 py-4">
                                                    {record.exit_date ? (
                                                        <>
                                                            <div className="text-sm text-gray-900">{formatDate(record.exit_date)}</div>
                                                            <div className="text-xs text-gray-500">{formatTime(record.exit_time)}</div>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.phone || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 max-w-[240px]">
                                                    <div className="text-sm text-gray-500 truncate">{record.notes || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'inside' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                                        {record.status === 'inside' ? 'İçeride' : 'Çıkış Yapıldı'}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.entry_by || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.exit_by || '-'}</div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Grouped view by month and day */
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="overflow-x-auto">
                            <div className="max-h-[600px] overflow-y-auto">
                                {groupedRecords.map((monthGroup) => (
                                    <div key={monthGroup.monthKey} className="mb-8 last:mb-0">
                                        {/* Month Header */}
                                        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 z-10 shadow-md">
                                            <h2 className="text-lg font-bold">{monthGroup.monthLabel}</h2>
                                            <p className="text-sm text-blue-100">{monthGroup.totalRecords} kayıt</p>
                                        </div>

                                        {/* Day Groups */}
                                        {monthGroup.dayGroups.map((dayGroup) => (
                                            <div key={dayGroup.dayKey} className="mb-4 last:mb-0">
                                                {/* Day Header */}
                                                <div className="sticky top-14 bg-gray-100 px-6 py-2 border-l-4 border-blue-500 z-9 shadow-sm">
                                                    <h3 className="text-sm font-semibold text-gray-800">{dayGroup.dayLabel}</h3>
                                                    <p className="text-xs text-gray-600">{dayGroup.records.length} kayıt</p>
                                                </div>

                                                {/* Records Table */}
                                                <table className="min-w-full table-auto divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Araç Plaka</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İsim Soyisim</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Firma</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ziyaret Edilen</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kişi Sayısı</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Tarihi</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Tarihi</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</th>
                                                            <th className="px-6 py-3 w-60 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Yapan</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Yapan</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {dayGroup.records.map((record) => (
                                                            <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 bg-blue-100 rounded">
                                                                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                                                            </svg>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-sm font-bold text-gray-900">{record.vehicle_plate || '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div>
                                                                        <span className="text-sm font-bold text-gray-900">{record.full_name || '-'}</span>
                                                                    </div>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.company_name || '-'}</div>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.visiting_person || '-'}</div>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.person_count ?? '-'}</div>
                                                                </td>

                                                                <td className="px-6 py-4 sticky left-0 z-8 bg-white">
                                                                    <div className="text-sm text-gray-900">{formatDate(record.entry_date)}</div>
                                                                    <div className="text-xs text-gray-500">{formatTime(record.entry_time)}</div>
                                                                </td>

                                                                <td className="px-6 py-4 sticky left-24 z-8 bg-white">
                                                                    {record.exit_date ? (
                                                                        <>
                                                                            <div className="text-sm text-gray-900">{formatDate(record.exit_date)}</div>
                                                                            <div className="text-xs text-gray-500">{formatTime(record.exit_time)}</div>
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-gray-400">-</span>
                                                                    )}
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.phone || '-'}</div>
                                                                </td>

                                                                <td className="px-6 py-4 max-w-[240px]">
                                                                    <div className="text-sm text-gray-500 truncate">{record.notes || '-'}</div>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'inside' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                                                        {record.status === 'inside' ? 'İçeride' : 'Çıkış Yapıldı'}
                                                                    </span>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.entry_by || '-'}</div>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.exit_by || '-'}</div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
