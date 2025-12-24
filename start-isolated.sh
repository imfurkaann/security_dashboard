#!/bin/bash

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║     🏨 OTEL İZOLE SECURITY MANAGEMENT BAŞLATICI                              ║"
echo "║     Kamera ve Diğer Sistemlerle Çakışmayan Yapılandırma                       ║"
echo "╠══════════════════════════════════════════════════════════════════════════════╣"
echo "║  Bu script sistemi tamamen izole portlar ve network ile başlatır:            ║"
echo "║                                                                              ║"
echo "║  📌 Kullanılan Portlar (Standart portlarla çakışmaz):                        ║"
echo "║     • 8088 - Web Arayüzü (Frontend)                                          ║"
echo "║     • 8089 - Backend API                                                     ║"
echo "║     • 5433 - Veritabanı (sadece localhost)                                   ║"
echo "║                                                                              ║"
echo "║  📌 Docker Network: 172.28.0.0/16 (Otel LAN'ı ile çakışmaz)                  ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# IP adresini otomatik tespit et
echo "🔍 IP adresi tespit ediliyor..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
else
    # Linux
    IP=$(hostname -I | awk '{print $1}')
fi

if [ -z "$IP" ]; then
    echo "❌ IP adresi tespit edilemedi!"
    echo "   Manuel olarak girin:"
    read -p "   IP Adresi: " IP
fi

echo "✅ Tespit edilen IP: $IP"
echo ""

# Port çakışma kontrolü
echo "🔍 Port çakışması kontrol ediliyor..."

check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo "⚠️  UYARI: Port $port zaten kullanımda!"
        read -p "   Devam etmek istiyor musunuz? (E/H): " CONTINUE
        if [[ ! "$CONTINUE" =~ ^[Ee]$ ]]; then
            exit 1
        fi
    fi
}

check_port 8088
check_port 8089
check_port 5433

echo "✅ Tüm portlar müsait!"
echo ""

# Environment değişkenlerini ayarla
export HOST_IP="$IP"
export VITE_API_URL="http://$IP:8089/api"

echo "📋 Yapılandırma:"
echo "   HOST_IP=$HOST_IP"
echo "   VITE_API_URL=$VITE_API_URL"
echo ""

# Docker Compose başlat
echo "🚀 Docker Compose başlatılıyor (izole yapılandırma)..."
echo ""
docker compose -f docker-compose.isolated.yml up --build -d

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Docker Compose başlatılamadı!"
    echo "   Docker'ın çalıştığından emin olun."
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║  ✅ SİSTEM BAŞARIYLA BAŞLATILDI!                                             ║"
echo "╠══════════════════════════════════════════════════════════════════════════════╣"
echo "║                                                                              ║"
echo "║  🌐 ERİŞİM ADRESLERİ:                                                        ║"
echo "║                                                                              ║"
echo "║     Bu Bilgisayar:                                                           ║"
echo "║       http://localhost:8088                                                  ║"
echo "║                                                                              ║"
echo "║     Ağdaki Diğer Cihazlar:                                                   ║"
echo "║       http://$IP:8088                                                        ║"
echo "║                                                                              ║"
echo "║     API Adresi:                                                              ║"
echo "║       http://$IP:8089/api                                                    ║"
echo "║                                                                              ║"
echo "╠══════════════════════════════════════════════════════════════════════════════╣"
echo "║  📌 NOT: Güvenlik duvarı izni gerekebilir. İzin vermeyi unutmayın!           ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Linux güvenlik duvarı kuralları (UFW varsa)
if command -v ufw &> /dev/null; then
    echo "🛡️ UFW güvenlik duvarı kuralları ekleniyor..."
    sudo ufw allow 8088/tcp comment "Security Management - Frontend" 2>/dev/null
    sudo ufw allow 8089/tcp comment "Security Management - API" 2>/dev/null
    echo "   ✅ Güvenlik duvarı kuralları eklendi"
    echo ""
fi

echo "Container durumları:"
docker ps --filter "name=security" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
