import { Request, Response } from 'express';
import {
    getWhatsAppConnectionStatus,
    getWhatsAppQrPayload,
    listWhatsAppGroups,
    normalizeWhatsAppGroupJid,
    resetWhatsAppSession,
    restartWhatsAppConnection,
    setWhatsAppTargetJid,
} from '../services/whatsappBaileys';
import { persistWhatsAppTargetJid } from '../services/whatsappSettingsStore';
import { createAuditLog } from '../utils/auditLog';
import { getClientIp } from '../middleware/rateLimiter';

const preventSensitiveResponseCaching = (res: Response): void => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
};

const auditWhatsAppAdminAction = async (
    req: Request,
    action: string,
    oldValues: Record<string, unknown> | null,
    newValues: Record<string, unknown> | null
): Promise<void> => {
    await createAuditLog({
        tableName: 'whatsapp_admin',
        recordId: action,
        action: 'UPDATE',
        oldValues,
        newValues,
        performedBy: req.admin?.userId || null,
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') || null,
    });
};

export const getAdminWhatsAppStatus = async (_req: Request, res: Response): Promise<void> => {
    preventSensitiveResponseCaching(res);
    res.status(200).json({ success: true, data: getWhatsAppConnectionStatus() });
};

export const getAdminWhatsAppGroups = async (_req: Request, res: Response): Promise<void> => {
    preventSensitiveResponseCaching(res);
    try {
        const status = getWhatsAppConnectionStatus();
        if (!status.enabled) {
            res.status(400).json({
                success: false,
                message: 'WhatsApp entegrasyonu kapalı.',
            });
            return;
        }
        if (!status.connected) {
            res.status(409).json({
                success: false,
                message: 'WhatsApp henüz bağlı değil. QR kodunu okutun ve tekrar deneyin.',
                data: {
                    connectionState: status.connectionState,
                    lastQrAt: status.lastQrAt,
                    lastDisconnectReason: status.lastDisconnectReason,
                },
            });
            return;
        }

        const groups = await listWhatsAppGroups();
        res.status(200).json({ success: true, data: groups });
    } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        console.warn('WhatsApp grup listesi alınamadı.', {
            timeout: message.includes('timeout') || message.includes('zaman aşım'),
        });
        res.status(message.includes('timeout') || message.includes('zaman aşım') ? 409 : 500).json({
            success: false,
            message: message.includes('timeout') || message.includes('zaman aşım')
                ? 'WhatsApp grup listesi zaman aşımına uğradı. Bağlantıyı kontrol edip tekrar deneyin.'
                : 'WhatsApp grup listesi alınamadı. Bağlantıyı yenileyip tekrar deneyin.',
        });
    }
};

export const updateAdminWhatsAppTargetGroup = async (req: Request, res: Response): Promise<void> => {
    preventSensitiveResponseCaching(res);
    try {
        const targetJid = normalizeWhatsAppGroupJid(req.body?.targetJid);
        if (!targetJid) {
            res.status(400).json({ success: false, message: 'Geçerli bir WhatsApp grubu seçin.' });
            return;
        }

        const status = getWhatsAppConnectionStatus();
        if (!status.connected) {
            res.status(409).json({ success: false, message: 'Hedef grup seçmeden önce WhatsApp bağlantısını kurun.' });
            return;
        }

        const groups = await listWhatsAppGroups();
        if (!groups.some((group) => group.id === targetJid)) {
            res.status(400).json({
                success: false,
                message: 'Seçilen WhatsApp hesabı bu grubun üyesi değil. Grup listesini yenileyin.',
            });
            return;
        }

        const previousTargetJid = status.targetJid;
        await persistWhatsAppTargetJid(targetJid);
        setWhatsAppTargetJid(targetJid);
        await auditWhatsAppAdminAction(
            req,
            'target-group',
            { targetJid: previousTargetJid },
            { targetJid }
        );

        res.status(200).json({
            success: true,
            message: 'WhatsApp hedef grubu kaydedildi.',
            data: { targetJid },
        });
    } catch {
        res.status(500).json({ success: false, message: 'Hedef grup güvenli biçimde kaydedilemedi.' });
    }
};

export const reconnectAdminWhatsApp = async (req: Request, res: Response): Promise<void> => {
    preventSensitiveResponseCaching(res);
    try {
        const status = getWhatsAppConnectionStatus();
        if (!status.enabled) {
            res.status(400).json({ success: false, message: 'WhatsApp entegrasyonu kapalı.' });
            return;
        }

        await restartWhatsAppConnection();
        await auditWhatsAppAdminAction(
            req,
            'reconnect',
            { connectionState: status.connectionState },
            { requested: true }
        );
        res.status(200).json({
            success: true,
            message: 'WhatsApp bağlantısı güvenli biçimde yeniden başlatıldı.',
        });
    } catch {
        res.status(500).json({ success: false, message: 'WhatsApp bağlantısı yeniden başlatılamadı.' });
    }
};

export const resetAdminWhatsAppSession = async (req: Request, res: Response): Promise<void> => {
    preventSensitiveResponseCaching(res);
    try {
        const status = getWhatsAppConnectionStatus();
        if (!status.enabled) {
            res.status(400).json({ success: false, message: 'WhatsApp entegrasyonu kapalı.' });
            return;
        }

        await resetWhatsAppSession();
        await auditWhatsAppAdminAction(
            req,
            'reset-session',
            { connectionState: status.connectionState, hadTarget: Boolean(status.targetJid) },
            { sessionReset: true }
        );
        res.status(200).json({
            success: true,
            message: 'WhatsApp oturumu sıfırlandı. Yeni QR kodu yalnızca bu yönetici ekranında gösterilecektir.',
        });
    } catch {
        res.status(500).json({ success: false, message: 'WhatsApp oturumu sıfırlanamadı.' });
    }
};

export const getAdminWhatsAppQr = async (_req: Request, res: Response): Promise<void> => {
    preventSensitiveResponseCaching(res);
    try {
        const status = getWhatsAppConnectionStatus();
        if (!status.enabled) {
            res.status(400).json({
                success: false,
                message: 'WhatsApp entegrasyonu kapalı.',
                data: { connected: false, qr: null, lastQrAt: status.lastQrAt },
            });
            return;
        }
        if (status.connected) {
            res.status(200).json({
                success: true,
                data: { connected: true, qr: null, message: 'WhatsApp zaten bağlı.' },
            });
            return;
        }

        const qrPayload = getWhatsAppQrPayload();
        if (!qrPayload) {
            res.status(404).json({
                success: false,
                message: 'Güncel QR kodu henüz hazır değil. Birkaç saniye sonra tekrar deneyin.',
                data: {
                    connected: false,
                    qr: null,
                    connectionState: status.connectionState,
                    lastQrAt: status.lastQrAt,
                },
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: { connected: false, qr: qrPayload, lastQrAt: status.lastQrAt },
        });
    } catch {
        res.status(500).json({ success: false, message: 'WhatsApp QR bilgisi alınamadı.' });
    }
};
