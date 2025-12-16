import { Router } from 'express';
import { getFireAlarms, createFireAlarm, updateFireAlarm, resolveFireAlarm } from '../controllers/fireAlarmController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Tüm istekler için authentication zorunlu
router.use(authMiddleware);

// Tüm yangın alarm kayıtlarını getir
router.get('/records', getFireAlarms);

// Yeni yangın alarm kaydı oluştur
router.post('/records', createFireAlarm);

// Yangın alarm kaydını güncelle
router.put('/records/:id', updateFireAlarm);

// Yangın alarmını çözümle
router.post('/records/:id/resolve', resolveFireAlarm);

export default router;
