#!/bin/bash

# ===========================================
# Google Cloud - EN UCUZ Deployment
# Compute Engine e2-micro (Free Tier)
# ===========================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  En Ucuz GCP Deployment (Free Tier)    ${NC}"
echo -e "${GREEN}=========================================${NC}"

# Değişkenler
PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-""}
REGION=${GOOGLE_CLOUD_REGION:-"us-central1"}  # Free tier sadece us-central1, us-west1, us-east1
ZONE="${REGION}-a"
INSTANCE_NAME="security-app"
MACHINE_TYPE="e2-micro"  # Free tier

if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Hata: GOOGLE_CLOUD_PROJECT environment variable tanımlı değil${NC}"
    echo "Kullanım: GOOGLE_CLOUD_PROJECT=your-project-id ./deploy-cheapest-gcp.sh"
    exit 1
fi

echo -e "${YELLOW}Project: $PROJECT_ID${NC}"
echo -e "${YELLOW}Region: $REGION (Free Tier)${NC}"
echo -e "${YELLOW}Instance: $INSTANCE_NAME ($MACHINE_TYPE)${NC}"

# Proje ayarla
gcloud config set project $PROJECT_ID

# API'leri etkinleştir
echo -e "${YELLOW}API'ler etkinleştiriliyor...${NC}"
gcloud services enable compute.googleapis.com

# Firewall kuralları oluştur
echo -e "${YELLOW}Firewall kuralları kontrol ediliyor...${NC}"
if ! gcloud compute firewall-rules describe allow-http &>/dev/null; then
    gcloud compute firewall-rules create allow-http \
        --allow tcp:80 \
        --source-ranges 0.0.0.0/0 \
        --description "Allow HTTP traffic"
fi

if ! gcloud compute firewall-rules describe allow-https &>/dev/null; then
    gcloud compute firewall-rules create allow-https \
        --allow tcp:443 \
        --source-ranges 0.0.0.0/0 \
        --description "Allow HTTPS traffic"
fi

# VM oluştur (eğer yoksa)
echo -e "${YELLOW}VM kontrol ediliyor...${NC}"
if ! gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE &>/dev/null; then
    echo -e "${YELLOW}e2-micro instance oluşturuluyor (Free Tier)...${NC}"
    gcloud compute instances create $INSTANCE_NAME \
        --zone=$ZONE \
        --machine-type=$MACHINE_TYPE \
        --image-family=cos-stable \
        --image-project=cos-cloud \
        --boot-disk-size=30GB \
        --boot-disk-type=pd-standard \
        --tags=http-server,https-server \
        --metadata=startup-script='#!/bin/bash
# Docker kurulumu (Container-Optimized OS zaten kurulu)
docker --version

# Sistem güncellemeleri
sudo mkdir -p /opt/security
'
    echo -e "${GREEN}VM oluşturuldu!${NC}"
else
    echo -e "${GREEN}VM zaten mevcut${NC}"
fi

# Projeyi VM'e kopyala
echo -e "${YELLOW}Proje dosyaları VM'e kopyalanıyor...${NC}"
gcloud compute scp --recurse --zone=$ZONE \
    --exclude=".git" \
    --exclude="node_modules" \
    --exclude="dist" \
    --exclude="coverage" \
    ./* $INSTANCE_NAME:/tmp/security/

# Docker compose çalıştır
echo -e "${YELLOW}Docker compose başlatılıyor...${NC}"
gcloud compute ssh $INSTANCE_NAME --zone=$ZONE --command="
    cd /tmp/security && \
    sudo docker compose down && \
    sudo docker compose up -d --build
"

# IP adresini al
EXTERNAL_IP=$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format="value(networkInterfaces[0].accessConfigs[0].natIP)")

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}  Deployment Tamamlandı! (ÜCRETSİZ)     ${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo -e "${GREEN}Uygulama URL: http://$EXTERNAL_IP${NC}"
echo ""
echo -e "${YELLOW}Not: Free tier limitleri:${NC}"
echo -e "${YELLOW}  - 1 adet e2-micro instance${NC}"
echo -e "${YELLOW}  - 30GB disk${NC}"
echo -e "${YELLOW}  - 1GB/ay network egress (ABD-Kanada-Avrupa)${NC}"
echo ""
echo -e "${YELLOW}VM'e SSH bağlantısı:${NC}"
echo -e "  gcloud compute ssh $INSTANCE_NAME --zone=$ZONE"
