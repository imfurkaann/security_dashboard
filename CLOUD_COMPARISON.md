# ☁️ Cloud Platform Karşılaştırması - En Ucuz Seçenekler

## 🎯 Maliyet Karşılaştırması (Aylık)

### Google Cloud Platform (GCP)

#### Seçenek 1: Compute Engine e2-micro ⭐ **ÜCRETSİZ**

```
Maliyet: $0/ay (Always Free Tier)
```

- 1 adet e2-micro instance (us-central1, us-west1, us-east1)
- 30GB Standard persistent disk
- Tüm stack tek VM'de (docker-compose)
- **Kullanım:** `./deploy-cheapest-gcp.sh`

**Limitler:**

- CPU: 2 vCPU shared
- RAM: 1GB
- Disk: 30GB
- Network: 1GB/ay egress (ABD-Kanada-Avrupa)

---

#### Seçenek 2: Cloud Run (Serverless) - **~$5-10/ay**

```
Frontend: Cloud Storage + Cloud CDN     $0.026/GB
Backend: Cloud Run                      İlk 2M istek ücretsiz
Database: Cloud SQL (db-f1-micro)       ~$7/ay
```

- **Kullanım:** `./deploy-gcp.sh`

**Artıları:**

- Auto-scaling
- Sadece kullanılan kaynak için ödeme
- Yönetimi kolay

**Eksileri:**

- Database maliyeti sabit (~$7/ay)

---

### AWS (Amazon Web Services)

#### Seçenek 1: EC2 t2.micro - **ÜCRETSİZ (12 ay)**

```
Maliyet: $0/ay (ilk 12 ay, sonra ~$8/ay)
```

- 1 adet t2.micro instance
- 30GB EBS storage (Free Tier)
- 750 saat/ay (Always Free 12 ay)

**Deployment:**

```bash
# EC2 instance oluştur
aws ec2 run-instances \
    --image-id ami-0c55b159cbfafe1f0 \
    --instance-type t2.micro \
    --key-name your-key

# Docker kur ve çalıştır
ssh -i your-key.pem ec2-user@IP
sudo yum install docker -y
sudo service docker start
git clone your-repo
cd your-repo
docker-compose up -d
```

---

#### Seçenek 2: Lightsail - **$3.5/ay**

```
Maliyet: $3.5/ay (512MB RAM, 1 vCPU, 20GB SSD)
```

- En basit ve tahmin edilebilir fiyat
- Yönetimi çok kolay

**Deployment:**

```bash
# Lightsail container service
aws lightsail create-container-service \
    --service-name security-app \
    --power micro \
    --scale 1
```

---

### Microsoft Azure

#### Seçenek 1: B1s VM - **~$4/ay**

```
Maliyet: ~$4/ay (1 vCPU, 1GB RAM)
```

- Sürekli çalışan ucuz instance
- Free tier kapsamında $200 kredi (30 gün)

**Deployment:**

```bash
# VM oluştur
az vm create \
    --resource-group security-rg \
    --name security-vm \
    --image UbuntuLTS \
    --size Standard_B1s
```

---

### DigitalOcean

#### Seçenek 1: Basic Droplet - **$4/ay**

```
Maliyet: $4/ay (1GB RAM, 1 vCPU, 25GB SSD)
```

- En basit fiyatlandırma
- Referral ile $200 kredi (60 gün)

**Deployment:**

```bash
# Droplet oluştur
doctl compute droplet create security-app \
    --size s-1vcpu-1gb \
    --image docker-20-04 \
    --region fra1

# SSH ve deploy
ssh root@IP
git clone your-repo
cd your-repo
docker-compose up -d
```

---

#### Seçenek 2: App Platform - **$5/ay**

```
Maliyet: $5/ay (Basic tier)
```

- Managed service
- Otomatik deploy (GitHub integration)
- Kolay scaling

---

### Render.com

#### Seçenek 1: Free Tier - **ÜCRETSİZ**

```
Maliyet: $0/ay
```

- Web service + PostgreSQL
- 750 saat/ay free
- 15 dakika inactivity sonrası sleep

**Limitler:**

- 512MB RAM
- Shared CPU
- Auto-sleep (inactivity)

---

### Railway.app

#### Seçenek 1: Free Trial - **İlk $5 ÜCRETSİZ**

```
Maliyet: ~$5-10/ay (sonra pay-as-you-go)
```

- Modern deployment
- GitHub integration
- Basit fiyatlandırma

---

## 📊 Önerilen Seçim (Kullanım Senaryosuna Göre)

### 1. Tamamen Ücretsiz (Test/Geliştirme)

```
🥇 Google Cloud - Compute Engine e2-micro
    ✅ Süresiz ücretsiz
    ✅ Limitler makul
    ⚠️ Sadece 3 bölgede (US)
```

### 2. En Ucuz Production (~$4/ay)

```
🥇 DigitalOcean Basic Droplet ($4/ay)
    ✅ Basit fiyatlandırma
    ✅ Güvenilir
    ✅ Kolay yönetim
```

### 3. Managed & Serverless (~$5-10/ay)

```
🥇 DigitalOcean App Platform ($5/ay)
    ✅ Otomatik deployment
    ✅ Auto-scaling
    ✅ Yönetim yok
```

### 4. En Yüksek Free Tier Kredi

```
🥇 Azure ($200/30 gün)
🥈 DigitalOcean ($200/60 gün)
🥉 GCP ($300/90 gün)
```

---

## 🚀 Hızlı Başlangıç

### Google Cloud (ÜCRETSİZ)

```bash
export GOOGLE_CLOUD_PROJECT=your-project-id
chmod +x deploy-cheapest-gcp.sh
./deploy-cheapest-gcp.sh
```

### DigitalOcean ($4/ay)

```bash
# Droplet oluştur (Web UI)
# SSH bağlan
git clone https://github.com/your-repo/security.git
cd security
cp .env.example .env
nano .env  # Şifreleri düzenle
docker-compose up -d
```

### Render.com (ÜCRETSİZ - Auto-sleep)

```bash
# render.yaml oluştur ve GitHub'a push
# Render.com dashboard'dan import et
# Otomatik deploy olur
```

---

## 💡 Maliyet Optimizasyon İpuçları

1. **Database**: SQLite kullan (çok düşük trafik için) - $0
2. **Frontend**: Netlify/Vercel free tier - $0
3. **Backend**: Cloud Run (2M istek/ay free) - $0
4. **Storage**: Cloud Storage (5GB free) - $0

**Toplam: $0/ay** (düşük trafik için)

---

## 📋 Deployment Scriptleri

- **GCP Free Tier**: `deploy-cheapest-gcp.sh`
- **GCP Cloud Run**: `deploy-gcp.sh`
- **Docker Compose**: `docker-compose.yml`
- **AWS/Azure/DO**: Manuel deployment (yukarıdaki komutlar)
