#!/bin/bash

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║     SECURITY MANAGEMENT - AĞ PAYLAŞIMLI BAŞLATMA              ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  Bu script projeyi yerel ağda paylaşımlı olarak başlatır     ║"
echo "║  Mevcut veritabanı verileri korunur, silinmez                ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# IP adresini otomatik al
echo "[1/5] Bilgisayarın IP adresi tespit ediliyor..."

# Linux/Mac için IP tespiti
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    HOST_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
else
    # Linux
    HOST_IP=$(hostname -I | awk '{print $1}')
fi

if [ -z "$HOST_IP" ]; then
    echo "[HATA] Yerel ağ IP adresi bulunamadı!"
    echo "Lütfen WiFi veya Ethernet bağlantınızı kontrol edin."
    exit 1
fi

echo "[OK] IP Adresi: $HOST_IP"
echo ""

# Docker kontrolü
echo "[2/5] Docker kontrol ediliyor..."
if ! docker info > /dev/null 2>&1; then
    echo "[HATA] Docker çalışmıyor! Lütfen Docker'ı başlatın."
    exit 1
fi
echo "[OK] Docker çalışıyor."
echo ""

# Mevcut container'ları durdur
echo "[3/5] Eski container'lar durduruluyor..."
docker compose -f docker-compose.network.yml down 2>/dev/null
echo "[OK] Eski container'lar durduruldu."
echo ""

# Mevcut veritabanı volume kontrolü
echo "[4/5] Veritabanı volume kontrol ediliyor..."
if docker volume inspect security_postgres_data > /dev/null 2>&1; then
    echo "[OK] Mevcut veritabanı volume bulundu. Veriler korunacak."
else
    echo "[BILGI] Veritabanı volume bulunamadı. Yeni oluşturulacak."
    echo "[UYARI] Eğer mevcut verileriniz varsa, önce volume'u oluşturun veya backup'tan yükleyin."
fi
echo ""

# Docker Compose başlat
echo "[5/5] Uygulama başlatılıyor..."
echo ""

export VITE_API_URL="http://$HOST_IP:5000/api"
export HOST_IP="$HOST_IP"

echo "Kullanılan ayarlar:"
echo "  - API URL: $VITE_API_URL"
echo "  - Host IP: $HOST_IP"
echo ""

# Build ve başlat
docker compose -f docker-compose.network.yml up --build -d

if [ $? -ne 0 ]; then
    echo ""
    echo "[HATA] Uygulama başlatılamadı!"
    exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    BAŞARILI ŞEKİLDE BAŞLATILDI                ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║                                                               ║"
echo "║  Bu bilgisayardan erişim:                                    ║"
echo "║    http://localhost                                          ║"
echo "║                                                               ║"
echo "║  Ağdaki diğer cihazlardan erişim:                            ║"
echo "║    http://$HOST_IP                                           ║"
echo "║                                                               ║"
echo "║  API Adresi:                                                  ║"
echo "║    http://$HOST_IP:5000/api                                  ║"
echo "║                                                               ║"
echo "╠═══════════════════════════════════════════════════════════════╣"
echo "║  NOT: Aynı WiFi ağına bağlı cihazlar yukarıdaki             ║"
echo "║       adresleri kullanarak uygulamaya erişebilir.            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Container durumlarını göster
echo "Container Durumları:"
docker compose -f docker-compose.network.yml ps
echo ""

echo "Logları görmek için: docker compose -f docker-compose.network.yml logs -f"
echo "Durdurmak için: docker compose -f docker-compose.network.yml down"
