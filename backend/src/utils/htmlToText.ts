/**
 * HTML'i düz metne çevirir
 * TipTap editor'den gelen HTML içeriği temizleyip okunabilir metne çevirir
 */
export function htmlToText(html: string): string {
    if (!html) return '';

    let text = html;

    // Başlıkları formatla
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n\n=== $1 ===\n\n');
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\n## $1 ##\n\n');
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n# $1 #\n');

    // Paragrafları yeni satır yap
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<p[^>]*>/gi, '');

    // Liste elemanları
    text = text.replace(/<li[^>]*>/gi, '\n  • ');
    text = text.replace(/<\/li>/gi, '');
    text = text.replace(/<\/ul>/gi, '\n');
    text = text.replace(/<ul[^>]*>/gi, '');
    text = text.replace(/<\/ol>/gi, '\n');
    text = text.replace(/<ol[^>]*>/gi, '');

    // Satır sonları
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Bold ve italic - metni koru ama tag'leri kaldır
    text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '$1');
    text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, '$1');
    text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '$1');
    text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, '$1');

    // Diğer tüm HTML tag'lerini kaldır
    text = text.replace(/<[^>]+>/g, '');

    // HTML entity'leri decode et
    text = text.replace(/&nbsp;/gi, ' ');
    text = text.replace(/&amp;/gi, '&');
    text = text.replace(/&lt;/gi, '<');
    text = text.replace(/&gt;/gi, '>');
    text = text.replace(/&quot;/gi, '"');
    text = text.replace(/&#39;/gi, "'");

    // Fazla boşlukları temizle
    text = text.replace(/\n{3,}/g, '\n\n'); // 3'ten fazla yeni satırı 2'ye indir
    text = text.replace(/[ \t]+/g, ' '); // Fazla boşlukları tek boşluğa indir

    // Baştan ve sondan boşlukları kaldır
    text = text.trim();

    return text;
}

/**
 * HTML içerik kontrolü
 */
export function containsHtml(text: string): boolean {
    if (!text) return false;
    return /<[^>]+>/.test(text);
}
