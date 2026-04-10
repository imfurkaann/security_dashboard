import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
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
    { title: 'Dashboard', path: '/dashboard' },
    { title: 'Araç Yönetimi', path: '/vehicles' },
    { title: 'Ziyaretçi Yönetimi', path: '/visitors' },
    { title: 'Müdür Yönetimi', path: '/managers' },
    { title: 'Olaylar', path: '/incidents' },
    { title: 'Yangın Alarmları', path: '/fire-alarms' },
    { title: 'SGK', path: '/sgk' },
    { title: 'Misafir Kayıtları', path: '/misafir-kayitlari' }
];

export default function UserSidebarLayout() {
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const rawUser = localStorage.getItem(STORAGE_KEYS.USER);
    const parsedUser = rawUser ? JSON.parse(rawUser) : null;
    const userName = parsedUser?.fullName || parsedUser?.username || 'Kullanici';
    const userRole = parsedUser?.role || 'security';

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
        <div className="min-h-screen bg-gray-900">
            {logoutLoading && <LogoutOverlay />}

            <button
                type="button"
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                className="fixed top-4 left-4 z-40 inline-flex lg:hidden items-center justify-center rounded-md bg-slate-900 p-2 text-gray-100 border border-slate-700 hover:bg-slate-800 transition"
                aria-label={isSidebarOpen ? 'Menüyü kapat' : 'Menüyü aç'}
            >
                {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {isSidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/50 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                    aria-hidden="true"
                />
            )}

            <aside className={`fixed left-0 top-0 h-screen w-64 bg-slate-900 border-r border-slate-700 shadow-md p-4 z-30 flex flex-col transform transition-transform duration-200 ease-out lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                <div className="mb-4 pb-3 border-b border-slate-700">
                    <h1 className="text-white text-sm font-semibold uppercase tracking-wide">Güvenlik Paneli</h1>
                </div>

                <nav className="space-y-1 flex-1 overflow-y-auto">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsSidebarOpen(false)}
                            className={({ isActive }) =>
                                `block rounded-md px-3 py-2 text-sm transition ${isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-300 hover:bg-slate-700 hover:text-white'
                                }`
                            }
                        >
                            {item.title}
                        </NavLink>
                    ))}
                </nav>

                <div className="mt-4 pt-3 border-t border-slate-700">
                    <p className="text-xs text-gray-400">Giris Yapan</p>
                    <p className="text-sm text-white font-semibold mt-1 truncate">{userName}</p>
                    <p className="text-[11px] text-gray-400 mt-1 uppercase">{userRole}</p>
                </div>

                <button
                    onClick={handleLogout}
                    className="mt-3 w-full rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 transition"
                >
                    Çıkış Yap
                </button>
            </aside>

            <main className="min-h-screen pt-14 lg:pt-0 lg:ml-64">
                <Outlet />
            </main>
        </div>
    );
}
