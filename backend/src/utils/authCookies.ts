import crypto from 'crypto';
import type { CookieOptions, Request, Response } from 'express';

export const AUTH_COOKIE_NAME = 'security_session';
export const CSRF_COOKIE_NAME = 'security_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const secureCookies = process.env.AUTH_COOKIE_SECURE === 'true';
const configuredMaxAge = Number(process.env.AUTH_COOKIE_MAX_AGE_MS || 24 * 60 * 60 * 1000);
const cookieMaxAge = Number.isFinite(configuredMaxAge) && configuredMaxAge > 0
    ? configuredMaxAge
    : 24 * 60 * 60 * 1000;

const baseCookieOptions: CookieOptions = {
    secure: secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: cookieMaxAge,
};

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
    if (!cookieHeader) return {};

    return cookieHeader.split(';').reduce<Record<string, string>>((cookies, part) => {
        const separatorIndex = part.indexOf('=');
        if (separatorIndex < 1) return cookies;

        const name = part.slice(0, separatorIndex).trim();
        const rawValue = part.slice(separatorIndex + 1).trim();

        try {
            cookies[name] = decodeURIComponent(rawValue);
        } catch {
            cookies[name] = rawValue;
        }

        return cookies;
    }, {});
};

export const getCookie = (req: Request, name: string): string | null => {
    return parseCookies(req.headers.cookie)[name] || null;
};

export const getTokenFromCookieHeader = (cookieHeader: string | undefined): string | null => {
    return parseCookies(cookieHeader)[AUTH_COOKIE_NAME] || null;
};

export const getRequestToken = (req: Request): string | null => {
    const cookieToken = getCookie(req, AUTH_COOKIE_NAME);
    if (cookieToken) return cookieToken;

    // Temporary backwards compatibility for clients holding a pre-migration token.
    const authorization = req.headers.authorization;
    if (authorization?.startsWith('Bearer ')) {
        return authorization.slice(7).trim() || null;
    }

    return null;
};

export const setAuthCookies = (res: Response, token: string): void => {
    const csrfToken = crypto.randomBytes(32).toString('hex');

    res.cookie(AUTH_COOKIE_NAME, token, {
        ...baseCookieOptions,
        httpOnly: true,
    });
    res.cookie(CSRF_COOKIE_NAME, csrfToken, {
        ...baseCookieOptions,
        httpOnly: false,
    });
    res.setHeader('Cache-Control', 'no-store');
};

export const clearAuthCookies = (res: Response): void => {
    const clearOptions: CookieOptions = {
        secure: secureCookies,
        sameSite: 'lax',
        path: '/',
    };

    res.clearCookie(AUTH_COOKIE_NAME, clearOptions);
    res.clearCookie(CSRF_COOKIE_NAME, clearOptions);
    res.setHeader('Cache-Control', 'no-store');
};

export const hasCookieSession = (req: Request): boolean => {
    return Boolean(getCookie(req, AUTH_COOKIE_NAME));
};

export const isValidCsrfToken = (req: Request): boolean => {
    const cookieToken = getCookie(req, CSRF_COOKIE_NAME);
    const headerToken = req.header(CSRF_HEADER_NAME);

    if (!cookieToken || !headerToken) return false;

    const cookieBuffer = Buffer.from(cookieToken);
    const headerBuffer = Buffer.from(headerToken);

    return cookieBuffer.length === headerBuffer.length
        && crypto.timingSafeEqual(cookieBuffer, headerBuffer);
};
