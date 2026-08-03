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

# 4. Firewall (UFW) Port Kontrolü (Hata verirse atla)
if command -v ufw > /dev/null 2>&1; then
    echo "🛡️  UFW güvenlik duvarı kontrol ediliyor..."
    sudo ufw allow 33334/tcp 2>/dev/null || echo "⚠️  UFW izni verilemedi (sudo yetkisi yoksa sunucu panelinden 33334 portunu açın)."
fi

# 5. Docker Compose Komutunu Tespit Et (docker compose vs docker-compose)
COMPOSE_CMD=""
if docker compose version >/dev/null 2>&1; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE_CMD="docker-compose"
else
    echo "❌ HATA: Docker Compose bulunamadı! Lütfen 'docker-compose' veya 'docker compose' eklentisini yükleyin."
    exit 1
fi

echo "🐳 Docker Compose komutu kullanılacak: $COMPOSE_CMD"
echo "🐳 Docker konteynırları inşa ediliyor ve başlatılıyor..."

$COMPOSE_CMD build --no-cache
$COMPOSE_CMD up -d

echo "======================================================================"
echo "✅ DEPLOYMENT TAMAMLANDI!"
echo "🌐 Sisteme Erişim Adresi: http://162.19.242.35:33334"
echo "📊 Konteyner Durumları için: $COMPOSE_CMD ps"
echo "📜 Canlı Loglar için:        $COMPOSE_CMD logs -f"
echo "======================================================================"
