#!/usr/bin/env bash
# ==============================================================================
# Sunucu Deployment Betiği - Güvenlik Yönetim Sistemi
# Hedef Adres: http://162.19.242.35:33334
# ==============================================================================

set -e

echo "🚀 Güvenlik Yönetim Sistemi - Sunucu Canlıya Alma Başlatılıyor..."

# 1. Ortam Değişkenleri Kontrolü / Oluşturulması
if [ ! -f .env ]; then
    echo "📄 .env dosyası oluşturuluyor..."
    cat <<EOT > .env
WHATSAPP_ENABLED=true
PUBLIC_HOST_IP=162.19.242.35
FRONTEND_PORT=33334
CORS_ORIGIN=*
EOT
fi

# 2. Secret dosyalarının varlığını kontrol et
mkdir -p secrets
if [ ! -f secrets/db_password.txt ]; then
    echo "pg_secure_password_$(openssl rand -hex 8)" > secrets/db_password.txt
    echo "🔑 Veritabanı şifresi üretildi (secrets/db_password.txt)"
fi

if [ ! -f secrets/jwt_secret.txt ]; then
    echo "jwt_secret_$(openssl rand -hex 16)" > secrets/jwt_secret.txt
    echo "🔑 JWT secret üretildi (secrets/jwt_secret.txt)"
fi

# 3. Klasör İzinleri ve Klasör Yapısı
mkdir -p backend/reports backend/sgk_kayitlari database/migrations
chmod -R 755 backend/reports backend/sgk_kayitlari

# 4. Firewall (UFW) Port Kontrolü
if command -v ufw > /dev/null 2>&1; then
    echo "🛡️  UFW güvenlik duvarı kontrol ediliyor... 33334 portuna izin veriliyor..."
    sudo ufw allow 33334/tcp || true
fi

# 5. Docker Konteynırlarını Build Et ve Başlat
echo "🐳 Docker konteynırları inşa ediliyor ve başlatılıyor..."
docker compose build --no-cache
docker compose up -d

echo "======================================================================"
echo "✅ DEPLOYMENT TAMAMLANDI!"
echo "🌐 Sisteme Erişim Adresi: http://162.19.242.35:33334"
echo "📊 Konteyner Durumları için: docker compose ps"
echo "📜 Canlı Loglar için:        docker compose logs -f"
echo "======================================================================"
