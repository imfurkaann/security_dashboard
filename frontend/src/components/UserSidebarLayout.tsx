import { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
    Home, 
    Car, 
    Users, 
    UserCheck, 
    ClipboardList, 
    Flame, 
    FileText, 
    FileSpreadsheet, 
    LogOut, 
    Menu, 
    X,
    ShieldAlert
} from 'lucide-react';
import api from '../utils/api';
import { STORAGE_KEYS } from '../constants';

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
    { title: 'Anasayfa', path: '/dashboard', icon: Home },
    { title: 'Araç Kayıtları Yönetimi', path: '/vehicles', icon: Car },
    { title: 'Ziyaretçi Kayıtları Yönetimi', path: '/visitors', icon: Users },
    { title: 'Müdür Kayıtları Yönetimi', path: '/managers', icon: UserCheck },
    { title: 'Misafir Kayıtları Yönetimi', path: '/misafir-kayitlari', icon: ClipboardList },
    { title: 'Yangın Alarmları Yönetimi', path: '/fire-alarms', icon: Flame },
    { title: 'Vardiya Rapor Yönetimi', path: '/incidents', icon: FileText },
    { title: 'SGK Belge Yönetimi', path: '/sgk', icon: FileSpreadsheet },
];

export default function UserSidebarLayout() {
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const navigate = useNavigate();

    const rawUser = localStorage.getItem(STORAGE_KEYS.USER);
    const parsedUser = rawUser ? JSON.parse(rawUser) : null;
    const userName = parsedUser?.fullName || parsedUser?.username || 'Kullanıcı';
    const userRole = parsedUser?.role || 'security';

    const sidebarWidth = useMemo(() => {
        const longestLabel = Math.max(
            'Güvenlik Kayıt Paneli'.length,
            ...menuItems.map((item) => item.title.length)
        );
        const widthInCh = Math.min(28, Math.max(18, longestLabel + 7));
        return `${widthInCh}ch`;
    }, []);

    const handleLogout = async () => {
        setLogoutLoading(true);
        try {
            await api.post('/auth/logout', {});
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem(STORAGE_KEYS.TOKEN);
            localStorage.removeItem(STORAGE_KEYS.USER);
            localStorage.removeItem(STORAGE_KEYS.SELECTED_GATE);
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen bg-gray-900" style={{ ['--sidebar-width' as string]: sidebarWidth }}>
            {logoutLoading && <LogoutOverlay />}

            {/* Mobile Menu Toggle Button */}
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
                {/* Header / Logo Section */}
                <div className="mb-4 pb-3 border-b border-slate-700 flex items-center gap-3 min-w-0 overflow-hidden">
                    <ShieldAlert className="w-5 h-5 text-blue-500 shrink-0" />
                    <h1 className={`text-white text-sm font-semibold uppercase tracking-wide truncate transition-all duration-300 ${
                        isHovered ? 'opacity-100 w-auto' : 'lg:opacity-0 lg:w-0 overflow-hidden'
                    }`}>
                        Güvenlik Kayıt
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
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <div className={`transition-all duration-300 min-w-0 ${
                            isHovered ? 'opacity-100 w-auto' : 'lg:opacity-0 lg:w-0 overflow-hidden'
                        }`}>
                            <p className="text-[10px] text-gray-400 leading-none">Giriş Yapan</p>
                            <p className="text-xs text-white font-semibold mt-1 truncate" title={userName}>{userName}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider">{userRole}</p>
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
