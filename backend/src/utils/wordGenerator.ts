import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import * as fs from 'fs';
import * as path from 'path';

/**
 * HTML içeriğini Word dosyasına çevirir
 * @param htmlContent - HTML formatında rapor içeriği
 * @param shiftLabel - Vardiya etiketi (00:00-08:00 vb.)
 * @param reporterName - Raporu kaydeden kişinin adı
 * @returns Word dosyasının tam yolu
 */
export async function createWordFromHtml(htmlContent: string, shiftLabel: string, reporterName?: string): Promise<string> {
    try {
        // HTML'i basit metin formatına çevir
        const plainText = htmlToPlainText(htmlContent);

        // Debug için
        console.log('📝 HTML İçerik:', htmlContent);
        console.log('📄 Plain Text:', plainText);

        // Dosya adı oluştur (tarih_vardiya.docx) - Her vardiya için günlük tek dosya
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // 2025-12-16
        const safeShiftLabel = shiftLabel.replace(/:/g, '-'); // 00-00-08-00
        const fileName = `rapor_${dateStr}_${safeShiftLabel}.docx`;

        // Raporlar klasörünü oluştur
        const reportsDir = path.join(process.cwd(), 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const filePath = path.join(reportsDir, fileName);

        // Word belgesi oluştur
        const doc = new Document({
            sections: [{
                properties: {},
                children: [
                    new Paragraph({
                        text: `Vardiya Raporu - ${shiftLabel}`,
                        heading: HeadingLevel.HEADING_1,
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Tarih: ${now.toLocaleDateString('tr-TR')}`,
                                bold: true,
                            }),
                        ],
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Saat: ${now.toLocaleTimeString('tr-TR')}`,
                                bold: true,
                            }),
                        ],
                    }),
                    ...(reporterName ? [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `Rapor Yazan: ${reporterName}`,
                                    bold: true,
                                }),
                            ],
                        }),
                    ] : []),
                    new Paragraph({ text: '' }), // Boşluk
                    new Paragraph({
                        text: 'Rapor İçeriği:',
                        heading: HeadingLevel.HEADING_2,
                    }),
                    ...parseHtmlToParagraphs(plainText),
                ],
            }],
        });

        // Dosyayı kaydet
        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(filePath, buffer);

        console.log(`✅ Word dosyası oluşturuldu: ${filePath}`);
        return filePath;
    } catch (error) {
        console.error('Word dosyası oluşturma hatası:', error);
        throw new Error('Word dosyası oluşturulamadı');
    }
}

/**
 * HTML'i basit metin formatına çevirir
 */
function htmlToPlainText(html: string): string {
    let text = html;

    // Birden fazla kez encode edilmiş olabilir, 3 kere decode et
    for (let i = 0; i < 3; i++) {
        text = text
            // HTML entity'lerini çevir
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/&#x2F;/gi, '/')
            .replace(/&nbsp;/gi, ' ')
            .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
            .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    }

    // HTML etiketlerini kaldır (satır sonları ekleyerek)
    text = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<h[1-6][^>]*>/gi, '')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<\/ul>/gi, '\n')
        .replace(/<ul[^>]*>/gi, '')
        .replace(/<\/ol>/gi, '\n')
        .replace(/<ol[^>]*>/gi, '')
        .replace(/<\/div>/gi, '\n')
        .replace(/<div[^>]*>/gi, '')
        .replace(/<strong[^>]*>/gi, '')
        .replace(/<\/strong>/gi, '')
        .replace(/<em[^>]*>/gi, '')
        .replace(/<\/em>/gi, '')
        .replace(/<[^>]+>/g, ''); // Tüm kalan HTML etiketlerini kaldır

    // Fazla boşlukları temizle
    text = text
        .replace(/[ \t]+/g, ' ') // Birden fazla boşluğu tek boşluğa çevir
        .replace(/\n\s*\n\s*\n+/g, '\n\n') // 3+ satır sonu -> 2 satır sonu
        .replace(/^\s+/gm, '') // Satır başı boşlukları temizle
        .trim();

    return text;
}

/**
 * Metni paragraflara böler
 */
function parseHtmlToParagraphs(text: string): Paragraph[] {
    const lines = text.split('\n');
    const paragraphs: Paragraph[] = [];

    for (const line of lines) {
        if (line.trim()) {
            paragraphs.push(new Paragraph({
                children: [new TextRun(line.trim())],
            }));
        } else {
            // Boş satır
            paragraphs.push(new Paragraph({ text: '' }));
        }
    }

    return paragraphs;
}
