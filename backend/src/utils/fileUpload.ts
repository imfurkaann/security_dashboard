import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// SGK kayıtları için dosya yükleme klasörü
const UPLOAD_DIR = path.join(__dirname, '../../sgk_kayitlari');

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

// Klasör yoksa oluştur
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * TC Kimlik numarasını hash'le (KVKK uyumu için)
 */
export const hashTC = (tcNo: string): string => {
    return crypto.createHash('sha256').update(tcNo).digest('hex');
};

/**
 * Pasaport numarasını hash'le (KVKK uyumu için)
 */
export const hashPassport = (passportNo: string): string => {
    return crypto.createHash('sha256').update(passportNo.toUpperCase().trim()).digest('hex');
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
    const allowedMimeTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png'
    ];

    // Fallback: some mobile browsers/providers send PDFs as application/octet-stream
    // so also allow by file extension when mimetype is generic
    const ext = path.extname(file.originalname || '').toLowerCase();

    if (allowedMimeTypes.includes(file.mimetype) || (ext === '.pdf' && (file.mimetype === 'application/octet-stream' || !file.mimetype))) {
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
        fileSize: SGK_MAX_FILE_SIZE_BYTES
    }
});

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

    if (totalBytes <= SGK_MAX_TOTAL_UPLOAD_SIZE_BYTES) {
        next();
        return;
    }

    uploadedFiles.forEach((file) => {
        if (file && (file as any).filename) {
            deleteFile((file as any).filename);
        }
    });

    res.status(413).json({
        success: false,
        message: `Toplam yükleme boyutu çok büyük. En fazla ${SGK_MAX_TOTAL_UPLOAD_SIZE_MB}MB olabilir.`
    });
};

/**
 * Dosya yolunu al (absolute path garantili)
 */
export const getFilePath = (fileName: string): string => {
    return path.resolve(UPLOAD_DIR, fileName);
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
