import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { guestExcelUpload } from '../utils/guestExcelUpload';
import { getGuestRecords, uploadGuestExcel } from '../controllers/guestRegistryController';

const router = Router();

router.use(authMiddleware);

router.get('/records', getGuestRecords);
router.post('/upload', guestExcelUpload.single('file'), uploadGuestExcel);

export default router;
