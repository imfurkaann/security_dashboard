import { Router } from 'express';
import {
    createQrVisitorRecord,
    createQrSgkRecord,
    getQrVisitorFormToken
} from '../controllers/visitorPublicController';
import { enforceSgkTotalUploadLimit, sgkUpload } from '../utils/fileUpload';
import { qrPublicRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const sgkUploadAny = sgkUpload.any();

// Tüm halka açık QR rotalarına rate limiter uygula
router.use(qrPublicRateLimiter);

router.get('/form-token', getQrVisitorFormToken);
router.post('/records', createQrVisitorRecord);
router.post('/sgk-records', sgkUploadAny, enforceSgkTotalUploadLimit, createQrSgkRecord);

export default router;
