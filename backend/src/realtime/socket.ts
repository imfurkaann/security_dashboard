import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

export type ApiMutationEvent = {
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    statusCode: number;
    timestamp: string;
    clientId: string | null;
    topics: string[];
};

const TOPIC_MAP: Array<{ prefix: string; topics: string[] }> = [
    { prefix: '/api/vehicles', topics: ['vehicles', 'dashboard'] },
    { prefix: '/api/visitors', topics: ['visitors', 'dashboard'] },
    { prefix: '/api/visitor-public', topics: ['visitors', 'dashboard'] },
    { prefix: '/api/managers', topics: ['managers', 'dashboard'] },
    { prefix: '/api/personnel', topics: ['personnel'] },
    { prefix: '/api/guest-registry', topics: ['guest-registry'] },
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
            origin: '*',
            methods: ['GET', 'POST'],
            credentials: false,
        },
        transports: ['websocket', 'polling'],
    });

    io.on('connection', (socket) => {
        socket.emit('realtime:connected', {
            socketId: socket.id,
            timestamp: new Date().toISOString(),
        });
    });

    return io;
};

export const emitApiMutation = (event: ApiMutationEvent): void => {
    const topics = event.topics.length > 0 ? event.topics : resolveMutationTopics(event.path);

    console.log('[realtime] emitApiMutation', {
        method: event.method,
        path: event.path,
        statusCode: event.statusCode,
        topics,
        clientId: event.clientId,
    });

    if (!io) {
        console.warn('[realtime] Socket.IO server is not initialized; mutation event skipped');
        return;
    }

    io.emit('api:mutation', {
        ...event,
        topics,
    });
};

export const getRealtimeServer = (): SocketIOServer | null => io;
