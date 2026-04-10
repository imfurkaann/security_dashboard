import { Router } from 'express';
import {
    adminLogin,
    adminLogout,
    getCurrentAdmin,
    adminLoginValidation,
} from '../controllers/adminAuthController';
import {
    getAdminEquipmentConfig,
    createEquipmentGate,
    updateEquipmentGate,
    deleteEquipmentGate,
    addGateEquipment,
    updateGateEquipment,
    deleteGateEquipment,
} from '../controllers/equipmentController';
import {
    getAdminWhatsAppGroups,
    getAdminWhatsAppQr,
    getAdminWhatsAppStatus,
    reconnectAdminWhatsApp,
    resetAdminWhatsAppSession,
    updateAdminWhatsAppTargetGroup,
} from '../controllers/adminWhatsAppController';
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

/**
 * @route   GET /api/admin/equipment-config
 * @desc    Get all gate/equipment configs for admin management
 * @access  Private (Admin only)
 */
router.get('/equipment-config', adminAuthMiddleware, getAdminEquipmentConfig);

/**
 * @route   POST /api/admin/equipment-config/gates
 * @desc    Create gate with optional initial equipments
 * @access  Private (Admin only)
 */
router.post('/equipment-config/gates', adminAuthMiddleware, createEquipmentGate);

/**
 * @route   PUT /api/admin/equipment-config/gates/:gateId
 * @desc    Update gate details / active status
 * @access  Private (Admin only)
 */
router.put('/equipment-config/gates/:gateId', adminAuthMiddleware, updateEquipmentGate);

/**
 * @route   DELETE /api/admin/equipment-config/gates/:gateId
 * @desc    Delete gate and its equipment list
 * @access  Private (Admin only)
 */
router.delete('/equipment-config/gates/:gateId', adminAuthMiddleware, deleteEquipmentGate);

/**
 * @route   POST /api/admin/equipment-config/gates/:gateId/equipments
 * @desc    Add equipment to a gate
 * @access  Private (Admin only)
 */
router.post('/equipment-config/gates/:gateId/equipments', adminAuthMiddleware, addGateEquipment);

/**
 * @route   PUT /api/admin/equipment-config/equipments/:equipmentId
 * @desc    Update equipment name / active status
 * @access  Private (Admin only)
 */
router.put('/equipment-config/equipments/:equipmentId', adminAuthMiddleware, updateGateEquipment);

/**
 * @route   DELETE /api/admin/equipment-config/equipments/:equipmentId
 * @desc    Delete equipment row
 * @access  Private (Admin only)
 */
router.delete('/equipment-config/equipments/:equipmentId', adminAuthMiddleware, deleteGateEquipment);

/**
 * @route   GET /api/admin/whatsapp/status
 * @desc    Get WhatsApp connection and config status
 * @access  Private (Admin only)
 */
router.get('/whatsapp/status', adminAuthMiddleware, getAdminWhatsAppStatus);

/**
 * @route   GET /api/admin/whatsapp/groups
 * @desc    List joined WhatsApp groups
 * @access  Private (Admin only)
 */
router.get('/whatsapp/groups', adminAuthMiddleware, getAdminWhatsAppGroups);

/**
 * @route   GET /api/admin/whatsapp/qr
 * @desc    Get current WhatsApp QR payload for admin panel display
 * @access  Private (Admin only)
 */
router.get('/whatsapp/qr', adminAuthMiddleware, getAdminWhatsAppQr);

/**
 * @route   POST /api/admin/whatsapp/target-group
 * @desc    Save WhatsApp target group JID
 * @access  Private (Admin only)
 */
router.post('/whatsapp/target-group', adminAuthMiddleware, updateAdminWhatsAppTargetGroup);

/**
 * @route   POST /api/admin/whatsapp/reconnect
 * @desc    Restart WhatsApp connection and regenerate QR if needed
 * @access  Private (Admin only)
 */
router.post('/whatsapp/reconnect', adminAuthMiddleware, reconnectAdminWhatsApp);

/**
 * @route   POST /api/admin/whatsapp/reset-session
 * @desc    Clear Baileys auth state and force new QR login
 * @access  Private (Admin only)
 */
router.post('/whatsapp/reset-session', adminAuthMiddleware, resetAdminWhatsAppSession);

export default router;
