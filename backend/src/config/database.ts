import { Pool, PoolClient, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import { readSecret } from './secrets';

dotenv.config();

const databasePassword = readSecret('DB_PASSWORD', 'DB_PASSWORD_FILE');
// Veritabanı yapılandırma kontrolü
const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);
if (!databasePassword) missingVars.push('DB_PASSWORD veya DB_PASSWORD_FILE');

if (missingVars.length > 0) {
    console.error('❌ Eksik veritabanı yapılandırması:', missingVars.join(', '));
    console.error('Lütfen .env dosyasını kontrol edin.');
    process.exit(1);
}

// Google Cloud SQL Unix Socket desteği
// DB_HOST /cloudsql/project:region:instance formatında ise Unix socket kullan
const isCloudSQL = process.env.DB_HOST?.startsWith('/cloudsql/');
// Docker içinde SSL kullanma (postgres container)
const isDocker = process.env.DB_HOST === 'postgres';
const parsedPoolMax = Number.parseInt(process.env.DB_POOL_MAX || '20', 10);
const poolMax = Number.isSafeInteger(parsedPoolMax) && parsedPoolMax >= 2 && parsedPoolMax <= 100
    ? parsedPoolMax
    : 20;

const poolConfig: PoolConfig = {
    // Cloud SQL için Unix socket, diğerleri için TCP
    ...(isCloudSQL ? {
        host: process.env.DB_HOST,
    } : {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
    }),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: databasePassword,
    // Bağlantı havuzu ayarları
    max: poolMax,                   // Maksimum bağlantı sayısı
    min: 2,                         // Minimum bağlantı sayısı
    idleTimeoutMillis: 30000,       // Boşta bekleme süresi (30sn)
    connectionTimeoutMillis: 5000,  // Bağlantı zaman aşımı (5sn)
    statement_timeout: 30000,
    query_timeout: 35000,
    application_name: 'security-management-api',
    // Karakter kodlaması
    client_encoding: 'UTF8',
    // SSL (production için, Cloud SQL ve Docker hariç)
    ...(process.env.NODE_ENV === 'production' && !isCloudSQL && !isDocker && {
        ssl: {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
        }
    })
};

const pool = new Pool(poolConfig);

// Bağlantı event'leri
pool.on('connect', (client) => {
    console.log('✅ Yeni veritabanı bağlantısı oluşturuldu');
    // Türkçe karakter desteği ve timezone ayarı
    void client.query("SET client_encoding = 'UTF8'; SET timezone = 'Europe/Istanbul'; SET lock_timeout = '5s'; SET idle_in_transaction_session_timeout = '30s'")
        .catch((error) => console.error('Veritabanı oturum güvenlik ayarları uygulanamadı:', error.message));
});

pool.on('error', (err) => {
    console.error('❌ Beklenmeyen veritabanı hatası:', err.message);
    // Production'da uygulamayı kapatma, sadece logla
    if (process.env.NODE_ENV !== 'production') {
        process.exit(-1);
    }
});

pool.on('remove', () => {
    console.log('ℹ️ Veritabanı bağlantısı havuzdan kaldırıldı');
});

// Bağlantı test fonksiyonu
export const testConnection = async (): Promise<boolean> => {
    let client: PoolClient | null = null;
    try {
        client = await pool.connect();
        await client.query('SELECT 1');
        console.log('✅ Veritabanı bağlantı testi başarılı');
        return true;
    } catch (error) {
        console.error('❌ Veritabanı bağlantı testi başarısız:', error);
        return false;
    } finally {
        client?.release();
    }
};

export default pool;
