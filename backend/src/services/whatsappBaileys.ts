import path from 'path';
import fs from 'fs';
import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
const qrcode = require('qrcode-terminal');

type WhatsAppSendResult = {
    success: boolean;
    messageId?: string;
    reason?: string;
    errorCode?: string;
    debugId?: string;
    manualFallbackSuggested?: boolean;
    durationMs?: number;
};

type WhatsAppConnectionStatus = {
    enabled: boolean;
    connected: boolean;
    lastQrAt: string | null;
    targetJid: string | null;
    lastDisconnectReason: string | null;
};

export type WhatsAppGroupInfo = {
    id: string;
    name: string;
};

let socket: WASocket | null = null;
let connectingPromise: Promise<WASocket> | null = null;
let warmupPromise: Promise<WASocket> | null = null;
let lastQrAt: string | null = null;
let lastQrPayload: string | null = null;
let isSocketOpen = false;
let reconnectAttempts = 0;
let lastDisconnectReason: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let configuredTargetJid: string | null = process.env.WHATSAPP_TARGET_GROUP_JID || process.env.WHATSAPP_TARGET_JID || null;

const CONNECTION_TIMEOUT_MS = Number(process.env.WHATSAPP_CONNECT_TIMEOUT_MS || 30000);
const SEND_CONNECT_TIMEOUT_MS = Number(process.env.WHATSAPP_SEND_CONNECT_TIMEOUT_MS || 8000);
const SEND_MESSAGE_TIMEOUT_MS = Number(process.env.WHATSAPP_SEND_MESSAGE_TIMEOUT_MS || 8000);
const MAX_RECONNECT_ATTEMPTS = 5;

const createDebugId = (): string => {
    return `wa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        promise
            .then((value) => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(timer);
                reject(error);
            });
    });
};

const classifySendError = (error: unknown): { errorCode: string; reason: string; recoverable: boolean } => {
    const message = error instanceof Error ? error.message : String(error || 'Bilinmeyen hata');
    const normalized = message.toLowerCase();

    if (normalized.includes('timeout')) {
        return {
            errorCode: 'WHATSAPP_TIMEOUT',
            reason: 'WhatsApp mesaj gönderimi zaman aşımına uğradı.',
            recoverable: true,
        };
    }

    if (
        normalized.includes('connection closed')
        || normalized.includes('connection was lost')
        || normalized.includes('connection terminated')
        || normalized.includes('socket closed')
    ) {
        return {
            errorCode: 'WHATSAPP_CONNECTION_CLOSED',
            reason: 'WhatsApp bağlantısı mesaj gönderimi sırasında koptu.',
            recoverable: true,
        };
    }

    if (normalized.includes('not connected') || normalized.includes('not open')) {
        return {
            errorCode: 'WHATSAPP_NOT_CONNECTED',
            reason: 'WhatsApp bağlı değil. Lütfen QR kodunu okutun.',
            recoverable: true,
        };
    }

    return {
        errorCode: 'WHATSAPP_SEND_FAILED',
        reason: message,
        recoverable: false,
    };
};

const scheduleWarmupReconnect = (delayMs: number): void => {
    if (reconnectTimer) {
        return;
    }

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        warmupWhatsAppConnection();
    }, delayMs);
};

const getTargetJid = (): string | null => {
    return configuredTargetJid || process.env.WHATSAPP_TARGET_GROUP_JID || process.env.WHATSAPP_TARGET_JID || null;
};

export const setWhatsAppTargetJid = (jid: string | null): void => {
    const normalized = jid?.trim() || null;
    configuredTargetJid = normalized;

    if (normalized) {
        process.env.WHATSAPP_TARGET_GROUP_JID = normalized;
    }
};

export const isWhatsAppAutoSendEnabled = (): boolean => {
    return process.env.WHATSAPP_ENABLED === 'true';
};

const getSessionPath = (): string => {
    const relativePath = process.env.WHATSAPP_SESSION_PATH || '.baileys_auth';
    return path.resolve(process.cwd(), relativePath);
};

const clearSessionFiles = (): void => {
    const sessionPath = getSessionPath();
    if (!fs.existsSync(sessionPath)) {
        return;
    }

    const files = fs.readdirSync(sessionPath);
    for (const file of files) {
        fs.rmSync(path.join(sessionPath, file), { force: true });
    }
};

const resetConnectionState = (): void => {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    try {
        (socket as unknown as { end?: (error?: Error) => void } | null)?.end?.(new Error('WhatsApp bağlantısı yönetici tarafından yenilendi'));
    } catch {
        // ignore socket shutdown errors
    }

    socket = null;
    connectingPromise = null;
    warmupPromise = null;
    isSocketOpen = false;
    reconnectAttempts = 0;
};

const waitForSocketOpen = async (waSocket: WASocket, timeoutMs: number): Promise<void> => {
    if (isSocketOpen) {
        return;
    }

    return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            waSocket.ev.off('connection.update', handleUpdate);
            reject(new Error('WhatsApp connection timeout. Please scan QR code.'));
        }, timeoutMs);

        const handleUpdate = (update: { connection?: string }) => {
            if (update.connection === 'open') {
                clearTimeout(timeout);
                waSocket.ev.off('connection.update', handleUpdate);
                isSocketOpen = true;
                console.log('✅ WhatsApp connection established');
                resolve();
            }
        };

        waSocket.ev.on('connection.update', handleUpdate);
    });
};

const createConnection = async (): Promise<WASocket> => {
    const sessionPath = getSessionPath();
    fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const waSocket = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: process.env.WHATSAPP_LOG_LEVEL || 'silent' }),
        browser: ['Security Dashboard', 'Chrome', '1.0.0'],
    });

    waSocket.ev.on('creds.update', saveCreds);
    waSocket.ev.on('connection.update', (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            lastQrAt = new Date().toISOString();
            lastQrPayload = qr;
            console.log('WhatsApp QR hazır. Terminalde görünen QR kodunu WhatsApp uygulaması ile tarayın.');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            isSocketOpen = true;
            lastQrPayload = null;
            console.log('WhatsApp bağlantısı açıldı.');
            return;
        }

        if (connection === 'close') {
            isSocketOpen = false;
            const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;

            lastDisconnectReason = statusCode === DisconnectReason.connectionReplaced
                ? 'connectionReplaced'
                : statusCode === DisconnectReason.restartRequired
                    ? 'restartRequired'
                    : statusCode === DisconnectReason.loggedOut
                        ? 'loggedOut'
                        : statusCode === DisconnectReason.unavailableService
                            ? 'unavailableService'
                            : 'other';

            console.warn(`🔴 WhatsApp bağlantısı kapandı (${lastDisconnectReason}):`, {
                statusCode,
                reconnectAttempts,
            });

            // Socket'i temizle - bu artık kullanılamaz
            socket = null;
            connectingPromise = null;
            warmupPromise = null;

            if (statusCode === DisconnectReason.connectionReplaced) {
                // 440: Aynı hesap başka bir oturum tarafından ele alındı.
                // Bu durumda otomatik reconnect döngüye girebilir; manuel bağlantı tercih edilir.
                reconnectAttempts = 0;
                console.warn('⚠️ WhatsApp: Bağlantı başka bir oturum tarafından değiştirildi (440). Otomatik reconnect durduruldu.');
            } else if (statusCode === DisconnectReason.restartRequired) {
                // 515: Socket restart gerekli, kontrollü reconnect yap.
                reconnectAttempts++;

                if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    console.error(
                        `❌ WhatsApp: ${MAX_RECONNECT_ATTEMPTS} reconnect denemesinden sonra başarısız. ` +
                        'Auth session corrupted - manuel QR eşleştirmesi gerekli.'
                    );
                    reconnectAttempts = 0;

                    // Auth session'ı temizle - taze başla
                    const sessionPath = getSessionPath();
                    try {
                        if (fs.existsSync(sessionPath)) {
                            const files = fs.readdirSync(sessionPath);
                            for (const file of files) {
                                fs.rmSync(`${sessionPath}/${file}`, { force: true });
                            }
                        }
                        console.log(`✅ Auth session files cleaned: ${sessionPath}`);
                    } catch (e) {
                        console.error('Error cleaning auth session:', e);
                    }

                    // Yeni QR generatesi için warmup başlat (1 saniye sonra)
                    scheduleWarmupReconnect(1000);
                } else {
                    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
                    console.log(`🔄 Reconnecting... (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms`);

                    scheduleWarmupReconnect(delay);
                }
            } else if (statusCode === DisconnectReason.loggedOut) {
                // 401: User logged out - clean auth state, require new QR
                console.warn('⚠️ WhatsApp: User logged out. Cleaning auth state.');
                reconnectAttempts = 0;

                const sessionPath = getSessionPath();
                try {
                    if (fs.existsSync(sessionPath)) {
                        const files = fs.readdirSync(sessionPath);
                        for (const file of files) {
                            fs.rmSync(`${sessionPath}/${file}`, { force: true });
                        }
                    }
                    console.log(`✅ Auth session files cleaned after logout: ${sessionPath}`);
                } catch (e) {
                    console.error('Error cleaning auth session:', e);
                }

                // QR oluşturmak için başlat
                scheduleWarmupReconnect(500);
            } else if (statusCode === DisconnectReason.unavailableService) {
                // 503: Servis geçici olarak kullanılamıyor, geri basınçla dene.
                reconnectAttempts = Math.min(reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS);
                const delay = Math.min(2000 * Math.pow(2, reconnectAttempts - 1), 60000);
                console.warn(`⚠️ WhatsApp service unavailable (503). ${delay}ms sonra tekrar denenecek.`);
                scheduleWarmupReconnect(delay);
            } else {
                // Diğer disconnect sebepleri - normal reconnect
                console.log('ℹ️ WhatsApp: Other disconnect reason, retrying connection...');
                reconnectAttempts = 0;
                scheduleWarmupReconnect(500);
            }
        }
    });

    return waSocket;
};

const ensureConnection = async (timeoutMs: number = CONNECTION_TIMEOUT_MS): Promise<WASocket> => {
    // Socket mevcutsa ve açıksa, return et
    if (socket && isSocketOpen) {
        return socket;
    }

    // connectingPromise mevcutsa, bekle
    if (connectingPromise) {
        return withTimeout(connectingPromise, timeoutMs, 'WhatsApp bağlantısı zaman aşımına uğradı.');
    }

    // Yeni connection oluştur
    connectingPromise = (async () => {
        try {
            const createdSocket = await createConnection();
            socket = createdSocket;
            await waitForSocketOpen(createdSocket, CONNECTION_TIMEOUT_MS);
            return createdSocket;
        } finally {
            connectingPromise = null;
        }
    })();

    return withTimeout(connectingPromise, timeoutMs, 'WhatsApp bağlantısı zaman aşımına uğradı.');
};

export const getWhatsAppConnectionStatus = (): WhatsAppConnectionStatus => ({
    enabled: isWhatsAppAutoSendEnabled(),
    connected: isSocketOpen,
    lastQrAt,
    targetJid: getTargetJid(),
    lastDisconnectReason,
});

export const sendWhatsAppTextMessage = async (text: string): Promise<WhatsAppSendResult> => {
    const debugId = createDebugId();
    const startedAt = Date.now();

    if (!isWhatsAppAutoSendEnabled()) {
        return {
            success: false,
            reason: 'WHATSAPP_ENABLED=false',
            errorCode: 'WHATSAPP_DISABLED',
            debugId,
            manualFallbackSuggested: true,
            durationMs: Date.now() - startedAt,
        };
    }

    const targetJid = getTargetJid();
    if (!targetJid) {
        return {
            success: false,
            reason: 'WHATSAPP_TARGET_GROUP_JID veya WHATSAPP_TARGET_JID tanımlı değil',
            errorCode: 'WHATSAPP_TARGET_MISSING',
            debugId,
            manualFallbackSuggested: true,
            durationMs: Date.now() - startedAt,
        };
    }

    // Normalize text and ensure emoji presentation for ambiguous symbols
    const normalizeTextForWhatsApp = (input: string): string => {
        if (!input) return input;

        // Normalize Unicode to NFC to avoid split codepoints
        let out = input.normalize('NFC');

        // Some characters (in Misc Symbols / Dingbats ranges) may be rendered
        // as text by some clients unless followed by Variation Selector-16 (FE0F).
        // Force FE0F where missing for those ranges to improve rendering consistency.
        out = out.replace(/([\u2600-\u26FF\u2700-\u27BF])(?!\uFE0F)/g, '$1\uFE0F');

        return out;
    };

    const sendOnce = async (): Promise<WhatsAppSendResult> => {
        const waSocket = await ensureConnection(SEND_CONNECT_TIMEOUT_MS);
        const preparedText = normalizeTextForWhatsApp(text);
        const result = await withTimeout(
            waSocket.sendMessage(targetJid, { text: preparedText }),
            SEND_MESSAGE_TIMEOUT_MS,
            'WhatsApp mesaj gönderimi timeout oldu.'
        );
        return {
            success: true,
            messageId: result?.key?.id ?? undefined,
            debugId,
            durationMs: Date.now() - startedAt,
        };
    };

    try {
        return await sendOnce();
    } catch (error) {
        const classified = classifySendError(error);
        if (classified.recoverable) {
            console.warn('WhatsApp send: bağlantı gönderim anında kapandı, yeniden bağlanıp tekrar deneniyor...');
            try {
                restartWhatsAppConnection();
                return await sendOnce();
            } catch (retryError) {
                const retryClassified = classifySendError(retryError);
                console.error('[WhatsAppSendFail][Retry]', {
                    debugId,
                    errorCode: retryClassified.errorCode,
                    reason: retryClassified.reason,
                    durationMs: Date.now() - startedAt,
                    targetJid,
                    isSocketOpen,
                    lastDisconnectReason,
                });
                return {
                    success: false,
                    reason: retryClassified.reason,
                    errorCode: retryClassified.errorCode,
                    debugId,
                    manualFallbackSuggested: true,
                    durationMs: Date.now() - startedAt,
                };
            }
        }

        console.error('[WhatsAppSendFail]', {
            debugId,
            errorCode: classified.errorCode,
            reason: classified.reason,
            durationMs: Date.now() - startedAt,
            targetJid,
            isSocketOpen,
            lastDisconnectReason,
        });

        return {
            success: false,
            reason: classified.reason,
            errorCode: classified.errorCode,
            debugId,
            manualFallbackSuggested: true,
            durationMs: Date.now() - startedAt,
        };
    }
};

export const warmupWhatsAppConnection = (): void => {
    if (!isWhatsAppAutoSendEnabled()) {
        return;
    }

    // Already connecting or connected, skip
    if (socket || connectingPromise || warmupPromise) {
        return;
    }

    console.log('🚀 WhatsApp warmup: Starting background connection...');

    warmupPromise = createConnection()
        .then((createdSocket) => {
            socket = createdSocket;
            console.log('✅ WhatsApp warmup: Socket created, waiting for open...');
            return createdSocket;
        })
        .catch((error) => {
            console.warn('⚠️ WhatsApp warmup failed:', error instanceof Error ? error.message : error);
            warmupPromise = null;
            throw error;
        });
};

export const listWhatsAppGroups = async (): Promise<WhatsAppGroupInfo[]> => {
    const waSocket = await ensureConnection();
    const groups = await waSocket.groupFetchAllParticipating();

    return Object.values(groups)
        .map(group => ({
            id: group.id,
            name: group.subject || group.id,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
};

export const restartWhatsAppConnection = (): void => {
    resetConnectionState();
    warmupWhatsAppConnection();
};

export const resetWhatsAppSession = (): void => {
    resetConnectionState();
    clearSessionFiles();
    lastQrAt = null;
    lastQrPayload = null;
    lastDisconnectReason = null;
    warmupWhatsAppConnection();
};

export const getWhatsAppQrPayload = (): string | null => lastQrPayload;
