import { Router } from 'express';
import {
    getVisitorRecords,
    createVisitorRecord,
    updateVisitorRecord,
    exitVisitor
} from '../controllers/visitorController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all visitor records
router.get('/records', getVisitorRecords);

// Create new visitor record
router.post('/records', createVisitorRecord);

// Update visitor record
router.put('/records/:id', updateVisitorRecord);

// Exit visitor
router.post('/records/:id/exit', exitVisitor);

export default router;
