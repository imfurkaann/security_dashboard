import multer from 'multer';

const MAX_FILE_SIZE_MB = Number(process.env.GUEST_EXCEL_MAX_FILE_SIZE_MB || '20');
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
    const fileName = file.originalname.toLowerCase();
    const hasExcelExtension = fileName.endsWith('.xls') || fileName.endsWith('.xlsx');

    if (allowedMimeTypes.has(file.mimetype) || hasExcelExtension) {
        cb(null, true);
        return;
    }

    cb(new Error('Sadece Excel dosyalari (.xls, .xlsx) yuklenebilir'));
};

export const guestExcelUpload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: 1
    }
});
