import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { getTokenFromCookieHeader } from '../utils/authCookies';
import { isAllowedOrigin } from '../config/httpSecurity';
import { getActiveSessionUser } from '../services/sessionService';

export type ApiMutationEvent = {
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    statusCode: number;
    timestamp: string;
    clientId: string | null;
    topics: string[];
    payload?: any;
};

const TOPIC_MAP: Array<{ prefix: string; topics: string[] }> = [
    { prefix: '/api/vehicles', topics: ['vehicles', 'dashboard'] },
    { prefix: '/api/visitors', topics: ['visitors', 'dashboard'] },
    { prefix: '/api/visitor-public', topics: ['visitors', 'dashboard'] },
    { prefix: '/api/managers', topics: ['managers', 'dashboard'] },
    { prefix: '/api/personnel', topics: ['personnel'] },
    { prefix: '/api/guest-registry', topics: ['guest-registry'] },
    { prefix: '/api/predefined-visitors', topics: ['predefined-visitors'] },
    { prefix: '/api/fire-alarms', topics: ['fire-alarms', 'dashboard'] },
    { prefix: '/api/incidents', topics: ['incidents'] },
    { prefix: '/api/sgk', topics: ['sgk'] },
    { prefix: '/api/admin/equipment-config', topics: ['gate-config'] },
    { prefix: '/api/admin/whatsapp', topics: ['whatsapp'] },
    { prefix: '/api/export', topics: ['export'] },
];

export const resolveMutationTopics = (path: string): string[] => {
    const matched = TOPIC_MAP.filter((item) => path.startsWith(item.prefix)).flatMap((item) => item.topics);
    return Array.from(new Set(matched));
};

let io: SocketIOServer | null = null;
const socketsBySession = new Map<string, Set<Socket>>();

export const disconnectRealtimeSession = (personnelRecordId: number | string): void => {
    const sessionKey = String(personnelRecordId);
    const sessionSockets = socketsBySession.get(sessionKey);
    if (!sessionSockets) return;

    for (const socket of sessionSockets) {
        socket.disconnect(true);
    }
    socketsBySession.delete(sessionKey);
};

export const initRealtime = (httpServer: HttpServer): SocketIOServer => {
    if (io) {
        return io;
    }

    io = new SocketIOServer(httpServer, {
        path: '/api/socket.io/',
        maxHttpBufferSize: 100_000,
        perMessageDeflate: false,
        pingInterval: 25_000,
        pingTimeout: 20_000,
        connectionStateRecovery: {
            maxDisconnectionDuration: 2 * 60 * 1000,
            skipMiddlewares: false,
        },
        cors: {
            origin: (origin, callback) => {
                if (isAllowedOrigin(origin)) {
                    callback(null, origin || true);
                } else {
                    console.warn(`[realtime] CORS policy violation for WebSocket connection: ${origin}`);
                    callback(new Error('CORS policy violation'));
                }
            },
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });

    // JWT Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = getTokenFromCookieHeader(socket.handshake.headers.cookie);
            
            if (!token) {
                return next(new Error('Yetkilendirme gerekli'));
            }

            const decoded = verifyToken(token);
            if (!decoded) {
                return next(new Error('Geçersiz oturum'));
            }

            // HTTP isteklerindeki oturum kontrolüyle aynı kuralları uygula.
            // Böylece devre dışı bırakılmış bir kullanıcı, token süresi dolana
            // kadar WebSocket üzerinden kayıt güncellemelerini izleyemez.
            const activeSessionUser = await getActiveSessionUser(decoded);
            if (!activeSessionUser) {
                return next(new Error('Oturum kapatılmış'));
            }

            (socket as any).user = {
                ...decoded,
                username: activeSessionUser.username,
                role: activeSessionUser.role,
            };
            next();
        } catch (err) {
            console.error('[realtime] Authentication middleware error:', err);
            next(new Error('Yetkilendirme servisi kullanılamıyor'));
        }
    });

    io.on('connection', (socket) => {
        const user = (socket as any).user;

        if (user) {
            // Join authenticated room
            socket.join('authenticated');
            
            // Join role-specific room
            if (user.role) {
                socket.join(`role:${user.role}`);
            }

            // Join admin room explicitly if user is admin
            if (user.isAdmin) {
                socket.join('role:admin');
            }

            if (user.personnelRecordId !== undefined && user.personnelRecordId !== null) {
                const sessionKey = String(user.personnelRecordId);
                const sessionSockets = socketsBySession.get(sessionKey) || new Set<Socket>();
                sessionSockets.add(socket);
                socketsBySession.set(sessionKey, sessionSockets);
                socket.once('disconnect', () => {
                    const currentSockets = socketsBySession.get(sessionKey);
                    currentSockets?.delete(socket);
                    if (currentSockets?.size === 0) socketsBySession.delete(sessionKey);
                });
            }

            const expiresAt = Number(user.exp) * 1000;
            if (Number.isFinite(expiresAt)) {
                const remainingLifetime = Math.max(0, expiresAt - Date.now());
                const expiryTimer = setTimeout(
                    () => socket.disconnect(true),
                    Math.min(remainingLifetime, 2_147_483_647)
                );
                socket.once('disconnect', () => clearTimeout(expiryTimer));
            }

            // Revoked, logged-out or disabled sessions must stop receiving data
            // without waiting for JWT expiry.
            const sessionCheckTimer = setInterval(async () => {
                try {
                    const activeSessionUser = await getActiveSessionUser(user);
                    if (!activeSessionUser) socket.disconnect(true);
                } catch {
                    socket.disconnect(true);
                }
            }, 60_000);
            socket.once('disconnect', () => clearInterval(sessionCheckTimer));
        }

        socket.emit('realtime:connected', {
            socketId: socket.id,
            timestamp: new Date().toISOString(),
            authenticated: !!user,
        });
    });

    return io;
};

export const emitApiMutation = (event: ApiMutationEvent): void => {
    const topics = event.topics.length > 0 ? event.topics : resolveMutationTopics(event.path);

    if (process.env.NODE_ENV !== 'production') {
        console.debug('[realtime] emitApiMutation', {
            method: event.method,
            path: event.path,
            statusCode: event.statusCode,
            topics,
            clientId: event.clientId,
        });
    }

    if (!io) {
        console.warn('[realtime] Socket.IO server is not initialized; mutation event skipped');
        return;
    }

    const payload = {
        ...event,
        topics,
    };

    // Route event based on path sensitivity:
    if (event.path.startsWith('/api/admin/')) {
        // Emit only to admins
        io.to('role:admin').emit('api:mutation', payload);
    } else {
        // Emit to all authenticated users
        io.to('authenticated').emit('api:mutation', payload);
    }
};

export const getRealtimeServer = (): SocketIOServer | null => io;

