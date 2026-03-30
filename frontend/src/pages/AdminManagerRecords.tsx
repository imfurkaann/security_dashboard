import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from 'antd';
import dayjs from '../utils/dayjsConfig';
import type { Dayjs } from 'dayjs';
import 'antd/dist/reset.css';
import axios from 'axios';
import { formatDate, formatTime } from '../utils/dateUtils';
import type { ManagerRecord } from '../types';
import { API_URL } from '../constants';
import ActionButton from '../components/ActionButton';

const { RangePicker } = DatePicker;

export default function AdminManagerRecords() {
    const [records, setRecords] = useState<ManagerRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Filter states
    const [filters, setFilters] = useState({
        manager_name: '',
        entry_by: '',
        exit_by: '',
        status: 'all',
        entryDateStart: '',
        entryDateEnd: '',
        exitDateStart: '',
        exitDateEnd: ''
    });

    // Fetch all records with admin authentication
    useEffect(() => {
        const fetchData = async () => {
            try {
                const adminToken = localStorage.getItem('adminToken');
                const config = {
                    headers: {
                        Authorization: `Bearer ${adminToken}`
                    }
                };
                const res = await axios.get(`${API_URL}/managers/records?includeDeleted=true`, config);
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
            // Manager name filter
            if (filters.manager_name && (!record.manager || !record.manager.toLowerCase().includes(filters.manager_name.toLowerCase()))) {
                return false;
            }

            // Entry by filter
            if (filters.entry_by && (!record.entry_by || !record.entry_by.toLowerCase().includes(filters.entry_by.toLowerCase()))) {
                return false;
            }

            // Exit by filter
            if (filters.exit_by && (!record.exit_by || !record.exit_by.toLowerCase().includes(filters.exit_by.toLowerCase()))) {
                return false;
            }

            // Status filter
            if (filters.status !== 'all' && record.status !== filters.status) {
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
        return filters.manager_name !== '' ||
            filters.entry_by !== '' ||
            filters.exit_by !== '' ||
            filters.status !== 'all' ||
            filters.entryDateStart !== '' ||
            filters.entryDateEnd !== '' ||
            filters.exitDateStart !== '' ||
            filters.exitDateEnd !== '';
    }, [filters]);

    // Grouped records by month and day (when no filters active)
    const groupedRecords = useMemo(() => {
        if (hasActiveFilters) return [];

        // Group by YYYY-MM (month), then by YYYY-MM-DD (day)
        const monthGroups: Record<string, Record<string, ManagerRecord[]>> = {};

        filteredRecords.forEach(record => {
            if (!record.entry_date) return;

            const monthKey = record.entry_date.substring(0, 7); // YYYY-MM
            const dayKey = record.entry_date; // YYYY-MM-DD

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
    }, [filteredRecords, hasActiveFilters]);

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
            manager_name: '',
            entry_by: '',
            exit_by: '',
            status: 'all',
            entryDateStart: '',
            entryDateEnd: '',
            exitDateStart: '',
            exitDateEnd: ''
        });
    };

    const handleDeleteRecord = async (id: string) => {
        if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;

        try {
            const adminToken = localStorage.getItem('adminToken');
            await axios.delete(`${API_URL}/managers/records/${id}`, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: new Date().toISOString() } : record));
        } catch (error) {
            console.error('Kayıt silinemedi:', error);
            alert('Kayıt silinirken bir hata oluştu');
        }
    };

    const handleRestoreRecord = async (id: string) => {
        try {
            const adminToken = localStorage.getItem('adminToken');
            await axios.post(`${API_URL}/managers/records/${id}/restore`, {}, {
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            setRecords(prev => prev.map(record => record.id === id ? { ...record, deleted_at: null } : record));
        } catch (error) {
            console.error('Kayıt geri alınamadı:', error);
            alert('Kayıt geri alınırken bir hata oluştu');
        }
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

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/admin/dashboard')}
                                className="p-2 hover:bg-gray-100 rounded-lg transition"
                                title="Geri Dön"
                            >
                                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Müdür Kayıtlarını Filtrele</h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    Toplam {records.length} kayıt, {filteredRecords.length} sonuç gösteriliyor
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/admin/manage-managers')}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Müdürleri Yönet
                        </button>
                    </div>
                </div>
            </header>


            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filter Panel */}
                <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-gray-900">Filtreler</h2>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                Filtreleri Temizle
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Manager Name */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Müdür Adı
                            </label>
                            <input
                                type="text"
                                value={filters.manager_name}
                                onChange={(e) => setFilters({ ...filters, manager_name: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        {/* Entry By */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Giriş Yapan
                            </label>
                            <input
                                type="text"
                                value={filters.entry_by}
                                onChange={(e) => setFilters({ ...filters, entry_by: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        {/* Exit By */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Çıkış Yapan
                            </label>
                            <input
                                type="text"
                                value={filters.exit_by}
                                onChange={(e) => setFilters({ ...filters, exit_by: e.target.value })}
                                placeholder="Ara..."
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Durum
                            </label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="all">Tümü</option>
                                <option value="inside">İçeride</option>
                                <option value="exited">Çıkış Yapıldı</option>
                            </select>
                        </div>

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
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İsim Soyisim</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Tarihi</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Yapan</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Yapan</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sortedFilteredRecords.map((record) => (
                                            <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-indigo-100 rounded">
                                                            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-bold text-gray-900">{record.manager || '-'}</span>
                                                            {record.manager_title && (
                                                                <div className="text-xs text-gray-500">{record.manager_title}</div>
                                                            )}
                                                        </div>
                                                    </div>
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
                                                    <div className="text-sm text-gray-900">{record.entry_by || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-900">{record.exit_by || '-'}</div>
                                                </td>

                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'inside' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                                        {record.status === 'inside' ? 'İçeride' : 'Çıkış Yapıldı'}
                                                    </span>
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
                                        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-3 z-10 shadow-md">
                                            <h2 className="text-lg font-bold">{monthGroup.monthLabel}</h2>
                                            <p className="text-sm text-indigo-100">{monthGroup.totalRecords} kayıt</p>
                                        </div>

                                        {/* Day Groups */}
                                        {monthGroup.dayGroups.map((dayGroup) => (
                                            <div key={dayGroup.dayKey} className="border-b border-gray-200 last:border-b-0">
                                                {/* Day Header */}
                                                <div className="sticky top-14 bg-gray-100 px-6 py-2 border-l-4 border-blue-500 z-9 shadow-sm">

                                                    <h3 className="text-sm font-semibold text-gray-700">{dayGroup.dayLabel}</h3>
                                                    <p className="text-xs text-gray-500">{dayGroup.records.length} kayıt</p>
                                                </div>

                                                {/* Records Table */}
                                                <table className="min-w-full table-auto divide-y divide-gray-200">
                                                    <thead className="bg-gray-50 sticky top-14 z-10">
                                                        <tr>

                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İsim Soyisim</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 z-8 bg-gray-50">Giriş Tarihi</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-24 z-8 bg-gray-50">Çıkış Tarihi</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Giriş Yapan</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Çıkış Yapan</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {dayGroup.records.map((record) => (
                                                            <tr key={record.id} className={`hover:bg-gray-50 ${record.deleted_at ? 'opacity-60' : ''}`}>
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 bg-indigo-100 rounded">
                                                                            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                            </svg>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-sm font-bold text-gray-900">{record.manager || '-'}</span>
                                                                            {record.manager_title && (
                                                                                <div className="text-xs text-gray-500">{record.manager_title}</div>
                                                                            )}
                                                                        </div>
                                                                    </div>
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
                                                                    <div className="text-sm text-gray-900">{record.entry_by || '-'}</div>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <div className="text-sm text-gray-900">{record.exit_by || '-'}</div>
                                                                </td>

                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'inside' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                                                                        {record.status === 'inside' ? 'İçeride' : 'Çıkış Yapıldı'}
                                                                    </span>
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
