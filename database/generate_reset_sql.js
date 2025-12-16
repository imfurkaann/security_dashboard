/**
 * Şifreleri hashleyip SQL script oluşturur
 * Kullanım: node generate_reset_sql.js
 */

const bcrypt = require('bcryptjs');

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
    console.log('-- =====================================================');
    console.log('-- Veritabanı Verilerini Sıfırlama ve Yeni Veriler ile Doldurma');
    console.log('-- Encoding: UTF-8');
    console.log('-- =====================================================\n');

    console.log('-- Tüm kayıtları temizle');
    console.log('TRUNCATE TABLE audit_log CASCADE;');
    console.log('TRUNCATE TABLE shift_reports CASCADE;');
    console.log('TRUNCATE TABLE fire_alarms CASCADE;');
    console.log('TRUNCATE TABLE incident_records CASCADE;');
    console.log('TRUNCATE TABLE managers_records CASCADE;');
    console.log('TRUNCATE TABLE visitor_records CASCADE;');
    console.log('TRUNCATE TABLE vehicle_records CASCADE;');
    console.log('TRUNCATE TABLE vehicles CASCADE;');
    console.log('TRUNCATE TABLE shifts CASCADE;');
    console.log('TRUNCATE TABLE personnel CASCADE;\n');

    console.log('-- =====================================================');
    console.log('-- PERSONNEL TABLOSU - YENİ KAYITLAR');
    console.log('-- =====================================================');

    for (const person of personnel) {
        const hashedPassword = await bcrypt.hash(person.password, 10);
        console.log(`INSERT INTO personnel (id, first_name, last_name, username, password_hash, role, is_active)`);
        console.log(`VALUES (uuid_generate_v4(), '${person.firstName}', '${person.lastName}', '${person.username}', '${hashedPassword}', '${person.role}', true);`);
    }

    console.log('\n-- =====================================================');
    console.log('-- VEHICLES TABLOSU - YENİ KAYITLAR');
    console.log('-- =====================================================');

    for (const vehicle of vehicles) {
        console.log(`INSERT INTO vehicles (id, plate, brand, is_active)`);
        console.log(`VALUES (uuid_generate_v4(), '${vehicle.plate}', '${vehicle.brand}', true);`);
    }

    console.log('\n-- =====================================================');
    console.log('-- Tamamlandı');
    console.log('-- =====================================================');
}

generateSQL().catch(console.error);
