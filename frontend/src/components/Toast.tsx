import { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';

export interface ToastMessage {
    id: string;
    title: string;
    message: string;
    type: 'success' | 'info' | 'error';
    duration?: number;
}

interface ToastProps {
    message: ToastMessage;
    onClose: (id: string) => void;
}

function Toast({ message, onClose }: ToastProps) {
    useEffect(() => {
        const duration = message.duration || 4000;
        const timer = setTimeout(() => {
            onClose(message.id);
        }, duration);

        return () => clearTimeout(timer);
    }, [message, onClose]);

    const bgColor = {
        success: 'bg-green-50 border-green-200',
        info: 'bg-blue-50 border-blue-200',
        error: 'bg-red-50 border-red-200'
    }[message.type];

    const textColor = {
        success: 'text-green-800',
        info: 'text-blue-800',
        error: 'text-red-800'
    }[message.type];

    const iconColor = {
        success: 'text-green-600',
        info: 'text-blue-600',
        error: 'text-red-600'
    }[message.type];

    return (
        <div
            className={`fixed top-4 right-4 max-w-sm rounded-lg border shadow-lg p-4 ${bgColor} z-50 animate-in fade-in slide-in-from-top-2`}
        >
            <div className="flex gap-3">
                <div className={`flex-shrink-0 ${iconColor}`}>
                    <CheckCircle size={20} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${textColor}`}>{message.title}</p>
                    <p className={`text-xs mt-1 ${textColor} opacity-90`}>{message.message}</p>
                </div>
            </div>
        </div>
    );
}

interface ToastContainerProps {
    messages: ToastMessage[];
    onClose: (id: string) => void;
}

export function ToastContainer({ messages, onClose }: ToastContainerProps) {
    return (
        <div className="fixed top-0 right-0 z-40 pointer-events-none">
            {messages.map((message) => (
                <div key={message.id} className="pointer-events-auto">
                    <Toast message={message} onClose={onClose} />
                </div>
            ))}
        </div>
    );
}
