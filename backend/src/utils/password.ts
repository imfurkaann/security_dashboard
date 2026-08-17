import bcrypt from 'bcryptjs';

const configuredRounds = Number.parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const BCRYPT_ROUNDS = Number.isInteger(configuredRounds) && configuredRounds >= 10 && configuredRounds <= 14
    ? configuredRounds
    : 12;

export const validateNewPassword = (
    password: unknown,
    username?: string | null
): { valid: true } | { valid: false; message: string } => {
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
        return { valid: false, message: 'Şifre 12-128 karakter arasında olmalıdır' };
    }

    if (/\s/.test(password)) {
        return { valid: false, message: 'Şifre boşluk içeremez' };
    }

    const characterGroups = [/[a-zçğıöşü]/, /[A-ZÇĞİÖŞÜ]/, /\d/, /[^\p{L}\p{N}]/u]
        .filter((pattern) => pattern.test(password)).length;
    if (characterGroups < 3) {
        return { valid: false, message: 'Şifre küçük harf, büyük harf, rakam ve özel karakter gruplarından en az üçünü içermelidir' };
    }

    const normalizedUsername = String(username || '').trim().toLocaleLowerCase('tr-TR');
    if (normalizedUsername.length >= 3 && password.toLocaleLowerCase('tr-TR').includes(normalizedUsername)) {
        return { valid: false, message: 'Şifre kullanıcı adını içeremez' };
    }

    return { valid: true };
};

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export const hashPassword = async (password: string): Promise<string> => {
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    return bcrypt.hash(password, salt);
};

/**
 * Compare plain text password with hashed password
 * @param password - Plain text password
 * @param hashedPassword - Hashed password from database
 * @returns True if passwords match
 */
export const comparePassword = async (
    password: string,
    hashedPassword: string
): Promise<boolean> => {
    return bcrypt.compare(password, hashedPassword);
};
