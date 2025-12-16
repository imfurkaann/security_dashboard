#!/bin/bash

# ===========================================
# Google Cloud Deployment Script
# ===========================================

set -e

# Renkli çıktı
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Security Management - GCP Deployment  ${NC}"
echo -e "${GREEN}=========================================${NC}"

# Değişkenler
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-""}
REGION=${GOOGLE_CLOUD_REGION:-"europe-west1"}
DB_INSTANCE_NAME="security-db"
BACKEND_SERVICE="security-backend"
FRONTEND_SERVICE="security-frontend"

# Kontroller
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Hata: GOOGLE_CLOUD_PROJECT environment variable tanımlı değil${NC}"
    echo "Kullanım: GOOGLE_CLOUD_PROJECT=your-project-id ./deploy-gcp.sh"
    exit 1
fi

echo -e "${YELLOW}Project: $PROJECT_ID${NC}"
echo -e "${YELLOW}Region: $REGION${NC}"

# gcloud authentication kontrolü
if ! gcloud auth print-access-token &>/dev/null; then
    echo -e "${YELLOW}Google Cloud'a giriş yapılıyor...${NC}"
    gcloud auth login
fi

# Proje ayarla
gcloud config set project $PROJECT_ID

# API'leri etkinleştir
echo -e "${YELLOW}Gerekli API'ler etkinleştiriliyor...${NC}"
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    sqladmin.googleapis.com \
    secretmanager.googleapis.com \
    containerregistry.googleapis.com

# Cloud SQL Instance oluştur (eğer yoksa)
echo -e "${YELLOW}Cloud SQL kontrol ediliyor...${NC}"
if ! gcloud sql instances describe $DB_INSTANCE_NAME &>/dev/null; then
    echo -e "${YELLOW}Cloud SQL instance oluşturuluyor...${NC}"
    gcloud sql instances create $DB_INSTANCE_NAME \
        --database-version=POSTGRES_15 \
        --tier=db-f1-micro \
        --region=$REGION \
        --storage-type=SSD \
        --storage-size=10GB \
        --database-flags=character_set_server=UTF8
    
    # Database oluştur
    gcloud sql databases create security_management --instance=$DB_INSTANCE_NAME
    
    # Kullanıcı şifresi ayarla
    echo -e "${YELLOW}Database kullanıcı şifresi ayarlanıyor...${NC}"
    DB_PASSWORD=$(openssl rand -base64 24)
    gcloud sql users set-password postgres \
        --instance=$DB_INSTANCE_NAME \
        --password=$DB_PASSWORD
    
    # Secret Manager'a kaydet
    echo -n "$DB_PASSWORD" | gcloud secrets create db-password --data-file=-
else
    echo -e "${GREEN}Cloud SQL instance zaten mevcut${NC}"
fi

# JWT Secret oluştur (eğer yoksa)
if ! gcloud secrets describe jwt-secret &>/dev/null; then
    echo -e "${YELLOW}JWT Secret oluşturuluyor...${NC}"
    JWT_SECRET=$(openssl rand -base64 32)
    echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=-
fi

# Connection name al
CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE_NAME --format="value(connectionName)")

# Backend build ve deploy
echo -e "${YELLOW}Backend build ediliyor...${NC}"
gcloud builds submit ./backend \
    --tag gcr.io/$PROJECT_ID/$BACKEND_SERVICE

echo -e "${YELLOW}Backend deploy ediliyor...${NC}"
gcloud run deploy $BACKEND_SERVICE \
    --image gcr.io/$PROJECT_ID/$BACKEND_SERVICE \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --set-env-vars="NODE_ENV=production,DB_HOST=/cloudsql/$CONNECTION_NAME,DB_PORT=5432,DB_NAME=security_management,DB_USER=postgres" \
    --set-secrets="DB_PASSWORD=db-password:latest,JWT_SECRET=jwt-secret:latest" \
    --add-cloudsql-instances=$CONNECTION_NAME \
    --memory=512Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=10 \
    --port=5000

# Backend URL al
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region=$REGION --format="value(status.url)")
echo -e "${GREEN}Backend URL: $BACKEND_URL${NC}"

# Frontend build ve deploy
echo -e "${YELLOW}Frontend build ediliyor...${NC}"
gcloud builds submit ./frontend \
    --tag gcr.io/$PROJECT_ID/$FRONTEND_SERVICE \
    --build-arg VITE_API_URL=$BACKEND_URL/api

echo -e "${YELLOW}Frontend deploy ediliyor...${NC}"
gcloud run deploy $FRONTEND_SERVICE \
    --image gcr.io/$PROJECT_ID/$FRONTEND_SERVICE \
    --region $REGION \
    --platform managed \
    --allow-unauthenticated \
    --memory=256Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=5 \
    --port=80

# Frontend URL al
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region=$REGION --format="value(status.url)")

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Deployment Tamamlandı!  ${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${GREEN}Frontend URL: $FRONTEND_URL${NC}"
echo -e "${GREEN}Backend URL: $BACKEND_URL${NC}"
echo ""
echo -e "${YELLOW}Not: İlk defa çalıştırıyorsanız, database schema'sını import etmeyi unutmayın.${NC}"
echo -e "${YELLOW}Cloud SQL Proxy kullanarak: ./database/schema.sql${NC}"
