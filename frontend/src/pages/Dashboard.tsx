import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

interface VehicleUsage {
    id: string;
    vehicle_id: string;
    vehicle_brand: string;
    vehicle_plate: string;
    manager_name: string;
    destination: string;
    personnel_full_name: string;
    given_date: string;
    given_time: string;
    return_date: string | null;
    return_time: string | null;
    status: 'in_use' | 'returned';
    notes: string | null;
}

export default function Dashboard() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [usages, setUsages] = useState<VehicleUsage[]>([]);
    const [openEvents, setOpenEvents] = useState<number>(0);
    const [stats] = useState({
        shiftStatus: 'Aktif'
    });
    const [visitorsInside, setVisitorsInside] = useState<number>(0);
    const [managersInside, setManagersInside] = useState<number>(0);
    const navigate = useNavigate();

    useEffect(() => {
        fetchUser();
        fetchUsages();
        fetchVisitors();
        fetchManagersRecords();
        fetchIncidents();
    }, []);

    const fetchIncidents = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/incidents/records`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const records = response.data || [];
            const open = records.filter((r: any) => r.status === 'open').length;
            setOpenEvents(open);
        } catch (error) {
            console.error('Olay verileri yüklenemedi:', error);
        }
    };

    const fetchManagersRecords = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/managers/records`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const records = response.data || [];
            const inside = records.filter((r: any) => r.status === 'inside').length;
            setManagersInside(inside);
        } catch (error) {
            console.error('Müdür kayıtları yüklenemedi:', error);
        }
    };

    const fetchUser = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUser(response.data.data);
        } catch (error) {
            navigate('/login');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsages = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/vehicles/records`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsages(response.data || []);
        } catch (error) {
            console.error('Kullanım verileri yüklenemedi:', error);
        }
    };

    const fetchVisitors = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_URL}/visitors/records`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const visitors = response.data || [];
            const inside = visitors.filter((v: any) => v.status === 'inside').length;
            setVisitorsInside(inside);
        } catch (error) {
            console.error('Ziyaretçi verileri yüklenemedi:', error);
        }
    };

    const handleLogout = async () => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/auth/logout`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            navigate('/login');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white">Yükleniyor...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-white">Hoş Geldiniz</h1>
                            <p className="text-gray-400 mt-1">{user?.fullName}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Vardiya pill styled to match dashboard design */}
                            <div className="flex flex-col items-end text-right mr-2">
                                <div className="text-xs text-gray-300 mb-1">Vardiya</div>
                                <div className="inline-flex items-center gap-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-sm">
                                    <svg className="w-2 h-2 text-white opacity-90" viewBox="0 0 8 8" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="4" cy="4" r="4" />
                                    </svg>
                                    <span>Aktif</span>
                                </div>
                            </div>

                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${user?.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                                user?.role === 'manager' ? 'bg-blue-500/20 text-blue-400' :
                                    'bg-green-500/20 text-green-400'
                                }`}>
                                {user?.role === 'admin' ? 'YÖNETİCİ' :
                                    user?.role === 'manager' ? 'MÜDÜR' : 'GÜVENLİK'}
                            </span>

                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                            >
                                Çıkış Yap
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                    {/* Kullanımdaki Araçlar */}
                    <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-blue-100 text-sm font-medium">Kullanımdaki Araçlar</p>
                                <p className="text-3xl font-bold text-white mt-2">
                                    {usages.filter(u => u.status === 'in_use').length}
                                </p>
                            </div>
                            <div className="bg-blue-500/30 p-3 rounded-lg">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* İçerideki Ziyaretçiler */}
                    <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-green-100 text-sm font-medium">İçerideki Ziyaretçiler</p>
                                <p className="text-3xl font-bold text-white mt-2">{visitorsInside}</p>
                            </div>
                            <div className="bg-green-500/30 p-3 rounded-lg">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Açık Olaylar */}
                    <div className="bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-yellow-100 text-sm font-medium">Açık Olaylar</p>
                                <p className="text-3xl font-bold text-white mt-2">{openEvents}</p>
                            </div>
                            <div className="bg-yellow-500/30 p-3 rounded-lg">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Vardiya Durumu */}
                    <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-lg shadow-lg p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-purple-100 text-sm font-medium">İçerideki Müdürler</p>
                                <p className="text-3xl font-bold text-white mt-2">{managersInside}</p>
                            </div>
                            <div className="bg-purple-500/30 p-3 rounded-lg">
                                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <button
                        onClick={() => navigate('/vehicles')}
                        className="bg-gradient-to-br from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 p-6 rounded-lg shadow-lg transition-all transform hover:scale-105"
                    >
                        <div className="text-white">
                            <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                            <h3 className="text-xl font-bold mb-2">Araç Yönetimi</h3>
                            <p className="text-blue-100">Araç kayıtlarını görüntüle ve yönet</p>
                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/visitors')}
                        className="bg-gradient-to-br from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 p-6 rounded-lg shadow-lg transition-all transform hover:scale-105"
                    >
                        <div className="text-white">
                            <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <h3 className="text-xl font-bold mb-2">Ziyaretçi Yönetimi</h3>
                            <p className="text-green-100">Ziyaretçi kayıtlarını görüntüle ve yönet</p>

                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/managers')}
                        className="bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 p-6 rounded-lg shadow-lg transition-all transform hover:scale-105"
                    >
                        <div className="text-white">
                            <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <h3 className="text-xl font-bold mb-2">Müdür Yönetimi</h3>
                            <p className="text-indigo-100">Müdürleri görüntüle ve yönet</p>

                        </div>
                    </button>

                    <button
                        onClick={() => navigate('/incidents')}
                        className="bg-gradient-to-br from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 p-6 rounded-lg shadow-lg transition-all transform hover:scale-105"
                    >
                        <div className="text-white">
                            <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <h3 className="text-xl font-bold mb-2">Olay Kayıtları</h3>
                            <p className="text-yellow-100">Olayları görüntüle ve yönet</p>

                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
