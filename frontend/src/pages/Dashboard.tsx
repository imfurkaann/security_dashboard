import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import type { VehicleUsage, VisitorRecord } from '../types';
import { STORAGE_KEYS } from '../constants';
import { AlertCircle, Car, Users, UserCheck, Flame } from 'lucide-react';

// Stat Card Component
interface StatCardProps {
    title: string;
    value: number;
    cardClass: string;
    iconWrapClass: string;
    icon: React.ReactNode;
}

function StatCard({ title, value, cardClass, iconWrapClass, icon }: StatCardProps) {
    return (
        <div className={`rounded-xl shadow-sm p-4 sm:p-5 min-h-[96px] border ${cardClass}`}>
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 pr-2">
                    <p className="text-xs sm:text-sm font-semibold text-white/90 leading-tight break-words">{title}</p>
                    <p className="text-2xl font-bold text-white mt-1">{value}</p>
                </div>
                <div className={`p-2.5 rounded-lg border ${iconWrapClass} flex-shrink-0`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

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
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700" />
                    <span className="text-slate-600">Yükleniyor...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-slate-900 text-white py-8 px-4 shadow-md border-b border-slate-700">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-3xl font-bold mb-1">Dosinia Luxury Resort Hotel</h1>
                    <p className="text-slate-200">GÜVENLİK VERİ KAYIT VE YÖNETİM SİSTEMİ</p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">

                {/* Stats Cards - Araç ve Ziyaretçi Bilgileri */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5 sm:mb-6">
                    <StatCard
                        title="Kullanımdaki Araçlar"
                        value={vehiclesInUse}
                        cardClass="border-blue-500 bg-gradient-to-br from-blue-500 to-blue-700"
                        iconWrapClass="border-blue-300/60 bg-blue-400/30 text-white"
                        icon={<Car size={20} />}
                    />
                    <StatCard
                        title="İçerideki Ziyaretçiler"
                        value={visitorsInside}
                        cardClass="border-emerald-500 bg-gradient-to-br from-emerald-500 to-emerald-700"
                        iconWrapClass="border-emerald-300/60 bg-emerald-400/30 text-white"
                        icon={<Users size={20} />}
                    />
                    <StatCard
                        title="İçerideki Müdürler"
                        value={managersInside}
                        cardClass="border-indigo-500 bg-gradient-to-br from-indigo-500 to-indigo-700"
                        iconWrapClass="border-indigo-300/60 bg-indigo-400/30 text-white"
                        icon={<UserCheck size={20} />}
                    />
                    <StatCard
                        title="Bugün Çalınan Alarmlar"
                        value={todayAlarms}
                        cardClass="border-rose-500 bg-gradient-to-br from-rose-500 to-red-700"
                        iconWrapClass="border-rose-300/60 bg-rose-400/30 text-white"
                        icon={<Flame size={20} />}
                    />
                </div>

                {/* Önemli Uyarılar */}
                <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6 border border-amber-200">
                    <div className="flex items-start gap-3 sm:gap-4">
                        <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5 sm:mt-1" size={22} />
                        <div className="flex-1">
                            <h2 className="text-black font-bold text-base sm:text-lg mb-3 sm:mb-4">ÖNEMLİ UYARILAR</h2>
                            <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm text-black leading-relaxed">
                                <div className="flex gap-3">
                                    <span className="text-black font-bold flex-shrink-0">•</span>
                                    <p>Sistemi ilk defa kullanacaksanız bilen çalışma arkadaşlarınızdan lütfen bilgilendirmeler alınız.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-black font-bold flex-shrink-0">•</span>
                                    <p>Sisteme giriş yaptığınız andan itibaren yapılan tüm işlemler giriş yapan kişi adına kaydedilmektedir. O yüzden giriş bilgilerinizi güvenli şekilde saklamanız önemlidir.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-black font-bold flex-shrink-0">•</span>
                                    <p>Uygulama içerisinde gerçekleştirilen her türlü işlem kayıt altına alınmaktadır. Giriş çıkış bilgileri, hatalı şifre giriş denemeleri, alınan kayıt bilgileri, sistemde yapılan her bir tıklama, sisteme girilmeye çalışılan cihaz bilgileri vb. tarih ve saat bilgisiyle kaydedilmektedir. Yönetici ilgili durumlarda bu verilere erişebilmektedir.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-black font-bold flex-shrink-0">•</span>
                                    <p>Yapılan her türlü veri girişi, güncelleme ve rapor alma işlemleri sistem günlüğüne işlenmektedir.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-black font-bold flex-shrink-0">•</span>
                                    <p>Kullanım sırasında karşılaşılan her türlü teknik hata veya aksaklık vakit kaybetmeden yöneticiye bildirilmelidir.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-black font-bold flex-shrink-0">•</span>
                                    <p>Sistemin daha verimli çalışması ve geliştirilmesi adına kullanıcı önerilerinin yöneticiye iletilmesi beklenmektedir.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-black font-bold flex-shrink-0">•</span>
                                    <p>Veri girişlerinin doğru ve eksiksiz yapılması zorunludur; hatalı girilen işlemler veri güvenliği için sistemden tamamen silinmemektedir. Yanlış veri girişi, sistemin ürettiği istatistiklerin bozulmasına ve hatalı sonuçlar alınmasına neden olmaktadır.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-black font-bold flex-shrink-0">•</span>
                                    <p>Uygulamadan ayrılmadan önce oturumun güvenli bir şekilde sonlandırılması için mutlaka "Çıkış Yap" butonu kullanılmalıdır.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-black font-bold flex-shrink-0">•</span>
                                    <p>Şifrenin unutulması durumunda veya sisteme ilk girişte tanımlanan geçici şifrenin kişisel bir şifreyle değiştirilmesi için yönetici ile iletişime geçilmesi gerekmektedir.</p>
                                </div>
                                <div className="flex gap-3">
                                    <span className="text-black font-bold flex-shrink-0">•</span>
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
