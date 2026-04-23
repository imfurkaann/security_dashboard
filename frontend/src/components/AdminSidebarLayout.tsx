import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
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
    { title: 'Araç Kayıtları Yönetimi', path: '/admin/vehicle-records' },
    { title: 'Ziyaretçi Kayıtları Yönetimi', path: '/admin/visitor-records' },
    { title: 'Müdür Kayıtları Yönetimi', path: '/admin/manager-records' },
    { title: 'Yangın Kayıtları Yönetimi', path: '/admin/fire-alarm-records' },
    { title: 'Vardiya Raporları Yönetimi', path: '/admin/incident-records' },
    { title: 'Personel Yönetimi', path: '/admin/manage-personnel' },
    { title: 'Personel İstatistiği', path: '/admin/personnel-statistics' },
    { title: 'WhatsApp Bağlantı Yönetimi', path: '/admin/whatsapp-settings' },
    { title: 'Kapı ve Ekipman Yönetimi', path: '/admin/gate-equipment-config' },
    { title: 'Otopark Yönetimi', path: '/admin/parking-management' },
    { title: 'Misafir Kayıtları', path: '/admin/misafir-kayitlari' },
    { title: 'Misafir QR Yönetimi', path: '/admin/misafir-qr-yonetimi' },
    { title: 'İstatistikler', path: '/admin/statistics' },
    { title: 'Veri Dışa Aktarma', path: '/admin/export-data' }
];

export default function AdminSidebarLayout() {
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [topPerformers, setTopPerformers] = useState<AdminTopPerformer[]>([]);
    const [showTopPerformersModal, setShowTopPerformersModal] = useState(false);
    const navigate = useNavigate();
    const rawAdmin = localStorage.getItem('adminUser');
    const parsedAdmin = rawAdmin ? JSON.parse(rawAdmin) : null;
    const adminName = parsedAdmin?.fullName || parsedAdmin?.username || 'Yonetici';

    const sidebarWidth = useMemo(() => {
        const longestLabel = Math.max(
            'Yönetim Paneli'.length,
            ...menuItems.map((item) => item.title.length)
        );
        const widthInCh = Math.min(30, Math.max(20, longestLabel + 7));
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
                <div className="fixed inset-0 z-[70] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
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

            <aside className={`fixed left-0 top-0 h-screen w-[var(--sidebar-width)] bg-slate-900 border-r border-slate-700 shadow-md p-4 z-30 flex flex-col transform transition-transform duration-200 ease-out lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                <div className="mb-4 pb-3 border-b border-slate-700">
                    <h1 className="text-white text-sm font-semibold uppercase tracking-wide">Yönetim Paneli</h1>
                </div>

                <nav className="space-y-1 flex-1 overflow-y-auto">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsSidebarOpen(false)}
                            className={({ isActive }) =>
                                `block rounded-md px-3 py-2 text-sm transition whitespace-nowrap ${isActive
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
                    <p className="text-sm text-white font-semibold mt-1 truncate">{adminName}</p>
                    <p className="text-[11px] text-gray-400 mt-1 uppercase">yonetici</p>
                </div>

                <button
                    onClick={handleLogout}
                    className="mt-3 w-full rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700 transition"
                >
                    Çıkış Yap
                </button>
            </aside>

            <main className="min-h-screen pt-14 lg:pt-0 lg:ml-[var(--sidebar-width)]">
                <Outlet />
            </main>
        </div>
    );
}
