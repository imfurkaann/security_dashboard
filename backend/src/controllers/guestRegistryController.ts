import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as XLSX from 'xlsx';
import pool from '../config/database';
import { getClientIp } from '../middleware/rateLimiter';
import { logDataChange } from '../utils/auditLog';
import { sanitizePlainText } from '../utils/validation';

interface ParsedRow {
    sheetName: string;
    rowNumber: number;
    rowData: Record<string, unknown>;
}

const EXPECTED_HEADERS = new Set([
    'voucher',
    'acenta',
    'hitap',
    'adi',
    'soyadi',
    'oda',
    'yetiskin',
    'cocuk',
    'free',
    'konaklama',
    'giristarihi',
    'geceleme',
    'gecelme',
    'cikistarihi',
    'girissaati',
    'istenen',
    'verilen',
    'ulke'
]);

interface GuestExcelColumns {
    voucher: string | null;
    acenta: string | null;
    hitap: string | null;
    adi: string | null;
    soyadi: string | null;
    oda: string | null;
    yetiskin: string | null;
    cocuk: string | null;
    free: string | null;
    konaklama: string | null;
    giris_tarihi: string | null;
    geceleme: string | null;
    cikis_tarihi: string | null;
    giris_saati: string | null;
    istenen: string | null;
    verilen: string | null;
    ulke: string | null;
}

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

const getCellByAliases = (lookup: Map<string, unknown>, aliases: string[]): unknown => {
    for (const alias of aliases) {
        const value = lookup.get(alias);
        if (value !== undefined) {
            return value;
        }
    }

    return null;
};

const mapExcelColumns = (rowData: Record<string, unknown>): GuestExcelColumns => {
    const lookup = new Map<string, unknown>();

    Object.entries(rowData).forEach(([key, value]) => {
        lookup.set(normalizeHeader(key), value);
    });

    return {
        voucher: sanitizeCell(getCellByAliases(lookup, ['voucher']), 100),
        acenta: sanitizeCell(getCellByAliases(lookup, ['acenta', 'acente']), 150),
        hitap: sanitizeCell(getCellByAliases(lookup, ['hitap']), 50),
        adi: sanitizeCell(getCellByAliases(lookup, ['adi', 'ad']), 120),
        soyadi: sanitizeCell(getCellByAliases(lookup, ['soyadi', 'soyad']), 120),
        oda: sanitizeCell(getCellByAliases(lookup, ['oda']), 50),
        yetiskin: sanitizeCell(getCellByAliases(lookup, ['yetiskin']), 20),
        cocuk: sanitizeCell(getCellByAliases(lookup, ['cocuk']), 20),
        free: sanitizeCell(getCellByAliases(lookup, ['free']), 20),
        konaklama: sanitizeCell(getCellByAliases(lookup, ['konaklama']), 50),
        giris_tarihi: parseDateValue(getCellByAliases(lookup, ['giristarihi'])),
        geceleme: sanitizeCell(getCellByAliases(lookup, ['geceleme', 'gecelme']), 50),
        cikis_tarihi: parseDateValue(getCellByAliases(lookup, ['cikistarihi'])),
        giris_saati: parseTimeValue(getCellByAliases(lookup, ['girissaati'])),
        istenen: sanitizeCell(getCellByAliases(lookup, ['istenen']), 200),
        verilen: sanitizeCell(getCellByAliases(lookup, ['verilen']), 200),
        ulke: sanitizeCell(getCellByAliases(lookup, ['ulke']), 100)
    };
};

const detectHeaderRowIndex = (rows: unknown[][]): number => {
    let bestIndex = 0;
    let bestScore = -1;

    rows.forEach((row, rowIndex) => {
        const score = row.reduce<number>((acc: number, cell: unknown) => {
            if (cell === null || cell === undefined) return acc;
            const normalized = normalizeHeader(String(cell));
            return EXPECTED_HEADERS.has(normalized) ? acc + 1 : acc;
        }, 0);

        if (score > bestScore) {
            bestScore = score;
            bestIndex = rowIndex;
        }
    });

    return bestScore > 0 ? bestIndex : 0;
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

        for (let rowIndex = headerRowIndex + 1; rowIndex < rawRows.length; rowIndex++) {
            const dataRow = rawRows[rowIndex] || [];
            const rowData: Record<string, unknown> = {};

            for (let colIndex = 0; colIndex < Math.max(headerRow.length, dataRow.length); colIndex++) {
                const rawHeader = headerRow[colIndex];
                const key = rawHeader ? String(rawHeader).trim() : `COL_${colIndex + 1}`;
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

            for (const row of parsedRows) {
                if (isEmptyRow(row.rowData)) {
                    skippedRows += 1;
                    continue;
                }

                const mapped = mapExcelColumns(row.rowData);

                await client.query(
                    `INSERT INTO misafir_kayitlari (
                        id,
                        excel_file_name,
                        sheet_name,
                        row_number,
                        row_data,
                        voucher,
                        acenta,
                        hitap,
                        adi,
                        soyadi,
                        oda,
                        yetiskin,
                        cocuk,
                        free,
                        konaklama,
                        giris_tarihi,
                        geceleme,
                        cikis_tarihi,
                        giris_saati,
                        istenen,
                        verilen,
                        ulke,
                        created_by
                    ) VALUES (
                        $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11,
                        $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
                    )`,
                    [
                        uuidv4(),
                        uploadedFile.originalname,
                        row.sheetName,
                        row.rowNumber,
                        JSON.stringify(row.rowData),
                        mapped.voucher,
                        mapped.acenta,
                        mapped.hitap,
                        mapped.adi,
                        mapped.soyadi,
                        mapped.oda,
                        mapped.yetiskin,
                        mapped.cocuk,
                        mapped.free,
                        mapped.konaklama,
                        mapped.giris_tarihi,
                        mapped.geceleme,
                        mapped.cikis_tarihi,
                        mapped.giris_saati,
                        mapped.istenen,
                        mapped.verilen,
                        mapped.ulke,
                        createdBy
                    ]
                );

                insertedRows += 1;
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
    } catch (error) {
        console.error('Misafir Excel import error:', error);
        res.status(500).json({ success: false, message: 'Excel dosyasi islenirken hata olustu' });
    }
};

export const getGuestRecords = async (req: Request, res: Response): Promise<void> => {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
        const offset = (page - 1) * limit;

        const voucherQuery = typeof req.query.voucher === 'string' ? req.query.voucher.trim() : '';
        const acentaQuery = typeof req.query.acenta === 'string' ? req.query.acenta.trim() : '';
        const adiQuery = typeof req.query.adi === 'string' ? req.query.adi.trim() : '';
        const soyadiQuery = typeof req.query.soyadi === 'string' ? req.query.soyadi.trim() : '';
        const girisTarihiQuery = typeof req.query.giris_tarihi === 'string' ? req.query.giris_tarihi.trim() : '';
        const girisSaatiQuery = typeof req.query.giris_saati === 'string' ? req.query.giris_saati.trim() : '';
        const odaQuery = typeof req.query.oda === 'string' ? req.query.oda.trim() : '';
        const ulkeQuery = typeof req.query.ulke === 'string' ? req.query.ulke.trim() : '';
        const searchQuery = typeof req.query.search === 'string' ? req.query.search.trim() : '';

        const conditions: string[] = ['deleted_at IS NULL'];
        const params: Array<string | number> = [];

        const addParam = (value: string | number): string => {
            params.push(value);
            return `$${params.length}`;
        };

        const normalizedFieldExpr = (fieldName: string): string =>
            `translate(lower(coalesce(${fieldName}::text, '')), 'cgioisuçğıöşü', 'cgioisucgiosu')`;

        if (voucherQuery) {
            const param = addParam(`%${voucherQuery}%`);
            conditions.push(`coalesce(voucher, '') ILIKE ${param}`);
        }

        if (acentaQuery) {
            const param = addParam(`%${normalizeSearchText(acentaQuery)}%`);
            conditions.push(`${normalizedFieldExpr('acenta')} LIKE ${param}`);
        }

        if (adiQuery) {
            const param = addParam(`%${normalizeSearchText(adiQuery)}%`);
            conditions.push(`${normalizedFieldExpr('adi')} LIKE ${param}`);
        }

        if (soyadiQuery) {
            const param = addParam(`%${normalizeSearchText(soyadiQuery)}%`);
            conditions.push(`${normalizedFieldExpr('soyadi')} LIKE ${param}`);
        }

        if (girisTarihiQuery) {
            const normalizedDate = parseDateValue(girisTarihiQuery);
            if (normalizedDate) {
                const param = addParam(normalizedDate);
                conditions.push(`giris_tarihi = ${param}::date`);
            }
        }

        if (girisSaatiQuery) {
            const normalizedTime = parseTimeValue(girisSaatiQuery);
            if (normalizedTime) {
                const param = addParam(normalizedTime);
                conditions.push(`giris_saati = ${param}::time`);
            }
        }

        if (odaQuery) {
            const param = addParam(`%${odaQuery}%`);
            conditions.push(`coalesce(oda, '') ILIKE ${param}`);
        }

        if (ulkeQuery) {
            const param = addParam(`%${normalizeSearchText(ulkeQuery)}%`);
            conditions.push(`${normalizedFieldExpr('ulke')} LIKE ${param}`);
        }

        if (searchQuery) {
            const normalizedSearch = `%${normalizeSearchText(searchQuery)}%`;
            const searchParam = addParam(normalizedSearch);
            const rawSearchParam = addParam(`%${searchQuery}%`);

            conditions.push(`(
                ${normalizedFieldExpr('voucher')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('acenta')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('hitap')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('adi')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('soyadi')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('oda')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('yetiskin')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('cocuk')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('free')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('konaklama')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('giris_tarihi')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('geceleme')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('cikis_tarihi')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('giris_saati')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('istenen')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('verilen')} LIKE ${searchParam}
                OR ${normalizedFieldExpr('ulke')} LIKE ${searchParam}
                OR row_data::text ILIKE ${rawSearchParam}
            )`);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const countResult = await pool.query(
            `SELECT COUNT(*)::int as total FROM misafir_kayitlari ${whereClause}`,
            params
        );

        const total = countResult.rows[0]?.total || 0;

        const selectParams = [...params, limit, offset];
        const dataResult = await pool.query(
            `SELECT
                id,
                excel_file_name,
                sheet_name,
                row_number,
                row_data,
                voucher,
                acenta,
                hitap,
                adi,
                soyadi,
                oda,
                yetiskin,
                cocuk,
                free,
                konaklama,
                to_char(giris_tarihi, 'YYYY-MM-DD') as giris_tarihi,
                geceleme,
                to_char(cikis_tarihi, 'YYYY-MM-DD') as cikis_tarihi,
                to_char(giris_saati, 'HH24:MI:SS') as giris_saati,
                istenen,
                verilen,
                ulke,
                created_at
             FROM misafir_kayitlari
             ${whereClause}
                 ORDER BY created_at ASC, sheet_name ASC, row_number ASC
             LIMIT $${params.length + 1}
             OFFSET $${params.length + 2}`,
            selectParams
        );

        res.status(200).json({
            success: true,
            data: dataResult.rows,
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
