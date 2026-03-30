import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../constants';

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
    { title: 'Dashboard', path: '/admin/dashboard' },
    { title: 'Araç Kayıtları', path: '/admin/vehicle-records' },
    { title: 'Ziyaretçi Yönetimi', path: '/admin/visitor-records' },
    { title: 'Müdür Kayıtları', path: '/admin/manager-records' },
    { title: 'Olay Yönetimi', path: '/admin/incident-records' },
    { title: 'Yangın Yönetimi', path: '/admin/fire-alarm-records' },
    { title: 'Personel Yönetimi', path: '/admin/manage-personnel' },
    { title: 'Veri Dışa Aktarma', path: '/admin/export-data' },
    { title: 'İstatistikler', path: '/admin/statistics' }
];

export default function AdminSidebarLayout() {
    const [logoutLoading, setLogoutLoading] = useState(false);
    const navigate = useNavigate();
    const rawAdmin = localStorage.getItem('adminUser');
    const parsedAdmin = rawAdmin ? JSON.parse(rawAdmin) : null;
    const adminName = parsedAdmin?.fullName || parsedAdmin?.username || 'Yonetici';

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
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen bg-gray-900">
            {logoutLoading && <LogoutOverlay />}

            <aside className="fixed left-0 top-0 h-screen w-60 bg-gray-800 border-r border-gray-700 p-4 z-30 flex flex-col">
                <div className="mb-4 pb-3 border-b border-gray-700">
                    <h1 className="text-white text-sm font-semibold uppercase tracking-wide">Yönetim Paneli</h1>
                </div>

                <nav className="space-y-1 flex-1 overflow-y-auto">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `block rounded-md px-3 py-2 text-sm transition ${
                                    isActive
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                }`
                            }
                        >
                            {item.title}
                        </NavLink>
                    ))}
                </nav>

                <div className="mt-4 pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-400">Giris Yapan</p>
                    <p className="text-sm text-white font-semibold mt-1 truncate">{adminName}</p>
                    <p className="text-[11px] text-red-400 mt-1 uppercase">yonetici</p>
                </div>

                <button
                    onClick={handleLogout}
                    className="mt-3 w-full rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 transition"
                >
                    Çıkış Yap
                </button>
            </aside>

            <main className="ml-60 min-h-screen">
                <Outlet />
            </main>
        </div>
    );
}
