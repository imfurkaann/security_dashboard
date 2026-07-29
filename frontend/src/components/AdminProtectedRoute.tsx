import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { AxiosError } from 'axios';
import api from '../utils/api';
import { STORAGE_KEYS } from '../constants';

interface AdminProtectedRouteProps {
    children: React.ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [hasConnectionError, setHasConnectionError] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Backend'den admin doğrula
                const response = await api.get('/admin/me');
                if (response.data.success && response.data.data?.role === 'admin') {
                    localStorage.setItem(STORAGE_KEYS.ADMIN_USER, JSON.stringify(response.data.data));
                    setIsAuthenticated(true);
                } else {
                    throw new Error('Invalid response or unauthorized role');
                }
            } catch (error) {
                const status = (error as AxiosError).response?.status;
                if (status === 401 || status === 403 || status === 404) {
                    localStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);
                    localStorage.removeItem(STORAGE_KEYS.ADMIN_USER);
                    setIsAuthenticated(false);
                } else {
                    // Do not destroy a valid local session during a temporary API/DB outage.
                    setHasConnectionError(true);
                }
            }
        };

        checkAuth();
    }, []);

    if (hasConnectionError) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-8 max-w-md text-center">
                    <h2 className="text-xl font-bold text-white mb-2">Bağlantı kurulamadı</h2>
                    <p className="text-gray-300 mb-5">
                        Sistem geçici olarak yanıt vermiyor. Oturumunuz korunuyor.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                    >
                        Tekrar Dene
                    </button>
                </div>
            </div>
        );
    }

    // Yükleniyor durumu
    if (isAuthenticated === null) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    <p className="text-gray-400">Doğrulanıyor...</p>
                </div>
            </div>
        );
    }

    // Authenticated değilse login'e yönlendir
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
