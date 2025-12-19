import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// SGK kayıtları için dosya yükleme klasörü
const UPLOAD_DIR = path.join(__dirname, '../../sgk_kayitlari');

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
 * TC'nin son 4 hanesini al
 */
export const getLastFourDigits = (tcNo: string): string => {
    const digits = tcNo.replace(/\D/g, '');
    return digits.slice(-4);
};

/**
 * Kısa unique ID oluştur (8 karakter)
 */
export const generateShortId = (): string => {
    return crypto.randomBytes(4).toString('hex');
};

/**
 * Dosya adını format'la: TCson4Hane_Ad_Soyad_UniqueID.ext
 */
export const formatFileName = (tcNo: string, fullName: string, extension: string): string => {
    const lastFour = getLastFourDigits(tcNo);
    // Ad soyadı temizle (Türkçe karakterler dahil, sadece özel karakterleri kaldır)
    const cleanName = fullName
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-ZğüşöçıİĞÜŞÖÇ_]/g, '');

    // Benzersiz ID ekle
    const uniqueId = generateShortId();

    return `${lastFour}_${cleanName}_${uniqueId}${extension}`;
};

/**
 * Multer storage configuration
 */
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        try {
            // Request body'den TC ve ad soyad al
            const tcNo = req.body.tc_no;
            const fullName = req.body.full_name;

            if (!tcNo || !fullName) {
                return cb(new Error('TC ve Ad Soyad zorunludur'), '');
            }

            // Dosya uzantısını al
            const ext = path.extname(file.originalname).toLowerCase();

            // Dosya adını oluştur
            const fileName = formatFileName(tcNo, fullName, ext);
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

    if (allowedMimeTypes.includes(file.mimetype)) {
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
        fileSize: 10 * 1024 * 1024, // 10MB limit
    }
});

/**
 * Dosya yolunu al
 */
export const getFilePath = (fileName: string): string => {
    return path.join(UPLOAD_DIR, fileName);
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
