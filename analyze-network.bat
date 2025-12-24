@echo off
chcp 65001 > nul
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║     🔍 AĞ ANALİZİ VE UYGUN YAPILANDIRMA SEÇİCİ                               ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.

echo ═══════════════════════════════════════════════════════════════════════════════
echo 📋 MEVCUT AĞ BİLGİLERİ
echo ═══════════════════════════════════════════════════════════════════════════════
echo.
echo 🖥️ Bu bilgisayarın IP adresleri:
ipconfig | findstr /i "IPv4"
echo.

echo 🌐 Varsayılan Gateway:
ipconfig | findstr /i "Default Gateway" | findstr /v "::"
echo.

echo 📡 Ağ Arayüzleri:
ipconfig | findstr /i "adapter"
echo.

echo ═══════════════════════════════════════════════════════════════════════════════
echo 📌 ÇAKIŞMA RİSKİ ANALİZİ
echo ═══════════════════════════════════════════════════════════════════════════════
echo.
echo Otellerde yaygın kullanılan IP/Port aralıkları:
echo.
echo   IP Kameralar:
echo     • 192.168.1.64  - 192.168.1.127  (yaygın)
echo     • 10.0.0.x      bloğu
echo     • Portlar: 80, 443, 554 (RTSP), 8080
echo.
echo   NVR/DVR Cihazları:
echo     • 192.168.1.200 - 192.168.1.254  (yaygın)
echo     • Portlar: 80, 8000, 8080, 37777
echo.
echo   Ağ Cihazları:
echo     • 192.168.1.1   (Router/Gateway)
echo     • 192.168.1.2-5 (Yönetilen Switch'ler)
echo.

echo ═══════════════════════════════════════════════════════════════════════════════
echo 🎯 ÖNERİLEN ÇÖZÜMLER
echo ═══════════════════════════════════════════════════════════════════════════════
echo.
echo   [1] İZOLE PORT YAPILANDIRMASI (ÖNERİLEN - Windows için en güvenilir)
echo       • Bu bilgisayarın IP'si + farklı portlar (8088, 8089, 5433)
echo       • Kurulum: Kolay
echo       • Çakışma riski: Çok düşük
echo.
echo   [2] FARKLI IP ADRESİ (Linux için)
echo       • Container'lara ağdan ayrı IP verilir
echo       • Kurulum: Karmaşık, Linux gerektirir
echo       • Çakışma riski: Sıfır
echo.
echo   [3] ÖZEL SUBNET (Docker içi izolasyon)
echo       • 172.28.0.0/16 - Otel ağından tamamen izole
echo       • Sadece Docker içinde kullanılır
echo       • Dışarıdan erişim port mapping ile
echo.

echo ═══════════════════════════════════════════════════════════════════════════════
echo ✅ SONUÇ: WINDOWS İÇİN ÖNERİ
echo ═══════════════════════════════════════════════════════════════════════════════
echo.
echo   Mevcut izole yapılandırma (docker-compose.isolated.yml) sizin için en uygun:
echo.
echo   ┌─────────────────────────────────────────────────────────────┐
echo   │  Frontend:  http://[BU_PC_IP]:8088                         │
echo   │  API:       http://[BU_PC_IP]:8089                         │
echo   │  Database:  [BU_PC_IP]:5433                                │
echo   │                                                            │
echo   │  Docker Network: 172.28.0.0/16 (tamamen izole)             │
echo   └─────────────────────────────────────────────────────────────┘
echo.
echo   Bu yapılandırma:
echo   ✅ Kamera portları (80, 554, 8080) ile çakışmaz
echo   ✅ NVR portları (8000, 37777) ile çakışmaz  
echo   ✅ Standart veritabanı portu (5432) ile çakışmaz
echo   ✅ Docker network otel LAN'ından izole
echo.
pause
