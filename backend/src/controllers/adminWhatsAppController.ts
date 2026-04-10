import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import {
    getWhatsAppConnectionStatus,
    listWhatsAppGroups,
    getWhatsAppQrPayload,
    resetWhatsAppSession,
    restartWhatsAppConnection,
    setWhatsAppTargetJid,
} from '../services/whatsappBaileys';
import { persistWhatsAppTargetJid } from '../services/whatsappSettingsStore';

const ENV_FILE_NAME = '.env';
const TARGET_KEY = 'WHATSAPP_TARGET_GROUP_JID';

const getEnvFilePath = (): string => path.resolve(process.cwd(), ENV_FILE_NAME);

const isValidGroupJid = (jid: string): boolean => {
    return /^\d+-\d+@g\.us$/.test(jid.trim()) || /^\d+@g\.us$/.test(jid.trim());
};

const upsertEnvVariable = (key: string, value: string): void => {
    const envPath = getEnvFilePath();
    const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const lines = existing.length > 0 ? existing.split(/\r?\n/) : [];

    let found = false;
    const updated = lines.map((line) => {
        if (line.startsWith(`${key}=`)) {
            found = true;
            return `${key}=${value}`;
        }
        return line;
    });

    if (!found) {
        updated.push(`${key}=${value}`);
    }

    const normalized = `${updated.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
    fs.writeFileSync(envPath, normalized, 'utf8');
};

export const getAdminWhatsAppStatus = async (_req: Request, res: Response): Promise<void> => {
    try {
        const status = getWhatsAppConnectionStatus();
        res.status(200).json({ success: true, data: status });
    } catch (error) {
        console.error('Get admin WhatsApp status error:', error);
        res.status(500).json({ success: false, message: 'WhatsApp durumu alınamadı.' });
    }
};

export const getAdminWhatsAppGroups = async (_req: Request, res: Response): Promise<void> => {
    try {
        const status = getWhatsAppConnectionStatus();
        if (!status.enabled) {
            res.status(400).json({
                success: false,
                message: 'WhatsApp entegrasyonu kapalı. Önce WHATSAPP_ENABLED=true yapın.',
            });
            return;
        }

        if (!status.connected) {
            res.status(409).json({
                success: false,
                message: 'WhatsApp henüz bağlı değil. Lütfen backend terminalindeki QR kodunu okutun ve tekrar deneyin.',
                data: {
                    connected: status.connected,
                    lastQrAt: status.lastQrAt,
                    lastDisconnectReason: status.lastDisconnectReason,
                },
            });
            return;
        }

        const groups = await listWhatsAppGroups();
        res.status(200).json({ success: true, data: groups });
    } catch (error) {
        console.error('Get admin WhatsApp groups error:', error);
        const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
        if (message.toLowerCase().includes('timeout')) {
            res.status(409).json({
                success: false,
                message: 'WhatsApp bağlantısı zaman aşımına uğradı. QR kodunu okutun ve tekrar deneyin.',
            });
            return;
        }

        res.status(500).json({ success: false, message: 'WhatsApp grup listesi alınamadı. Bağlantıyı yenileyip tekrar deneyin.' });
    }
};

export const updateAdminWhatsAppTargetGroup = async (req: Request, res: Response): Promise<void> => {
    try {
        const rawJid = String(req.body?.targetJid || '').trim();

        if (!rawJid) {
            res.status(400).json({ success: false, message: 'Grup kimliği zorunludur.' });
            return;
        }

        if (!isValidGroupJid(rawJid)) {
            res.status(400).json({ success: false, message: 'Geçerli bir grup JID giriniz. Örnek: 1203...@g.us' });
            return;
        }

        await persistWhatsAppTargetJid(rawJid);
        setWhatsAppTargetJid(rawJid);

        // Docker ortamında .env yazma her zaman mümkün olmayabilir; başarısızlık ana akışı bozmasın.
        try {
            process.env[TARGET_KEY] = rawJid;
            upsertEnvVariable(TARGET_KEY, rawJid);
        } catch (envError) {
            console.warn('WhatsApp hedef grubu .env dosyasına yazılamadı, DB kaydı kullanılacak:', envError);
        }

        res.status(200).json({
            success: true,
            message: 'WhatsApp hedef grubu kaydedildi.',
            data: { targetJid: rawJid },
        });
    } catch (error) {
        console.error('Update admin WhatsApp target group error:', error);
        res.status(500).json({ success: false, message: 'Hedef grup kaydedilemedi.' });
    }
};

export const reconnectAdminWhatsApp = async (_req: Request, res: Response): Promise<void> => {
    try {
        const status = getWhatsAppConnectionStatus();
        if (!status.enabled) {
            res.status(400).json({
                success: false,
                message: 'WhatsApp entegrasyonu kapalı. Docker ortaminda WHATSAPP_ENABLED=true yapip backend servisini yeniden baslatin.',
            });
            return;
        }

        restartWhatsAppConnection();
        res.status(200).json({
            success: true,
            message: 'WhatsApp bağlantısı yeniden başlatıldı. Gerekirse QR kodunu tekrar okutun.',
        });
    } catch (error) {
        console.error('Reconnect admin WhatsApp error:', error);
        res.status(500).json({ success: false, message: 'WhatsApp yeniden başlatılamadı.' });
    }
};

export const resetAdminWhatsAppSession = async (_req: Request, res: Response): Promise<void> => {
    try {
        const status = getWhatsAppConnectionStatus();
        if (!status.enabled) {
            res.status(400).json({
                success: false,
                message: 'WhatsApp entegrasyonu kapalı. Docker ortaminda WHATSAPP_ENABLED=true yapip backend servisini yeniden baslatin.',
            });
            return;
        }

        resetWhatsAppSession();
        res.status(200).json({
            success: true,
            message: 'WhatsApp oturumu sıfırlandı. Yeni QR kodu backend terminalinde görünecek.',
        });
    } catch (error) {
        console.error('Reset admin WhatsApp session error:', error);
        res.status(500).json({ success: false, message: 'WhatsApp oturumu sıfırlanamadı.' });
    }
};

export const getAdminWhatsAppQr = async (_req: Request, res: Response): Promise<void> => {
    try {
        const status = getWhatsAppConnectionStatus();
        if (!status.enabled) {
            res.status(400).json({
                success: false,
                message: 'WhatsApp entegrasyonu kapalı. Docker ortaminda WHATSAPP_ENABLED=true yapip backend servisini yeniden baslatin.',
                data: {
                    connected: false,
                    qr: null,
                    lastQrAt: status.lastQrAt,
                },
            });
            return;
        }

        const qrPayload = getWhatsAppQrPayload();

        if (status.connected) {
            res.status(200).json({
                success: true,
                data: {
                    connected: true,
                    qr: null,
                    message: 'WhatsApp zaten bağlı. QR gerekmiyor.',
                },
            });
            return;
        }

        if (!qrPayload) {
            res.status(404).json({
                success: false,
                message: 'Henüz QR hazır değil. Birkaç saniye sonra tekrar deneyin.',
                data: {
                    connected: false,
                    qr: null,
                    lastQrAt: status.lastQrAt,
                },
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                connected: false,
                qr: qrPayload,
                lastQrAt: status.lastQrAt,
            },
        });
    } catch (error) {
        console.error('Get admin WhatsApp QR error:', error);
        res.status(500).json({
            success: false,
            message: 'WhatsApp QR bilgisi alınamadı.',
        });
    }
};
