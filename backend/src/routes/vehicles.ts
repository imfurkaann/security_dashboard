import { Router } from 'express';
import {
    getVehicles,
    getManagers,
    getVehicleRecords,
    createVehicleRecord,
    returnVehicle
} from '../controllers/vehicleController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all vehicles
router.get('/', getVehicles);

// Get all managers
router.get('/managers', getManagers);

// Get all vehicle records
router.get('/records', getVehicleRecords);

// Create new vehicle record
router.post('/records', createVehicleRecord);

// Return vehicle
router.post('/records/:id/return', returnVehicle);

export default router;
