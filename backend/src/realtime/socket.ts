import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { verifyToken } from '../utils/jwt';

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
                const allowedOrigins = [
                    process.env.FRONTEND_URL || 'http://localhost:5174',
                    'http://localhost:5173',
                    'http://localhost:3000',
                    'http://localhost',
                    'http://localhost:80'
                ].filter(Boolean);
                const localhostPattern = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
                const localNetworkPattern = /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

                if (!origin || allowedOrigins.includes(origin) || localhostPattern.test(origin) || localNetworkPattern.test(origin)) {
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
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
            
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

