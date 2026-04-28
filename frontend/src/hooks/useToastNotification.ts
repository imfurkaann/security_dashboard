import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export interface Toast {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'error';
    duration?: number;
}

export const useToastNotification = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((title: string, message: string, type: 'success' | 'info' | 'error' = 'success', duration = 4000) => {
        const id = uuidv4();
        const toast: Toast = {
            id,
            title,
            message,
            type,
            duration
        };

        setToasts((prev) => [...prev, toast]);
        return id;
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return {
        toasts,
        addToast,
        removeToast
    };
};
