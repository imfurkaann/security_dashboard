import { Router } from 'express';
import {
    getGeneralStats,
    getVisitorTrends,
    getVehicleStats,
    getManagerStats,
    getFireAlarmStats,
    getIncidentStats,
    getComparativeAnalysis,
    getPersonnelPerformanceStats
} from '../controllers/statisticsController';
import { adminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();

// Tüm istatistik route'ları auth gerektirir
router.use(adminAuthMiddleware);

// Genel istatistikler
router.get('/general', getGeneralStats);

// Ziyaretçi trendleri
router.get('/visitors', getVisitorTrends);

// Araç istatistikleri
router.get('/vehicles', getVehicleStats);

// Yönetici istatistikleri
router.get('/managers', getManagerStats);

// Yangın alarmı istatistikleri
router.get('/fire-alarms', getFireAlarmStats);

// Olay istatistikleri
router.get('/incidents', getIncidentStats);

// Karşılaştırmalı analiz
router.get('/comparison', getComparativeAnalysis);

// Personel kayıt performansı
router.get('/personnel-performance', getPersonnelPerformanceStats);

export default router;
