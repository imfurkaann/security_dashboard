import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState, type ReactNode } from 'react';
import api from '../utils/api';

interface ProtectedRouteProps {
    children: ReactNode;
    requiredRoles?: string[];
}

interface User {
    id: string;
    username: string;
    role: string;
    fullName: string;
}

/**
 * Korumalı Route Bileşeni
 * - Authentication kontrolü yapar
 * - Token geçerliliğini doğrular
 * - Role-based access control sağlar
 */
export default function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const location = useLocation();

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');

            // Token yoksa
            if (!token) {
                setIsAuthenticated(false);
                return;
            }

            // Token format kontrolü
            if (token.length < 10 || token.length > 1000) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setIsAuthenticated(false);
                return;
            }

            try {
                // Backend'den kullanıcı bilgilerini doğrula
                const response = await api.get('/auth/me');

                if (response.data.success && response.data.data) {
                    setUser(response.data.data);
                    setIsAuthenticated(true);
                } else {
                    throw new Error('Invalid response');
                }
            } catch (error) {
                // Token geçersiz veya süresi dolmuş
                localStorage.removeItem('token');
                localStorage.removeItem('user');
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
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Role kontrolü (opsiyonel)
    if (requiredRoles && requiredRoles.length > 0 && user) {
        if (!requiredRoles.includes(user.role)) {
            return (
                <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-8 max-w-md text-center">
                        <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h2 className="text-xl font-bold text-white mb-2">Yetkisiz Erişim</h2>
                        <p className="text-gray-400 mb-4">Bu sayfayı görüntüleme yetkiniz bulunmamaktadır.</p>
                        <button
                            onClick={() => window.history.back()}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                        >
                            Geri Dön
                        </button>
                    </div>
                </div>
            );
        }
    }

    return <>{children}</>;
}

/**
 * Sadece admin erişimi için wrapper
 */
export function AdminRoute({ children }: { children: ReactNode }) {
    return (
        <ProtectedRoute requiredRoles={['admin']}>
            {children}
        </ProtectedRoute>
    );
}

/**
 * Admin ve manager erişimi için wrapper
 */
export function ManagerRoute({ children }: { children: ReactNode }) {
    return (
        <ProtectedRoute requiredRoles={['admin', 'manager']}>
            {children}
        </ProtectedRoute>
    );
}
