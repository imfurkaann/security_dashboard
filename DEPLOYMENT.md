# Security Management System - Docker & Cloud Deployment

## 🐳 Docker ile Yerel Çalıştırma

### Ön Gereksinimler

- Docker Desktop yüklü olmalı
- Docker Compose yüklü olmalı

### Hızlı Başlangıç

1. **Environment dosyasını oluşturun:**

```bash
cp .env.example .env
```

2. **`.env` dosyasını düzenleyin:**

```env
DB_PASSWORD=güvenli-bir-şifre
JWT_SECRET=en-az-32-karakter-uzunluğunda-gizli-anahtar
VITE_API_URL=http://localhost:5000/api
```

3. **Docker ile başlatın:**

```bash
docker-compose up -d
```

4. **Uygulamaya erişin:**

- Frontend: <http://localhost>
- Backend API: <http://localhost:5000/api>
- PostgreSQL: localhost:5432

### Yararlı Docker Komutları

```bash
# Logları görüntüle
docker-compose logs -f

# Servisleri durdur
docker-compose down

# Servisleri yeniden başlat
docker-compose restart

# Volume'lar dahil tamamen temizle
docker-compose down -v

# Sadece backend'i yeniden build et
docker-compose build backend

# Sadece frontend'i yeniden build et
docker-compose build frontend
```

---

## ☁️ Google Cloud Platform Deployment

### Ön Gereksinimler

- Google Cloud hesabı
- gcloud CLI yüklü
- Billing etkinleştirilmiş proje

### Otomatik Deployment

**Linux/Mac:**

```bash
export GOOGLE_CLOUD_PROJECT=your-project-id
export GOOGLE_CLOUD_REGION=europe-west1
chmod +x deploy-gcp.sh
./deploy-gcp.sh
```

**Windows:**

```cmd
set GOOGLE_CLOUD_PROJECT=your-project-id
set GOOGLE_CLOUD_REGION=europe-west1
deploy-gcp.bat
```

### Manuel Deployment Adımları

#### 1. gcloud CLI Kurulumu ve Giriş

```bash
# gcloud kurulumu (Windows için installer indir)
# https://cloud.google.com/sdk/docs/install

# Giriş yap
gcloud auth login

# Proje ayarla
gcloud config set project YOUR_PROJECT_ID
```

#### 2. Gerekli API'leri Etkinleştir

```bash
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    sqladmin.googleapis.com \
    secretmanager.googleapis.com \
    containerregistry.googleapis.com
```

#### 3. Cloud SQL Instance Oluştur

```bash
gcloud sql instances create security-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=europe-west1

# Database oluştur
gcloud sql databases create security_management --instance=security-db

# Şifre ayarla
gcloud sql users set-password postgres \
    --instance=security-db \
    --password=YOUR_SECURE_PASSWORD
```

#### 4. Secrets Oluştur

```bash
# Database şifresi
echo -n "YOUR_DB_PASSWORD" | gcloud secrets create db-password --data-file=-

# JWT secret
echo -n "YOUR_JWT_SECRET" | gcloud secrets create jwt-secret --data-file=-
```

#### 5. Backend Deploy

```bash
# Build
gcloud builds submit ./backend --tag gcr.io/PROJECT_ID/security-backend

# Deploy
gcloud run deploy security-backend \
    --image gcr.io/PROJECT_ID/security-backend \
    --region europe-west1 \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars="NODE_ENV=production,DB_HOST=/cloudsql/CONNECTION_NAME,DB_NAME=security_management,DB_USER=postgres" \
    --set-secrets="DB_PASSWORD=db-password:latest,JWT_SECRET=jwt-secret:latest" \
    --add-cloudsql-instances=CONNECTION_NAME \
    --port=5000
```

#### 6. Frontend Deploy

```bash
# Build (BACKEND_URL'i güncelleyin)
gcloud builds submit ./frontend \
    --tag gcr.io/PROJECT_ID/security-frontend \
    --build-arg VITE_API_URL=https://security-backend-xxx.run.app/api

# Deploy
gcloud run deploy security-frontend \
    --image gcr.io/PROJECT_ID/security-frontend \
    --region europe-west1 \
    --platform managed \
    --allow-unauthenticated \
    --port=80
```

#### 7. Database Schema Import

```bash
# Cloud SQL Proxy indir ve çalıştır
./cloud_sql_proxy -instances=PROJECT:REGION:security-db=tcp:5432

# Başka terminalde
psql -h localhost -U postgres -d security_management -f database/schema.sql
psql -h localhost -U postgres -d security_management -f database/seed_new.sql
```

---

## 🔧 Diğer Cloud Platformları

### AWS (Elastic Container Service)

```bash
# ECR'a push
aws ecr get-login-password | docker login --username AWS --password-stdin YOUR_ECR_URL
docker tag security-backend:latest YOUR_ECR_URL/security-backend:latest
docker push YOUR_ECR_URL/security-backend:latest
```

### Azure (Container Apps)

```bash
# ACR'a push
az acr login --name YOUR_ACR_NAME
docker tag security-backend:latest YOUR_ACR_NAME.azurecr.io/security-backend:latest
docker push YOUR_ACR_NAME.azurecr.io/security-backend:latest
```

### DigitalOcean (App Platform)

App Platform otomatik olarak Dockerfile'ı algılar. Repo'yu bağlayın ve deploy edin.

---

## 📁 Dosya Yapısı

```
security/
├── docker-compose.yml          # Tüm servisleri çalıştır
├── .env.example                 # Environment değişkenleri örneği
├── cloudbuild.yaml              # Google Cloud Build config
├── deploy-gcp.sh                # Linux/Mac deployment script
├── deploy-gcp.bat               # Windows deployment script
├── backend/
│   ├── Dockerfile               # Backend container
│   └── .dockerignore
├── frontend/
│   ├── Dockerfile               # Frontend container
│   ├── nginx.conf               # Nginx yapılandırması
│   └── .dockerignore
└── database/
    ├── schema.sql               # Database şeması
    └── seed_new.sql             # Başlangıç verileri
```

---

## 🔐 Güvenlik Notları

1. **Production'da mutlaka değiştirin:**
   - `DB_PASSWORD` - Güçlü bir şifre kullanın
   - `JWT_SECRET` - En az 32 karakter, rastgele

2. **HTTPS zorunlu:** Cloud Run otomatik HTTPS sağlar

3. **Secrets yönetimi:** Google Secret Manager veya benzeri kullanın

4. **IP kısıtlamaları:** Gerekirse Cloud Armor ile IP filtreleme yapın

---

## 🐛 Sorun Giderme

### Container başlamıyor

```bash
docker-compose logs backend
docker-compose logs frontend
```

### Database bağlantı hatası

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` kontrol edin
- Cloud SQL için connection name doğru mu?

### Frontend API'ye bağlanamıyor

- `VITE_API_URL` doğru mu?
- Backend çalışıyor mu?
- CORS ayarları doğru mu?
