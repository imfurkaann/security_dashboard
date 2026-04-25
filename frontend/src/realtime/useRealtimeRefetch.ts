import { useEffect, useRef } from 'react';
import { subscribeToApiMutations, type ApiMutationEvent } from './socket';

type UseRealtimeRefetchOptions = {
    topics: string[];
    onMutation: () => void | Promise<void>;
    debounceMs?: number;
    enabled?: boolean;
};

const LOCAL_TOPICS: Array<{ prefix: string; topics: string[] }> = [
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

const fallbackTopicsFromPath = (path: string): string[] => {
    const matched = LOCAL_TOPICS.filter((item) => path.startsWith(item.prefix)).flatMap((item) => item.topics);
    return Array.from(new Set(matched));
};

const hasTopicOverlap = (event: ApiMutationEvent, watchedTopics: string[]): boolean => {
    const eventTopics = event.topics && event.topics.length > 0 ? event.topics : fallbackTopicsFromPath(event.path);
    if (eventTopics.length === 0) return false;
    return watchedTopics.some((topic) => eventTopics.includes(topic));
};

export const useRealtimeRefetch = ({
    topics,
    onMutation,
    debounceMs = 300,
    enabled = true,
}: UseRealtimeRefetchOptions): void => {
    const timeoutRef = useRef<number | null>(null);
    const onMutationRef = useRef(onMutation);
    const watchedTopicsRef = useRef(topics);

    useEffect(() => {
        onMutationRef.current = onMutation;
    }, [onMutation]);

    useEffect(() => {
        watchedTopicsRef.current = topics;
    }, [topics]);

    useEffect(() => {
        if (!enabled) return;

        const unsubscribe = subscribeToApiMutations((event) => {
            // Self-echo suppression is intentionally disabled so same-browser tabs
            // (personnel/admin) always receive live updates.
            if (!hasTopicOverlap(event, watchedTopicsRef.current)) return;

            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = window.setTimeout(() => {
                void onMutationRef.current();
                timeoutRef.current = null;
            }, debounceMs);
        });

        return () => {
            if (timeoutRef.current) {
                window.clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            unsubscribe();
        };
    }, [debounceMs, enabled]);
};
