import pool from './database';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Migration Runner
 * Backend başladığında veritabanı migration'larını otomatik çalıştırır.
 * Her migration sadece bir kez çalışır (migration_history tablosunda takip edilir).
 */

// Migration history tablosunu oluştur
const createMigrationTable = async (): Promise<void> => {
    const query = `
        CREATE TABLE IF NOT EXISTS migration_history (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) UNIQUE NOT NULL,
            executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            success BOOLEAN DEFAULT TRUE
        );
    `;
    await pool.query(query);
};

// Çalıştırılmış migration'ları getir
const getExecutedMigrations = async (): Promise<string[]> => {
    const result = await pool.query(
        'SELECT migration_name FROM migration_history WHERE success = TRUE ORDER BY id'
    );
    return result.rows.map(row => row.migration_name);
};

// Migration'ı kaydet
const recordMigration = async (name: string, success: boolean): Promise<void> => {
    await pool.query(
        'INSERT INTO migration_history (migration_name, success) VALUES ($1, $2) ON CONFLICT (migration_name) DO UPDATE SET success = $2, executed_at = NOW()',
        [name, success]
    );
};

// Migration dosyasını çalıştır
const executeMigration = async (filePath: string, fileName: string): Promise<boolean> => {
    const client = await pool.connect();
    try {
        const sql = fs.readFileSync(filePath, 'utf-8');
        
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('COMMIT');
        
        console.log(`  ✅ ${fileName} başarıyla çalıştırıldı`);
        return true;
    } catch (error) {
        await client.query('ROLLBACK');
        const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
        console.error(`  ❌ ${fileName} başarısız: ${errorMessage}`);
        return false;
    } finally {
        client.release();
    }
};

// Ana migration fonksiyonu
export const runMigrations = async (): Promise<void> => {
    console.log('🔄 Migration kontrolü başlıyor...');
    
    try {
        // Migration history tablosunu oluştur
        await createMigrationTable();
        
        // Migration klasörünün yolunu belirle
        // Docker'da /app/migrations, local'de ../../database/migrations
        let migrationsDir = path.resolve(__dirname, '../../database/migrations');
        
        // Docker ortamında farklı yol kullan
        if (process.env.NODE_ENV === 'production') {
            const dockerPath = '/app/migrations';
            if (fs.existsSync(dockerPath)) {
                migrationsDir = dockerPath;
            }
        }
        
        // Migration klasörü yoksa oluştur veya atla
        if (!fs.existsSync(migrationsDir)) {
            console.log('⚠️ Migration klasörü bulunamadı, atlanıyor...');
            return;
        }
        
        // Migration dosyalarını al ve sırala
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();
        
        if (files.length === 0) {
            console.log('ℹ️ Migration dosyası bulunamadı.');
            return;
        }
        
        // Çalıştırılmış migration'ları al
        const executedMigrations = await getExecutedMigrations();
        
        // Bekleyen migration'ları bul
        const pendingMigrations = files.filter(f => !executedMigrations.includes(f));
        
        if (pendingMigrations.length === 0) {
            console.log('✅ Tüm migration\'lar zaten çalıştırılmış.');
            return;
        }
        
        console.log(`📋 ${pendingMigrations.length} bekleyen migration bulundu:`);
        
        // Her migration'ı sırayla çalıştır
        for (const file of pendingMigrations) {
            const filePath = path.join(migrationsDir, file);
            console.log(`\n  🔹 ${file} çalıştırılıyor...`);
            
            const success = await executeMigration(filePath, file);
            await recordMigration(file, success);
            
            if (!success) {
                console.error(`\n❌ Migration durdu: ${file} başarısız oldu.`);
                console.error('Lütfen hatayı düzeltin ve tekrar çalıştırın.');
                // Migration hatasında uygulamayı durdurmayalım, sadece logla
                break;
            }
        }
        
        console.log('\n✅ Migration kontrolü tamamlandı.');
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
        console.error('❌ Migration hatası:', errorMessage);
        // Migration hatasında uygulamayı durdurmayalım
    }
};

export default runMigrations;
