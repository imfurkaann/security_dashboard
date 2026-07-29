import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { uploadGuestExcelFile } from '../utils/guestExcelUpload';
import { getGuestRecords, uploadGuestExcel } from '../controllers/guestRegistryController';

const router = Router();

router.use(authMiddleware);

router.get('/records', getGuestRecords);
router.post('/upload', uploadGuestExcelFile, uploadGuestExcel);

export default router;
