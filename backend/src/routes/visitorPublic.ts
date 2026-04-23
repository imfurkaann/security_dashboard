import { Router } from 'express';
import {
    createQrVisitorRecord,
    getQrVisitorFormToken
} from '../controllers/visitorPublicController';

const router = Router();

router.get('/form-token', getQrVisitorFormToken);
router.post('/records', createQrVisitorRecord);

export default router;
