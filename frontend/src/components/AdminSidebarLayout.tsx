import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
    Car, 
    Users, 
    UserCheck, 
    Flame, 
    FileText, 
    FileSpreadsheet, 
    TrendingUp, 
    Settings, 
    Layers, 
    ClipboardList, 
    QrCode, 
    FileDown, 
    LogOut, 
    Menu, 
    X, 
    ShieldCheck 
} from 'lucide-react';
import axios from 'axios';
import { API_URL, STORAGE_KEYS } from '../constants';

interface AdminTopPerformer {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    totalCount: number;
    rank: number;
}

function LogoutOverlay() {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-gray-800 rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4 border border-gray-700">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
                <div className="text-white text-lg font-medium">Çıkış yapılıyor...</div>
            </div>
        </div>
    );
}

const menuItems = [
    { title: 'Araç Kayıtları Yönetimi', path: '/admin/vehicle-records', icon: Car },
    { title: 'Ziyaretçi Kayıtları Yönetimi', path: '/admin/visitor-records', icon: Users },
    { title: 'Müdür Kayıtları Yönetimi', path: '/admin/manager-records', icon: UserCheck },
    { title: 'Yangın Kayıtları Yönetimi', path: '/admin/fire-alarm-records', icon: Flame },
    { title: 'Vardiya Raporları Yönetimi', path: '/admin/incident-records', icon: FileText },
    { title: 'SGK Belgesi Sorgulama', path: '/admin/sgk', icon: FileSpreadsheet },
    { title: 'Personel Yönetimi', path: '/admin/manage-personnel', icon: Users },
    { title: 'Personel İstatistiği', path: '/admin/personnel-statistics', icon: TrendingUp },
    { title: 'WhatsApp Bağlantı Yönetimi', path: '/admin/whatsapp-settings', icon: Settings },
    { title: 'Kapı ve Ekipman Yönetimi', path: '/admin/gate-equipment-config', icon: Layers },
    { title: 'Otopark Yönetimi', path: '/admin/parking-management', icon: Car },
    { title: 'Misafir Kayıtları', path: '/admin/misafir-kayitlari', icon: ClipboardList },
    { title: 'Misafir QR Yönetimi', path: '/admin/misafir-qr-yonetimi', icon: QrCode },
    { title: 'İstatistikler', path: '/admin/statistics', icon: TrendingUp },
    { title: 'Veri Dışa Aktarma', path: '/admin/export-data', icon: FileDown }
];

export default function AdminSidebarLayout() {
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [topPerformers, setTopPerformers] = useState<AdminTopPerformer[]>([]);
    const [showTopPerformersModal, setShowTopPerformersModal] = useState(false);
    const navigate = useNavigate();

    const rawAdmin = localStorage.getItem('adminUser');
    const parsedAdmin = rawAdmin ? JSON.parse(rawAdmin) : null;
    const adminName = parsedAdmin?.fullName || parsedAdmin?.username || 'Yönetici';

    const sidebarWidth = useMemo(() => {
        const longestLabel = Math.max(
            'Yönetim Paneli'.length,
            ...menuItems.map((item) => item.title.length)
        );
        const widthInCh = Math.min(32, Math.max(20, longestLabel + 7));
        return `${widthInCh}ch`;
    }, []);

    useEffect(() => {
        const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_TOP_PERFORMERS_POPUP);
        if (!raw) return;

        try {
            const parsed = JSON.parse(raw) as AdminTopPerformer[];
            if (Array.isArray(parsed) && parsed.length > 0) {
                setTopPerformers(parsed);
                setShowTopPerformersModal(true);
                return;
            }
        } catch (error) {
            console.error('Admin top performers verisi okunamadı:', error);
        }

        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOP_PERFORMERS_POPUP);
    }, []);

    const closeTopPerformersModal = () => {
        setShowTopPerformersModal(false);
        setTopPerformers([]);
        localStorage.removeItem(STORAGE_KEYS.ADMIN_TOP_PERFORMERS_POPUP);
    };

    const handleLogout = async () => {
        setLogoutLoading(true);
        const adminToken = localStorage.getItem('adminToken');

        try {
            if (adminToken) {
                await axios.post(
                    `${API_URL}/admin/logout`,
                    {},
                    {
                        headers: {
                            Authorization: `Bearer ${adminToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminUser');
            localStorage.removeItem('selectedGate');
            localStorage.removeItem(STORAGE_KEYS.ADMIN_TOP_PERFORMERS_POPUP);
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen bg-gray-900" style={{ ['--sidebar-width' as string]: sidebarWidth }}>
            {logoutLoading && <LogoutOverlay />}

            {showTopPerformersModal && (
                <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl text-slate-900 animate-fadeIn">
                        <div className="text-center mb-5">
                            <div className="text-4xl mb-2">🏅</div>
                            <h2 className="text-xl sm:text-2xl font-extrabold">Geçen Haftanın En Çok Kayıt Yapan İlk 3 Personeli</h2>
                            <p className="text-sm sm:text-base text-slate-600 mt-1">Yönetici giriş özeti</p>
                        </div>

                        <div className="space-y-3">
                            {topPerformers.map((person) => (
                                <div key={person.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div>
                                        <p className="font-bold text-amber-600">{person.rank}. {person.firstName} {person.lastName}</p>
                                        <p className="text-sm text-slate-500">@{person.username}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500">Toplam Kayıt</p>
                                        <p className="text-lg font-extrabold text-blue-700">{person.totalCount}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={closeTopPerformersModal}
                            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 transition"
                        >
                            Kapat
                        </button>
                    </div>
                </div>
            )}

            {/* Mobile Sidebar Toggle Button */}
            <button
                type="button"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                className="fixed top-4 left-4 z-40 inline-flex lg:hidden items-center justify-center rounded-md bg-slate-900 p-2 text-gray-100 border border-slate-700 hover:bg-slate-800 transition"
                aria-label={isSidebarOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            >
                {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {/* Mobile Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/50 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar Element */}
            <aside 
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`fixed left-0 top-0 h-screen bg-slate-900 border-r border-slate-700 shadow-md p-4 z-30 flex flex-col transform transition-all duration-300 ease-in-out lg:translate-x-0 ${
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                } ${
                    isHovered 
                        ? 'w-[var(--sidebar-width)] lg:w-[var(--sidebar-width)]' 
                        : 'w-[var(--sidebar-width)] lg:w-20'
                }`}
            >
                {/* Logo Section */}
                <div className="mb-4 pb-3 border-b border-slate-700 flex items-center gap-3 min-w-0 overflow-hidden">
                    <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />
                    <h1 className={`text-white text-sm font-semibold uppercase tracking-wide truncate transition-all duration-300 ${
                        isHovered ? 'opacity-100 w-auto' : 'lg:opacity-0 lg:w-0 overflow-hidden'
                    }`}>
                        Yönetim Paneli
                    </h1>
                </div>

                {/* Nav Links Section */}
                <nav className={`space-y-1 flex-1 min-w-0 ${isHovered ? 'overflow-y-auto' : 'overflow-y-hidden'}`}>
                    {menuItems.map((item) => {
                        const IconComponent = item.icon;
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                onClick={() => setIsSidebarOpen(false)}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition whitespace-nowrap min-w-0 ${isActive
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                                    }`
                                }
                            >
                                <IconComponent size={18} className="shrink-0" />
                                <span className={`transition-all duration-300 ${
                                    isHovered ? 'opacity-100 w-auto' : 'lg:opacity-0 lg:w-0 overflow-hidden'
                                }`}>
                                    {item.title}
                                </span>
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Profile Information Section */}
                <div className="mt-4 pt-3 border-t border-slate-700 min-w-0 overflow-hidden">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-500 font-bold shrink-0 select-none">
                            {adminName.charAt(0).toUpperCase()}
                        </div>
                        <div className={`transition-all duration-300 min-w-0 ${
                            isHovered ? 'opacity-100 w-auto' : 'lg:opacity-0 lg:w-0 overflow-hidden'
                        }`}>
                            <p className="text-[10px] text-gray-400 leading-none">Giriş Yapan</p>
                            <p className="text-xs text-white font-semibold mt-1 truncate" title={adminName}>{adminName}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider">Yönetici</p>
                        </div>
                    </div>
                </div>

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    className={`mt-3 w-full rounded-md bg-red-650 hover:bg-red-700 text-white transition flex items-center justify-center gap-2 py-2 px-3 ${
                        isHovered ? '' : 'lg:p-2'
                    }`}
                    title="Çıkış Yap"
                >
                    <LogOut size={16} className="shrink-0" />
                    <span className={`transition-all duration-300 whitespace-nowrap ${
                        isHovered ? 'opacity-100 w-auto' : 'lg:opacity-0 lg:w-0 overflow-hidden'
                    }`}>
                        Çıkış Yap
                    </span>
                </button>
            </aside>

            {/* Main Content Pane */}
            <main className="min-h-screen pt-14 lg:pt-0 lg:ml-20 transition-all duration-300 ease-in-out">
                <Outlet />
            </main>
        </div>
    );
}
