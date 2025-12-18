import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import * as fs from 'fs';
import * as path from 'path';

/**
 * HTML içeriğini Word dosyasına çevirir ve hiyerarşik klasör yapısına kaydeder.
 * Yapı: reports/Yil-Ay/Gun/rapor_vardiya.docx
 */
export async function createWordFromHtml(htmlContent: string, shiftLabel: string, reporterName?: string): Promise<string> {
    try {
        const plainText = htmlToPlainText(htmlContent);
        const now = new Date();

        // 1. Klasör yapısı değişkenlerini hazırla
        const year = now.getFullYear();
        const monthNames = ["Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran", "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik"];
        const monthName = monthNames[now.getMonth()];
        const monthFolderName = `${year}-${monthName}`;
        const dayFolderName = String(now.getDate()).padStart(2, '0');

        // 2. Klasör yolunu oluştur
        const reportsBaseDir = path.join(process.cwd(), 'reports');
        const targetDir = path.join(reportsBaseDir, monthFolderName, dayFolderName);

        // 3. Klasörleri oluştur (İzin hatasını önlemek için recursive: true)
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true, mode: 0o777 });
        }

        // 4. Güvenli dosya adı oluştur (Saatlerdeki ":" karakterini "-" ile değiştirir)
        const safeShiftLabel = shiftLabel.replace(/:/g, '-');
        const fileName = `rapor_${safeShiftLabel}.docx`;
        const filePath = path.join(targetDir, fileName);

        // 5. Word Belgesi Tasarımı
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

        // 6. Dosyayı tampon belleğe al ve kaydet
        const buffer = await Packer.toBuffer(doc);
        fs.writeFileSync(filePath, buffer);

        console.log(`✅ Word dosyası başarıyla kaydedildi: ${filePath}`);

        return filePath;
    } catch (error: unknown) {
        // TypeScript unknown tip hatası çözümü
        if (error instanceof Error) {
            console.error('❌ Word dosyası oluşturma hatası:', error.message);
            throw new Error(`Word dosyası oluşturulamadı: ${error.message}`);
        } else {
            console.error('❌ Bilinmeyen bir hata oluştu');
            throw new Error('Word dosyası oluşturulurken beklenmedik bir hata oluştu.');
        }
    }
}

/**
 * HTML'i basit metin formatına çevirir
 */
function htmlToPlainText(html: string): string {
    let text = html;
    // HTML entity'lerini temizle
    for (let i = 0; i < 3; i++) {
        text = text
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/&nbsp;/gi, ' ')
            .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec));
    }

    // HTML etiketlerini temizle
    text = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<p[^>]*>/gi, '')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li[^>]*>/gi, '• ')
        .replace(/<[^>]+>/g, '') // Kalan tüm etiketleri sil
        .replace(/[ \t]+/g, ' ')  // Fazla boşlukları temizle
        .replace(/\n\s*\n\s*\n+/g, '\n\n')
        .trim();

    return text;
}

/**
 * Metni paragraflara böler
 */
function parseHtmlToParagraphs(text: string): Paragraph[] {
    const lines = text.split('\n');
    return lines
        .filter(line => line.trim().length > 0) // Boş satırları filtrele
        .map(line => {
            return new Paragraph({
                children: [new TextRun(line.trim())],
            });
        });
}