import { Router } from 'express';
import {
    submitEquipmentCheck,
    getEquipmentCheckStatus,
    getEquipmentConfig,
    equipmentCheckValidation,
} from '../controllers/equipmentController';
import { authMiddleware } from '../middleware/auth';
import { sendWhatsAppNotification } from '../controllers/whatsappNotificationController';
import { whatsappSendRateLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @route   POST /api/equipment-check
 * @desc    Submit equipment check (acknowledge equipment condition)
 * @access  Private
 */
router.post('/', authMiddleware, equipmentCheckValidation, submitEquipmentCheck);

/**
 * @route   GET /api/equipment-check/status
 * @desc    Check if equipment check is completed for current session
 * @access  Private
 */
router.get('/status', authMiddleware, getEquipmentCheckStatus);

/**
 * @route   GET /api/equipment-check/config
 * @desc    Get active gate/equipment configuration for personnel flow
 * @access  Private
 */
router.get('/config', authMiddleware, getEquipmentConfig);

/**
 * @route   POST /api/equipment-check/send-whatsapp-message
 * @desc    Send a WhatsApp message manually (triggered from frontend modal)
 * @access  Private
 */
router.post('/send-whatsapp-message', authMiddleware, whatsappSendRateLimiter, sendWhatsAppNotification);

export default router;
