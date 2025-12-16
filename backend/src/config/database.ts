import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Veritabanı yapılandırma kontrolü
const requiredEnvVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
const missingVars = requiredEnvVars.filter(v => !process.env[v]);

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
    password: process.env.DB_PASSWORD,
    // Bağlantı havuzu ayarları
    max: 20,                        // Maksimum bağlantı sayısı
    min: 2,                         // Minimum bağlantı sayısı
    idleTimeoutMillis: 30000,       // Boşta bekleme süresi (30sn)
    connectionTimeoutMillis: 5000,  // Bağlantı zaman aşımı (5sn)
    // Karakter kodlaması
    client_encoding: 'UTF8',
    // SSL (production için, Cloud SQL ve Docker hariç)
    ...(process.env.NODE_ENV === 'production' && !isCloudSQL && !isDocker && {
        ssl: {
            rejectUnauthorized: false
        }
    })
};

const pool = new Pool(poolConfig);

// Bağlantı event'leri
pool.on('connect', (client) => {
    console.log('✅ Yeni veritabanı bağlantısı oluşturuldu');
    // Türkçe karakter desteği ve timezone ayarı
    client.query("SET client_encoding = 'UTF8'");
    client.query("SET timezone = 'Europe/Istanbul'");
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
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('✅ Veritabanı bağlantı testi başarılı');
        return true;
    } catch (error) {
        console.error('❌ Veritabanı bağlantı testi başarısız:', error);
        return false;
    }
};

export default pool;
