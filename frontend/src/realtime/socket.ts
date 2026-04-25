import { io, Socket } from 'socket.io-client';
import { API_URL } from '../constants';

export type ApiMutationEvent = {
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    statusCode: number;
    timestamp: string;
    clientId: string | null;
    topics?: string[];
};

type MutationListener = (event: ApiMutationEvent) => void;

const DEV_PORTS = new Set(['5173', '5174', '5175']);

const getSocketServerUrl = (): string => {
    if (typeof window !== 'undefined' && !DEV_PORTS.has(window.location.port)) {
        return window.location.origin;
    }

    return API_URL.replace(/\/api\/?$/, '');
};

const SOCKET_SERVER_URL = getSocketServerUrl();

let socket: Socket | null = null;

const getSocket = (): Socket => {
    if (socket) {
        return socket;
    }

    socket = io(SOCKET_SERVER_URL, {
        path: '/api/socket.io/',
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
    });

    return socket;
};

export const initializeRealtimeClient = (): Socket => getSocket();

export const subscribeToApiMutations = (listener: MutationListener): (() => void) => {
    const client = getSocket();
    client.on('api:mutation', listener);

    return () => {
        client.off('api:mutation', listener);
    };
};
