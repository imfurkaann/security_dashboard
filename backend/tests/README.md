# Test Dizini

Bu dizinde araç kayıt sistemi için güvenlik ve doğrulama testleri bulunmaktadır.

## Dizin Yapısı

```
tests/
├── integration/          # Integration testleri
│   └── vehicleRecords.test.ts
├── unit/                # Unit testleri (gelecekte eklenecek)
├── setup.ts            # Test setup dosyası
└── SECURITY_TEST_REPORT.md
```

## Test Çalıştırma

```bash
# Tüm testleri çalıştır
npm test

# Coverage ile çalıştır
npm test -- --coverage

# Watch modunda çalıştır
npm run test:watch

# Belirli bir test dosyası
npm test vehicleRecords.test.ts
```

## Test Kategorileri

1. **Valid Cases**: Normal kullanım senaryoları
2. **SQL Injection**: SQL enjeksiyon saldırılarına karşı koruma
3. **XSS Protection**: Cross-site scripting koruması
4. **Validation**: Girdi doğrulama testleri
5. **Authentication**: Yetkilendirme testleri
6. **Transaction**: İşlem bütünlüğü testleri

## Not

Testler çalıştırılmadan önce:

- PostgreSQL veritabanının çalışır durumda olması gerekir
- `.env.test` dosyasında test veritabanı ayarları yapılmalıdır
- Test veritabanı oluşturulmalıdır (opsiyonel: ayrı test DB kullanmak için)
