import type { ReactNode } from 'react';

type ActionVariant = 'primary' | 'success' | 'danger' | 'neutral';

interface ActionButtonProps {
    onClick?: () => void;
    children: ReactNode;
    variant?: ActionVariant;
    disabled?: boolean;
    title?: string;
    className?: string;
    type?: 'button' | 'submit' | 'reset';
}

const variantClasses: Record<ActionVariant, string> = {
    primary: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    danger: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    neutral: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
};

export default function ActionButton({
    onClick,
    children,
    variant = 'neutral',
    disabled = false,
    title,
    className = '',
    type = 'button'
}: ActionButtonProps) {
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`.trim()}
        >
            {children}
        </button>
    );
}
