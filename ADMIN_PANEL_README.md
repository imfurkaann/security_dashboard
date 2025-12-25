# Admin Panel Sistemi - Kurulum Özeti

## Yapılan Değişiklikler

### 1. Backend

#### Yeni Dosyalar:
- `backend/src/routes/admin.ts` - Admin route'ları
- `backend/src/controllers/adminAuthController.ts` - Admin authentication controller
- `backend/src/middleware/adminAuth.ts` - Admin authentication middleware

#### Güncellenen Dosyalar:
- `backend/src/server.ts` - Admin route'ları eklendi

### 2. Frontend

#### Yeni Dosyalar:
- `frontend/src/pages/AdminLogin.tsx` - Admin giriş sayfası
- `frontend/src/pages/AdminDashboard.tsx` - Admin panel ana sayfa
- `frontend/src/pages/AdminVehicleRecords.tsx` - Admin araç kayıtları sayfası
- `frontend/src/components/AdminProtectedRoute.tsx` - Admin route koruma komponenti

#### Güncellenen Dosyalar:
- `frontend/src/App.tsx` - Admin route'ları eklendi

### 3. Database

**Yeni tablo oluşturulmadı** - Mevcut `personnel` tablosu kullanılıyor.

## Kullanım

### Admin Girişi

1. URL: `http://localhost:5174/admin/login`
2. Giriş bilgileri: `personnel` tablosunda `role='admin'` olan kullanıcılar

### Admin Paneli Özellikleri

1. **Dashboard** - `/admin/dashboard`
   - Sistemdeki tüm istatistikler görüntülenir
   - Kullanımdaki araçlar, içerideki ziyaretçiler, müdürler, bugünkü alarmlar

2. **Araç Kayıtları** - `/admin/vehicle-records`
   - Tüm araç kayıtları görüntülenir ve filtrelenebilir
   - Normal kullanıcıların gördüğü ile aynı tasarım ve özellikler

### Admin Yetkilendirmesi

- Sadece `personnel` tablosunda `role='admin'` olan kullanıcılar admin paneline erişebilir
- Admin login ayrı endpoint kullanır: `/api/admin/login`
- JWT token'da `isAdmin: true` flag'i bulunur
- Admin middleware tüm admin route'larını korur

## Test

1. Backend'i yeniden başlatın:
   ```bash
   cd backend
   npm run dev
   ```

2. Frontend'i başlatın:
   ```bash
   cd frontend
   npm run dev
   ```

3. Admin kullanıcısı ile giriş yapın:
   - URL: http://localhost:5174/admin/login
   - Kullanıcı adı: personnel tablosundaki admin kullanıcı
   - Şifre: ilgili kullanıcının şifresi

## Güvenlik

- Admin middleware her istekte role='admin' kontrolü yapar
- JWT token'da isAdmin flag'i bulunması zorunludur
- Rate limiting tüm admin endpoint'lerine uygulanır
- Admin çıkış yaptığında personnel_records tablosuna logout kaydı düşer
