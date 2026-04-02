import { Router } from 'express';
import {
    adminLogin,
    adminLogout,
    getCurrentAdmin,
    adminLoginValidation,
} from '../controllers/adminAuthController';
import { adminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

/**
 * @route   POST /api/admin/login
 * @desc    Admin login
 * @access  Public
 */
router.post('/login', adminLoginValidation, adminLogin);

/**
 * @route   POST /api/admin/logout
 * @desc    Admin logout
 * @access  Private (Admin only)
 */
router.post('/logout', adminAuthMiddleware, adminLogout);

/**
 * @route   GET /api/admin/me
 * @desc    Get current admin user info
 * @access  Private (Admin only)
 */
router.get('/me', adminAuthMiddleware, getCurrentAdmin);

export default router;
