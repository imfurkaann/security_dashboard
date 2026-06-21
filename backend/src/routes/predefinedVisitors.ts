import { Router } from 'express';
import {
    getPredefinedVisitors,
    createPredefinedVisitor,
    updatePredefinedVisitor,
    deletePredefinedVisitor,
    searchPredefinedVisitors
} from '../controllers/predefinedVisitorController';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// ==========================================
// User (Personnel) Routes - Requires general authentication
// ==========================================

// Search predefined visitors for auto-fill in registration modal
router.get('/search', authMiddleware, searchPredefinedVisitors);

// ==========================================
// Admin Routes - Requires admin privilege
// ==========================================

// CRUD for predefined visitors
router.get('/admin', adminAuthMiddleware, getPredefinedVisitors);
router.post('/admin', adminAuthMiddleware, createPredefinedVisitor);
router.put('/admin/:id', adminAuthMiddleware, updatePredefinedVisitor);
router.delete('/admin/:id', adminAuthMiddleware, deletePredefinedVisitor);

export default router;
