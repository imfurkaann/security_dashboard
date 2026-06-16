import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import pool from '../config/database';
import { getClientIp } from '../middleware/rateLimiter';
import { logDataChange } from '../utils/auditLog';
import { sanitizePlainText } from '../utils/validation';
import { emitApiMutation, resolveMutationTopics } from '../realtime/socket';

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

const normalizeHeader = (value: string): string => {
    const repaired = fixPotentialMojibake(String(value));
    return normalizeSearchText(repaired).replace(/[^a-z0-9]/g, '');
};

const sanitizeCell = (value: unknown, maxLength: number): string | null => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    if (!text) return null;
    return sanitizePlainText(text, maxLength);
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
        const parsed = XLSX.SSF.parse_date_code(value);
        if (!parsed) return null;
        return normalizeDateParts(parsed.y, parsed.m, parsed.d);
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
        const serial = value >= 1 ? value % 1 : value;
        const parsed = XLSX.SSF.parse_date_code(serial);
        if (!parsed) return null;
        return normalizeTimeParts(parsed.H || 0, parsed.M || 0, Math.floor(parsed.S || 0));
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

const parseExcelRows = (fileBuffer: Buffer): ParsedRow[] => {
    const workbook = XLSX.read(fileBuffer, {
        type: 'buffer',
        cellDates: true,
        raw: false
    });

    const parsedRows: ParsedRow[] = [];

    workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) return;

        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
            header: 1,
            defval: null,
            raw: false,
            blankrows: false
        });

        if (rawRows.length === 0) return;

        const headerRowIndex = detectHeaderRowIndex(rawRows);
        const headerRow = rawRows[headerRowIndex] || [];
        const usedRowKeys = new Set<string>();
        const headerKeys = headerRow.map((rawHeader, colIndex) => {
            const key = rawHeader ? String(rawHeader).trim() : '';
            return makeUniqueHeaderKey(key || `COL_${colIndex + 1}`, usedRowKeys, colIndex);
        });

        for (let rowIndex = headerRowIndex + 1; rowIndex < rawRows.length; rowIndex++) {
            const dataRow = rawRows[rowIndex] || [];
            const rowData: Record<string, unknown> = {};
            const rowUsedKeys = new Set<string>();

            for (let colIndex = 0; colIndex < Math.max(headerKeys.length, dataRow.length); colIndex++) {
                const rawHeader = headerKeys[colIndex] || `COL_${colIndex + 1}`;
                const key = makeUniqueHeaderKey(rawHeader, rowUsedKeys, colIndex);
                rowData[key] = dataRow[colIndex] ?? null;
            }

            parsedRows.push({
                sheetName,
                rowNumber: rowIndex + 1,
                rowData
            });
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
        const parsedRows = parseExcelRows(uploadedFile.buffer);

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

        try {
            await client.query('BEGIN');

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
                    const baseIndex = rowIndex * 6;
                    valuePlaceholders.push(`($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}::jsonb, $${baseIndex + 6})`);
                    queryValues.push(
                        uuidv4(),
                        uploadedFile.originalname,
                        row.sheetName,
                        row.rowNumber,
                        JSON.stringify(row.rowData),
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
            uploadedFile.originalname,
            'INSERT',
            null,
            {
                file_name: uploadedFile.originalname,
                total_rows: parsedRows.length,
                inserted_rows: insertedRows,
                skipped_rows: skippedRows
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

        emitApiMutation({
            method: 'POST',
            path: '/api/guest-registry/upload',
            statusCode: 201,
            timestamp: new Date().toISOString(),
            clientId: req.header('x-realtime-client-id')?.trim() || null,
            topics: resolveMutationTopics('/api/guest-registry/upload'),
        });
    } catch (error) {
        console.error('Misafir Excel import error:', error);
        res.status(500).json({ success: false, message: 'Excel dosyasi islenirken hata olustu' });
    }
};

export const getGuestRecords = async (req: Request, res: Response): Promise<void> => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);

        const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const normalizedSearch = normalizeSearchText(searchQuery);

        // Schema ve kolon tiplerini çıkarmak için 500 satırlık küçük bir örneklem alalım
        const sampleResult = await pool.query(
            `SELECT row_data 
             FROM misafir_kayitlari 
             WHERE deleted_at IS NULL 
             LIMIT 500`
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
                AND EXISTS (
                    SELECT 1 FROM jsonb_each_text(row_data)
                    WHERE translate(lower(value), 'çğıöşüı', 'cgiosui') LIKE $1
                )
            `;
            countParams.push(`%${normalizedSearch}%`);
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
                AND EXISTS (
                    SELECT 1 FROM jsonb_each_text(row_data)
                    WHERE translate(lower(value), 'çğıöşüı', 'cgiosui') LIKE $${paramIdx++}
                )
            `;
            dataParams.push(`%${normalizedSearch}%`);
        }

        dataQuery += `
            ORDER BY created_at ASC, sheet_name ASC, row_number ASC
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
