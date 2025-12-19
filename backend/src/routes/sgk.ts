import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { sgkUpload } from '../utils/fileUpload';
import {
    getSgkRecords,
    createSgkRecord,
    searchSgkRecords,
    getSgkFile,
    deleteSgkRecord
} from '../controllers/sgkController';

const router = express.Router();

// Tüm rotalar authentication gerektirir
router.use(authMiddleware);

// GET /api/sgk/records - Tüm SGK kayıtlarını getir
router.get('/records', getSgkRecords);

// POST /api/sgk/records - Yeni SGK belgesi yükle (multipart/form-data)
router.post('/records', sgkUpload.single('pdf_file'), createSgkRecord);

// POST /api/sgk/records/search - TC ile kayıt ara
router.post('/records/search', searchSgkRecords);

// GET /api/sgk/records/:id/file - PDF dosyasını getir
router.get('/records/:id/file', getSgkFile);

// DELETE /api/sgk/records/:id - SGK kaydını ve dosyasını sil
router.delete('/records/:id', deleteSgkRecord);

export default router;
