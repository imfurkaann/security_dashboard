import { Navigate } from 'react-router-dom';

interface AdminProtectedRouteProps {
    children: React.ReactNode;
}

export default function AdminProtectedRoute({ children }: AdminProtectedRouteProps) {
    const adminToken = localStorage.getItem('adminToken');
    const adminUser = localStorage.getItem('adminUser');

    // Check if admin is authenticated
    if (!adminToken || !adminUser) {
        return <Navigate to="/login" replace />;
    }

    try {
        const user = JSON.parse(adminUser);
        if (user.role !== 'admin') {
            return <Navigate to="/login" replace />;
        }
    } catch {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
