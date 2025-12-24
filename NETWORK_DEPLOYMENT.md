# 🌐 Yerel Ağda Paylaşımlı Deployment Rehberi

Bu rehber, Security Management uygulamasını yerel ağda (WiFi) paylaşımlı olarak çalıştırmak için hazırlanmıştır.

## 📋 Önemli Notlar

- ✅ **Mevcut veritabanı verileri korunur** - Hiçbir veri silinmez
- ✅ **local_backup.sql yüklenmez** - Bu bilgisayardaki veriler diğer bilgisayara aktarılmaz
- ✅ **Aynı WiFi ağındaki tüm cihazlar** uygulamaya erişebilir

---

## 🚀 Hızlı Başlangıç

### Windows

```batch
start-network.bat
```

### Linux/Mac

```bash
chmod +x start-network.sh
./start-network.sh
```

---

## 📦 Manuel Kurulum

### 1. IP Adresini Öğrenin

**Windows:**

```powershell
ipconfig | findstr "IPv4"
```

**Linux/Mac:**

```bash
hostname -I | awk '{print $1}'
# veya Mac için:
ipconfig getifaddr en0
```

### 2. Environment Değişkenlerini Ayarlayın

Bilgisayarınızın IP adresi örneğin `192.168.1.100` ise:

**Windows (PowerShell):**

```powershell
$env:HOST_IP = "192.168.1.100"
$env:VITE_API_URL = "http://192.168.1.100:5000/api"
```

**Linux/Mac:**

```bash
export HOST_IP="192.168.1.100"
export VITE_API_URL="http://192.168.1.100:5000/api"
```

### 3. Docker Compose'u Başlatın

```bash
docker compose -f docker-compose.network.yml up --build -d
```

---

## 🔗 Erişim Adresleri

| Cihaz | Adres |
|-------|-------|
| Bu bilgisayar | <http://localhost> |
| Ağdaki diğer cihazlar | http://[IP_ADRESINIZ] |
| API (Backend) | http://[IP_ADRESINIZ]:5000/api |

---

## 🛡️ Güvenlik Duvarı Ayarları

### Windows Güvenlik Duvarı

Eğer ağdaki diğer cihazlar bağlanamıyorsa:

1. **Windows Defender Güvenlik Duvarı** → **Gelişmiş Ayarlar**
2. **Gelen Kurallar** → **Yeni Kural**
3. **Port** seçin → **TCP** → Portlar: `80, 5000, 5432`
4. **Bağlantıya İzin Ver** → Tüm ağ türleri için uygulayın
5. Kural adı: "Security Management App"

Veya PowerShell ile:

```powershell
New-NetFirewallRule -DisplayName "Security Management - HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "Security Management - API" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
```

### Linux (UFW)

```bash
sudo ufw allow 80/tcp
sudo ufw allow 5000/tcp
```

---

## 💾 Veritabanı Yönetimi

### Mevcut Verileri Koruma

`docker-compose.network.yml` dosyası, `local_backup.sql` dosyasını **yüklemez**. Bu sayede:

- Diğer bilgisayardaki mevcut veriler korunur
- Yeni veri eklenmez, sadece mevcut veriler kullanılır

### Volume Kontrolü

Veritabanı verilerinizin olduğu volume'u kontrol etmek için:

```bash
docker volume ls | grep postgres
docker volume inspect security_postgres_data
```

### Backup Alma (Önerilir)

Çalıştırmadan önce mevcut verilerin yedeğini alın:

```bash
docker exec security_db pg_dump -U postgres security_management > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Backup'tan Geri Yükleme

Eğer veritabanını sıfırdan yüklemek isterseniz:

```bash
# Container'ı durdurun
docker compose -f docker-compose.network.yml down

# Volume'u silin (DİKKAT: Tüm veriler silinir!)
docker volume rm security_postgres_data

# Backup dosyasını kopyalayın ve normal compose ile başlatın
docker compose -f docker-compose.yml up -d
```

---

## 🔧 Sorun Giderme

### Container'lar Başlamıyor

```bash
# Logları kontrol edin
docker compose -f docker-compose.network.yml logs

# Belirli bir container'ın logları
docker compose -f docker-compose.network.yml logs backend
docker compose -f docker-compose.network.yml logs frontend
docker compose -f docker-compose.network.yml logs postgres
```

### Ağdan Erişilemiyor

1. IP adresinin doğru olduğundan emin olun
2. Güvenlik duvarı kurallarını kontrol edin
3. Docker'ın ağ binding'ini kontrol edin:

```bash
docker port security_frontend
docker port security_backend
```

### Frontend API'ye Bağlanamıyor

Frontend build sırasında IP adresi gömülür. IP değişirse yeniden build gerekir:

```bash
docker compose -f docker-compose.network.yml up --build -d
```

---

## 📱 Mobil Cihazlardan Erişim

1. Telefon/tablet aynı WiFi ağına bağlı olmalı
2. Tarayıcıda `http://[BILGISAYAR_IP]` adresine gidin
3. Örnek: `http://192.168.1.100`

---

## 🛑 Durdurma

### Windows

```batch
stop-network.bat
```

### Linux/Mac

```bash
docker compose -f docker-compose.network.yml down
```

> **Not:** Durdurma işlemi verileri silmez. Veriler Docker volume'da saklanmaya devam eder.
