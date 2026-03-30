import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from '../utils/dayjsConfig';
import type { Dayjs } from 'dayjs';
import 'antd/dist/reset.css';
import api from '../utils/api';
import { formatDate, formatTime } from '../utils/dateUtils';
import type { VehicleUsage, Vehicle } from '../types';
import ActionButton from '../components/ActionButton';

const { RangePicker } = DatePicker;

export default function VehicleRecords() {
    const [records, setRecords] = useState<VehicleUsage[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Filter states
    const [filters, setFilters] = useState({
        vehicle_plate: '',
        manager: '',
        destination: '',
        given_by: '',
        returned_by: '',
        status: 'all',
        givenDateStart: '',
        givenDateEnd: '',
        returnDateStart: '',
        returnDateEnd: ''
    });

    // Fetch all records and vehicles
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [recordsRes, vehiclesRes] = await Promise.all([
                    api.get('/vehicles/records?includeDeleted=true'),
                    api.get('/vehicles')
                ]);
                setRecords(recordsRes.data || []);
                setVehicles(vehiclesRes.data || []);
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
            // Vehicle plate filter - exact match
            if (filters.vehicle_plate && record.vehicle_plate !== filters.vehicle_plate) {
                return false;
            }

            // Manager filter
            if (filters.manager && !record.manager.toLowerCase().includes(filters.manager.toLowerCase())) {
                return false;
            }

            // Destination filter
            if (filters.destination && !record.destination.toLowerCase().includes(filters.destination.toLowerCase())) {
                return false;
            }

            // Given by filter
            if (filters.given_by && record.given_by && !record.given_by.toLowerCase().includes(filters.given_by.toLowerCase())) {
                return false;
            }

            // Returned by filter
            if (filters.returned_by && record.returned_by && !record.returned_by.toLowerCase().includes(filters.returned_by.toLowerCase())) {
                return false;
            }

            // Status filter
            if (filters.status !== 'all' && record.status !== filters.status) {
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
            filters.givenDateStart !== '' ||
            filters.givenDateEnd !== '' ||
            filters.returnDateStart !== '' ||
            filters.returnDateEnd !== '';
    }, [filters]);

    // Group records by month and day (oldest month/day first, newest last) - only when no filters active
    const groupedRecords = useMemo(() => {
        const monthGroups: { [key: string]: { [key: string]: VehicleUsage[] } } = {};

        filteredRecords.forEach(record => {
            const date = dayjs(record.given_date);
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

        // Sort months in descending order (newest first, oldest last)
        const sortedMonths = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a));

        return sortedMonths.map(monthKey => {
            // Sort days within month in descending order (newest first)
            const sortedDays = Object.keys(monthGroups[monthKey]).sort((a, b) => b.localeCompare(a));

            const dayGroups = sortedDays.map(dayKey => ({
                dayKey,
                dayLabel: dayjs(dayKey).format('DD MMMM YYYY dddd'),
                records: monthGroups[monthKey][dayKey].sort((a, b) =>
                    // Sort records by time in ascending order (earliest first)
                    a.given_time.localeCompare(b.given_time)
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

    // Sorted records for filtered view (without grouping)
    const sortedFilteredRecords = useMemo(() => {
        return [...filteredRecords].sort((a, b) => {
            // Sort by date first, then by time
            const dateCompare = a.given_date.localeCompare(b.given_date);
            if (dateCompare !== 0) return dateCompare;
            return a.given_time.localeCompare(b.given_time);
        });
    }, [filteredRecords]);

    // Clear all filters
    const clearFilters = () => {
        setFilters({
            vehicle_plate: '',
            manager: '',
            destination: '',
            given_by: '',
            returned_by: '',
            status: 'all',
            givenDateStart: '',
            givenDateEnd: '',
            returnDateStart: '',
            returnDateEnd: ''
        });
    };

    const handleDeleteRecord = async (id: string) => {
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

        try {
            await api.delete(`/vehicles/records/${id}`);
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: new Date().toISOString() } : record));
        } catch (error) {
            console.error('Kayıt silinemedi:', error);
            alert('Kayıt silinirken bir hata oluştu');
        }
    };

    const handleRestoreRecord = async (id: string) => {
        try {
            await api.post(`/vehicles/records/${id}/restore`);
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
                                onClick={() => navigate('/vehicles')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">Araç Kayıtları</h1>
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
                            {/* Vehicle Plate Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Araç Plakası
                                </label>
                                <select
                                    value={filters.vehicle_plate}
                                    onChange={(e) => setFilters({ ...filters, vehicle_plate: e.target.value })}
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="">Tüm Araçlar</option>
                                    {vehicles.map(vehicle => (
                                        <option key={vehicle.id} value={vehicle.plate}>
                                            {vehicle.plate}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Manager Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Müdür
                                </label>
                                <input
                                    type="text"
                                    value={filters.manager}
                                    onChange={(e) => setFilters({ ...filters, manager: e.target.value })}
                                    placeholder="Ara..."
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Destination Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Gidilen Yer
                                </label>
                                <input
                                    type="text"
                                    value={filters.destination}
                                    onChange={(e) => setFilters({ ...filters, destination: e.target.value })}
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
                                    <option value="in_use">Kullanımda</option>
                                    <option value="returned">Teslim Alındı</option>
                                </select>
                            </div>

                            {/* Given By Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Teslim Eden
                                </label>
                                <input
                                    type="text"
                                    value={filters.given_by}
                                    onChange={(e) => setFilters({ ...filters, given_by: e.target.value })}
                                    placeholder="Ara..."
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        {/* Second Row - Date Ranges */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Returned By Filter */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Teslim Alan
                                </label>
                                <input
                                    type="text"
                                    value={filters.returned_by}
                                    onChange={(e) => setFilters({ ...filters, returned_by: e.target.value })}
                                    placeholder="Ara..."
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Given Date Range */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Teslim Tarihi
                                </label>
                                <RangePicker
                                    value={[
                                        filters.givenDateStart ? dayjs(filters.givenDateStart) : null,
                                        filters.givenDateEnd ? dayjs(filters.givenDateEnd) : null
                                    ]}
                                    onChange={(dates) => {
                                        if (!dates || (!dates[0] && !dates[1])) {
                                            // Takvim temizlendi - filtreleri sıfırla
                                            setFilters({
                                                ...filters,
                                                givenDateStart: '',
                                                givenDateEnd: ''
                                            });
                                        } else if (dates[0] && dates[1]) {
                                            // İki tarih de seçildi
                                            setFilters({
                                                ...filters,
                                                givenDateStart: dates[0].format('YYYY-MM-DD'),
                                                givenDateEnd: dates[1].format('YYYY-MM-DD')
                                            });
                                        } else if (dates[0] && !dates[1]) {
                                            // Sadece başlangıç tarihi seçili - tek gün olarak kullan
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

                            {/* Return Date Range */}
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    İade Tarihi
                                </label>
                                <RangePicker
                                    value={[
                                        filters.returnDateStart ? dayjs(filters.returnDateStart) : null,
                                        filters.returnDateEnd ? dayjs(filters.returnDateEnd) : null
                                    ]}
                                    onChange={(dates) => {
                                        if (!dates || (!dates[0] && !dates[1])) {
                                            // Takvim temizlendi - filtreleri sıfırla
                                            setFilters({
                                                ...filters,
                                                returnDateStart: '',
                                                returnDateEnd: ''
                                            });
                                        } else if (dates[0] && dates[1]) {
                                            // İki tarih de seçildi
                                            setFilters({
                                                ...filters,
                                                returnDateStart: dates[0].format('YYYY-MM-DD'),
                                                returnDateEnd: dates[1].format('YYYY-MM-DD')
                                            });
                                        } else if (dates[0] && !dates[1]) {
                                            // Sadece başlangıç tarihi seçili - tek gün olarak kullan
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
                </div>

                {/* Records Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
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
                    ) : hasActiveFilters ? (
                        // Filtered view - simple table without grouping
                        <div className="overflow-x-auto">
                            <div className="max-h-[600px] overflow-y-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Araç</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Müdür</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gidilen Yer</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teslim Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İade Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teslim Eden</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teslim Alan</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sortedFilteredRecords.map((record) => (
                                            <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="p-2 bg-blue-100 rounded">
                                                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                                            </svg>
                                                        </div>
                                                        <div className="ml-3">
                                                            <div className="text-sm font-bold text-gray-900">{record.vehicle_plate}</div>
                                                            <div className="text-xs text-gray-500">{record.vehicle_brand}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-bold text-gray-900">{record.manager}</div>
                                                    <div className="text-xs text-gray-500">{record.manager_title}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-900">{record.destination}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{formatDate(record.given_date)}</div>
                                                    <div className="text-xs text-gray-500">{formatTime(record.given_time)}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {record.return_date ? (
                                                        <>
                                                            <div className="text-sm text-gray-900">{formatDate(record.return_date)}</div>
                                                            <div className="text-xs text-gray-500">{formatTime(record.return_time)}</div>
                                                        </>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.given_by || '-'}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.returned_by || '-'}</div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {record.status === 'in_use' ? (
                                                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                                                            Kullanımda
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                            Teslim Alındı
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm text-gray-500 max-w-xs truncate" title={record.notes || '-'}>
                                                        {record.notes || '-'}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        // Grouped view by month and day
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
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50 sticky top-14 z-10">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Araç</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Müdür</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gidilen Yer</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 z-8 bg-gray-50">Teslim Tarihi</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-24 z-8 bg-gray-50">İade Tarihi</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teslim Eden</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teslim Alan</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Açıklama</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {dayGroup.records.map((record) => (
                                                            <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center">
                                                                        <div className="p-2 bg-blue-100 rounded">
                                                                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                                                            </svg>
                                                                        </div>
                                                                        <div className="ml-3">
                                                                            <div className="text-sm font-bold text-gray-900">{record.vehicle_plate}</div>
                                                                            <div className="text-xs text-gray-500">{record.vehicle_brand}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm font-bold text-gray-900">{record.manager}</div>
                                                                    <div className="text-xs text-gray-500">{record.manager_title}</div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm text-gray-900">{record.destination}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap sticky left-0 z-8 bg-white">
                                                                    <div className="text-sm text-gray-900">{formatDate(record.given_date)}</div>
                                                                    <div className="text-xs text-gray-500">{formatTime(record.given_time)}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap sticky left-24 z-8 bg-white">
                                                                    {record.return_date ? (
                                                                        <>
                                                                            <div className="text-sm text-gray-900">{formatDate(record.return_date)}</div>
                                                                            <div className="text-xs text-gray-500">{formatTime(record.return_time)}</div>
                                                                        </>
                                                                    ) : (
                                                                        <span className="text-gray-400">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.given_by || '-'}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.returned_by || '-'}</div>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    {record.status === 'in_use' ? (
                                                                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                                                                            Kullanımda
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                                            Teslim Alındı
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="text-sm text-gray-500 max-w-xs truncate" title={record.notes || '-'}>
                                                                        {record.notes || '-'}
                                                                    </div>
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
                    )}
                </div>
            </main>
        </div>
    );
}
