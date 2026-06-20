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

    const token = localStorage.getItem('token') || localStorage.getItem('adminToken');

    socket = io(SOCKET_SERVER_URL, {
        path: '/api/socket.io/',
        transports: ['websocket', 'polling'],
        auth: { token },
        autoConnect: true,
        reconnection: true,
    });

    (socket as any)._lastToken = token;

    return socket;
};

export const initializeRealtimeClient = (): Socket => {
    const client = getSocket();
    const currentToken = localStorage.getItem('token') || localStorage.getItem('adminToken');

    if ((client as any)._lastToken !== currentToken) {
        (client as any)._lastToken = currentToken;
        client.auth = { token: currentToken };
        if (client.connected) {
            client.disconnect().connect();
        }
    }
    return client;
};

export const subscribeToApiMutations = (listener: MutationListener): (() => void) => {
    const client = getSocket();

    // Dynamically check if token changed (e.g. after login/logout) and reconnect if necessary
    const currentToken = localStorage.getItem('token') || localStorage.getItem('adminToken');
    if ((client as any)._lastToken !== currentToken) {
        (client as any)._lastToken = currentToken;
        client.auth = { token: currentToken };
        if (client.connected) {
            client.disconnect().connect();
        }
    }

    const wrapper = (event: ApiMutationEvent) => {
        try {
            // Temporary debug logging to inspect incoming realtime events
            // Remove or guard this in production.
            // eslint-disable-next-line no-console
            console.debug('[realtime] api:mutation received', event);
        } catch (err) {
            // ignore logging errors
        }

        listener(event);
    };

    client.on('api:mutation', wrapper);

    return () => {
        client.off('api:mutation', wrapper);
    };
};

