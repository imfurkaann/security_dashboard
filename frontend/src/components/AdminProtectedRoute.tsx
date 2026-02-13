import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../utils/api';

interface AdminProtectedRouteProps {
    children: React.ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    useEffect(() => {
        const checkAuth = async () => {
            const adminToken = localStorage.getItem('adminToken');
            const adminUser = localStorage.getItem('adminUser');

            // Token yoksa
            if (!adminToken || !adminUser) {
                setIsAuthenticated(false);
                return;
            }

            // Token format kontrolü
            if (adminToken.length < 10 || adminToken.length > 1000) {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminUser');
                setIsAuthenticated(false);
                return;
            }

            try {
                const user = JSON.parse(adminUser);
                if (user.role !== 'admin') {
                    setIsAuthenticated(false);
                    return;
                }

                // Backend'den admin doğrula
                const response = await api.get('/admin/me');
                if (response.data.success && response.data.data) {
                    setIsAuthenticated(true);
                } else {
                    throw new Error('Invalid response');
                }
            } catch {
                localStorage.removeItem('adminToken');
                localStorage.removeItem('adminUser');
                setIsAuthenticated(false);
            }
        };

        checkAuth();
    }, []);

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
