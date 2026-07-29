import { NextFunction, Request, Response } from 'express';
import multer, { MulterError } from 'multer';

const parsePositiveNumber = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const GUEST_EXCEL_MAX_FILE_SIZE_MB = parsePositiveNumber(
    process.env.GUEST_EXCEL_MAX_FILE_SIZE_MB,
    20
);
const MAX_FILE_SIZE_BYTES = GUEST_EXCEL_MAX_FILE_SIZE_MB * 1024 * 1024;

const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
    const fileName = file.originalname.toLowerCase();
    const hasExcelExtension = fileName.endsWith('.xls') || fileName.endsWith('.xlsx');
    const hasAllowedMimeType = allowedMimeTypes.has(file.mimetype)
        || file.mimetype === 'application/octet-stream';

    if (hasExcelExtension && hasAllowedMimeType) {
        cb(null, true);
        return;
    }

    cb(new Error('Sadece geçerli Excel dosyaları (.xls, .xlsx) yüklenebilir'));
};

const guestExcelUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: 1
    }
});

export const uploadGuestExcelFile = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    guestExcelUpload.single('file')(req, res, (error?: unknown) => {
        if (!error) {
            next();
            return;
        }

        if (error instanceof MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                res.status(413).json({
                    success: false,
                    message: `Excel dosyası en fazla ${GUEST_EXCEL_MAX_FILE_SIZE_MB} MB olabilir`
                });
                return;
            }

            res.status(400).json({
                success: false,
                message: 'Excel dosyası yüklenemedi'
            });
            return;
        }

        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : 'Geçersiz Excel dosyası'
        });
    });
};
