import fs from 'fs';

/**
 * Reads a secret from a mounted file first, then falls back to an environment
 * variable for local development. Secret values are never logged.
 */
export const readSecret = (
    environmentName: string,
    fileEnvironmentName: string
): string | undefined => {
    const filePath = process.env[fileEnvironmentName]?.trim();
    if (filePath) {
        try {
            const value = fs.readFileSync(filePath, 'utf8').trim();
            return value || undefined;
        } catch {
            throw new Error(`${fileEnvironmentName} ile belirtilen secret dosyası okunamadı`);
        }
    }

    const value = process.env[environmentName]?.trim();
    return value || undefined;
};
