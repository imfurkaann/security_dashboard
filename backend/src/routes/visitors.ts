import { Router } from 'express';
import {
    getVisitorRecords,
    createVisitorRecord,
    updateVisitorRecord,
    exitVisitor,
    deleteVisitorRecord,
    restoreVisitorRecord,
    sendVisitorWhatsAppMessage
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

// Soft delete visitor record
router.delete('/records/:id', deleteVisitorRecord);

// Restore visitor record
router.post('/records/:id/restore', restoreVisitorRecord);

// Send WhatsApp message from modal (automatic send)
router.post('/send-whatsapp-message', sendVisitorWhatsAppMessage);

export default router;
