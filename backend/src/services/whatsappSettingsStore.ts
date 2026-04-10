import pool from '../config/database';

const WHATSAPP_TARGET_SETTING_KEY = 'whatsapp.target_group_jid';

export const loadPersistedWhatsAppTargetJid = async (): Promise<string | null> => {
    try {
        const result = await pool.query<{ value: string | null }>(
            'SELECT value FROM system_settings WHERE key = $1 LIMIT 1',
            [WHATSAPP_TARGET_SETTING_KEY]
        );

        const value = result.rows[0]?.value?.trim();
        return value || null;
    } catch (error) {
        console.warn('WhatsApp target group DBden okunamadı, env fallback kullanılacak:', error);
        return null;
    }
};

export const persistWhatsAppTargetJid = async (jid: string): Promise<void> => {
    await pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [WHATSAPP_TARGET_SETTING_KEY, jid]
    );
};
