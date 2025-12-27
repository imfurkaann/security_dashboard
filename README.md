# 🛡️ Güvenlik Yönetim Paneli

Otel ve işyeri güvenlik personeli için geliştirilmiş modern yönetim sistemi.

## 🚀 Hızlı Başlangıç (Docker ile)

### İlk Kurulum (Sadece 1 Kez)

1. **`KURULUM.bat`** dosyasına çift tıklayın
2. Gerekli kontroller yapılacak ve masaüstüne kısayollar eklenecek
3. Docker Desktop kurulu değilse indirme sayfası açılacak

### Sistemi Başlatma

**Sadece bu bilgisayardan erişim için:**

- Masaüstündeki **"Guvenlik Sistemi"** kısayoluna çift tıklayın

**Aynı WiFi ağındaki cihazlardan erişim için:**

- Masaüstündeki **"Guvenlik Sistemi (Ag Erisimi)"** kısayoluna çift tıklayın
- Bu mod firewall kurallarını ayarlar

### Sistemi Durdurma

- Masaüstündeki **"Guvenlik Sistemi DURDUR"** kısayoluna tıklayın
- veya açık pencereyi kapatın

## 📱 Ağdan Erişim

Sistem başlatıldığında ekranda görünen ağ adresini diğer cihazlara girin:

```
http://192.168.1.X:80
```

Aynı WiFi ağındaki:

- 📱 Telefonlar
- 📱 Tabletler  
- 💻 Diğer bilgisayarlar

sisteme bu adres üzerinden erişebilir.

## 📁 Dosya Yapısı

```
├── KURULUM.bat              # İlk kurulum (1 kez çalıştır)
├── BASLATICI.bat            # Normal başlatma
├── BASLATICI_YONETICI.bat   # Yönetici modunda başlatma
├── DURDUR.bat               # Sistemi durdur
├── ACCESS_INFO.txt          # Erişim bilgileri (otomatik oluşur)
├── docker-compose.yml       # Docker yapılandırması
├── backend/                 # API sunucusu
└── frontend/                # Web arayüzü
```

## ✨ Özellikler

- 👥 Personel ve Müdür Yönetimi
- 🚗 Araç Kayıt Sistemi
- 👤 Ziyaretçi Takibi
- 🔥 Yangın Alarm Kayıtları
- 📝 Olay Kayıtları
- 📊 İstatistik ve Raporlar
- 🔐 Güvenli Authentication (JWT)
- 🛡️ Role-Based Access Control
- 📊 Gelişmiş Filtreleme
- 🗄️ Audit Trail (Tüm işlemler loglanır)
- ♻️ Soft Delete (Veri kaybı yok)

## 🔧 Teknoloji Stack

### Backend

- Node.js + Express + TypeScript
- PostgreSQL
- JWT Authentication

### Frontend

- Vite + React + TypeScript
- Tailwind CSS

### Deployment

- Docker + Docker Compose

## 🛡️ Güvenlik Özellikleri

- ✅ Güvenlik kamerası IP aralıklarından kaçınma
- ✅ Dinamik port ataması (çakışma önleme)
- ✅ Otomatik firewall kural yönetimi
- ✅ JWT token tabanlı kimlik doğrulama
- ✅ Rate limiting
- ✅ CORS koruması

## 🔨 Geliştirici Modu

Docker yerine manuel geliştirme için:

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Database

PostgreSQL 14+ gereklidir.

```bash
createdb security_management
```

## ❓ Sorun Giderme

### Docker Desktop başlamıyor

- Windows'u yeniden başlatın
- Hyper-V ve WSL2 özelliklerinin aktif olduğundan emin olun

### Ağdan erişilemiyor

- "Ag Erisimi" modunda başlattığınızdan emin olun
- Firewall kurallarını kontrol edin
- Aynı WiFi ağında olduğunuzdan emin olun

### Port çakışması

- Sistem otomatik olarak uygun port bulur
- ACCESS_INFO.txt dosyasından güncel portu öğrenin

## 👨‍💻 Geliştirici

Furkan - Security Management System
