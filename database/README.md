# Database Setup Guide

## PostgreSQL Kurulumu

### 1. PostgreSQL İndirme ve Kurma

- [PostgreSQL Download](https://www.postgresql.org/download/)
- Windows için: PostgreSQL 14+ versiyonunu indirin
- Kurulum sırasında şifrenizi unutmayın!

### 2. Database Oluşturma

PowerShell veya CMD'de:

```bash
# PostgreSQL'e bağlan
psql -U postgres

# Database oluştur
CREATE DATABASE security_management;

# Bağlantıyı test et
\c security_management
\q
```

### 3. Schema'yı Yükleme

```bash
# Schema dosyasını çalıştır
psql -U postgres -d security_management -f schema.sql
```

### 4. Backend .env Dosyasını Güncelle

`backend/.env` dosyasını oluşturun (`.env.example` dosyasını kopyalayın):

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=security_management
DB_USER=postgres
DB_PASSWORD=your_actual_password
```

## Database Yapısı

### Tablolar

1. **users** - Personeller ve Müdürler
2. **shifts** - Vardiya kayıtları
3. **vehicles** - Araç giriş/çıkış kayıtları
4. **visitors** - Ziyaretçi kayıtları
5. **incidents** - Olay kayıtları
6. **manager_logins** - Müdür giriş kayıtları
7. **audit_log** - Tüm işlemlerin log kaydı

### Özellikler

- ✅ **UUID** kullanımı (güvenli ID'ler)
- ✅ **Soft Delete** (deleted_at kolonu)
- ✅ **Audit Trail** (audit_log tablosu)
- ✅ **Indexing** (hızlı sorgular)
- ✅ **Timestamps** (otomatik güncelleme)
- ✅ **Foreign Keys** (veri bütünlüğü)

## Backup ve Restore

### Backup Alma

```bash
pg_dump -U postgres security_management > backup.sql
```

### Restore Etme

```bash
psql -U postgres security_management < backup.sql
```
