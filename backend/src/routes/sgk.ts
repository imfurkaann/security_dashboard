import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { sgkUpload } from '../utils/fileUpload';
import {
    getSgkRecords,
    createSgkRecord,
    updateSgkRecord,
    searchSgkRecords,
    getSgkFile,
    getSgkFileById,
    deleteSgkRecord
} from '../controllers/sgkController';

const router = express.Router();

// Tüm rotalar authentication gerektirir
router.use(authMiddleware);

const sgkUploadFields = sgkUpload.fields([
    { name: 'pdf_files', maxCount: 10 },
    { name: 'pdf_file', maxCount: 1 }
]);

// GET /api/sgk/records - Tüm SGK kayıtlarını getir
router.get('/records', getSgkRecords);

// POST /api/sgk/records - Yeni SGK belgesi yükle (multipart/form-data)
router.post('/records', sgkUploadFields, createSgkRecord);

// POST /api/sgk/records/search - TC ile kayıt ara
router.post('/records/search', searchSgkRecords);

// PUT /api/sgk/records/:id - SGK kaydını güncelle
router.put('/records/:id', sgkUploadFields, updateSgkRecord);

// GET /api/sgk/records/:id/file - PDF dosyasını getir
router.get('/records/:id/file', getSgkFile);

// GET /api/sgk/records/:id/files/:fileId - Belirli dosyayı getir
router.get('/records/:id/files/:fileId', getSgkFileById);

// DELETE /api/sgk/records/:id - SGK kaydını ve dosyasını sil
router.delete('/records/:id', deleteSgkRecord);

export default router;
