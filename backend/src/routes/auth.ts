import { Router } from 'express';
import {
    login,
    logout,
    getCurrentUser,
    loginValidation,
} from '../controllers/authController';
import { authMiddleware, rateLimitMiddleware } from '../middleware/auth';
import { loginRateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public (with enhanced rate limiting)
 * GÜVENLİK: İki katmanlı rate limiting - genel + login özel
 */
router.post('/login', loginRateLimiter, rateLimitMiddleware, loginValidation, login);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (update manager exit time)
 * @access  Private
 */
router.post('/logout', authMiddleware, logout);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user info
 * @access  Private
 */
router.get('/me', authMiddleware, getCurrentUser);

export default router;
