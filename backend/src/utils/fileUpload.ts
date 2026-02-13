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
            // Request body'den TC, pasaport ve ad soyad al
            const tcNo = req.body.tc_no;
            const passportNo = req.body.passport_no;
            const fullName = req.body.full_name;

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
