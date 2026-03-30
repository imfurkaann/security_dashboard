import { Router } from 'express';
import {
    getVehicles,
    getManagers,
    getVehicleRecords,
    createVehicleRecord,
    returnVehicle,
    updateVehicleRecord,
    deleteVehicleRecord,
    restoreVehicleRecord,
    createVehicle,
    updateVehicle,
    deleteVehicle
} from '../controllers/vehicleController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Get all vehicles
router.get('/', getVehicles);

// Create new vehicle
router.post('/', createVehicle);

// Update vehicle
router.put('/:id', updateVehicle);

// Delete vehicle
router.delete('/:id', deleteVehicle);

// Get all managers
router.get('/managers', getManagers);

// Get all vehicle records
router.get('/records', getVehicleRecords);

// Create new vehicle record
router.post('/records', createVehicleRecord);

// Update vehicle record
router.put('/records/:id', updateVehicleRecord);

// Return vehicle
router.post('/records/:id/return', returnVehicle);

// Soft delete vehicle record
router.delete('/records/:id', deleteVehicleRecord);

// Restore soft deleted vehicle record
router.post('/records/:id/restore', restoreVehicleRecord);

export default router;
