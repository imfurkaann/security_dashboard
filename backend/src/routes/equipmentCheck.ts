import { Router } from 'express';
import {
    submitEquipmentCheck,
    getEquipmentCheckStatus,
    getEquipmentWhatsAppGroups,
    getEquipmentWhatsAppStatus,
    getEquipmentConfig,
    equipmentCheckValidation,
    sendWhatsAppMessage,
} from '../controllers/equipmentController';
import { authMiddleware } from '../middleware/auth';

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
 * @route   GET /api/equipment-check/whatsapp-status
 * @desc    WhatsApp auto-send connection status (Baileys)
 * @access  Private
 */
router.get('/whatsapp-status', authMiddleware, getEquipmentWhatsAppStatus);

/**
 * @route   GET /api/equipment-check/whatsapp-groups
 * @desc    List joined WhatsApp groups for target JID selection
 * @access  Private
 */
router.get('/whatsapp-groups', authMiddleware, getEquipmentWhatsAppGroups);

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
router.post('/send-whatsapp-message', authMiddleware, sendWhatsAppMessage);

export default router;
