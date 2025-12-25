import express from 'express';
import { getAllPersonnel, createPersonnel, updatePersonnel, deletePersonnel } from '../controllers/personnelController';
import { adminAuthMiddleware } from '../middleware/adminAuth';

const router = express.Router();

// All routes require admin authentication
router.get('/', adminAuthMiddleware, getAllPersonnel);
router.post('/', adminAuthMiddleware, createPersonnel);
router.put('/:id', adminAuthMiddleware, updatePersonnel);
router.delete('/:id', adminAuthMiddleware, deletePersonnel);

export default router;
