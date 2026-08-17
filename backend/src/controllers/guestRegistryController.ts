import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
import pool from '../config/database';
import { getClientIp } from '../middleware/rateLimiter';
import { logDataChange } from '../utils/auditLog';

interface ParsedRow {
    sheetName: string;
    rowNumber: number;
    rowData: Record<string, unknown>;
}

type GuestColumnType = 'text' | 'date' | 'time' | 'number';

interface GuestRegistryColumn {
    key: string;
    label: string;
    type: GuestColumnType;
    index: number;
}

class GuestImportValidationError extends Error {}

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const MAX_IMPORT_ROWS = parsePositiveInteger(process.env.GUEST_EXCEL_MAX_ROWS, 100_000);
const MAX_IMPORT_COLUMNS = parsePositiveInteger(process.env.GUEST_EXCEL_MAX_COLUMNS, 200);
const MAX_IMPORT_CELLS = parsePositiveInteger(process.env.GUEST_EXCEL_MAX_CELLS, 2_000_000);
const MAX_IMPORT_SHEETS = parsePositiveInteger(process.env.GUEST_EXCEL_MAX_SHEETS, 50);
const MAX_CELL_LENGTH = parsePositiveInteger(process.env.GUEST_EXCEL_MAX_CELL_LENGTH, 2_000);
const MAX_SEARCH_LENGTH = 200;
const MAX_SEARCH_TEXT_LENGTH = 20_000;

const parseBoundedQueryInteger = (
    value: unknown,
    fallback: number,
    min: number,
    max: number
): number => {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
};

const isHiddenGeneratedColumn = (key: string): boolean => /^COL_\d+(?:_\d+)?$/i.test(key.trim());

const normalizeSearchText = (value: string): string => {
    return value
        .toLocaleLowerCase('tr-TR')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/c/g, 'c')
        .replace(/g/g, 'g')
        .replace(/i/g, 'i')
        .replace(/o/g, 'o')
        .replace(/s/g, 's')
        .replace(/u/g, 'u')
        .replace(/ç/g, 'c')
        .replace(/ğ/g, 'g')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ş/g, 's')
        .replace(/ü/g, 'u');
};

const fixPotentialMojibake = (value: string): string => {
    if (!/Ã|Å|Ä|Ð|Ñ|â/.test(value)) {
        return value;
    }

    try {
        const fixed = Buffer.from(value, 'latin1').toString('utf8');
        return fixed.includes('�') ? value : fixed;
    } catch (_error) {
        return value;
    }
};

const sanitizeHeader = (value: unknown, fallbackIndex: number): string => {
    const repaired = fixPotentialMojibake(String(value ?? ''))
        .replace(/[\u0000-\u001F\u007F]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
    return repaired || `COL_${fallbackIndex + 1}`;
};

const normalizeHeader = (value: string): string => {
    const repaired = fixPotentialMojibake(String(value));
    return normalizeSearchText(repaired).replace(/[^a-z0-9]/g, '');
};

const normalizeCellValue = (value: unknown): unknown => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) return value;

    const text = fixPotentialMojibake(String(value))
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .trim()
        .slice(0, MAX_CELL_LENGTH);
    if (!text) return null;
    return text;
};

const buildSearchText = (rowData: Record<string, unknown>): string => {
    return Object.values(rowData)
        .map((value) => value === null || value === undefined ? '' : normalizeSearchText(String(value)))
        .filter(Boolean)
        .join(' ')
        .slice(0, MAX_SEARCH_TEXT_LENGTH);
};

const sanitizeFileName = (value: string): string => {
    return fixPotentialMojibake(value)
        .replace(/[\\/]/g, '_')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .slice(0, 255) || 'misafir-kayitlari.xlsx';
};

const hasValidExcelSignature = (buffer: Buffer): boolean => {
    if (buffer.length < 8) return false;
    const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B;
    const oleSignature = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];
    const isOle = oleSignature.every((byte, index) => buffer[index] === byte);
    return isZip || isOle;
};

const makeUniqueHeaderKey = (baseKey: string, usedKeys: Set<string>, fallbackIndex: number): string => {
    const normalizedBase = baseKey || `COL_${fallbackIndex + 1}`;
    if (!usedKeys.has(normalizedBase)) {
        usedKeys.add(normalizedBase);
        return normalizedBase;
    }

    let suffix = 2;
    let candidate = `${normalizedBase}_${suffix}`;
    while (usedKeys.has(candidate)) {
        suffix += 1;
        candidate = `${normalizedBase}_${suffix}`;
    }

    usedKeys.add(candidate);
    return candidate;
};

const inferColumnType = (values: unknown[]): GuestColumnType => {
    const nonEmptyValues = values
        .map((value) => (value === null || value === undefined ? '' : String(value).trim()))
        .filter((value) => value.length > 0);

    if (nonEmptyValues.length === 0) {
        return 'text';
    }

    const dateHits = nonEmptyValues.filter((value) => parseDateValue(value) !== null).length;
    const timeHits = nonEmptyValues.filter((value) => parseTimeValue(value) !== null).length;
    const numericHits = nonEmptyValues.filter((value) => !Number.isNaN(Number(value))).length;

    if (dateHits / nonEmptyValues.length >= 0.6) {
        return 'date';
    }

    if (timeHits / nonEmptyValues.length >= 0.6) {
        return 'time';
    }

    if (numericHits / nonEmptyValues.length >= 0.8) {
        return 'number';
    }

    return 'text';
};

const formatTwoDigits = (value: number): string => String(value).padStart(2, '0');

const normalizeDateParts = (year: number, month: number, day: number): string | null => {
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return null;
    }

    const normalized = new Date(Date.UTC(year, month - 1, day));
    if (
        normalized.getUTCFullYear() !== year ||
        normalized.getUTCMonth() + 1 !== month ||
        normalized.getUTCDate() !== day
    ) {
        return null;
    }

    return `${year}-${formatTwoDigits(month)}-${formatTwoDigits(day)}`;
};

const parseDateValue = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number' && Number.isFinite(value)) {
        const wholeDays = Math.floor(value);
        const parsed = new Date(Date.UTC(1899, 11, 30) + wholeDays * 86_400_000);
        return normalizeDateParts(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
    }

    if (value instanceof Date) {
        return normalizeDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
    }

    const text = String(value).trim();
    if (!text) return null;

    const isoDateTimePrefix = text.match(/^(\d{4})-(\d{2})-(\d{2})T/);
    if (isoDateTimePrefix) {
        return normalizeDateParts(
            Number(isoDateTimePrefix[1]),
            Number(isoDateTimePrefix[2]),
            Number(isoDateTimePrefix[3])
        );
    }

    const digits = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
    if (digits) {
        return normalizeDateParts(Number(digits[1]), Number(digits[2]), Number(digits[3]));
    }

    const reverseDigits = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
    if (reverseDigits) {
        return normalizeDateParts(Number(reverseDigits[3]), Number(reverseDigits[2]), Number(reverseDigits[1]));
    }

    const shortYearDigits = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2})$/);
    if (shortYearDigits) {
        const year = Number(shortYearDigits[3]);
        const fullYear = year >= 70 ? 1900 + year : 2000 + year;
        return normalizeDateParts(fullYear, Number(shortYearDigits[2]), Number(shortYearDigits[1]));
    }

    const dateOnlyPart = text.split(' ')[0];
    if (dateOnlyPart && dateOnlyPart !== text) {
        return parseDateValue(dateOnlyPart);
    }

    const fallback = new Date(text);
    if (!Number.isNaN(fallback.getTime())) {
        return normalizeDateParts(fallback.getFullYear(), fallback.getMonth() + 1, fallback.getDate());
    }

    return null;
};

const normalizeTimeParts = (hour: number, minute: number, second: number): string | null => {
    if (
        !Number.isFinite(hour) ||
        !Number.isFinite(minute) ||
        !Number.isFinite(second) ||
        hour < 0 ||
        hour > 23 ||
        minute < 0 ||
        minute > 59 ||
        second < 0 ||
        second > 59
    ) {
        return null;
    }

    return `${formatTwoDigits(hour)}:${formatTwoDigits(minute)}:${formatTwoDigits(second)}`;
};

const parseTimeValue = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;

    if (typeof value === 'number' && Number.isFinite(value)) {
        const serial = ((value % 1) + 1) % 1;
        const totalSeconds = Math.floor(serial * 86_400);
        return normalizeTimeParts(
            Math.floor(totalSeconds / 3600),
            Math.floor((totalSeconds % 3600) / 60),
            totalSeconds % 60
        );
    }

    if (value instanceof Date) {
        return normalizeTimeParts(value.getHours(), value.getMinutes(), value.getSeconds());
    }

    const text = String(value).trim();
    if (!text) return null;

    const normalized = text.replace(/\./g, ':');
    const match = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
        return normalizeTimeParts(Number(match[1]), Number(match[2]), Number(match[3] || 0));
    }

    return null;
};

const isEmptyRow = (rowData: Record<string, unknown>): boolean => {
    return Object.values(rowData).every((value) => {
        if (value === null || value === undefined) return true;
        return String(value).trim() === '';
    });
};

const isNumericLike = (value: string): boolean => {
    const normalized = value.trim().replace(',', '.');
    return normalized.length > 0 && !Number.isNaN(Number(normalized));
};

const detectHeaderRowIndex = (rows: unknown[][]): number => {
    const scanLimit = Math.min(rows.length, 20);
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let rowIndex = 0; rowIndex < scanLimit; rowIndex++) {
        const row = rows[rowIndex] || [];
        const cleaned = row
            .map((cell) => (cell === null || cell === undefined ? '' : String(cell).trim()))
            .filter((cell) => cell.length > 0);

        if (cleaned.length === 0) {
            continue;
        }

        const textCount = cleaned.filter((cell) => /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(cell)).length;
        const numericCount = cleaned.filter((cell) => isNumericLike(cell)).length;
        const uniqueCount = new Set(cleaned.map((cell) => normalizeHeader(cell))).size;

        // Prefer rows that look like headers: many non-empty/textual and mostly unique cells.
        const score = cleaned.length * 3 + textCount * 4 + uniqueCount * 2 - numericCount * 2;

        if (score > bestScore) {
            bestScore = score;
            bestIndex = rowIndex;
        }
    }

    return bestIndex;
};

const normalizeWorkbookCellValue = (value: ExcelJS.CellValue): unknown => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
        return value;
    }

    const objectValue = value as unknown as Record<string, unknown>;
    if ('result' in objectValue) return normalizeCellValue(objectValue.result);
    if (Array.isArray(objectValue.richText)) {
        return objectValue.richText
            .map((part) => (part && typeof part === 'object' && 'text' in part ? String(part.text) : ''))
            .join('');
    }
    if (typeof objectValue.text === 'string') return objectValue.text;
    if (typeof objectValue.hyperlink === 'string') return objectValue.hyperlink;
    return null;
};

const parseExcelRows = async (fileBuffer: Buffer): Promise<ParsedRow[]> => {
    const workbook = new ExcelJS.Workbook();
    // ExcelJS currently publishes its own Buffer type against an older Node
    // declaration. Multer's buffer is the same runtime object; keep the cast at
    // this narrow library boundary instead of weakening upload types globally.
    await workbook.xlsx.load(fileBuffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    if (workbook.worksheets.length > MAX_IMPORT_SHEETS) {
        throw new GuestImportValidationError(`Excel dosyasi en fazla ${MAX_IMPORT_SHEETS} sayfa içerebilir`);
    }

    const parsedRows: ParsedRow[] = [];
    let estimatedCellCount = 0;

    workbook.worksheets.forEach((worksheet) => {
        const rowCount = worksheet.rowCount;
        const columnCount = worksheet.columnCount;
        if (columnCount > MAX_IMPORT_COLUMNS) {
            throw new GuestImportValidationError(`Bir Excel sayfasinda en fazla ${MAX_IMPORT_COLUMNS} kolon olabilir`);
        }
        estimatedCellCount += rowCount * columnCount;
        if (estimatedCellCount > MAX_IMPORT_CELLS) {
            throw new GuestImportValidationError(`Excel dosyasi en fazla ${MAX_IMPORT_CELLS.toLocaleString('tr-TR')} hücre içerebilir`);
        }

        const rowNumbers: number[] = [];
        const rawRows: unknown[][] = [];
        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            const values: unknown[] = [];
            const boundedCellCount = Math.min(Math.max(row.cellCount, columnCount), MAX_IMPORT_COLUMNS);
            for (let columnIndex = 1; columnIndex <= boundedCellCount; columnIndex += 1) {
                values.push(normalizeWorkbookCellValue(row.getCell(columnIndex).value));
            }
            rowNumbers.push(rowNumber);
            rawRows.push(values);
        });

        if (rawRows.length === 0) return;

        const headerRowIndex = detectHeaderRowIndex(rawRows);
        const headerRow = rawRows[headerRowIndex] || [];
        const safeSheetName = sanitizeHeader(worksheet.name, 0);
        const usedRowKeys = new Set<string>();
        const headerKeys = headerRow.map((rawHeader, colIndex) => {
            return makeUniqueHeaderKey(sanitizeHeader(rawHeader, colIndex), usedRowKeys, colIndex);
        });

        for (let rowIndex = headerRowIndex + 1; rowIndex < rawRows.length; rowIndex++) {
            const dataRow = rawRows[rowIndex] || [];
            const rowData: Record<string, unknown> = {};
            const rowUsedKeys = new Set<string>();

            for (let colIndex = 0; colIndex < Math.max(headerKeys.length, dataRow.length); colIndex++) {
                const rawHeader = headerKeys[colIndex] || `COL_${colIndex + 1}`;
                const key = makeUniqueHeaderKey(rawHeader, rowUsedKeys, colIndex);
                rowData[key] = normalizeCellValue(dataRow[colIndex]);
            }

            parsedRows.push({
                sheetName: safeSheetName,
                rowNumber: rowNumbers[rowIndex] || rowIndex + 1,
                rowData
            });

            if (parsedRows.length > MAX_IMPORT_ROWS) {
                throw new GuestImportValidationError(`Excel dosyasi en fazla ${MAX_IMPORT_ROWS.toLocaleString('tr-TR')} veri satiri içerebilir`);
            }
        }
    });

    return parsedRows;
};

export const uploadGuestExcel = async (req: Request, res: Response): Promise<void> => {
    const uploadedFile = req.file;

    if (!uploadedFile) {
        res.status(400).json({ success: false, message: 'Excel dosyasi bulunamadi' });
        return;
    }

    try {
        if (!hasValidExcelSignature(uploadedFile.buffer)) {
            res.status(400).json({ success: false, message: 'Dosya içerigi geçerli bir Excel biçiminde degil' });
            return;
        }

        const parsedRows = await parseExcelRows(uploadedFile.buffer);
        const safeFileName = sanitizeFileName(uploadedFile.originalname);

        if (parsedRows.length === 0) {
            res.status(400).json({ success: false, message: 'Excel dosyasinda veri satiri bulunamadi' });
            return;
        }

        const createdBy = req.user?.userId || null;
        const clientIp = getClientIp(req);

        const client = await pool.connect();
        const rowErrors: Array<{ rowNumber: number; sheetName: string; reason: string }> = [];
        let insertedRows = 0;
        let skippedRows = 0;
        let previousRecordCount = 0;

        try {
            await client.query('BEGIN');

            // Ayni anda baslayan iki içe aktarma birbirinin verisini yarida kesemez.
            await client.query(`SELECT pg_advisory_xact_lock(hashtext('misafir_kayitlari_import'))`);
            const previousCountResult = await client.query('SELECT COUNT(*)::int AS count FROM misafir_kayitlari');
            previousRecordCount = previousCountResult.rows[0]?.count || 0;

            // Her yeni Excel yuklemesinde onceki tum kayitlari kaldirip tam yenileme yap.
            await client.query('TRUNCATE TABLE misafir_kayitlari');

            const activeRows = parsedRows.filter(row => {
                if (isEmptyRow(row.rowData)) {
                    skippedRows += 1;
                    return false;
                }
                return true;
            });

            // Paketler halinde (Batch Size = 500) veritabanına ekleyelim
            const batchSize = 500;
            for (let i = 0; i < activeRows.length; i += batchSize) {
                const chunk = activeRows.slice(i, i + batchSize);
                
                const valuePlaceholders: string[] = [];
                const queryValues: any[] = [];
                
                chunk.forEach((row, rowIndex) => {
                    const baseIndex = rowIndex * 7;
                    valuePlaceholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}::jsonb, $${baseIndex + 6}, $${baseIndex + 7})`);
                    queryValues.push(
                        uuidv4(),
                        safeFileName,
                        row.sheetName,
                        row.rowNumber,
                        JSON.stringify(row.rowData),
                        buildSearchText(row.rowData),
                        createdBy
                    );
                });

                const batchQuery = `
                    INSERT INTO misafir_kayitlari (
                        id,
                        excel_file_name,
                        sheet_name,
                        row_number,
                        row_data,
                        search_text,
                        created_by
                    ) VALUES ${valuePlaceholders.join(', ')}
                `;

                await client.query(batchQuery, queryValues);
                insertedRows += chunk.length;
            }

            await client.query('COMMIT');
        } catch (txError) {
            await client.query('ROLLBACK');

            rowErrors.push({
                rowNumber: 0,
                sheetName: 'GENEL',
                reason: txError instanceof Error ? txError.message : 'Bilinmeyen veritabani hatasi'
            });

            res.status(500).json({
                success: false,
                message: 'Excel verileri kaydedilirken hata olustu, hicbir kayit yazilmadi',
                summary: {
                    totalRows: parsedRows.length,
                    insertedRows: 0,
                    skippedRows,
                    failedRows: parsedRows.length - skippedRows,
                    errors: rowErrors
                }
            });
            return;
        } finally {
            client.release();
        }

        await logDataChange(
            'misafir_kayitlari',
            safeFileName,
            'INSERT',
            { record_count: previousRecordCount },
            {
                file_name: safeFileName,
                total_rows: parsedRows.length,
                inserted_rows: insertedRows,
                skipped_rows: skippedRows,
                replaced_rows: previousRecordCount
            },
            createdBy,
            clientIp
        );

        res.status(201).json({
            success: true,
            message: 'Excel dosyasi basariyla ice aktarildi',
            summary: {
                totalRows: parsedRows.length,
                insertedRows,
                skippedRows,
                failedRows: rowErrors.length,
                errors: rowErrors
            }
        });

    } catch (error) {
        console.error('Misafir Excel import error:', error);
        if (error instanceof GuestImportValidationError) {
            res.status(400).json({ success: false, message: error.message });
            return;
        }
        res.status(500).json({ success: false, message: 'Excel dosyasi islenirken hata olustu' });
    }
};

export const getGuestRecords = async (req: Request, res: Response): Promise<void> => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        const page = parseBoundedQueryInteger(req.query.page, 1, 1, 1_000_000);
        const limit = parseBoundedQueryInteger(req.query.limit, 50, 1, 500);

        const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        if (searchQuery.length > MAX_SEARCH_LENGTH) {
            res.status(400).json({
                success: false,
                message: `Arama metni en fazla ${MAX_SEARCH_LENGTH} karakter olabilir`
            });
            return;
        }
        const normalizedSearch = normalizeSearchText(searchQuery);
        const escapedSearch = normalizedSearch.replace(/[\\%_]/g, '\\$&');

        // Her sayfanın ilk satırı tüm kolonları, örnek satırlar da kolon tiplerini temsil eder.
        const sampleResult = await pool.query(
            `SELECT row_data
             FROM (
                 SELECT DISTINCT ON (sheet_name) row_data, sheet_name, row_number
                 FROM misafir_kayitlari
                 WHERE deleted_at IS NULL
                 ORDER BY sheet_name, row_number, id
             ) first_sheet_rows
             UNION ALL
             SELECT row_data
             FROM (
                 SELECT row_data
                 FROM misafir_kayitlari
                 WHERE deleted_at IS NULL
                 ORDER BY created_at ASC, sheet_name ASC, row_number ASC, id ASC
                 LIMIT 500
             ) sample_rows`
        );

        const orderedColumnKeys: string[] = [];
        const columnValueMap = new Map<string, unknown[]>();

        sampleResult.rows.forEach((row: any) => {
            const rowData = row.row_data || {};
            Object.entries(rowData).forEach(([key, value]) => {
                if (isHiddenGeneratedColumn(key)) {
                    return;
                }

                if (!columnValueMap.has(key)) {
                    columnValueMap.set(key, []);
                    orderedColumnKeys.push(key);
                }

                columnValueMap.get(key)?.push(value);
            });
        });

        const columns: GuestRegistryColumn[] = orderedColumnKeys.map((key, index) => ({
            key,
            label: key,
            type: inferColumnType(columnValueMap.get(key) || []),
            index
        }));

        // Toplam kayıt sayısını bulalım (SQL filtreleme ile)
        let countQuery = `
            SELECT COUNT(*) 
            FROM misafir_kayitlari 
            WHERE deleted_at IS NULL
        `;
        const countParams: any[] = [];
        if (searchQuery) {
            countQuery += `
                AND search_text LIKE $1 ESCAPE '\\'
            `;
            countParams.push(`%${escapedSearch}%`);
        }
        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count, 10);

        // Sayfalanmış veriyi çekelim (SQL filtreleme ve sayfalama ile)
        let dataQuery = `
            SELECT id, excel_file_name, sheet_name, row_number, row_data, created_at
            FROM misafir_kayitlari
            WHERE deleted_at IS NULL
        `;
        const dataParams: any[] = [];
        let paramIdx = 1;
        if (searchQuery) {
            dataQuery += `
                AND search_text LIKE $${paramIdx++} ESCAPE '\\'
            `;
            dataParams.push(`%${escapedSearch}%`);
        }

        dataQuery += `
            ORDER BY created_at ASC, sheet_name ASC, row_number ASC, id ASC
            LIMIT $${paramIdx++} OFFSET $${paramIdx++}
        `;

        const offset = (page - 1) * limit;
        dataParams.push(limit, offset);

        const dataResult = await pool.query(dataQuery, dataParams);

        const formattedData = dataResult.rows.map((row: any) => {
            const visibleRowData = Object.fromEntries(
                Object.entries(row.row_data || {}).filter(([key]) => !isHiddenGeneratedColumn(key))
            );
            return {
                id: row.id,
                excel_file_name: row.excel_file_name,
                sheet_name: row.sheet_name,
                row_number: row.row_number,
                row_data: visibleRowData,
                created_at: row.created_at
            };
        });

        res.status(200).json({
            success: true,
            data: formattedData,
            schema: {
                columns
            },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Misafir kayitlari listelenemedi:', error);
        res.status(500).json({ success: false, message: 'Misafir kayitlari listelenirken hata olustu' });
    }
};
