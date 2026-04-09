# Veritabanı Transfer Rehberi

Bu rehber, Docker üzerinde çalışan mevcut PostgreSQL veritabanını yeni sunucuya en güvenli şekilde taşımak için hazırlanmıştır.

## Neler taşınıyor

- Kaynak veritabanı: `security_management`
- Kaynak container: `security_db`
- Docker volume: `security_postgres_data`

## Önerilen yöntem

En güvenli yöntem PostgreSQL dump alıp yeni sunucuda restore etmektir.
Docker volume’ü doğrudan kopyalamak genelde önerilmez. Bunu sadece iki ortamı tam kontrol ediyorsan ve PostgreSQL sürümleri birebir uyumluysa düşün.

---

## 1) Mevcut Docker veritabanından yedek alma

### Seçenek A: Custom format yedek `(.dump)`

Mevcut makinede PowerShell üzerinden çalıştır:

```powershell
docker exec -t security_db pg_dump -U postgres -d security_management -Fc -f /tmp/security_management.dump
docker cp security_db:/tmp/security_management.dump .\security_management.dump
```

Bu yöntem neden daha iyi:
- Düz SQL’e göre daha hızlı restore edilir
- `clean restore` desteği vardır
- Tam veritabanı taşımak için daha uygundur

### Seçenek B: Düz SQL yedek `(.sql)`

```powershell
docker exec -t security_db pg_dump -U postgres -d security_management > security_management.sql
```

Bunu sadece okunabilir bir SQL dosyasına ihtiyacın varsa kullan.

---

## 2) Yedeği yeni sunucuya kopyalama

### SSH erişimin varsa

```powershell
scp .\security_management.dump user@new-server:/tmp/security_management.dump
```

SQL yedek kullanıyorsan:

```powershell
scp .\security_management.sql user@new-server:/tmp/security_management.sql
```

### Dosya aktarım aracı kullanıyorsan

Dosyayı manuel olarak yeni sunucuya kopyala ve `/tmp` gibi erişebildiğin bir klasöre yerleştir.

---

## 3) Yeni sunucuda restore etme

### Yeni sunucu da Docker kullanıyorsa

Önce PostgreSQL container’ını çalıştır, sonra restore işlemini yap.

#### Custom format yedeği restore etme

```powershell
docker cp .\security_management.dump security_db:/tmp/security_management.dump
docker exec -it security_db pg_restore -U postgres -d security_management --clean --if-exists /tmp/security_management.dump
```

### Yeni sunucuda lokal PostgreSQL varsa

#### Custom format yedeği restore etme

```powershell
pg_restore -U postgres -d security_management --clean --if-exists C:\temp\security_management.dump
```

#### Düz SQL yedeği restore etme

```powershell
psql -U postgres -d security_management -f C:\temp\security_management.sql
```

---

## 4) Hedef veritabanı yoksa

Önce veritabanını oluştur:

```powershell
createdb -U postgres security_management
```

Docker içindeysen:

```powershell
docker exec -it security_db createdb -U postgres security_management
```

---

## 5) Restore işlemini doğrulama

Yeni sunucuda şu kontrolleri çalıştır:

```powershell
psql -U postgres -d security_management -c "SELECT current_database(), now();"
psql -U postgres -d security_management -c "SELECT COUNT(*) FROM managers_records;"
psql -U postgres -d security_management -c "SELECT COUNT(*) FROM vehicle_records;"
psql -U postgres -d security_management -c "SELECT COUNT(*) FROM visitor_records;"
psql -U postgres -d security_management -c "SELECT COUNT(*) FROM fire_alarms;"
psql -U postgres -d security_management -c "SELECT COUNT(*) FROM incidents;"
```

Birkaç örnek satır da kontrol edebilirsin:

```powershell
psql -U postgres -d security_management -c "SELECT * FROM managers_records ORDER BY created_at DESC LIMIT 5;"
psql -U postgres -d security_management -c "SELECT * FROM visitor_records ORDER BY created_at DESC LIMIT 5;"
```

---

## 6) Backend bağlantısını güncelleme

Backend’in yeni sunucudaki veritabanına bağlandığından emin ol.

### Örnek `.env`

```env
DB_HOST=new-server-host
DB_PORT=5432
DB_NAME=security_management
DB_USER=postgres
DB_PASSWORD=your-password
```

Eğer backend Docker Compose ile çalışıyorsa compose içindeki environment değerlerini de güncelle.

---

## 7) Önemli notlar

- Veritabanı volume’unu silmek istiyorsan dışında `docker compose down -v` kullanma.
- Mümkünse kaynak ve hedef PostgreSQL major sürümlerini uyumlu tut.
- Hedef sunucuda zaten veri varsa `--clean --if-exists` kullanırken dikkatli ol.
- Production ortamında restore öncesi ikinci bir yedek al.

---

## Önerilen taşıma akışı

1. Kaynak sistemde yazmayı durdur.
2. Güncel bir yedek al.
3. Yedeği yeni sunucuya aktar.
4. Restore işlemini yap.
5. Satır sayıları ve örnek kayıtları doğrula.
6. Backend’i yeni veritabanına yönlendir.
7. Giriş, kayıt oluşturma, güncelleme, export ve logout akışlarını test et.

---

## Kısa sürüm

### Yedek alma

```powershell
docker exec -t security_db pg_dump -U postgres -d security_management -Fc -f /tmp/security_management.dump
docker cp security_db:/tmp/security_management.dump .\security_management.dump
```

### Restore etme

```powershell
docker cp .\security_management.dump security_db:/tmp/security_management.dump
docker exec -it security_db pg_restore -U postgres -d security_management --clean --if-exists /tmp/security_management.dump
```

### Doğrulama

```powershell
psql -U postgres -d security_management -c "SELECT COUNT(*) FROM visitor_records;"
```
