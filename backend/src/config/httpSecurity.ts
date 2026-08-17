const normalizeOrigin = (value: string | undefined | null): string | null => {
    const trimmed = value?.trim();
    if (!trimmed) return null;

    try {
        return new URL(trimmed).origin;
    } catch {
        return null;
    }
};

const configuredOrigins = (): Set<string> => {
    const origins = new Set<string>();
    const add = (value: string | undefined | null) => {
        const normalized = normalizeOrigin(value);
        if (normalized) origins.add(normalized);
    };

    add(process.env.FRONTEND_URL);

    for (const value of (process.env.CORS_ORIGINS || '').split(',')) {
        add(value);
    }

    const publicHost = process.env.PUBLIC_HOST_IP?.trim();
    const frontendPort = process.env.FRONTEND_PORT?.trim() || '33334';
    if (publicHost) {
        add(`http://${publicHost}:${frontendPort}`);
        add(`https://${publicHost}:${frontendPort}`);
        add(`http://${publicHost}`);
        add(`https://${publicHost}`);
    }

    const allowLocalhost = process.env.NODE_ENV !== 'production'
        || process.env.ALLOW_LOCALHOST_ORIGIN === 'true';
    if (allowLocalhost) {
        ['5173', '5174', '3000', '33334'].forEach((port) => {
            add(`http://localhost:${port}`);
            add(`http://127.0.0.1:${port}`);
        });
        add('http://localhost');
        add('http://127.0.0.1');
    }

    return origins;
};

export const getAllowedOrigins = (): string[] => Array.from(configuredOrigins());

export const isAllowedOrigin = (origin: string | undefined): boolean => {
    // Non-browser service and health-check clients do not necessarily send Origin.
    if (!origin) return true;
    const normalized = normalizeOrigin(origin);
    return Boolean(normalized && configuredOrigins().has(normalized));
};

export const assertSecureHttpConfiguration = (): void => {
    if (process.env.NODE_ENV !== 'production') return;

    if (process.env.CORS_ORIGIN === '*') {
        throw new Error('Production ortamında CORS_ORIGIN=* kullanılamaz; CORS_ORIGINS ile açık origin listesi tanımlayın');
    }

    if (getAllowedOrigins().length === 0) {
        throw new Error('Production ortamında en az bir FRONTEND_URL, PUBLIC_HOST_IP veya CORS_ORIGINS tanımlanmalıdır');
    }
};

