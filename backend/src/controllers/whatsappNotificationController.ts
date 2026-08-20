import { Request, Response } from 'express';
import { getClientIp } from '../middleware/rateLimiter';
import { sendWhatsAppTextMessage } from '../services/whatsappBaileys';
import { consumeWhatsAppSendTicket } from '../services/whatsappSendTicketStore';
import { createAuditLog } from '../utils/auditLog';

export const sendWhatsAppNotification = async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    const ticket = consumeWhatsAppSendTicket(req.body?.token, userId);

    if (!ticket.success) {
        res.status(409).json({
            success: false,
            errorCode: 'WHATSAPP_SEND_TICKET_INVALID',
            message: 'Bildirim gönderme onayı geçersiz veya süresi dolmuş. Kaydı yenileyip tekrar deneyin.',
        });
        return;
    }

    try {
        const result = await sendWhatsAppTextMessage(ticket.message);
        await createAuditLog({
            tableName: 'whatsapp_notification',
            recordId: result.debugId || 'unknown',
            action: 'INSERT',
            oldValues: null,
            newValues: {
                success: result.success,
                errorCode: result.errorCode || null,
                durationMs: result.durationMs || null,
            },
            performedBy: userId || null,
            ipAddress: getClientIp(req),
            userAgent: req.get('user-agent') || null,
        });
        res.status(200).json(result);
    } catch {
        res.status(500).json({
            success: false,
            errorCode: 'WHATSAPP_SEND_FAILED',
            message: 'WhatsApp mesajı gönderilirken hata oluştu.',
        });
    }
};
