# Ekipman Teslim Alma ve Personel Giriş-Çıkış Sistemi

## 🎯 Özellikler

### 1. Ekipman Teslim Alma Sayfası

Personel sisteme giriş yaptıktan sonra, vardiyaya başlamadan önce ekipmanlarını kontrol ederek teslim alır.

**Kontrol Edilen Ekipmanlar:**

- 📺 Televizyon
- 🖥️ Monitör
- 📱 Telefon
- 🌡️ Alkol Metre

**Özellikler:**

- Her ekipman için "Onaylıyorum" / "Onaylamıyorum" seçeneği
- Onaylanmayan ekipmanlar için zorunlu açıklama alanı
- WhatsApp mesaj paylaşımı (opsiyonel)
- Otomatik kayıt tutma

### 2. Personel Giriş-Çıkış Kayıt Sistemi

Personelin sisteme giriş ve çıkış saatlerini otomatik olarak kaydeder.

**Kayıt Bilgileri:**

- Giriş tarihi ve saati
- Çıkış tarihi ve saati
- Giriş IP adresi
- Çıkış IP adresi

## 📊 Veritabanı Yapısı

### Personnel Records Tablosu

```sql
CREATE TABLE personnel_records (
    id SERIAL PRIMARY KEY,
    personnel_id INTEGER NOT NULL,
    login_time TIMESTAMP WITH TIME ZONE,
    logout_time TIMESTAMP WITH TIME ZONE,
    login_ip VARCHAR(45),
    logout_ip VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

### Equipment Checks Tablosu

```sql
CREATE TABLE equipment_checks (
    id SERIAL PRIMARY KEY,
    personnel_record_id INTEGER NOT NULL,
    personnel_id INTEGER NOT NULL,
    television_status BOOLEAN,
    monitor_status BOOLEAN,
    phone_status BOOLEAN,
    breathalyzer_status BOOLEAN,
    television_reason TEXT,
    monitor_reason TEXT,
    phone_reason TEXT,
    breathalyzer_reason TEXT,
    whatsapp_sent BOOLEAN,
    whatsapp_message TEXT,
    checked_at TIMESTAMP WITH TIME ZONE
);
```

## 🚀 Kurulum

### 1. Migration'ı Çalıştırın

**Windows:**

```bash
run-migration-015.bat
```

**Manual olarak:**

```bash
psql -U postgres -d security_management -f database/migrations/015_create_personnel_records_and_equipment_checks.sql
```

### 2. Backend'i Başlatın

Migration çalıştırıldıktan sonra backend otomatik olarak yeni endpoint'leri tanıyacaktır.

```bash
cd backend
npm run dev
```

### 3. Frontend'i Başlatın

```bash
cd frontend
npm run dev
```

## 📱 Kullanım Akışı

### Personel Giriş Akışı

1. **Login Sayfası** (`/login`)
   - Kullanıcı adı ve şifre ile giriş yapılır
   - Başarılı girişte `personnel_records` tablosuna giriş kaydı oluşturulur

2. **Ekipman Kontrol Sayfası** (`/equipment-check`)
   - Otomatik olarak yönlendirilir
   - Tüm ekipmanlar kontrol edilir
   - Onaylanmayan ekipmanlar için açıklama yazılır
   - "Onayla ve Devam Et" butonuna basılır
   - `equipment_checks` tablosuna kayıt oluşturulur

3. **WhatsApp Paylaşım Modal'ı** (Opsiyonel)
   - Ekipman kontrol raporu oluşturulur
   - WhatsApp'tan paylaşma seçeneği sunulur
   - Modal kapatılınca dashboard'a yönlendirilir

4. **Dashboard** (`/dashboard`)
   - Normal sistem kullanımı başlar

### Personel Çıkış Akışı

1. **Logout Butonu**
   - Dashboard'da "Çıkış Yap" butonuna basılır
   - Backend'e logout isteği gönderilir
   - `personnel_records` tablosunda çıkış saati güncellenir
   - Login sayfasına yönlendirilir

## 🔌 API Endpoints

### Equipment Check Endpoints

#### POST `/api/equipment-check`

Ekipman kontrolü kaydı oluşturur.

**Request Body:**

```json
{
  "television_status": true,
  "monitor_status": false,
  "phone_status": true,
  "breathalyzer_status": true,
  "monitor_reason": "Ekran çizik var"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Ekipman kontrolü kaydedildi",
  "data": {
    "whatsappMessage": "🔐 *Ekipman Teslim Alma Raporu*\n\n..."
  }
}
```

#### GET `/api/equipment-check/status`

Mevcut oturum için ekipman kontrolü durumunu kontrol eder.

**Response:**

```json
{
  "success": true,
  "data": {
    "hasActiveSession": true,
    "equipmentCheckCompleted": false
  }
}
```

### Auth Endpoint Updates

#### POST `/api/auth/login`

**Değişiklik:** Login'de `personnel_records` tablosuna giriş kaydı oluşturulur.

#### POST `/api/auth/logout`

**Değişiklik:** Logout'ta `personnel_records` tablosunda çıkış saati güncellenir.

## 📋 WhatsApp Mesaj Formatı

```
🔐 *Ekipman Teslim Alma Raporu*

👤 *Personel:* Ahmet Yılmaz
📅 *Tarih:* 23.12.2025
⏰ *Saat:* 08:30

✅ *Sağlam Teslim Alınan Ekipmanlar:*
  • Televizyon
  • Telefon
  • Alkol Metre

⚠️ *Sorunlu Ekipmanlar:*
  • Monitör
    _Açıklama: Ekran çizik var_
```

## 🔒 Güvenlik Özellikleri

- ✅ JWT Token doğrulaması (tüm endpoint'ler için)
- ✅ Input validasyonu (express-validator)
- ✅ SQL Injection koruması (parametreli sorgular)
- ✅ Rate limiting (brute force koruması)
- ✅ IP adresi logging (audit trail)
- ✅ Transaction kullanımı (veri bütünlüğü)

## 📊 Raporlama

### Personel Mesai Raporları

```sql
-- Belirli bir tarih aralığında personel giriş-çıkış kayıtları
SELECT 
    p.first_name || ' ' || p.last_name as personel,
    pr.login_time as giris,
    pr.logout_time as cikis,
    pr.logout_time - pr.login_time as calisma_suresi
FROM personnel_records pr
JOIN personnel p ON p.id = pr.personnel_id
WHERE pr.login_time::date BETWEEN '2025-01-01' AND '2025-01-31'
ORDER BY pr.login_time DESC;
```

### Ekipman Sorun Raporları

```sql
-- Sorunlu ekipman kayıtları
SELECT 
    p.first_name || ' ' || p.last_name as personel,
    ec.checked_at as tarih,
    CASE 
        WHEN NOT ec.television_status THEN 'Televizyon: ' || ec.television_reason
        WHEN NOT ec.monitor_status THEN 'Monitör: ' || ec.monitor_reason
        WHEN NOT ec.phone_status THEN 'Telefon: ' || ec.phone_reason
        WHEN NOT ec.breathalyzer_status THEN 'Alkol Metre: ' || ec.breathalyzer_reason
    END as sorun
FROM equipment_checks ec
JOIN personnel p ON p.id = ec.personnel_id
WHERE NOT (ec.television_status AND ec.monitor_status AND 
           ec.phone_status AND ec.breathalyzer_status)
ORDER BY ec.checked_at DESC;
```

## 🐛 Troubleshooting

### Problem: Migration çalışmıyor

**Çözüm:**

```bash
# PostgreSQL servisinin çalıştığından emin olun
# Windows Services'de "postgresql-x64-14" servisini kontrol edin

# Veritabanı bağlantısını test edin
psql -U postgres -d security_management -c "SELECT version();"
```

### Problem: Ekipman kontrol sayfası yüklenmiyor

**Çözüm:**

1. Migration'ın başarıyla çalıştığını kontrol edin
2. Backend console'da hata mesajlarını kontrol edin
3. Browser console'da network tab'ını kontrol edin

### Problem: WhatsApp mesajı oluşturulmuyor

**Çözüm:**

- Backend response'unda `whatsappMessage` field'ının olduğunu kontrol edin
- Controller'daki mesaj oluşturma kodunu kontrol edin

## 📝 Notlar

- Ekipman kontrolü her oturum için sadece bir kez yapılabilir
- Logout yapılmadan yeni giriş yapılırsa önceki oturum otomatik kapatılmaz
- WhatsApp paylaşımı opsiyoneldir, zorunlu değildir
- Tüm zaman bilgileri timezone aware olarak kaydedilir (TIMESTAMP WITH TIME ZONE)

## 🔄 Gelecek Geliştirmeler

- [ ] Ekipman kontrol geçmişini görüntüleme
- [ ] Personel mesai raporları sayfası
- [ ] Ekipman bakım takip sistemi
- [ ] Sorunlu ekipman bildirimleri
- [ ] Excel/PDF export özellikleri
