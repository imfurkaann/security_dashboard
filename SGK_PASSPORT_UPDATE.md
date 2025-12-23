# SGK Kayıtları - Pasaport Numarası Desteği

## Yapılan Değişiklikler (23 Aralık 2025)

### 📋 Özet

SGK kayıt sistemine pasaport numarası desteği eklendi. Artık hem TC Kimlik No hem de Pasaport Numarası ile kayıt yapılabilir.

### 🔄 Mantık

- **TC veya Pasaport**: Hangisi girilirse o kullanılır (ikisi birden girilemez)
- **Zorunlu Değil**: İkisi de girilmezse kayıt UUID ile oluşturulur
- **Dosya Adlandırma**:
  - TC varsa: `TCson4Hane_Ad_Soyad_UniqueID.pdf`
  - Pasaport varsa: `Pasaportson4Hane_Ad_Soyad_UniqueID.pdf`
  - İkisi de yoksa: `Ad_Soyad_UUID.pdf`

### 📁 Değiştirilen Dosyalar

#### 1. Database Migration

**Dosya**: `database/migrations/017_add_passport_to_sgk.sql`

- `hashed_passport` kolonu eklendi
- TC unique constraint kaldırıldı (artık NULL olabilir)
- Check constraint eklendi (TC veya Pasaport'tan biri mutlaka dolu olmalı)
- Index eklendi

#### 2. Backend - File Upload Utils

**Dosya**: `backend/src/utils/fileUpload.ts`

- `hashPassport()` fonksiyonu eklendi
- `getLastFourChars()` fonksiyonu eklendi (pasaport için)
- `formatFileName()` güncellendi - TC/Pasaport/UUID mantığı eklendi
- Multer storage güncellendi

#### 3. Backend - Controller

**Dosya**: `backend/src/controllers/sgkController.ts`

- `createSgkRecord()`: Pasaport desteği eklendi
- `searchSgkRecords()`: Pasaport ile arama eklendi
- `getSgkRecords()`: hashed_passport kolonu eklendi
- `updateSgkRecord()`: Pasaport güncellemesi eklendi
- Validasyonlar: TC ve pasaport aynı anda girilemez kontrolü

#### 4. Frontend - Types

**Dosya**: `frontend/src/types/index.ts`

- `SgkRecord`: `hashed_passport` alanı eklendi
- `SgkFormData`: `passport_no` alanı eklendi
- `SgkSearchData`: `passport` search type eklendi

#### 5. Frontend - UI

**Dosya**: `frontend/src/pages/Sgk.tsx`

- Upload Modal: TC ve Pasaport yan yana grid layout
- Edit Modal: TC ve Pasaport yan yana grid layout
- Search Form: "Pasaport No" arama türü eklendi
- Form validasyonları güncellendi
- Input onChange'lerde cross-clear mantığı (biri girilince diğeri temizlenir)

### 🔒 Güvenlik (KVKK Uyumlu)

- Pasaport numaraları SHA-256 ile hash'lenerek saklanır
- Arama sırasında hash karşılaştırması yapılır
- Dosya adında sadece son 4 karakter kullanılır

### ✅ Özellikler

1. **Kayıt Ekleme**:
   - TC veya Pasaport seçeneklerinden biri seçilir
   - Biri girilince diğeri otomatik temizlenir
   - İkisi birden girilemez

2. **Arama**:
   - TC Kimlik No ile arama
   - Pasaport No ile arama
   - Ad Soyad ile arama
   - Firma Adı ile arama

3. **Düzenleme**:
   - Kayıt düzenlerken TC veya Pasaport değiştirilebilir
   - Dosya opsiyonel olarak değiştirilebilir

### 🚀 Migration Nasıl Çalıştırılır?

```bash
# PostgreSQL'e bağlan
psql -U postgres -d security_db

# Migration'ı çalıştır
\i database/migrations/017_add_passport_to_sgk.sql
```

### 📝 Notlar

- Mevcut TC'li kayıtlar etkilenmez
- Pasaport numaraları 6-20 karakter arası olmalıdır
- TC numaraları hala 11 hane olarak kontrol edilir
- Sistem geriye dönük uyumludur

### 🧪 Test Senaryoları

1. TC ile yeni kayıt ekle ✅
2. Pasaport ile yeni kayıt ekle ✅
3. TC ile kayıt ara ✅
4. Pasaport ile kayıt ara ✅
5. TC'li kaydı pasaport'lu olarak güncelle ✅
6. İkisini birden girmeye çalış (hata almalı) ✅
