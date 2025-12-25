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

// SQL'i statement'lara böl ($$...$$ bloklarını koruyarak)
const splitSqlStatements = (sql: string): string[] => {
    const statements: string[] = [];
    let current = '';
    let inDollarQuote = false;

    // Satır satır işle
    const lines = sql.split('\n');

    for (const line of lines) {
        // Yorum satırlarını atla
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('--')) {
            continue;
        }

        current += line + '\n';

        // $$ bloğu kontrolü
        const dollarMatches = line.match(/\$\$/g);
        if (dollarMatches) {
            // $$ sayısına göre durumu değiştir
            for (let i = 0; i < dollarMatches.length; i++) {
                inDollarQuote = !inDollarQuote;
            }
        }

        // $$ bloğu içinde değilsek ve satır ; ile bitiyorsa, statement'ı tamamla
        if (!inDollarQuote && trimmedLine.endsWith(';')) {
            const stmt = current.trim();
            if (stmt.length > 0 && stmt !== ';') {
                statements.push(stmt);
            }
            current = '';
        }
    }

    // Son kalan statement
    const remaining = current.trim();
    if (remaining.length > 0 && remaining !== ';') {
        statements.push(remaining);
    }

    return statements;
};

// Migration dosyasını çalıştır
const executeMigration = async (filePath: string, fileName: string): Promise<boolean> => {
    try {
        const sql = fs.readFileSync(filePath, 'utf-8');

        // SQL'i statement'lara böl
        const statements = splitSqlStatements(sql);

        let skippedCount = 0;

        // Her statement'ı ayrı ayrı çalıştır (her biri kendi transaction'ında)
        for (const statement of statements) {
            const client = await pool.connect();
            try {
                await client.query(statement);
            } catch (stmtError) {
                const errorMessage = stmtError instanceof Error ? stmtError.message : '';
                // "already exists" hatalarını tolere et (tablo, index, constraint vb.)
                if (errorMessage.includes('already exists') ||
                    errorMessage.includes('duplicate key') ||
                    errorMessage.includes('zaten var') ||
                    errorMessage.includes('does not exist')) {
                    skippedCount++;
                    continue;
                }
                // Diğer hatalar için hata fırlat
                throw stmtError;
            } finally {
                client.release();
            }
        }

        if (skippedCount > 0) {
            console.log(`  ✅ ${fileName} başarıyla çalıştırıldı (${skippedCount} atlandı - zaten mevcut)`);
        } else {
            console.log(`  ✅ ${fileName} başarıyla çalıştırıldı`);
        }
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
        console.error(`  ❌ ${fileName} başarısız: ${errorMessage}`);
        return false;
    }
};

// Ana migration fonksiyonu
export const runMigrations = async (): Promise<void> => {
    console.log('🔄 Migration kontrolü başlıyor...');

    try {
        // Migration history tablosunu oluştur
        await createMigrationTable();

        // Migration klasörünün yolunu belirle
        // Docker'da /app/migrations, local'de ../../../database/migrations
        let migrationsDir = path.resolve(__dirname, '../../../database/migrations');

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
