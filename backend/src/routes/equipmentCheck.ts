import { Router } from 'express';
import {
    submitEquipmentCheck,
    getEquipmentCheckStatus,
    equipmentCheckValidation,
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

export default router;
