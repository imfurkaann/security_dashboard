import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { getTokenFromCookieHeader } from '../utils/authCookies';

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

export const initRealtime = (httpServer: HttpServer): SocketIOServer => {
    if (io) {
        return io;
    }

    io = new SocketIOServer(httpServer, {
        path: '/api/socket.io/',
        cors: {
            origin: (origin, callback) => {
                const corsOriginSetting = process.env.CORS_ORIGIN;
                if (corsOriginSetting === '*') {
                    callback(null, origin || true);
                    return;
                }
                const publicHostIp = process.env.PUBLIC_HOST_IP?.trim();
                const frontendPort = process.env.FRONTEND_PORT || '33334';
                const allowedOrigins = [
                    process.env.FRONTEND_URL,
                    publicHostIp ? `http://${publicHostIp}:${frontendPort}` : null,
                    publicHostIp ? `http://${publicHostIp}` : null,
                    publicHostIp ? `https://${publicHostIp}:${frontendPort}` : null,
                    publicHostIp ? `https://${publicHostIp}` : null,
                    'http://localhost:5174',
                    'http://localhost:5173',
                    'http://localhost:3000',
                    'http://localhost',
                    'http://localhost:80'
                ].filter(Boolean) as string[];
                const localhostPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
                const ipv4Pattern = /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/;

                if (!origin || allowedOrigins.includes(origin) || localhostPattern.test(origin) || ipv4Pattern.test(origin)) {
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
    io.use((socket, next) => {
        try {
            const token = getTokenFromCookieHeader(socket.handshake.headers.cookie)
                || socket.handshake.auth?.token
                || socket.handshake.headers?.authorization?.replace('Bearer ', '');
            
            if (!token) {
                (socket as any).user = null;
                return next();
            }

            const decoded = verifyToken(token);
            if (!decoded) {
                (socket as any).user = null;
                return next();
            }

            (socket as any).user = decoded;
            next();
        } catch (err) {
            console.error('[realtime] Authentication middleware error:', err);
            (socket as any).user = null;
            next();
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

            const expiresAt = Number(user.exp) * 1000;
            if (Number.isFinite(expiresAt)) {
                const remainingLifetime = Math.max(0, expiresAt - Date.now());
                const expiryTimer = setTimeout(
                    () => socket.disconnect(true),
                    Math.min(remainingLifetime, 2_147_483_647)
                );
                socket.once('disconnect', () => clearTimeout(expiryTimer));
            }
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

