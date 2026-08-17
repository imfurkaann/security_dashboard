interface InfiniteScrollStatusProps {
    loadingMore: boolean;
    hasMore: boolean;
    itemCount: number;
}

export default function InfiniteScrollStatus({
    loadingMore,
    hasMore,
    itemCount,
}: InfiniteScrollStatusProps) {
    if (itemCount === 0) return null;

    return (
        <div className="sticky left-0 w-full py-3 text-center text-xs font-medium text-gray-500">
            {loadingMore
                ? 'Daha fazla kayıt yükleniyor...'
                : hasMore
                    ? 'Daha fazla kayıt için aşağı kaydırın'
                    : `Tüm ${itemCount} kayıt gösteriliyor`}
        </div>
    );
}
