import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import type { User, VehicleUsage } from '../types';
import { STORAGE_KEYS, ROLE_LABELS } from '../constants';

// Stat Card Component
interface StatCardProps {
    title: string;
    value: number;
    gradient: string;
    iconBgColor: string;
    icon: React.ReactNode;
}

function StatCard({ title, value, gradient, iconBgColor, icon }: StatCardProps) {
    return (
        <div className={`bg-gradient-to-br ${gradient} rounded-lg shadow-lg p-6`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium opacity-90">{title}</p>
                    <p className="text-3xl font-bold text-white mt-2">{value}</p>
                </div>
                <div className={`${iconBgColor} p-3 rounded-lg`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

// Navigation Card Component
interface NavCardProps {
    title: string;
    description: string;
    gradient: string;
    hoverGradient: string;
    icon: React.ReactNode;
    onClick: () => void;
}

function NavCard({ title, description, gradient, hoverGradient, icon, onClick }: NavCardProps) {
    return (
        <button
            onClick={onClick}
            className={`bg-gradient-to-br ${gradient} ${hoverGradient} p-6 rounded-lg shadow-lg transition-all transform hover:scale-105`}
        >
            <div className="text-white">
                {icon}
                <h3 className="text-xl font-bold mb-2">{title}</h3>
                <p className="opacity-90">{description}</p>
            </div>
        </button>
    );
}

// Icons
const VehicleIcon = ({ size = 12 }: { size?: number }) => (
    <svg className={`w-${size} h-${size} mb-4`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
    </svg>
);

const VisitorIcon = ({ size = 12 }: { size?: number }) => (
    <svg className={`w-${size} h-${size} mb-4`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const ManagerIcon = ({ size = 12 }: { size?: number }) => (
    <svg className={`w-${size} h-${size} mb-4`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
);

const IncidentIcon = ({ size = 12 }: { size?: number }) => (
    <svg className={`w-${size} h-${size} mb-4`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
);

const FireAlarmIcon = ({ size = 12 }: { size?: number }) => (
    <svg className={`w-${size} h-${size} mb-4`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
    </svg>
);

const SgkIcon = ({ size = 12 }: { size?: number }) => (
    <svg className={`w-${size} h-${size} mb-4`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

export default function Dashboard() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [usages, setUsages] = useState<VehicleUsage[]>([]);
    const [todayAlarms, setTodayAlarms] = useState(0);
    const [visitorsInside, setVisitorsInside] = useState(0);
    const [managersInside, setManagersInside] = useState(0);
    const navigate = useNavigate();

    // Fetch all data in parallel for better performance
    const fetchAllData = useCallback(async () => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const [userRes, vehiclesRes, visitorsRes, managersRes, fireAlarmsRes] = await Promise.all([
                api.get('/auth/me'),
                api.get('/vehicles/records'),
                api.get('/visitors/records'),
                api.get('/managers/records'),
                api.get('/fire-alarms/records'),
            ]);

            // User
            if (userRes.data?.data) {
                setUser(userRes.data.data);
            }

            // Vehicles
            setUsages(vehiclesRes.data || []);

            // Visitors inside
            const visitors = visitorsRes.data || [];
            setVisitorsInside(visitors.filter((v: { status: string }) => v.status === 'inside').length);

            // Managers inside
            const managers = managersRes.data || [];
            setManagersInside(managers.filter((m: { status: string }) => m.status === 'inside').length);

            // Today's fire alarms
            const fireAlarmsData = fireAlarmsRes.data?.data || fireAlarmsRes.data || [];
            const fireAlarmsList = Array.isArray(fireAlarmsData) ? fireAlarmsData : [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            setTodayAlarms(fireAlarmsList.filter((alarm: { alarm_time: string }) => {
                const alarmDate = new Date(alarm.alarm_time);
                alarmDate.setHours(0, 0, 0, 0);
                return alarmDate.getTime() === today.getTime();
            }).length);

        } catch (error) {
            console.error('Dashboard veri yükleme hatası:', error);
            navigate('/login');
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout', {});
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem(STORAGE_KEYS.TOKEN);
            localStorage.removeItem(STORAGE_KEYS.USER);
            navigate('/login');
        }
    };

    // Calculate stats
    const vehiclesInUse = usages.filter(u => u.status === 'in_use').length;

    // Get role badge color
    const getRoleBadgeClass = (role: string) => {
        const classes: Record<string, string> = {
            admin: 'bg-red-500/20 text-red-400',
            manager: 'bg-blue-500/20 text-blue-400',
            security: 'bg-green-500/20 text-green-400',
        };
        return classes[role] || classes.security;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                    <span className="text-gray-400">Yükleniyor...</span>
                </div>
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
                            {/* Shift Status */}
                            <div className="flex flex-col items-end text-right mr-2">
                                <div className="text-xs text-gray-300 mb-1">Vardiya</div>
                                <div className="inline-flex items-center gap-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-semibold shadow-sm">
                                    <span className="w-2 h-2 bg-white rounded-full opacity-90" />
                                    <span>Aktif</span>
                                </div>
                            </div>

                            {/* Role Badge */}
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeClass(user?.role || '')}`}>
                                {ROLE_LABELS[user?.role || ''] || 'GÜVENLİK'}
                            </span>

                            {/* Logout Button */}
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
                    <StatCard
                        title="Kullanımdaki Araçlar"
                        value={vehiclesInUse}
                        gradient="from-blue-600 to-blue-700"
                        iconBgColor="bg-blue-500/30"
                        icon={<VehicleIcon size={8} />}
                    />
                    <StatCard
                        title="İçerideki Ziyaretçiler"
                        value={visitorsInside}
                        gradient="from-green-600 to-green-700"
                        iconBgColor="bg-green-500/30"
                        icon={<VisitorIcon size={8} />}
                    />
                    <StatCard
                        title="İçerideki Müdürler"
                        value={managersInside}
                        gradient="from-purple-600 to-purple-700"
                        iconBgColor="bg-purple-500/30"
                        icon={<ManagerIcon size={8} />}
                    />
                    <StatCard
                        title="Bugün Çalınan Alarmlar"
                        value={todayAlarms}
                        gradient="from-red-600 to-red-700"
                        iconBgColor="bg-red-500/30"
                        icon={<FireAlarmIcon size={8} />}
                    />
                </div>

                {/* Navigation Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <NavCard
                        title="Araç Yönetimi"
                        description="Araç kayıtlarını görüntüle ve yönet"
                        gradient="from-blue-600 to-blue-700"
                        hoverGradient="hover:from-blue-700 hover:to-blue-800"
                        icon={<VehicleIcon />}
                        onClick={() => navigate('/vehicles')}
                    />
                    <NavCard
                        title="Ziyaretçi Yönetimi"
                        description="Ziyaretçi kayıtlarını görüntüle ve yönet"
                        gradient="from-green-600 to-green-700"
                        hoverGradient="hover:from-green-700 hover:to-green-800"
                        icon={<VisitorIcon />}
                        onClick={() => navigate('/visitors')}
                    />
                    <NavCard
                        title="SGK Kayıtları"
                        description="SGK kayıtlarını görüntüle ve yönet"
                        gradient="from-cyan-600 to-cyan-700"
                        hoverGradient="hover:from-cyan-700 hover:to-cyan-800"
                        icon={<SgkIcon />}
                        onClick={() => navigate('/sgk')}
                    />
                    <NavCard
                        title="Müdür Yönetimi"
                        description="Müdürleri görüntüle ve yönet"
                        gradient="from-indigo-600 to-indigo-700"
                        hoverGradient="hover:from-indigo-700 hover:to-indigo-800"
                        icon={<ManagerIcon />}
                        onClick={() => navigate('/managers')}
                    />
                    <NavCard
                        title="Olay Kayıtları"
                        description="Olayları görüntüle ve yönet"
                        gradient="from-yellow-600 to-yellow-700"
                        hoverGradient="hover:from-yellow-700 hover:to-yellow-800"
                        icon={<IncidentIcon />}
                        onClick={() => navigate('/incidents')}
                    />
                    <NavCard
                        title="Yangın Alarmları"
                        description="Yangın alarm kayıtlarını görüntüle ve yönet"
                        gradient="from-red-600 to-red-700"
                        hoverGradient="hover:from-red-700 hover:to-red-800"
                        icon={<FireAlarmIcon />}
                        onClick={() => navigate('/fire-alarms')}
                    />
                </div>
            </div>
        </div>
    );
}
