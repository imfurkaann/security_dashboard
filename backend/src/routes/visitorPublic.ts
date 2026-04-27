import { Router } from 'express';
import {
    createQrVisitorRecord,
    createQrSgkRecord,
    getQrVisitorFormToken
} from '../controllers/visitorPublicController';
import { sgkUpload } from '../utils/fileUpload';

const router = Router();

const sgkUploadFields = sgkUpload.fields([
    { name: 'pdf_files', maxCount: 10 },
    { name: 'pdf_file', maxCount: 1 }
]);

router.get('/form-token', getQrVisitorFormToken);
router.post('/records', createQrVisitorRecord);
router.post('/sgk-records', sgkUploadFields, createQrSgkRecord);

export default router;
