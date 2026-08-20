import crypto from 'crypto';

const TICKET_TTL_MS = 5 * 60 * 1000;
const MAX_ACTIVE_TICKETS = 2_000;
const MAX_MESSAGE_LENGTH = 4_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

type WhatsAppSendTicket = {
    message: string;
    userId: string;
    expiresAt: number;
};

export type WhatsAppSendTicketResult =
    | { success: true; message: string }
    | { success: false; reason: 'invalid' | 'expired' };

const tickets = new Map<string, WhatsAppSendTicket>();

const removeExpiredTickets = (): void => {
    const now = Date.now();
    for (const [token, ticket] of tickets.entries()) {
        if (ticket.expiresAt <= now) tickets.delete(token);
    }
};

const cleanupTimer = setInterval(removeExpiredTickets, 60_000);
cleanupTimer.unref();

export const issueWhatsAppSendTicket = (message: string, userId: string | null | undefined): string | null => {
    const normalizedMessage = message.normalize('NFC').trim();
    const normalizedUserId = userId?.trim();
    if (!normalizedMessage || normalizedMessage.length > MAX_MESSAGE_LENGTH || !normalizedUserId) {
        return null;
    }

    removeExpiredTickets();
    while (tickets.size >= MAX_ACTIVE_TICKETS) {
        const oldestToken = tickets.keys().next().value as string | undefined;
        if (!oldestToken) break;
        tickets.delete(oldestToken);
    }

    const token = crypto.randomBytes(32).toString('base64url');
    tickets.set(token, {
        message: normalizedMessage,
        userId: normalizedUserId,
        expiresAt: Date.now() + TICKET_TTL_MS,
    });
    return token;
};

export const consumeWhatsAppSendTicket = (token: unknown, userId: string | null | undefined): WhatsAppSendTicketResult => {
    if (typeof token !== 'string' || !TOKEN_PATTERN.test(token) || !userId) {
        return { success: false, reason: 'invalid' };
    }

    const ticket = tickets.get(token);
    if (!ticket) return { success: false, reason: 'invalid' };

    if (ticket.expiresAt <= Date.now()) {
        tickets.delete(token);
        return { success: false, reason: 'expired' };
    }
    if (ticket.userId !== userId) {
        return { success: false, reason: 'invalid' };
    }

    // Tek kullanımlık bilet, eşzamanlı iki isteğin aynı bildirimi iki kez
    // göndermemesi için kullanıcı doğrulamasından hemen sonra tüketilir.
    tickets.delete(token);

    return { success: true, message: ticket.message };
};
