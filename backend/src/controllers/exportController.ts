import { Request, Response } from 'express';
import { getRecordCounts, generateExportZip } from '../services/exportService';
import { getClientIp } from '../middleware/rateLimiter';

// Kayıt sayılarını getir (önizleme için)
export const getExportPreview = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Başlangıç ve bitiş tarihleri gereklidir'
            });
        }

        // Tarih validasyonu
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Geçersiz tarih formatı'
            });
        }

        if (start > end) {
            return res.status(400).json({
                success: false,
                message: 'Başlangıç tarihi bitiş tarihinden büyük olamaz'
            });
        }

        // Maksimum 90 gün kontrolü
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 90) {
            return res.status(400).json({
                success: false,
                message: 'En fazla 90 günlük veri indirilebilir'
            });
        }

        const counts = await getRecordCounts(startDate as string, endDate as string);

        return res.json({
            success: true,
            data: {
                counts,
                totalDays: diffDays + 1,
                totalRecords: Object.values(counts).reduce((a, b) => a + b, 0)
            }
        });

    } catch (error) {
        console.error('Export preview error:', error);
        return res.status(500).json({
            success: false,
            message: 'Önizleme oluşturulurken bir hata oluştu'
        });
    }
};

// Excel export dosyası oluştur ve indir
export const generateExport = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, reports } = req.body;

        // Validasyonlar
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Başlangıç ve bitiş tarihleri gereklidir'
            });
        }

        if (!reports || typeof reports !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'En az bir rapor türü seçilmelidir'
            });
        }

        // En az bir rapor seçilmiş mi kontrol et
        const hasSelectedReport = Object.values(reports).some(v => v === true);
        if (!hasSelectedReport) {
            return res.status(400).json({
                success: false,
                message: 'En az bir rapor türü seçilmelidir'
            });
        }

        // Tarih validasyonu
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Geçersiz tarih formatı'
            });
        }

        if (start > end) {
            return res.status(400).json({
                success: false,
                message: 'Başlangıç tarihi bitiş tarihinden büyük olamaz'
            });
        }

        // Maksimum 90 gün kontrolü
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 90) {
            return res.status(400).json({
                success: false,
                message: 'En fazla 90 günlük veri indirilebilir'
            });
        }

        // Admin bilgileri
        const adminUser = (req as any).user;
        const adminId = adminUser?.userId || 'unknown';
        const adminName = adminUser?.fullName || adminUser?.username || 'Admin';
        const ipAddress = getClientIp(req);

        // Export oluştur
        await generateExportZip(
            res,
            {
                startDate,
                endDate,
                reports: {
                    managers: reports.managers || false,
                    vehicles: reports.vehicles || false,
                    visitors: reports.visitors || false,
                    fireAlarms: reports.fireAlarms || false,
                    incidents: reports.incidents || false
                }
            },
            adminId,
            adminName,
            ipAddress
        );

    } catch (error) {
        console.error('Export generation error:', error);

        // Eğer response henüz gönderilmediyse hata döndür
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'Dışa aktarma oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.'
            });
        }
    }
};
