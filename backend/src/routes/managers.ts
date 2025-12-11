import { Router } from 'express';
import {
    getManagerRecords,
    createManagerRecord,
    updateManagerRecord,
    exitManager
} from '../controllers/managerController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
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
