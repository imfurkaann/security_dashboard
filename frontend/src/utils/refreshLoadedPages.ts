type FetchPage = (offset: number, append: boolean) => Promise<unknown>;

/**
 * Realtime yenilemede kullanıcı daha önce kaç sayfa açtıysa aynı görünür aralığı
 * yeniden kurar. İlk sayfaya sessizce dönmek, eski kayıtların kaybolduğu izlenimini
 * oluşturduğu için güvenlik geçmişi ekranlarında kabul edilemez.
 */
export const refreshLoadedPages = async (
    loadedItemCount: number,
    pageSize: number,
    fetchPage: FetchPage,
): Promise<void> => {
    const pageCount = Math.max(1, Math.ceil(Math.max(loadedItemCount, 1) / pageSize));
    await fetchPage(0, false);
    for (let page = 1; page < pageCount; page += 1) {
        await fetchPage(page * pageSize, true);
    }
};
