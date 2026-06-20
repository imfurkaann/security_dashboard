import { useState, useEffect } from 'react';
import {
    BarChart, Bar, PieChart, Pie, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell
} from 'recharts';
import api from '../../utils/api';
import WordCloud from '../WordCloud';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

interface IncidentsTabProps {
    startDate: string;
    endDate: string;
    getDaysLabel: () => string;
    formatDate: (dateStr: string) => string;
    CustomTooltip: any;
    refetchKey: number;
}

export default function IncidentsTab({
    startDate,
    endDate,
    getDaysLabel,
    CustomTooltip,
    refetchKey
}: IncidentsTabProps) {
    const [loading, setLoading] = useState(true);
    const [isMobileViewport, setIsMobileViewport] = useState(false);
    const [incidentStats, setIncidentStats] = useState<any>({
        monthlyTrend: [],
        typeDistribution: [],
        severityDistribution: [],
        categoryStats: {}
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const updateViewport = () => setIsMobileViewport(window.innerWidth < 768);
        updateViewport();
        window.addEventListener('resize', updateViewport);
        return () => window.removeEventListener('resize', updateViewport);
    }, []);

    useEffect(() => {
        let isMounted = true;
        const fetchIncidentsData = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/statistics/incidents?startDate=${startDate}&endDate=${endDate}`);
                if (isMounted) {
                    setIncidentStats(res.data.data);
                }
            } catch (error) {
                console.error('Olay istatistik yükleme hatası:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchIncidentsData();
        return () => {
            isMounted = false;
        };
    }, [startDate, endDate, refetchKey]);

    const getWordCloudWidth = () => {
        if (typeof window === 'undefined') return 320;
        return Math.max(window.innerWidth - (isMobileViewport ? 40 : 120), 280);
    };

    if (loading && !incidentStats.categoryStats) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Dönem Bilgisi Başlık */}
            <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm font-medium text-slate-600">📅 {getDaysLabel()} verilerini görüntülüyorsunuz</p>
            </div>

            {/* Kategori İstatistikleri - Ana Kartlar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-100 rounded-lg">
                            <span className="text-2xl">🚨</span>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Hırsızlık</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {parseInt(incidentStats?.categoryStats?.theft_total) || 0}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-100 rounded-lg">
                            <span className="text-2xl">👊</span>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Saldırı/Kavga</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {parseInt(incidentStats?.categoryStats?.assault_total) || 0}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-yellow-100 rounded-lg">
                            <span className="text-2xl">⚕️</span>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Tıbbi Acil</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {parseInt(incidentStats?.categoryStats?.medical_total) || 0}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-100 rounded-lg">
                            <span className="text-2xl">🔨</span>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Vandalizm</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {parseInt(incidentStats?.categoryStats?.vandalism_total) || 0}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <span className="text-2xl">🚑</span>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Kaza</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {parseInt(incidentStats?.categoryStats?.accident_total) || 0}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-pink-100 rounded-lg">
                            <span className="text-2xl">💊</span>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600">Madde Kullanımı</p>
                            <p className="text-2xl font-bold text-gray-900">
                                {parseInt(incidentStats?.categoryStats?.substance_total) || 0}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Ana Kategori Dağılımı - Pasta Grafiği */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-category-distribution">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">📊 Kategori Bazlı Olay Dağılımı ({getDaysLabel()})</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <PieChart>
                        <Pie
                            data={[
                                { name: 'Hırsızlık', value: parseInt(incidentStats?.categoryStats?.theft_total) || 0 },
                                { name: 'Saldırı/Kavga', value: parseInt(incidentStats?.categoryStats?.assault_total) || 0 },
                                { name: 'Tıbbi Acil', value: parseInt(incidentStats?.categoryStats?.medical_total) || 0 },
                                { name: 'Vandalizm', value: parseInt(incidentStats?.categoryStats?.vandalism_total) || 0 },
                                { name: 'Kaza/Yaralanma', value: parseInt(incidentStats?.categoryStats?.accident_total) || 0 },
                                { name: 'Madde Kullanımı', value: parseInt(incidentStats?.categoryStats?.substance_total) || 0 }
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => (percent && percent > 0) ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                            outerRadius={120}
                            dataKey="value"
                        >
                            <Cell fill="#EF4444" />
                            <Cell fill="#F59E0B" />
                            <Cell fill="#3B82F6" />
                            <Cell fill="#8B5CF6" />
                            <Cell fill="#10B981" />
                            <Cell fill="#EC4899" />
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hırsızlık Detayı */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-theft">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">🚨 Hırsızlık Kategorileri ({getDaysLabel()})</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[
                            { name: 'Misafir Eşyası', count: parseInt(incidentStats?.categoryStats?.theft_guest_property) || 0 },
                            { name: 'Otel Mülkiyeti', count: parseInt(incidentStats?.categoryStats?.theft_hotel_property) || 0 },
                            { name: 'Personel Hırsızlığı', count: parseInt(incidentStats?.categoryStats?.theft_personnel) || 0 }
                        ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="count" name="Olay Sayısı" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Saldırı/Kavga Detayı */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-assault">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">👊 Saldırı & Kavga Kategorileri ({getDaysLabel()})</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[
                            { name: 'Fiziksel Saldırı', count: parseInt(incidentStats?.categoryStats?.assault_physical) || 0 },
                            { name: 'Sözlü Taciz', count: parseInt(incidentStats?.categoryStats?.assault_verbal) || 0 },
                            { name: 'Toplu Kavga', count: parseInt(incidentStats?.categoryStats?.assault_mass_fight) || 0 }
                        ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="count" name="Olay Sayısı" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Tıbbi Acil Detayı */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-medical">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">⚕️ Tıbbi Acil Kategorileri ({getDaysLabel()})</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={[
                                    { name: 'Ciddi Tıbbi Durum', value: parseInt(incidentStats?.categoryStats?.medical_serious) || 0 },
                                    { name: 'İlk Yardım', value: parseInt(incidentStats?.categoryStats?.medical_first_aid) || 0 },
                                    { name: 'Ambulans Çağrısı', value: parseInt(incidentStats?.categoryStats?.medical_ambulance) || 0 }
                                ]}
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                dataKey="value"
                                labelLine={false}
                                label={({ name, percent }) => (percent && percent > 0) ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                            >
                                <Cell fill="#3B82F6" />
                                <Cell fill="#10B981" />
                                <Cell fill="#F59E0B" />
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Vandalizm Kategorileri */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-vandalism">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">🔨 Vandalizm & Hasar Kategorileri ({getDaysLabel()})</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[
                            { name: 'Oda Hasarı', count: parseInt(incidentStats?.categoryStats?.vandalism_room) || 0 },
                            { name: 'Ortak Alan Hasarı', count: parseInt(incidentStats?.categoryStats?.vandalism_common_area) || 0 }
                        ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="count" name="Olay Sayısı" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Madde Kullanımı Kategorileri */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-substance">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">💊 Madde Kullanımı Kategorileri ({getDaysLabel()})</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={[
                                    { name: 'Personel (Görevde)', value: parseInt(incidentStats?.categoryStats?.substance_personnel) || 0 },
                                    { name: 'Mülkte Bulunma', value: parseInt(incidentStats?.categoryStats?.substance_property) || 0 }
                                ]}
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                dataKey="value"
                                labelLine={false}
                                label={({ name, percent }) => (percent && percent > 0) ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                            >
                                <Cell fill="#EC4899" />
                                <Cell fill="#F472B6" />
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Kaza/Yaralanma Detayı */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-chart-id="incident-accident">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">🚑 Kaza & Yaralanma Kategorileri ({getDaysLabel()})</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[
                            { name: 'Kayma/Düşme', count: parseInt(incidentStats?.categoryStats?.accident_slip_fall) || 0 },
                            { name: 'Ekipman Kazası', count: parseInt(incidentStats?.categoryStats?.accident_equipment) || 0 },
                            { name: 'İş Kazası', count: parseInt(incidentStats?.categoryStats?.accident_work) || 0 }
                        ]}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="count" name="Olay Sayısı" fill="#10B981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Diğer Kategoriler */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Diğer Kategoriler ({getDaysLabel()})</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-pink-100 rounded-xl border border-pink-200">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">💊</span>
                                <span className="text-sm font-medium text-gray-700">Madde (Personel)</span>
                            </div>
                            <span className="text-lg font-bold text-pink-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.substance_personnel) || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-pink-100 rounded-xl border border-pink-200">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">💊</span>
                                <span className="text-sm font-medium text-gray-700">Madde (Mülk)</span>
                            </div>
                            <span className="text-lg font-bold text-pink-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.substance_property) || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🔨</span>
                                <span className="text-sm font-medium text-gray-700">Vandalizm (Oda)</span>
                            </div>
                            <span className="text-lg font-bold text-purple-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.vandalism_room) || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🔨</span>
                                <span className="text-sm font-medium text-gray-700">Vandalizm (Alan)</span>
                            </div>
                            <span className="text-lg font-bold text-purple-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.vandalism_common_area) || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🚪</span>
                                <span className="text-sm font-medium text-gray-700">İzinsiz Giriş (Oda)</span>
                            </div>
                            <span className="text-lg font-bold text-amber-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.unauthorized_room) || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🚪</span>
                                <span className="text-sm font-medium text-gray-700">İzinsiz (Kısıtlı)</span>
                            </div>
                            <span className="text-lg font-bold text-amber-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.unauthorized_restricted_area) || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">📹</span>
                                <span className="text-sm font-medium text-gray-700">CCTV Arızası</span>
                            </div>
                            <span className="text-lg font-bold text-blue-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.security_cctv_malfunction) || 0}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">📝</span>
                                <span className="text-sm font-medium text-gray-700">Diğer</span>
                            </div>
                            <span className="text-lg font-bold text-gray-600 bg-white px-2 py-1 rounded-lg shadow-sm">{parseInt(incidentStats?.categoryStats?.other) || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
