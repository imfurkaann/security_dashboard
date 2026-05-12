import { Router } from 'express';
import { getIncidentRecords, createIncidentRecord, updateIncidentStatus, createShiftReport, getShiftReport, updateShiftReport, exportIncidentRecordsAsWord } from '../controllers/incidentController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Tüm istekler için authentication zorunlu
router.use(authMiddleware);

// Tüm rapor kayıtlarını getir
router.get('/records', getIncidentRecords);

// Raporları dışa aktar
router.post('/records/export', exportIncidentRecordsAsWord);

// Yeni rapor kaydı oluştur
router.post('/records', createIncidentRecord);

// Vardiya raporu oluştur
router.post('/reports', createShiftReport);

// Bugünkü vardiya raporunu getir (shift_label'a göre)
router.get('/reports/:shift_label', getShiftReport);

// Vardiya raporunu güncelle
router.put('/reports/:id', updateShiftReport);

// Olay durumunu güncelle
router.patch('/records/:id/status', updateIncidentStatus);

export default router;
