import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { enforceSgkTotalUploadLimit, sgkUpload } from '../utils/fileUpload';
import {
    getSgkRecords,
    createSgkRecord,
    updateSgkRecord,
    searchSgkRecords,
    getSgkFile,
    getSgkFileById,
    deleteSgkRecord,
    getPendingQrSgk,
    getPendingQrSgkFile,
    approvePendingQrSgk,
    rejectPendingQrSgk
} from '../controllers/sgkController';

const router = express.Router();

// Tüm rotalar authentication gerektirir
router.use(authMiddleware);

// Bekleyen QR Kayıtları rotaları
router.get('/pending-qr', getPendingQrSgk);
router.get('/pending-qr/:id/files/:fileId', getPendingQrSgkFile);
router.post('/pending-qr/:id/approve', approvePendingQrSgk);
router.post('/pending-qr/:id/reject', rejectPendingQrSgk);

const sgkUploadAny = sgkUpload.any();

// GET /api/sgk/records - Tüm SGK kayıtlarını getir
router.get('/records', getSgkRecords);

// POST /api/sgk/records - Yeni SGK belgesi yükle (multipart/form-data)
router.post('/records', sgkUploadAny, enforceSgkTotalUploadLimit, createSgkRecord);

// POST /api/sgk/records/search - TC ile kayıt ara
router.post('/records/search', searchSgkRecords);

// PUT /api/sgk/records/:id - SGK kaydını güncelle
router.put('/records/:id', sgkUploadAny, enforceSgkTotalUploadLimit, updateSgkRecord);

// GET /api/sgk/records/:id/file - PDF dosyasını getir
router.get('/records/:id/file', getSgkFile);

// GET /api/sgk/records/:id/files/:fileId - Belirli dosyayı getir
router.get('/records/:id/files/:fileId', getSgkFileById);

// DELETE /api/sgk/records/:id - SGK kaydını ve dosyasını sil
router.delete('/records/:id', deleteSgkRecord);

export default router;
