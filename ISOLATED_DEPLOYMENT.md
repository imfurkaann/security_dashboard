# 🏨 İzole Deployment Rehberi - Otel Sistemleriyle Çakışmayan Yapılandırma

Bu rehber, Security Management uygulamasını otelin mevcut sistemleriyle (IP kameralar, NVR, ağ cihazları vb.) **hiçbir çakışma olmadan** çalıştırmak için hazırlanmıştır.

---

## 📋 Neden İzole Yapılandırma?

Otellerde genellikle şu sistemler bulunur:

- 🎥 IP Kameralar (genelde 192.168.x.x veya 10.x.x.x IP bloğu)
- 📹 NVR/DVR Cihazları (80, 8080, 554 gibi portlar)
- 🌐 Ağ Yönetim Sistemleri
- 📡 WiFi Kontrol Cihazları

**Bu yapılandırma, tüm bu sistemlerle çakışmayı önler!**

---

## 🔒 İzole Yapılandırma Özellikleri

| Özellik | Standart | İzole (Bu Yapılandırma) |
|---------|----------|-------------------------|
| **Frontend Port** | 80 | **8088** |
| **API Port** | 5000 | **8089** |
| **Database Port** | 5432 | **5433** (sadece localhost) |
| **Docker Network** | bridge (varsayılan) | **172.28.0.0/16** (izole) |
| **Container İsimleri** | security_* | **security_*_isolated** |
| **Volume İsimleri** | postgres_data | **security_postgres_isolated_data** |

### Neden Bu Portlar?

- **8088/8089**: Standart web (80, 443, 8080) ve API (3000, 5000, 8000) portlarıyla çakışmaz
- **172.28.0.0/16**: Otel LAN'larında nadiren kullanılır (genelde 192.168.x.x veya 10.x.x.x)
- **5433**: PostgreSQL standart portu (5432) ile çakışmaz

---

## 🚀 Hızlı Başlangıç

### Windows

```batch
start-isolated.bat
```

### Linux/Mac

```bash
chmod +x start-isolated.sh
./start-isolated.sh
```

---

## 🌐 Erişim Adresleri

Sistem başladıktan sonra:

| Cihaz | Adres |
|-------|-------|
| Bu bilgisayar | <http://localhost:8088> |
| Ağdaki diğer cihazlar | http://[IP_ADRESINIZ]:8088 |
| API (Backend) | http://[IP_ADRESINIZ]:8089/api |

### IP Adresinizi Öğrenme

**Windows:**

```powershell
ipconfig | findstr "IPv4"
```

**Linux/Mac:**

```bash
hostname -I | awk '{print $1}'
```

---

## 🔍 Çakışma Kontrolü

Sistemi başlatmadan önce portların müsait olduğunu kontrol edin:

### Windows

```powershell
# Port 8088 kontrolü
netstat -ano | findstr ":8088"

# Port 8089 kontrolü
netstat -ano | findstr ":8089"

# Boş çıktı = port müsait ✅
```

### Linux/Mac

```bash
# Port kontrolü
lsof -i :8088
lsof -i :8089

# Boş çıktı = port müsait ✅
```

---

## 🛡️ Güvenlik Duvarı Yapılandırması

### Windows (Otomatik)

Yönetici olarak çalıştırın:

```batch
setup-firewall-isolated.bat
```

### Windows (Manuel)

```powershell
# PowerShell (Yönetici olarak)
New-NetFirewallRule -DisplayName "Security Management - Isolated Frontend" -Direction Inbound -Protocol TCP -LocalPort 8088 -Action Allow
New-NetFirewallRule -DisplayName "Security Management - Isolated API" -Direction Inbound -Protocol TCP -LocalPort 8089 -Action Allow
```

### Linux (UFW)

```bash
sudo ufw allow 8088/tcp comment "Security Management - Frontend"
sudo ufw allow 8089/tcp comment "Security Management - API"
```

---

## 🔧 Manuel Kurulum

### 1. Environment Değişkenleri

```powershell
# Windows PowerShell
$env:HOST_IP = "192.168.1.100"  # Kendi IP adresiniz
$env:VITE_API_URL = "http://192.168.1.100:8089/api"
```

```bash
# Linux/Mac
export HOST_IP="192.168.1.100"
export VITE_API_URL="http://192.168.1.100:8089/api"
```

### 2. Docker Compose Başlatma

```bash
docker compose -f docker-compose.isolated.yml up --build -d
```

### 3. Sistemi Durdurma

```bash
docker compose -f docker-compose.isolated.yml down
```

---

## 📊 Container Durumları

```bash
# Çalışan container'ları görüntüle
docker ps --filter "name=security"

# Logları görüntüle
docker logs security_frontend_isolated
docker logs security_backend_isolated
docker logs security_db_isolated
```

---

## 💾 Veritabanı Yönetimi

### Backup Alma

```bash
docker exec security_db_isolated pg_dump -U postgres security_management > backup_isolated_$(date +%Y%m%d).sql
```

### Mevcut Veritabanından Aktarma

Eğer mevcut bir veritabanınız varsa ve izole sisteme aktarmak istiyorsanız:

```bash
# 1. Eski sistemden backup al
docker exec security_db pg_dump -U postgres security_management > backup.sql

# 2. İzole sisteme yükle
docker exec -i security_db_isolated psql -U postgres security_management < backup.sql
```

---

## ⚠️ Sorun Giderme

### Port Zaten Kullanımda

```
Error: Port 8088 is already in use
```

**Çözüm:** Portu kullanan uygulamayı bulun ve kapatın:

```powershell
# Windows - portu kullanan işlemi bul
netstat -ano | findstr ":8088"
# PID'yi not alın, sonra:
taskkill /PID <PID> /F
```

### Docker Network Çakışması

```
Error: Pool overlaps with other one on this address space
```

**Çözüm:** Mevcut Docker network'leri temizleyin:

```bash
# Kullanılmayan network'leri sil
docker network prune

# Veya spesifik network'ü sil
docker network rm security_isolated_net
```

### Container Başlamıyor

```bash
# Logları kontrol edin
docker logs security_backend_isolated

# Container'ı yeniden oluşturun
docker compose -f docker-compose.isolated.yml up --build --force-recreate -d
```

---

## 🔄 Mevcut Sistemle Karşılaştırma

| Dosya | Amaç |
|-------|------|
| `docker-compose.yml` | Geliştirme ortamı (standart portlar) |
| `docker-compose.network.yml` | Ağ paylaşımı (standart portlar, 0.0.0.0) |
| `docker-compose.isolated.yml` | **Otel izole** (özel portlar, izole network) |

---

## 📌 Önemli Notlar

1. **Mevcut veriler korunur**: İzole yapılandırma farklı bir volume kullanır
2. **Aynı anda çalıştırabilirsiniz**: Standart ve izole sistemler birlikte çalışabilir
3. **Güvenlik**: Database sadece localhost'tan erişilebilir (5433)
4. **Kameralarla çakışma yok**: 172.28.x.x bloğu genelde kullanılmaz

---

## 🎯 Özet

```
┌─────────────────────────────────────────────────────────────┐
│  İZOLE SİSTEM ERİŞİM BİLGİLERİ                              │
├─────────────────────────────────────────────────────────────┤
│  🌐 Web Arayüzü:    http://[IP]:8088                        │
│  📡 API:            http://[IP]:8089/api                    │
│  💾 Database:       localhost:5433 (sadece yerel erişim)    │
│  🔗 Docker Network: 172.28.0.0/16                           │
└─────────────────────────────────────────────────────────────┘
```
