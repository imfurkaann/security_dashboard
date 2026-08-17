import { useEffect, useRef, type RefObject } from 'react';

interface ReliableInfiniteScrollOptions {
    containerRef: RefObject<HTMLElement | null>;
    enabled?: boolean;
    loading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    itemCount: number;
    contentKey?: string | number;
    onLoadMore: () => void;
    containerThreshold?: number;
    windowThreshold?: number;
}

/**
 * Supports both layouts used by the application: a table/card container with
 * its own scrollbar and a document that scrolls as a whole. The initial frame
 * check is important because list refs do not exist while the loading screen is
 * rendered, and because a short first page may not create a scroll event.
 */
export const useReliableInfiniteScroll = ({
    containerRef,
    enabled = true,
    loading,
    loadingMore,
    hasMore,
    itemCount,
    contentKey = '',
    onLoadMore,
    containerThreshold = 400,
    windowThreshold = 500,
}: ReliableInfiniteScrollOptions): void => {
    const requestInFlightRef = useRef(false);
    const lastInitialCheckIdentityRef = useRef<string | null>(null);
    const onLoadMoreRef = useRef(onLoadMore);

    useEffect(() => {
        onLoadMoreRef.current = onLoadMore;
    }, [onLoadMore]);

    useEffect(() => {
        if (!loadingMore) requestInFlightRef.current = false;
    }, [loadingMore]);

    useEffect(() => {
        if (!enabled || loading || loadingMore || !hasMore) return;

        const container = containerRef.current;

        const loadNextPage = () => {
            if (requestInFlightRef.current) return;
            requestInFlightRef.current = true;
            onLoadMoreRef.current();
        };

        const checkContainer = () => {
            if (!container) return;
            const isScrollable = container.scrollHeight > container.clientHeight + 1;
            const remaining = container.scrollHeight - container.clientHeight - container.scrollTop;
            if (isScrollable && remaining < containerThreshold) loadNextPage();
        };

        const checkWindow = () => {
            // When the list owns the vertical scrollbar, the document itself is
            // often permanently at its bottom. Treating that as a window scroll
            // would eagerly request every page without user interaction.
            const containerIsScrollable = Boolean(
                container && container.scrollHeight > container.clientHeight + 1,
            );
            if (containerIsScrollable) return;
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            const documentHeight = document.documentElement.scrollHeight;
            if (documentHeight - viewportHeight - scrollTop < windowThreshold) loadNextPage();
        };

        container?.addEventListener('scroll', checkContainer, { passive: true });
        window.addEventListener('scroll', checkWindow, { passive: true });
        window.addEventListener('resize', checkWindow, { passive: true });

        const initialCheckIdentity = `${itemCount}:${contentKey}`;
        const shouldRunInitialCheck = lastInitialCheckIdentityRef.current !== initialCheckIdentity;
        lastInitialCheckIdentityRef.current = initialCheckIdentity;
        const initialCheckFrame = shouldRunInitialCheck
            ? window.requestAnimationFrame(() => {
                checkContainer();
                checkWindow();
            })
            : 0;

        return () => {
            if (initialCheckFrame) window.cancelAnimationFrame(initialCheckFrame);
            container?.removeEventListener('scroll', checkContainer);
            window.removeEventListener('scroll', checkWindow);
            window.removeEventListener('resize', checkWindow);
        };
    }, [
        containerRef,
        containerThreshold,
        contentKey,
        enabled,
        hasMore,
        itemCount,
        loading,
        loadingMore,
        windowThreshold,
    ]);
};
