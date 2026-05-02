import { Router } from 'express';
import {
    createQrVisitorRecord,
    createQrSgkRecord,
    getQrVisitorFormToken
} from '../controllers/visitorPublicController';
import { enforceSgkTotalUploadLimit, sgkUpload } from '../utils/fileUpload';

const router = Router();

const sgkUploadAny = sgkUpload.any();

router.get('/form-token', getQrVisitorFormToken);
router.post('/records', createQrVisitorRecord);
router.post('/sgk-records', sgkUploadAny, enforceSgkTotalUploadLimit, createQrSgkRecord);

export default router;
