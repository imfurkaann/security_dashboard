import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'max';
    closeOnBackdropClick?: boolean;
    children: ReactNode;
    footer?: ReactNode;
    hasUnsavedChanges?: boolean;
}

const sizeClasses: Record<string, string> = {
    sm:  'max-w-md',
    md:  'max-w-lg',
    lg:  'max-w-2xl',
    xl:  'max-w-3xl',
    '2xl': 'max-w-4xl',
    '3xl': 'max-w-5xl',
    '4xl': 'max-w-6xl',
    '5xl': 'max-w-7xl',
    max:  'max-w-[95vw]',
};

export default function Modal({
    isOpen,
    onClose,
    size = 'md',
    closeOnBackdropClick = true,
    children,
    footer,
    hasUnsavedChanges = false,
}: ModalProps) {
    const modalRef   = useRef<HTMLDivElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Two-phase render: mount → animate-in / animate-out → unmount
    const [shouldRender,    setShouldRender]    = useState(isOpen);
    const [isVisible,       setIsVisible]       = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            // Next microtask lets the element paint before the transition starts
            const id = requestAnimationFrame(() =>
                requestAnimationFrame(() => setIsVisible(true))
            );
            return () => cancelAnimationFrame(id);
        } else {
            setIsVisible(false);
            const id = setTimeout(() => setShouldRender(false), 220);
            return () => clearTimeout(id);
        }
    }, [isOpen]);

    // Prevent body scroll while open
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, [isOpen]);

    // Keep refs fresh without re-running keyboard listener
    const onCloseRef            = useRef(onClose);
    const hasUnsavedChangesRef  = useRef(hasUnsavedChanges);
    useEffect(() => {
        onCloseRef.current           = onClose;
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    }, [onClose, hasUnsavedChanges]);

    const handleClose = useCallback(() => {
        if (hasUnsavedChangesRef.current) {
            if (!window.confirm('Değişiklikleriniz kaydedilmedi. Kapatmak istediğinize emin misiniz?')) return;
        }
        onCloseRef.current();
    }, []);

    // ESC key + focus trap
    useEffect(() => {
        if (!isOpen) return;

        const prevFocused = document.activeElement as HTMLElement | null;

        const FOCUSABLE =
            'a[href],area[href],input:not([disabled]),select:not([disabled]),' +
            'textarea:not([disabled]),button:not([disabled]),[tabindex="0"],[contenteditable]';

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                handleClose();
                return;
            }

            if (e.key === 'Tab' && modalRef.current) {
                const els = Array.from(
                    modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
                ).filter(el => el.offsetParent !== null); // skip hidden

                if (els.length === 0) return;
                const first = els[0];
                const last  = els[els.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === first) { last.focus();  e.preventDefault(); }
                } else {
                    if (document.activeElement === last)  { first.focus(); e.preventDefault(); }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown, true); // capture phase beats nested listeners

        // Auto-focus first input
        const focusTimer = setTimeout(() => {
            if (!modalRef.current) return;
            const first = modalRef.current.querySelector<HTMLElement>(
                'input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled])'
            );
            first?.focus();
        }, 60);

        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
            clearTimeout(focusTimer);
            prevFocused?.focus();
        };
    }, [isOpen, handleClose]);

    if (!shouldRender) return null;

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (closeOnBackdropClick && e.target === overlayRef.current) handleClose();
    };

    return (
        <div
            ref={overlayRef}
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            className={[
                'fixed inset-0 z-50 flex items-center justify-center',
                'p-3 sm:p-5',
                'bg-black/40 backdrop-blur-[3px]',
                'transition-opacity duration-200 ease-out',
                isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
            ].join(' ')}
        >
            <div
                ref={modalRef}
                className={[
                    'relative w-full bg-white rounded-2xl shadow-2xl',
                    'border border-slate-200',
                    /* Cap at ~90% viewport height so content stays in view */
                    'max-h-[90dvh] flex flex-col overflow-hidden',
                    'transition-all duration-200 ease-out',
                    isVisible ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-2',
                    sizeClasses[size] ?? sizeClasses.md,
                ].join(' ')}
            >
                {/* Close button — sits in top-right corner, always visible */}
                <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Kapat"
                    className="absolute top-3 right-3 z-20 p-1.5 rounded-lg
                               text-slate-400 hover:text-slate-700
                               hover:bg-slate-100 active:bg-slate-200
                               transition-all duration-150 hover:rotate-90"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Scrollable content area — compact vertical padding */}
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain
                                px-5 sm:px-6 pt-5 pb-5 sm:pt-6 sm:pb-6
                                scrollbar-hide">
                    {children}
                </div>

                {/* Optional sticky footer */}
                {footer && (
                    <div className="shrink-0 px-5 sm:px-6 py-3.5 border-t border-slate-200
                                    bg-slate-50/80 flex flex-row-reverse gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
