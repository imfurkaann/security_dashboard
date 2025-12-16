import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const personnel = [
    { firstName: 'Raziye', lastName: 'Toraman', username: 'raziye.toraman', password: 'raziye.toraman123', role: 'personnel' },
    { firstName: 'Ferhat', lastName: 'Kurt', username: 'ferhat.kurt', password: 'ferhat.kurt123', role: 'personnel' },
    { firstName: 'Ahmet', lastName: 'Akgül', username: 'ahmet.akgul', password: 'ahmet.akgul123', role: 'personnel' },
    { firstName: 'Mustan', lastName: 'Bozdağ', username: 'mustan.bozdag', password: 'mustan.bozdag123', role: 'personnel' },
    { firstName: 'Hatice', lastName: 'Öztürk', username: 'hatice.ozturk', password: 'hatice.ozturk123', role: 'personnel' },
    { firstName: 'Furkan', lastName: 'Çelik', username: 'furkan.celik', password: 'furkan.celik123', role: 'personnel' },
    { firstName: 'Hanifi', lastName: 'Çelik', username: 'hanifi.celik', password: 'hanifi.celik123', role: 'personnel' },
    { firstName: 'İsmail', lastName: 'Aksoy', username: 'ismail.aksoy', password: 'ismail.aksoy123', role: 'personnel' },
    { firstName: 'Umut', lastName: 'Hıncal', username: 'umut.hincal', password: 'umut.hincal123', role: 'personnel' },
    { firstName: 'Adem', lastName: 'Çelik', username: 'adem.celik', password: 'adem.celik0585', role: 'admin' }
];

const vehicles = [
    { plate: '07BEE763', brand: 'Otokar Atlas' },
    { plate: '07AEN693', brand: 'Ford Transit' },
    { plate: '07ABJ290', brand: 'Fiat Doblo' },
    { plate: '07CCU63', brand: 'Opel Vivaro' }
];

async function generateSQL() {
    let sql = '';

    sql += '-- =====================================================\n';
    sql += '-- Veritabanı Verilerini Sıfırlama ve Yeni Veriler ile Doldurma\n';
    sql += '-- Encoding: UTF-8\n';
    sql += '-- =====================================================\n\n';

    sql += '-- =====================================================\n';
    sql += '-- PERSONNEL TABLOSU - YENİ KAYITLAR\n';
    sql += '-- =====================================================\n';

    for (const person of personnel) {
        const hashedPassword = await bcrypt.hash(person.password, 10);
        sql += `INSERT INTO personnel (id, first_name, last_name, username, password, role, is_active)\n`;
        sql += `VALUES (gen_random_uuid(), '${person.firstName}', '${person.lastName}', '${person.username}', '${hashedPassword}', '${person.role}', true);\n`;
    }

    sql += '\n-- =====================================================\n';
    sql += '-- VEHICLES TABLOSU - YENİ KAYITLAR\n';
    sql += '-- =====================================================\n';

    for (const vehicle of vehicles) {
        sql += `INSERT INTO vehicles (id, plate, brand, is_active)\n`;
        sql += `VALUES (gen_random_uuid(), '${vehicle.plate}', '${vehicle.brand}', true);\n`;
    }

    sql += '\n-- =====================================================\n';
    sql += '-- Tamamlandı\n';
    sql += '-- =====================================================\n';

    // Dosyayı database klasörüne yaz
    const outputPath = path.join(__dirname, '..', '..', '..', 'database', 'reset_data.sql');
    fs.writeFileSync(outputPath, sql, 'utf8');
    console.log('✅ reset_data.sql başarıyla oluşturuldu!');
}

generateSQL().catch(console.error);
