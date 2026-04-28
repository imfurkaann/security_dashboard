import { useEffect, useCallback, useRef } from 'react';
import { subscribeToApiMutations, type ApiMutationEvent } from './socket';
import api from '../utils/api';

export interface QrNotification {
    id: string;
    title: string;
    message: string;
    type: 'visitor' | 'sgk';
}

type NotificationCallback = (notification: QrNotification) => void;

export const useQrNotifications = (onNotification: NotificationCallback): void => {
    const callbackRef = useRef(onNotification);

    useEffect(() => {
        callbackRef.current = onNotification;
    }, [onNotification]);

    useEffect(() => {
        let isMounted = true;

        const unsubscribe = subscribeToApiMutations(async (event: ApiMutationEvent) => {
            // Listen for visitor (including QR) and SGK record creation
            const isVisitorMutation = event.path.includes('/visitor') && event.method === 'POST' && event.statusCode === 201;
            const isSgkMutation = event.path.includes('/sgk') && event.method === 'POST' && event.statusCode === 201;

            if (!isVisitorMutation && !isSgkMutation) return;

            try {
                if (isVisitorMutation && event.path.includes('/visitor-public')) {
                    // QR visitor record - fetch latest QR visitor
                    const res = await api.get('/visitors/records?limit=1&sort=entry_date DESC,entry_time DESC');
                    const records = res.data || [];

                    if (records.length > 0) {
                        const record = records[0];
                        // Only show notification for QR-based records
                        if (record.entry_by_name === 'Misafir') {
                            if (isMounted) {
                                callbackRef.current({
                                    id: record.id,
                                    title: '✓ Ziyaretçi Girişi',
                                    message: `${record.full_name} giriş yaptı`,
                                    type: 'visitor'
                                });
                            }
                        }
                    }
                } else if (isSgkMutation && event.path.includes('/sgk')) {
                    // SGK record creation
                    const res = await api.get('/sgk?limit=1&sort=upload_date DESC,id DESC');
                    const records = res.data || [];

                    if (records.length > 0) {
                        const record = records[0];
                        if (isMounted) {
                            callbackRef.current({
                                id: record.id,
                                title: '✓ SGK Belgesi',
                                message: `${record.full_name} - ${record.company_name} belgesi yüklendi`,
                                type: 'sgk'
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Bildirim alınamadı:', error);
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);
};
