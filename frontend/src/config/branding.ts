export interface SecurityAppConfig {
    siteName: string;
    applicationName: string;
}

const normalizeBrandValue = (value: unknown, fallback: string): string => {
    if (typeof value !== 'string') return fallback;
    const normalized = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    return normalized.length >= 2 && normalized.length <= 120 ? normalized : fallback;
};

export const BRANDING: SecurityAppConfig = {
    siteName: 'Güvenlik Sistemi',
    applicationName: 'Güvenlik Yönetim Sistemi',
};

export const loadBranding = async (): Promise<SecurityAppConfig> => {
    try {
        const response = await fetch('/branding/site.json', {
            cache: 'no-store',
            credentials: 'same-origin',
        });
        if (!response.ok) return BRANDING;

        const runtimeConfig = await response.json() as Partial<SecurityAppConfig>;
        const siteName = normalizeBrandValue(runtimeConfig.siteName, BRANDING.siteName);
        BRANDING.siteName = siteName;
        BRANDING.applicationName = normalizeBrandValue(
            runtimeConfig.applicationName,
            `${siteName} - Güvenlik Yönetimi`,
        );
    } catch {
        // Markalama yüklenemezse ana kayıt uygulaması genel adla çalışmaya devam eder.
    }

    return BRANDING;
};
