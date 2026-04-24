const REALTIME_CLIENT_ID_KEY = 'realtimeClientId';

const generateClientId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

export const getRealtimeClientId = (): string => {
    const existing = localStorage.getItem(REALTIME_CLIENT_ID_KEY);
    if (existing && existing.trim().length > 0) {
        return existing;
    }

    const created = generateClientId();
    localStorage.setItem(REALTIME_CLIENT_ID_KEY, created);
    return created;
};
