import { Router } from 'express';
import {
    getAllManagers,
    createManager,
    updateManager,
    deleteManager,
    getManagerRecords,
    createManagerRecord,
    updateManagerRecord,
    exitManager
} from '../controllers/managerController';
import { authMiddleware } from '../middleware/auth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Admin routes for managing managers (CRUD)
router.get('/', adminAuthMiddleware, getAllManagers);
router.post('/', adminAuthMiddleware, createManager);
router.put('/:id', adminAuthMiddleware, updateManager);
router.delete('/:id', adminAuthMiddleware, deleteManager);

// All other routes require authentication
router.use(authMiddleware);

// Get all manager records
router.get('/records', getManagerRecords);

// Create new manager record
router.post('/records', createManagerRecord);

// Update manager record
router.put('/records/:id', updateManagerRecord);

// Exit manager
router.post('/records/:id/exit', exitManager);

export default router;
