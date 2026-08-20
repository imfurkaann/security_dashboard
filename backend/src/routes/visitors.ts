import { Router } from 'express';
import {
    getVisitorRecords,
    createVisitorRecord,
    updateVisitorRecord,
    exitVisitor,
    undoVisitorExit,
    deleteVisitorRecord,
    restoreVisitorRecord,
    getPendingQrVisitors,
    approvePendingQrVisitor,
    rejectPendingQrVisitor
} from '../controllers/visitorController';
import { authMiddleware } from '../middleware/auth';
import { sendWhatsAppNotification } from '../controllers/whatsappNotificationController';
import { whatsappSendRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all visitor records
router.get('/records', getVisitorRecords);

// Create new visitor record
router.post('/records', createVisitorRecord);

// Get all pending QR visitors
router.get('/pending-qr', getPendingQrVisitors);

// Approve a pending QR visitor
router.post('/pending-qr/:id/approve', approvePendingQrVisitor);

// Reject a pending QR visitor
router.post('/pending-qr/:id/reject', rejectPendingQrVisitor);

// Update visitor record
router.put('/records/:id', updateVisitorRecord);

// Exit visitor
router.post('/records/:id/exit', exitVisitor);

// Undo exit
router.post('/records/:id/undo-exit', undoVisitorExit);

// Soft delete visitor record
router.delete('/records/:id', deleteVisitorRecord);

// Restore visitor record
router.post('/records/:id/restore', restoreVisitorRecord);

// Send WhatsApp message from modal (automatic send)
router.post('/send-whatsapp-message', whatsappSendRateLimiter, sendWhatsAppNotification);

export default router;
