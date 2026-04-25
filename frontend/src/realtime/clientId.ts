const REALTIME_CLIENT_ID_KEY = 'realtimeClientId';

const getSafeSessionStorage = (): Storage | null => {
    if (typeof window === 'undefined') return null;
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
};

const getSafeLocalStorage = (): Storage | null => {
    if (typeof window === 'undefined') return null;
    try {
        return window.localStorage;
    } catch {
        return null;
    }
};

const generateClientId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

export const getRealtimeClientId = (): string => {
    const sessionStore = getSafeSessionStorage();
    const localStore = getSafeLocalStorage();

    const existing = sessionStore?.getItem(REALTIME_CLIENT_ID_KEY);
    if (existing && existing.trim().length > 0) {
        return existing;
    }

    // Backward-compatible migration from old localStorage key.
    const legacy = localStore?.getItem(REALTIME_CLIENT_ID_KEY);
    if (legacy && legacy.trim().length > 0) {
        sessionStore?.setItem(REALTIME_CLIENT_ID_KEY, legacy);
        localStore?.removeItem(REALTIME_CLIENT_ID_KEY);
        return legacy;
    }

    const created = generateClientId();
    sessionStore?.setItem(REALTIME_CLIENT_ID_KEY, created);
    return created;
};
