import { Router } from 'express';
import { searchPredefinedVisitors } from '../controllers/predefinedVisitorController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Search active frequent visitors for auto-fill in registration modal
router.get('/search', authMiddleware, searchPredefinedVisitors);

export default router;
