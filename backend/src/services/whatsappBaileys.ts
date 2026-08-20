import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';

export type WhatsAppSendResult = {
    success: boolean;
    messageId?: string;
    reason?: string;
    errorCode?: string;
    debugId?: string;
    manualFallbackSuggested?: boolean;
    durationMs?: number;
};

export type WhatsAppConnectionState = 'disabled' | 'connecting' | 'qr_required' | 'connected' | 'disconnected';

export type WhatsAppConnectionStatus = {
    enabled: boolean;
    connected: boolean;
    connectionState: WhatsAppConnectionState;
    qrAvailable: boolean;
    lastQrAt: string | null;
    lastConnectedAt: string | null;
    targetJid: string | null;
    lastDisconnectReason: string | null;
};

export type WhatsAppGroupInfo = {
    id: string;
    name: string;
};

const GROUP_JID_PATTERN = /^\d+(?:-\d+)?@g\.us$/;
const DEFAULT_CONNECTION_TIMEOUT_MS = 30_000;
const DEFAULT_SEND_CONNECTION_TIMEOUT_MS = 8_000;
const DEFAULT_SEND_TIMEOUT_MS = 8_000;
const DEFAULT_GROUP_LIST_TIMEOUT_MS = 15_000;
const DEFAULT_QR_TTL_MS = 60_000;
const MAX_RECONNECT_ATTEMPTS = 8;
const MAX_MESSAGE_LENGTH = 4_000;
const MAX_QUEUED_MESSAGES = 100;

const readBoundedInteger = (name: string, fallback: number, minimum: number, maximum: number): number => {
    const parsed = Number(process.env[name]);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
        return fallback;
    }
    return parsed;
};

const CONNECTION_TIMEOUT_MS = readBoundedInteger(
    'WHATSAPP_CONNECT_TIMEOUT_MS',
    DEFAULT_CONNECTION_TIMEOUT_MS,
    5_000,
    120_000
);
const SEND_CONNECT_TIMEOUT_MS = readBoundedInteger(
    'WHATSAPP_SEND_CONNECT_TIMEOUT_MS',
    DEFAULT_SEND_CONNECTION_TIMEOUT_MS,
    3_000,
    60_000
);
const SEND_MESSAGE_TIMEOUT_MS = readBoundedInteger(
    'WHATSAPP_SEND_MESSAGE_TIMEOUT_MS',
    DEFAULT_SEND_TIMEOUT_MS,
    3_000,
    60_000
);
const GROUP_LIST_TIMEOUT_MS = readBoundedInteger(
    'WHATSAPP_GROUP_LIST_TIMEOUT_MS',
    DEFAULT_GROUP_LIST_TIMEOUT_MS,
    3_000,
    60_000
);
const QR_TTL_MS = readBoundedInteger('WHATSAPP_QR_TTL_MS', DEFAULT_QR_TTL_MS, 15_000, 120_000);

let socket: WASocket | null = null;
let connectionPromise: Promise<WASocket> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connectionGeneration = 0;
let isSocketOpen = false;
let reconnectAttempts = 0;
let lastQrAt: string | null = null;
let lastQrPayload: string | null = null;
let lastConnectedAt: string | null = null;
let lastDisconnectReason: string | null = null;
let configuredTargetJid: string | null = null;
let messageQueueTail: Promise<void> = Promise.resolve();
let queuedMessageCount = 0;

const createDebugId = (): string => `wa-${crypto.randomUUID()}`;

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
};

export const normalizeWhatsAppGroupJid = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return normalized.length <= 80 && GROUP_JID_PATTERN.test(normalized) ? normalized : null;
};

const normalizeMessage = (value: string): string => {
    const normalized = value
        .normalize('NFC')
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/([\u2600-\u26FF\u2700-\u27BF])(?!\uFE0F)/g, '$1\uFE0F')
        .trim();

    if (!normalized || normalized.length > MAX_MESSAGE_LENGTH) {
        throw new Error('WHATSAPP_INVALID_MESSAGE');
    }

    return normalized;
};

const classifySendError = (error: unknown): { errorCode: string; reason: string } => {
    const message = error instanceof Error ? error.message : String(error || '');
    const normalized = message.toLowerCase();

    if (message === 'WHATSAPP_INVALID_MESSAGE') {
        return { errorCode: 'WHATSAPP_INVALID_MESSAGE', reason: 'Mesaj içeriği geçersiz veya çok uzun.' };
    }
    if (normalized.includes('timeout') || normalized.includes('zaman aşım')) {
        return { errorCode: 'WHATSAPP_TIMEOUT', reason: 'WhatsApp işlemi zaman aşımına uğradı.' };
    }
    if (
        normalized.includes('connection closed')
        || normalized.includes('connection was lost')
        || normalized.includes('connection terminated')
        || normalized.includes('socket closed')
    ) {
        return { errorCode: 'WHATSAPP_CONNECTION_CLOSED', reason: 'WhatsApp bağlantısı işlem sırasında koptu.' };
    }
    if (normalized.includes('not connected') || normalized.includes('not open')) {
        return { errorCode: 'WHATSAPP_NOT_CONNECTED', reason: 'WhatsApp bağlı değil. Yönetici bağlantıyı kontrol etmelidir.' };
    }

    return { errorCode: 'WHATSAPP_SEND_FAILED', reason: 'WhatsApp mesajı gönderilemedi.' };
};

const getSessionPath = (): string => {
    const configuredPath = process.env.WHATSAPP_SESSION_PATH?.trim() || '.baileys_auth';
    const workingDirectory = path.resolve(process.cwd());
    const sessionPath = path.resolve(workingDirectory, configuredPath);
    const relative = path.relative(workingDirectory, sessionPath);

    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('WHATSAPP_SESSION_PATH uygulama çalışma dizini içinde ayrı bir klasör olmalıdır.');
    }

    return sessionPath;
};

const hardenSessionPermissions = (): void => {
    const sessionPath = getSessionPath();
    fs.mkdirSync(sessionPath, { recursive: true, mode: 0o700 });
    fs.chmodSync(sessionPath, 0o700);

    for (const entry of fs.readdirSync(sessionPath, { withFileTypes: true })) {
        const entryPath = path.join(sessionPath, entry.name);
        fs.chmodSync(entryPath, entry.isDirectory() ? 0o700 : 0o600);
    }
};

const clearSessionFiles = (): void => {
    const sessionPath = getSessionPath();
    fs.mkdirSync(sessionPath, { recursive: true, mode: 0o700 });

    for (const entry of fs.readdirSync(sessionPath, { withFileTypes: true })) {
        fs.rmSync(path.join(sessionPath, entry.name), { force: true, recursive: true });
    }

    fs.chmodSync(sessionPath, 0o700);
};

const getTargetJid = (): string | null => {
    return configuredTargetJid
        || normalizeWhatsAppGroupJid(process.env.WHATSAPP_TARGET_GROUP_JID)
        || normalizeWhatsAppGroupJid(process.env.WHATSAPP_TARGET_JID);
};

export const setWhatsAppTargetJid = (jid: string | null): void => {
    const normalized = jid === null ? null : normalizeWhatsAppGroupJid(jid);
    if (jid !== null && !normalized) {
        throw new Error('Geçersiz WhatsApp grup JID değeri.');
    }

    configuredTargetJid = normalized;
    if (normalized) {
        process.env.WHATSAPP_TARGET_GROUP_JID = normalized;
    } else {
        delete process.env.WHATSAPP_TARGET_GROUP_JID;
        delete process.env.WHATSAPP_TARGET_JID;
    }
};

export const isWhatsAppAutoSendEnabled = (): boolean => process.env.WHATSAPP_ENABLED === 'true';

const clearReconnectTimer = (): void => {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
};

const closeCurrentSocket = (reason: string): void => {
    clearReconnectTimer();
    connectionGeneration += 1;
    const previousSocket = socket;
    socket = null;
    connectionPromise = null;
    isSocketOpen = false;
    reconnectAttempts = 0;
    lastQrPayload = null;

    try {
        previousSocket?.end(new Error(reason));
    } catch {
        // Bağlantı zaten kapanmış olabilir.
    }
};

const scheduleReconnect = (delayMs: number): void => {
    if (reconnectTimer || !isWhatsAppAutoSendEnabled()) return;
    const scheduledGeneration = connectionGeneration;

    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (scheduledGeneration === connectionGeneration) {
            warmupWhatsAppConnection();
        }
    }, delayMs);
};

const getDisconnectStatusCode = (error: unknown): number | undefined => {
    if (!error || typeof error !== 'object') return undefined;
    const candidate = error as {
        output?: { statusCode?: number };
        statusCode?: number;
    };
    return candidate.output?.statusCode ?? candidate.statusCode;
};

const getDisconnectReason = (statusCode: number | undefined): string => {
    if (statusCode === DisconnectReason.connectionReplaced) return 'connectionReplaced';
    if (statusCode === DisconnectReason.restartRequired) return 'restartRequired';
    if (statusCode === DisconnectReason.loggedOut) return 'loggedOut';
    if (statusCode === DisconnectReason.unavailableService) return 'unavailableService';
    return 'connectionClosed';
};

const handleConnectionClosed = (generation: number, statusCode: number | undefined): void => {
    if (generation !== connectionGeneration) return;

    isSocketOpen = false;
    socket = null;
    connectionPromise = null;
    lastQrPayload = null;
    lastDisconnectReason = getDisconnectReason(statusCode);
    connectionGeneration += 1;

    console.warn('WhatsApp bağlantısı kapandı.', {
        reason: lastDisconnectReason,
        reconnectAttempt: reconnectAttempts,
    });

    if (statusCode === DisconnectReason.connectionReplaced || statusCode === DisconnectReason.loggedOut) {
        // Oturum anahtarları otomatik silinmez. Yetkili yönetici açıkça
        // "Oturumu Sıfırla" işlemini seçmeden uzun ömürlü kimlik bilgilerine dokunma.
        reconnectAttempts = 0;
        return;
    }

    reconnectAttempts = Math.min(reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS);
    const baseDelay = statusCode === DisconnectReason.restartRequired ? 1_000 : 2_000;
    const delay = Math.min(baseDelay * (2 ** Math.max(0, reconnectAttempts - 1)), 60_000);
    scheduleReconnect(delay);
};

const createConnection = async (generation: number): Promise<WASocket> => {
    const sessionPath = getSessionPath();
    hardenSessionPermissions();

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await withTimeout(
        fetchLatestBaileysVersion(),
        10_000,
        'WhatsApp sürüm bilgisi zaman aşımına uğradı.'
    );

    if (generation !== connectionGeneration) {
        throw new Error('WhatsApp bağlantı isteği geçersiz hale geldi.');
    }

    const waSocket = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: process.env.WHATSAPP_LOG_LEVEL || 'silent' }),
        browser: ['Güvenlik Yönetimi', 'Chrome', '1.0.0'],
        markOnlineOnConnect: false,
        syncFullHistory: false,
        shouldSyncHistoryMessage: () => false,
    });

    waSocket.ev.on('creds.update', () => {
        if (generation !== connectionGeneration) return;
        void saveCreds()
            .then(() => hardenSessionPermissions())
            .catch(() => console.error('WhatsApp oturum bilgileri güvenli biçimde kaydedilemedi.'));
    });

    waSocket.ev.on('connection.update', (update) => {
        if (generation !== connectionGeneration) return;
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            lastQrAt = new Date().toISOString();
            lastQrPayload = qr;
            console.log('WhatsApp QR kodu yetkili yönetici paneli için hazır.');
        }

        if (connection === 'open') {
            socket = waSocket;
            isSocketOpen = true;
            reconnectAttempts = 0;
            lastQrPayload = null;
            lastConnectedAt = new Date().toISOString();
            lastDisconnectReason = null;
            console.log('WhatsApp bağlantısı açıldı.');
            return;
        }

        if (connection === 'close') {
            handleConnectionClosed(generation, getDisconnectStatusCode(lastDisconnect?.error));
        }
    });

    return waSocket;
};

const startConnection = (): Promise<WASocket> => {
    if (connectionPromise) return connectionPromise;
    if (socket) return Promise.resolve(socket);

    const generation = connectionGeneration;
    const pending = createConnection(generation)
        .then((createdSocket) => {
            if (generation !== connectionGeneration) {
                try {
                    createdSocket.end(new Error('Geçersiz hale gelen WhatsApp bağlantısı kapatıldı.'));
                } catch {
                    // Bağlantı zaten kapanmış olabilir.
                }
                throw new Error('WhatsApp bağlantı isteği geçersiz hale geldi.');
            }
            socket = createdSocket;
            return createdSocket;
        })
        .finally(() => {
            if (generation === connectionGeneration) {
                connectionPromise = null;
            }
        });

    connectionPromise = pending;
    return pending;
};

const waitForSocketOpen = async (waSocket: WASocket, timeoutMs: number): Promise<void> => {
    if (socket === waSocket && isSocketOpen) return;
    const generation = connectionGeneration;

    return new Promise<void>((resolve, reject) => {
        const cleanup = (): void => {
            clearTimeout(timeout);
            waSocket.ev.off('connection.update', handleUpdate);
        };
        const handleUpdate = (update: { connection?: string }): void => {
            if (generation !== connectionGeneration) {
                cleanup();
                reject(new Error('WhatsApp bağlantısı yenilendi.'));
            } else if (update.connection === 'open') {
                cleanup();
                resolve();
            } else if (update.connection === 'close') {
                cleanup();
                reject(new Error('WhatsApp connection closed.'));
            }
        };
        const timeout = setTimeout(() => {
            waSocket.ev.off('connection.update', handleUpdate);
            reject(new Error('WhatsApp connection timeout.'));
        }, timeoutMs);

        waSocket.ev.on('connection.update', handleUpdate);
    });
};

const ensureConnection = async (timeoutMs: number = CONNECTION_TIMEOUT_MS): Promise<WASocket> => {
    const activeSocket = socket || await withTimeout(
        startConnection(),
        timeoutMs,
        'WhatsApp bağlantısı zaman aşımına uğradı.'
    );

    if (!isSocketOpen || socket !== activeSocket) {
        await waitForSocketOpen(activeSocket, timeoutMs);
    }

    if (!isSocketOpen || socket !== activeSocket) {
        throw new Error('WhatsApp not connected.');
    }

    return activeSocket;
};

const isQrAvailable = (): boolean => {
    if (!lastQrPayload || !lastQrAt) return false;
    const generatedAt = new Date(lastQrAt).getTime();
    if (!Number.isFinite(generatedAt) || Date.now() - generatedAt > QR_TTL_MS) {
        lastQrPayload = null;
        return false;
    }
    return true;
};

export const getWhatsAppConnectionStatus = (): WhatsAppConnectionStatus => {
    const enabled = isWhatsAppAutoSendEnabled();
    const qrAvailable = isQrAvailable();
    const connectionState: WhatsAppConnectionState = !enabled
        ? 'disabled'
        : isSocketOpen
            ? 'connected'
            : qrAvailable
                ? 'qr_required'
                : (socket || connectionPromise || reconnectTimer)
                    ? 'connecting'
                    : 'disconnected';

    return {
        enabled,
        connected: isSocketOpen,
        connectionState,
        qrAvailable,
        lastQrAt,
        lastConnectedAt,
        targetJid: getTargetJid(),
        lastDisconnectReason,
    };
};

const sendWhatsAppTextMessageInternal = async (text: string): Promise<WhatsAppSendResult> => {
    const debugId = createDebugId();
    const startedAt = Date.now();

    if (!isWhatsAppAutoSendEnabled()) {
        return {
            success: false,
            reason: 'WhatsApp entegrasyonu devre dışı.',
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
            reason: 'WhatsApp hedef grubu belirlenmemiş.',
            errorCode: 'WHATSAPP_TARGET_MISSING',
            debugId,
            manualFallbackSuggested: true,
            durationMs: Date.now() - startedAt,
        };
    }

    let preparedText: string;
    try {
        preparedText = normalizeMessage(text);
    } catch (error) {
        const classified = classifySendError(error);
        return {
            success: false,
            ...classified,
            debugId,
            manualFallbackSuggested: true,
            durationMs: Date.now() - startedAt,
        };
    }

    let waSocket: WASocket;
    try {
        waSocket = await ensureConnection(SEND_CONNECT_TIMEOUT_MS);
    } catch (initialConnectionError) {
        const currentStatus = getWhatsAppConnectionStatus();
        if (currentStatus.connectionState === 'qr_required' || currentStatus.connectionState === 'connecting') {
            const classified = classifySendError(initialConnectionError);
            return {
                success: false,
                ...classified,
                debugId,
                manualFallbackSuggested: true,
                durationMs: Date.now() - startedAt,
            };
        }

        await restartWhatsAppConnection();
        try {
            waSocket = await ensureConnection(SEND_CONNECT_TIMEOUT_MS);
        } catch (connectionError) {
            const classified = classifySendError(connectionError);
            console.warn('WhatsApp mesaj bağlantısı kurulamadı.', {
                debugId,
                errorCode: classified.errorCode,
                durationMs: Date.now() - startedAt,
            });
            return {
                success: false,
                ...classified,
                debugId,
                manualFallbackSuggested: true,
                durationMs: Date.now() - startedAt,
            };
        }
    }

    try {
        // Gönderim timeout'u teslimatın başarısız olduğunu kanıtlamaz. Aynı mesajı
        // otomatik tekrar göndermek çift bildirime yol açabileceği için yalnızca bir
        // kez sendMessage çağrılır.
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
    } catch (error) {
        const classified = classifySendError(error);
        console.error('WhatsApp mesajı gönderilemedi.', {
            debugId,
            errorCode: classified.errorCode,
            durationMs: Date.now() - startedAt,
            connectionState: getWhatsAppConnectionStatus().connectionState,
        });
        return {
            success: false,
            ...classified,
            debugId,
            manualFallbackSuggested: true,
            durationMs: Date.now() - startedAt,
        };
    }
};

export const sendWhatsAppTextMessage = async (text: string): Promise<WhatsAppSendResult> => {
    if (queuedMessageCount >= MAX_QUEUED_MESSAGES) {
        return {
            success: false,
            reason: 'WhatsApp gönderim sırası dolu. Lütfen kısa süre sonra tekrar deneyin.',
            errorCode: 'WHATSAPP_QUEUE_FULL',
            debugId: createDebugId(),
            manualFallbackSuggested: true,
        };
    }

    queuedMessageCount += 1;
    const task = messageQueueTail.then(() => sendWhatsAppTextMessageInternal(text));
    messageQueueTail = task.then(() => undefined, () => undefined);

    try {
        return await task;
    } finally {
        queuedMessageCount -= 1;
    }
};

export const warmupWhatsAppConnection = (): void => {
    if (!isWhatsAppAutoSendEnabled() || socket || connectionPromise) return;

    const pending = startConnection();
    void pending.catch((error) => {
        const message = error instanceof Error ? error.message : 'Bilinmeyen bağlantı hatası';
        console.warn('WhatsApp başlangıç bağlantısı kurulamadı.', { reason: message.slice(0, 160) });
        if (!socket && isWhatsAppAutoSendEnabled()) {
            reconnectAttempts = Math.min(reconnectAttempts + 1, MAX_RECONNECT_ATTEMPTS);
            scheduleReconnect(Math.min(2_000 * (2 ** Math.max(0, reconnectAttempts - 1)), 60_000));
        }
    });
};

export const listWhatsAppGroups = async (): Promise<WhatsAppGroupInfo[]> => {
    const waSocket = await ensureConnection(CONNECTION_TIMEOUT_MS);
    const groups = await withTimeout(
        waSocket.groupFetchAllParticipating(),
        GROUP_LIST_TIMEOUT_MS,
        'WhatsApp grup listesi zaman aşımına uğradı.'
    );

    return Object.values(groups)
        .map((group) => ({
            id: normalizeWhatsAppGroupJid(group.id),
            name: typeof group.subject === 'string' ? group.subject.trim().slice(0, 160) : '',
        }))
        .filter((group): group is WhatsAppGroupInfo => Boolean(group.id))
        .map((group) => ({ id: group.id, name: group.name || group.id }))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
};

export const restartWhatsAppConnection = async (): Promise<void> => {
    closeCurrentSocket('WhatsApp bağlantısı yönetici tarafından yenilendi.');
    warmupWhatsAppConnection();
};

export const resetWhatsAppSession = async (): Promise<void> => {
    closeCurrentSocket('WhatsApp oturumu yönetici tarafından sıfırlandı.');
    clearSessionFiles();
    lastQrAt = null;
    lastQrPayload = null;
    lastConnectedAt = null;
    lastDisconnectReason = null;
    warmupWhatsAppConnection();
};

export const getWhatsAppQrPayload = (): string | null => isQrAvailable() ? lastQrPayload : null;

export const shutdownWhatsAppConnection = async (): Promise<void> => {
    console.log('WhatsApp bağlantısı güvenli biçimde kapatılıyor.');
    closeCurrentSocket('Uygulama kapatılıyor.');
    await new Promise((resolve) => setTimeout(resolve, 250));
};
