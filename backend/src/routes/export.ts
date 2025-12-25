import { Router } from 'express';
import { getExportPreview, generateExport } from '../controllers/exportController';
import { adminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Tüm export route'ları admin yetkisi gerektirir
router.use(adminAuthMiddleware);

// Önizleme - kayıt sayılarını getir
router.get('/preview', getExportPreview);

// Export oluştur ve indir
router.post('/generate', generateExport);

export default router;
