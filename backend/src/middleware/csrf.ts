import type { NextFunction, Request, Response } from 'express';
import { hasCookieSession, isValidCsrfToken } from '../utils/authCookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const LOGIN_PATHS = new Set(['/api/auth/login', '/api/admin/login']);

/**
 * Cookie-authenticated state changes require a matching double-submit CSRF
 * token. Legacy Bearer clients remain supported during the migration window.
 */
export const csrfProtection = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (
        SAFE_METHODS.has(req.method)
        || LOGIN_PATHS.has(req.path)
        || !hasCookieSession(req)
    ) {
        next();
        return;
    }

    if (!isValidCsrfToken(req)) {
        res.status(403).json({
            success: false,
            message: 'Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin.',
        });
        return;
    }

    next();
};
