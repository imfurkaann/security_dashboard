import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { readSecret } from '../config/secrets';

// SGK kayıtları için dosya yükleme klasörü
const UPLOAD_DIR = path.join(__dirname, '../../sgk_kayitlari');
const identifierHashKey = readSecret('PII_HASH_KEY', 'PII_HASH_KEY_FILE')
    || readSecret('JWT_SECRET', 'JWT_SECRET_FILE');

if (!identifierHashKey) {
    throw new Error('PII_HASH_KEY/PII_HASH_KEY_FILE veya JWT secret tanımlanmalıdır');
}

const parseUploadLimitMb = (value: string | undefined, fallbackMb: number): number => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallbackMb;
    }

    return parsed;
};

const looksLikeMojibake = (value: string): boolean => {
    return /Ã|Å|Ä|Ð|Ñ|â/.test(value);
};

const normalizeMultipartText = (value: string | undefined): string | undefined => {
    if (!value || !looksLikeMojibake(value)) {
        return value;
    }

    const fixed = Buffer.from(value, 'latin1').toString('utf8');
    return fixed.includes('�') ? value : fixed;
};

export const SGK_MAX_FILE_SIZE_MB = parseUploadLimitMb(process.env.SGK_MAX_FILE_SIZE_MB, 50);
export const SGK_MAX_FILE_SIZE_BYTES = SGK_MAX_FILE_SIZE_MB * 1024 * 1024;

export const SGK_MAX_TOTAL_UPLOAD_SIZE_MB = parseUploadLimitMb(process.env.SGK_MAX_TOTAL_UPLOAD_SIZE_MB, 50);
export const SGK_MAX_TOTAL_UPLOAD_SIZE_BYTES = SGK_MAX_TOTAL_UPLOAD_SIZE_MB * 1024 * 1024;
export const SGK_MAX_FILE_COUNT = Math.max(
    1,
    Math.min(Number.parseInt(process.env.SGK_MAX_FILE_COUNT || '25', 10) || 25, 100)
);

// Klasör yoksa oluştur
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * TC Kimlik numarasını hash'le (KVKK uyumu için)
 */
export const hashTC = (tcNo: string): string => {
    return `h1:${crypto.createHmac('sha256', identifierHashKey).update(`tc:${tcNo}`).digest('hex')}`;
};

export const getTCHashCandidates = (tcNo: string): string[] => [
    hashTC(tcNo),
    crypto.createHash('sha256').update(tcNo).digest('hex')
];

/**
 * Pasaport numarasını hash'le (KVKK uyumu için)
 */
export const hashPassport = (passportNo: string): string => {
    const normalized = passportNo.toUpperCase().trim();
    return `h1:${crypto.createHmac('sha256', identifierHashKey).update(`passport:${normalized}`).digest('hex')}`;
};

export const getPassportHashCandidates = (passportNo: string): string[] => {
    const normalized = passportNo.toUpperCase().trim();
    return [
        hashPassport(normalized),
        crypto.createHash('sha256').update(normalized).digest('hex')
    ];
};

/**
 * TC'nin son 4 hanesini al
 */
export const getLastFourDigits = (tcNo: string): string => {
    const digits = tcNo.replace(/\D/g, '');
    return digits.slice(-4);
};

/**
 * Pasaport numarasının son 4 karakterini al
 */
export const getLastFourChars = (passportNo: string): string => {
    const clean = passportNo.toUpperCase().trim();
    return clean.slice(-4);
};

/**
 * Kısa unique ID oluştur (8 karakter)
 */
export const generateShortId = (): string => {
    return crypto.randomBytes(4).toString('hex');
};

/**
 * Dosya adını format'la
 * TC varsa: TCson4Hane_Ad_Soyad_UniqueID.ext
 * Pasaport varsa: Pasaportson4Hane_Ad_Soyad_UniqueID.ext
 * Hiçbiri yoksa: Ad_Soyad_UUID.ext
 */
export const formatFileName = (fullName: string, extension: string, tcNo?: string, passportNo?: string): string => {
    // Ad soyadı temizle (Türkçe karakterler dahil, sadece özel karakterleri kaldır)
    const cleanName = fullName
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ_]/g, '');

    // Benzersiz ID ekle
    const uniqueId = generateShortId();

    let prefix = '';

    if (tcNo) {
        // TC varsa son 4 hane
        prefix = getLastFourDigits(tcNo);
    } else if (passportNo) {
        // Pasaport varsa son 4 karakter
        prefix = getLastFourChars(passportNo);
    } else {
        // Hiçbiri yoksa sadece isim-uuid
        return `${cleanName}_${uniqueId}${extension}`;
    }

    return `${prefix}_${cleanName}_${uniqueId}${extension}`;
};;

/**
 * Multer storage configuration
 */
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        try {
            const normalizedOriginalName = normalizeMultipartText(file.originalname);
            if (normalizedOriginalName) {
                file.originalname = normalizedOriginalName;
            }

            // Request body'den TC, pasaport ve ad soyad al
            const tcNo = req.body.tc_no;
            const passportNo = req.body.passport_no;
            const fullName = normalizeMultipartText(req.body.full_name);

            if (fullName) {
                req.body.full_name = fullName;
            }

            if (!fullName) {
                return cb(new Error('Ad Soyad zorunludur'), '');
            }

            // TC veya pasaport en az biri olmalı (ama zorunlu değil - UUID ile kayıt olabilir)
            // Dosya adı için hangisi varsa onu kullan

            // Dosya uzantısını al
            const ext = path.extname(file.originalname).toLowerCase();

            // Dosya adını oluştur
            const fileName = formatFileName(fullName, ext, tcNo, passportNo);
            cb(null, fileName);
        } catch (error) {
            cb(error as Error, '');
        }
    }
});

/**
 * File filter - PDF, JPG, JPEG, PNG dosyalarına izin ver
 */
const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Fallback: some mobile browsers/providers send PDFs as application/octet-stream
    // so also allow by file extension when mimetype is generic
    const ext = path.extname(file.originalname || '').toLowerCase();
    const isGenericMime = !file.mimetype || file.mimetype === 'application/octet-stream';

    const isPdf = ext === '.pdf' && (file.mimetype === 'application/pdf' || isGenericMime);
    const isJpeg = ['.jpg', '.jpeg'].includes(ext) && (['image/jpeg', 'image/jpg'].includes(file.mimetype) || isGenericMime);
    const isPng = ext === '.png' && (file.mimetype === 'image/png' || isGenericMime);

    if (isPdf || isJpeg || isPng) {
        cb(null, true);
    } else {
        cb(new Error('Sadece PDF, JPG, JPEG ve PNG dosyaları yüklenebilir'));
    }
};

/**
 * Multer middleware
 */
export const sgkUpload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: SGK_MAX_FILE_SIZE_BYTES,
        files: SGK_MAX_FILE_COUNT
    }
});

const hasAllowedFileSignature = (file: Express.Multer.File): boolean => {
    const filePath = (file as any).path as string | undefined;
    if (!filePath) return false;

    let descriptor: number | null = null;
    try {
        descriptor = fs.openSync(filePath, 'r');
        const header = Buffer.alloc(12);
        const bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
        const ext = path.extname(file.originalname || file.filename || '').toLowerCase();

        if (ext === '.pdf') {
            return bytesRead >= 5 && header.subarray(0, 5).toString('ascii') === '%PDF-';
        }

        if (ext === '.jpg' || ext === '.jpeg') {
            return bytesRead >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
        }

        if (ext === '.png') {
            return bytesRead >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        }

        return false;
    } catch (error) {
        console.error('SGK file signature validation failed:', error);
        return false;
    } finally {
        if (descriptor !== null) fs.closeSync(descriptor);
    }
};

export const collectUploadedFiles = (req: Express.Request): Express.Multer.File[] => {
    const filesFromSingle = (req as any).file ? [((req as any).file as Express.Multer.File)] : [];
    const files = (req as any).files as unknown;

    if (!files) {
        return filesFromSingle;
    }

    if (Array.isArray(files)) {
        return [...filesFromSingle, ...files];
    }

    const filesMap = files as { [fieldname: string]: Express.Multer.File[] };
    const filesFromFields = Object.values(filesMap).flat();
    return [...filesFromSingle, ...filesFromFields];
};

export const enforceSgkTotalUploadLimit: import('express').RequestHandler = (req, res, next) => {
    const uploadedFiles = collectUploadedFiles(req);
    const totalBytes = uploadedFiles.reduce((sum, file) => sum + (file.size || 0), 0);

    const cleanup = () => uploadedFiles.forEach((file) => {
        if (file && (file as any).filename) {
            try {
                deleteFile((file as any).filename);
            } catch (error) {
                console.error('Rejected SGK upload could not be cleaned up:', error);
            }
        }
    });

    if (uploadedFiles.length > SGK_MAX_FILE_COUNT) {
        cleanup();
        res.status(413).json({
            success: false,
            message: `Tek seferde en fazla ${SGK_MAX_FILE_COUNT} belge yüklenebilir.`
        });
        return;
    }

    if (uploadedFiles.some((file) => file.fieldname !== 'pdf_files')) {
        cleanup();
        res.status(400).json({ success: false, message: 'Geçersiz dosya alanı.' });
        return;
    }

    if (uploadedFiles.some((file) => !hasAllowedFileSignature(file))) {
        cleanup();
        res.status(400).json({
            success: false,
            message: 'Dosya içeriği geçersiz. Yalnızca gerçek PDF, JPG ve PNG belgeleri kabul edilir.'
        });
        return;
    }

    if (totalBytes <= SGK_MAX_TOTAL_UPLOAD_SIZE_BYTES) {
        next();
        return;
    }

    cleanup();

    res.status(413).json({
        success: false,
        message: `Toplam yükleme boyutu çok büyük. En fazla ${SGK_MAX_TOTAL_UPLOAD_SIZE_MB}MB olabilir.`
    });
};

/**
 * Dosya yolunu al (absolute path garantili)
 */
export const getFilePath = (fileName: string): string => {
    if (!fileName || path.basename(fileName) !== fileName || fileName.includes('\0')) {
        throw new Error('Geçersiz saklanan dosya adı');
    }

    const resolvedPath = path.resolve(UPLOAD_DIR, fileName);
    const uploadRoot = path.resolve(UPLOAD_DIR) + path.sep;
    if (!resolvedPath.startsWith(uploadRoot)) {
        throw new Error('Dosya yolu yükleme klasörü dışında olamaz');
    }

    return resolvedPath;
};

/**
 * Dosyanın var olup olmadığını kontrol et
 */
export const fileExists = (fileName: string): boolean => {
    const filePath = getFilePath(fileName);
    return fs.existsSync(filePath);
};

/**
 * Dosyayı sil
 */
export const deleteFile = (fileName: string): void => {
    const filePath = getFilePath(fileName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
};
