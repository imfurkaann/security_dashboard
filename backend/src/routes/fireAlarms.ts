import { Router } from 'express';
import {
    getFireAlarms,
    createFireAlarm,
    updateFireAlarm,
    resolveFireAlarm,
    undoResolveFireAlarm,
    deleteFireAlarm,
    restoreFireAlarm,
    sendFireAlarmWhatsAppMessage,
} from '../controllers/fireAlarmController';
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

// Çözümleme işlemini geri al
router.post('/records/:id/undo-resolve', undoResolveFireAlarm);

// Yangın alarm kaydını soft-delete yap
router.delete('/records/:id', deleteFireAlarm);

// Yangın alarm kaydını geri al
router.post('/records/:id/restore', restoreFireAlarm);

// WhatsApp mesajını otomatik gönder
router.post('/send-whatsapp-message', sendFireAlarmWhatsAppMessage);

export default router;
