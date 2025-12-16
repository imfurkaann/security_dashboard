/**
 * Custom Hooks
 * Yeniden kullanılabilir React hooks
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import type { User } from '../types';
import { STORAGE_KEYS } from '../constants';

/**
 * Kullanıcı authentication hook'u
 */
export function useAuth() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const checkAuth = useCallback(async () => {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

        if (!token) {
            setIsAuthenticated(false);
            setLoading(false);
            return;
        }

        try {
            const response = await api.get('/auth/me');
            if (response.data.success && response.data.data) {
                setUser(response.data.data);
                setIsAuthenticated(true);
            } else {
                throw new Error('Invalid response');
            }
        } catch {
            localStorage.removeItem(STORAGE_KEYS.TOKEN);
            localStorage.removeItem(STORAGE_KEYS.USER);
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await api.post('/auth/logout', {});
        } catch {
            // Ignore logout errors
        } finally {
            localStorage.removeItem(STORAGE_KEYS.TOKEN);
            localStorage.removeItem(STORAGE_KEYS.USER);
            setUser(null);
            setIsAuthenticated(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    return { user, loading, isAuthenticated, logout, checkAuth };
}

/**
 * API veri çekme hook'u
 */
export function useFetch<T>(url: string, deps: unknown[] = []) {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await api.get(url);
            setData(response.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Veri yüklenemedi');
        } finally {
            setLoading(false);
        }
    }, [url]);

    useEffect(() => {
        refetch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [url, ...deps]);

    return { data, loading, error, refetch };
}

/**
 * Local storage state hook'u
 */
export function useLocalStorage<T>(key: string, initialValue: T) {
    const [storedValue, setStoredValue] = useState<T>(() => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch {
            return initialValue;
        }
    });

    const setValue = useCallback((value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error('useLocalStorage error:', error);
        }
    }, [key, storedValue]);

    return [storedValue, setValue] as const;
}

/**
 * Debounce hook'u
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * Modal state hook'u
 */
export function useModal(initialState = false) {
    const [isOpen, setIsOpen] = useState(initialState);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen(prev => !prev), []);

    return { isOpen, open, close, toggle };
}
