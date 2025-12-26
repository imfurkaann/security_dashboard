import { useState, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import { STORAGE_KEYS } from '../constants';
import type { AxiosError } from 'axios';

// Error messages
const ERROR_MESSAGES = {
    DEFAULT: 'Giriş başarısız. Lütfen tekrar deneyin.',
    VALIDATION: 'Kullanıcı adı ve şifre gereklidir.',
    RATE_LIMIT: 'Çok fazla deneme yaptınız. Lütfen bekleyin.',
} as const;

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();

    // Form validation
    const validateForm = useCallback((): boolean => {
        if (!username.trim() || !password.trim()) {
            setError(ERROR_MESSAGES.VALIDATION);
            return false;
        }
        return true;
    }, [username, password]);

    // Handle form submission
    const handleSubmit = useCallback(async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) return;

        setLoading(true);

        try {
            // First, try regular login to check user role
            const checkResponse = await api.post('/auth/login', {
                username: username.trim(),
                password
            });

            const { user } = checkResponse.data.data;

            // Check user role and use appropriate login endpoint
            if (user.role === 'admin') {
                // Admin users: Use admin login endpoint to get proper admin token
                console.log('Admin user detected, calling admin login...');
                const adminResponse = await api.post('/admin/login', {
                    username: username.trim(),
                    password
                });

                console.log('Admin login response:', adminResponse.data);
                const { token: adminToken } = adminResponse.data.data;
                console.log('Admin token received:', adminToken ? 'yes' : 'no');
                console.log('Admin token length:', adminToken?.length);

                // Save admin token ONLY to admin-specific keys (not to shared token key)
                localStorage.setItem('adminToken', adminToken);
                localStorage.setItem('adminUser', JSON.stringify({ ...user, isAdmin: true }));

                console.log('LocalStorage adminToken:', localStorage.getItem('adminToken'));

                // Small delay to ensure localStorage is saved before navigation
                setTimeout(() => {
                    navigate('/admin/dashboard', { replace: true });
                }, 100);
            } else {
                // Regular users: Use token from first login - save ONLY to personnel-specific keys
                const { token } = checkResponse.data.data;
                localStorage.setItem(STORAGE_KEYS.TOKEN, token);
                localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
                navigate('/equipment-check', { replace: true });
            }
        } catch (err) {
            const axiosError = err as AxiosError<{ message?: string }>;

            if (axiosError.response?.status === 429) {
                setError(ERROR_MESSAGES.RATE_LIMIT);
            } else {
                setError(axiosError.response?.data?.message || ERROR_MESSAGES.DEFAULT);
            }
        } finally {
            setLoading(false);
        }
    }, [username, password, validateForm, navigate]);

    return (
        <div className="min-h-screen bg-gray-900 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors duration-300 relative overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
            </div>

            {/* Theme Toggle Button */}
            <button
                onClick={toggleTheme}
                className="fixed top-4 right-4 z-50 p-2.5 rounded-lg bg-gray-800 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-600 shadow-lg transition-all duration-200"
                aria-label="Toggle theme"
            >
                {theme === 'light' ? (
                    <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                )}
            </button>

            {/* Login Card */}
            <div className="relative w-full max-w-md z-10">
                <div className="bg-gray-800/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-700/50 dark:border-gray-600/50 overflow-hidden">
                    {/* Card Header */}
                    <div className="p-8 text-center space-y-4">
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-blue-600/20 backdrop-blur-sm border border-blue-500/30 mb-2">
                            <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">Otel Güvenlik Sistemi</h1>
                    </div>

                    {/* Card Body */}
                    <div className="px-6 sm:px-8 pb-8">
                        <div className="space-y-6">
                            {/* Error Message */}
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                    <span>{error}</span>
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {/* Username Input */}
                                <div className="space-y-2">
                                    <label htmlFor="username" className="block text-sm font-medium text-gray-300">
                                        Kullanıcı Adı
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        <input
                                            id="username"
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-400"
                                            placeholder="Kullanıcı adınızı girin"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                {/* Password Input */}
                                <div className="space-y-2">
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                                        Şifre
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                        </div>
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-10 pr-12 py-3 bg-gray-700/50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-white placeholder-gray-400"
                                            placeholder="Şifrenizi girin"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-300 transition-colors"
                                        >
                                            {showPassword ? (
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                </svg>
                                            ) : (
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
                                >
                                    {loading ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>Giriş Yapılıyor...</span>
                                        </>
                                    ) : (
                                        <span>Giriş Yap</span>
                                    )}
                                </button>
                            </form>

                            {/* Forgot Password Link */}
                            <div className="mt-6 text-center">
                                <button className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                                    Şifremi Unuttum?
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-8 pt-6 border-t border-gray-700/50 text-center">
                            <p className="text-xs text-gray-500">
                                Otel Güvenlik Yönetim Sistemi v1.0
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                                © 2025 Tüm hakları saklıdır.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
