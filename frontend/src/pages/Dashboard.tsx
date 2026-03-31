import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import type { VehicleUsage, VisitorRecord } from '../types';
import { STORAGE_KEYS } from '../constants';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts';
import { AlertCircle, CheckCircle, Lock, LogOut, Shield } from 'lucide-react';

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
                    <p className="text-xs font-medium opacity-90">{title}</p>
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

export default function Dashboard() {
    const [loading, setLoading] = useState(true);
    const [usages, setUsages] = useState<VehicleUsage[]>([]);
    const [visitorRecords, setVisitorRecords] = useState<VisitorRecord[]>([]);
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
            const [vehiclesRes, visitorsRes, managersRes, fireAlarmsRes] = await Promise.all([
                api.get('/vehicles/records'),
                api.get('/visitors/records'),
                api.get('/managers/records'),
                api.get('/fire-alarms/records'),
            ]);

            // Vehicles
            setUsages(vehiclesRes.data || []);

            // Visitors inside
            const visitors = visitorsRes.data || [];
            setVisitorRecords(visitors);
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

    // Calculate stats
    const vehiclesInUse = usages.filter(u => u.status === 'in_use').length;

    const getVisitorTotalCount = (personCount: number | null | undefined) => {
        if (typeof personCount === 'number' && personCount > 0) {
            // person_count yaninda gelen kisi sayisi oldugu icin ana ziyaretciyi de ekliyoruz.
            return personCount + 1;
        }
        return 1;
    };

    const topVehicleUsers = useMemo(() => {
        const counts: Record<string, number> = {};

        usages.forEach((usage) => {
            if (!usage.manager) return;
            counts[usage.manager] = (counts[usage.manager] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
    }, [usages]);

    const topUsedVehicles = useMemo(() => {
        const counts: Record<string, number> = {};

        usages.forEach((usage) => {
            if (!usage.vehicle_plate) return;
            counts[usage.vehicle_plate] = (counts[usage.vehicle_plate] || 0) + 1;
        });

        return Object.entries(counts)
            .map(([plate, count]) => ({ plate, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
    }, [usages]);

    const mostVisitedPeople = useMemo(() => {
        const counts: Record<string, number> = {};

        visitorRecords.forEach((record) => {
            const target = record.visiting_person?.trim();
            if (!target) return;
            const visitorCount = getVisitorTotalCount(record.person_count);
            counts[target] = (counts[target] || 0) + visitorCount;
        });

        return Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
    }, [visitorRecords]);

    const twoWeekVisitorComparison = useMemo(() => {
        const labels = ['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz'];
        const data = labels.map((label) => ({
            day: label,
            thisWeek: 0,
            lastWeek: 0,
            diff: 0
        }));

        const startOfWeek = (dateInput: Date) => {
            const date = new Date(dateInput);
            date.setHours(0, 0, 0, 0);
            const day = (date.getDay() + 6) % 7;
            date.setDate(date.getDate() - day);
            return date;
        };

        const now = new Date();
        const thisWeekStart = startOfWeek(now);
        const nextWeekStart = new Date(thisWeekStart);
        nextWeekStart.setDate(thisWeekStart.getDate() + 7);

        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(thisWeekStart.getDate() - 7);

        visitorRecords.forEach((record) => {
            if (!record.entry_date) return;
            const entryDate = new Date(record.entry_date);
            entryDate.setHours(0, 0, 0, 0);

            const count = getVisitorTotalCount(record.person_count);
            const dayIndex = (entryDate.getDay() + 6) % 7;

            if (entryDate >= thisWeekStart && entryDate < nextWeekStart) {
                data[dayIndex].thisWeek += count;
            } else if (entryDate >= lastWeekStart && entryDate < thisWeekStart) {
                data[dayIndex].lastWeek += count;
            }
        });

        data.forEach((item) => {
            item.diff = item.thisWeek - item.lastWeek;
        });

        return data;
    }, [visitorRecords]);

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
                    <h1 className="text-lg font-bold text-white">Dashboard</h1>
                </div>

                {/* Stats Cards - Araç ve Ziyaretçi Bilgileri */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
                    <StatCard
                        title="Kullanımdaki Araçlar"
                        value={vehiclesInUse}
                        gradient="from-blue-600 to-blue-700"
                        iconBgColor="bg-blue-500/30"
                        icon={<VehicleIcon size={6} />}
                    />
                    <StatCard
                        title="İçerideki Ziyaretçiler"
                        value={visitorsInside}
                        gradient="from-green-600 to-green-700"
                        iconBgColor="bg-green-500/30"
                        icon={<VisitorIcon size={6} />}
                    />
                    <StatCard
                        title="İçerideki Müdürler"
                        value={managersInside}
                        gradient="from-purple-600 to-purple-700"
                        iconBgColor="bg-purple-500/30"
                        icon={<ManagerIcon size={6} />}
                    />
                    <StatCard
                        title="Bugün Çalınan Alarmlar"
                        value={todayAlarms}
                        gradient="from-red-600 to-red-700"
                        iconBgColor="bg-red-500/30"
                        icon={<FireAlarmIcon size={6} />}
                    />
                </div>

                {/* Önemli Uyarılar */}
                <div className="bg-amber-50 rounded-lg shadow-lg p-6 mb-6 border-l-4 border-amber-500">
                    <div className="flex items-start gap-4">
                        <AlertCircle className="text-amber-600 flex-shrink-0 mt-1" size={24} />
                        <div className="flex-1">
                            <h2 className="text-amber-900 font-bold text-lg mb-4">ÖNEMLİ UYARILAR</h2>
                            <div className="space-y-3 text-sm text-amber-900">
                                <div className="flex gap-3">
                                    <span className="text-amber-600 font-bold flex-shrink-0">•</span>
                                    <p>Sistemi ilk defa kullanacaksanız bilen çalışma arkadaşlarınızdan lütfen bilgilendirmeler alınız.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-amber-600 font-bold flex-shrink-0">•</span>
                                    <p>Sisteme giriş yaptığınız andan itibaren yapılan tüm işlemler giriş yapan kişi adına kaydedilmektedir. O yüzden giriş bilgilerinizi güvenli şekilde saklamanız önemlidir.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-amber-600 font-bold flex-shrink-0">•</span>
                                    <p>Uygulama içerisinde gerçekleştirilen her türlü işlem kayıt altına alınmaktadır. Giriş çıkış bilgileri, hatalı şifre giriş denemeleri, alınan kayıt bilgileri, sistemde yapılan her bir tıklama, sisteme girilmeye çalışılan cihaz bilgileri vb. tarih ve saat bilgisiyle kaydedilmektedir. Yönetici ilgili durumlarda bu verilere erişebilmektedir.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-amber-600 font-bold flex-shrink-0">•</span>
                                    <p>Yapılan her türlü veri girişi, güncelleme ve rapor alma işlemleri sistem günlüğüne işlenmektedir.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-amber-600 font-bold flex-shrink-0">•</span>
                                    <p>Kullanım sırasında karşılaşılan her türlü teknik hata veya aksaklık vakit kaybetmeden yöneticiye bildirilmelidir.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-amber-600 font-bold flex-shrink-0">•</span>
                                    <p>Sistemin daha verimli çalışması ve geliştirilmesi adına kullanıcı önerilerinin yöneticiye iletilmesi beklenmektedir.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-amber-600 font-bold flex-shrink-0">•</span>
                                    <p>Veri girişlerinin doğru ve eksiksiz yapılması zorunludur; hatalı girilen işlemler veri güvenliği için sistemden tamamen silinmemektedir. Yanlış veri girişi, sistemin ürettiği istatistiklerin bozulmasına ve hatalı sonuçlar alınmasına neden olmaktadır.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-amber-600 font-bold flex-shrink-0">•</span>
                                    <p>Uygulamadan ayrılmadan önce oturumun güvenli bir şekilde sonlandırılması için mutlaka "Çıkış Yap" butonu kullanılmalıdır.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-amber-600 font-bold flex-shrink-0">•</span>
                                    <p>Şifrenin unutulması durumunda veya sisteme ilk girişte tanımlanan geçici şifrenin kişisel bir şifreyle değiştirilmesi için yönetici ile iletişime geçilmesi gerekmektedir.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-amber-600 font-bold flex-shrink-0">•</span>
                                    <p>Sistem verilerinin kopyaları alınarak cihaz dışına aktarılması, başka kişi ve kurumlarla paylaşılması yasaktır.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
