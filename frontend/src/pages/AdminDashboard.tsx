import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../constants';

interface VehicleUsage {
    id: number;
    status: string;
}

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
        <div className={`bg-gradient-to-br ${gradient} rounded-lg shadow p-3`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium opacity-90 text-white">{title}</p>
                    <p className="text-xl font-bold text-white mt-1">{value}</p>
                </div>
                <div className={`${iconBgColor} p-2 rounded-lg`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

// Icons
const VehicleIcon = ({ size = 12 }: { size?: number }) => (
    <svg className={`w-${size} h-${size}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
    </svg>
);

const VisitorIcon = ({ size = 12 }: { size?: number }) => (
    <svg className={`w-${size} h-${size}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
);

const ManagerIcon = ({ size = 12 }: { size?: number }) => (
    <svg className={`w-${size} h-${size}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
);

const FireAlarmIcon = ({ size = 12 }: { size?: number }) => (
    <svg className={`w-${size} h-${size}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
    </svg>
);

export default function AdminDashboard() {
    const [loading, setLoading] = useState(true);
    const [usages, setUsages] = useState<VehicleUsage[]>([]);
    const [todayAlarms, setTodayAlarms] = useState(0);
    const [visitorsInside, setVisitorsInside] = useState(0);
    const [managersInside, setManagersInside] = useState(0);
    const navigate = useNavigate();

    // Fetch all data in parallel for better performance
    const fetchAllData = useCallback(async () => {
        const adminToken = localStorage.getItem('adminToken');
        if (!adminToken) {
            navigate('/login');
            return;
        }

        try {
            const headers = {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            };

            const [vehiclesRes, visitorsRes, managersRes, fireAlarmsRes] = await Promise.all([
                axios.get(`${API_URL}/vehicles/records`, { headers }),
                axios.get(`${API_URL}/visitors/records`, { headers }),
                axios.get(`${API_URL}/managers/records`, { headers }),
                axios.get(`${API_URL}/fire-alarms/records`, { headers }),
            ]);

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
            console.error('Admin dashboard data loading error:', error);
            navigate('/login');
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Calculate stats
    const vehiclesInUse = usages.filter(u => u.status === 'in_use').length;

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
            <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
                {/* Header */}
                <div className="bg-gray-800 rounded-lg shadow p-4 mb-4">
                    <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>
                </div>
            </div>
        </div>
    );
}
