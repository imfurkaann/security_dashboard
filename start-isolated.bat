@echo off
chcp 65001 > nul
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║     🏨 OTEL İZOLE SECURITY MANAGEMENT BAŞLATICI                              ║
echo ║     Kamera ve Diğer Sistemlerle Çakışmayan Yapılandırma                       ║
echo ╠══════════════════════════════════════════════════════════════════════════════╣
echo ║  Bu script sistemi tamamen izole portlar ve network ile başlatır:            ║
echo ║                                                                              ║
echo ║  📌 Kullanılan Portlar (Standart portlarla çakışmaz):                        ║
echo ║     • 8088 - Web Arayüzü (Frontend)                                          ║
echo ║     • 8089 - Backend API                                                     ║
echo ║     • 5433 - Veritabanı (sadece localhost)                                   ║
echo ║                                                                              ║
echo ║  📌 Docker Network: 172.28.0.0/16 (Otel LAN'ı ile çakışmaz)                  ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.

REM IP adresini otomatik al
echo 🔍 IP adresi tespit ediliyor...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set "IP=%%a"
    goto :found
)
:found
REM Baştaki boşluğu temizle
set IP=%IP: =%
echo ✅ Tespit edilen IP: %IP%
echo.

REM Çakışma kontrolü
echo 🔍 Port çakışması kontrol ediliyor...
netstat -ano | findstr ":8088 " > nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  UYARI: Port 8088 zaten kullanımda!
    netstat -ano | findstr ":8088 "
    echo.
    set /p CONTINUE="Devam etmek istiyor musunuz? (E/H): "
    if /i not "%CONTINUE%"=="E" exit /b 1
)

netstat -ano | findstr ":8089 " > nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  UYARI: Port 8089 zaten kullanımda!
    netstat -ano | findstr ":8089 "
    echo.
    set /p CONTINUE="Devam etmek istiyor musunuz? (E/H): "
    if /i not "%CONTINUE%"=="E" exit /b 1
)

netstat -ano | findstr ":5433 " > nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  UYARI: Port 5433 zaten kullanımda!
    netstat -ano | findstr ":5433 "
    echo.
    set /p CONTINUE="Devam etmek istiyor musunuz? (E/H): "
    if /i not "%CONTINUE%"=="E" exit /b 1
)

echo ✅ Tüm portlar müsait!
echo.

REM Environment değişkenlerini ayarla
set HOST_IP=%IP%
set VITE_API_URL=http://%IP%:8089/api

echo 📋 Yapılandırma:
echo    HOST_IP=%HOST_IP%
echo    VITE_API_URL=%VITE_API_URL%
echo.

REM Docker Compose başlat
echo 🚀 Docker Compose başlatılıyor (izole yapılandırma)...
echo.
docker compose -f docker-compose.isolated.yml up --build -d

if %errorlevel% neq 0 (
    echo.
    echo ❌ Docker Compose başlatılamadı!
    echo    Docker Desktop'ın çalıştığından emin olun.
    pause
    exit /b 1
)

echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║  ✅ SİSTEM BAŞARIYLA BAŞLATILDI!                                             ║
echo ╠══════════════════════════════════════════════════════════════════════════════╣
echo ║                                                                              ║
echo ║  🌐 ERİŞİM ADRESLERİ:                                                        ║
echo ║                                                                              ║
echo ║     Bu Bilgisayar:                                                           ║
echo ║       http://localhost:8088                                                  ║
echo ║                                                                              ║
echo ║     Ağdaki Diğer Cihazlar:                                                   ║
echo ║       http://%IP%:8088                                            ║
echo ║                                                                              ║
echo ║     API Adresi:                                                              ║
echo ║       http://%IP%:8089/api                                        ║
echo ║                                                                              ║
echo ╠══════════════════════════════════════════════════════════════════════════════╣
echo ║  📌 NOT: Güvenlik duvarı izni gerekebilir. İzin vermeyi unutmayın!           ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.

REM Güvenlik duvarı kuralları ekle
echo 🛡️ Güvenlik duvarı kuralları ekleniyor...
netsh advfirewall firewall show rule name="Security Management - Isolated Frontend" > nul 2>&1
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="Security Management - Isolated Frontend" dir=in action=allow protocol=TCP localport=8088 > nul 2>&1
    echo    ✅ Port 8088 izni eklendi
) else (
    echo    ℹ️ Port 8088 izni zaten mevcut
)

netsh advfirewall firewall show rule name="Security Management - Isolated API" > nul 2>&1
if %errorlevel% neq 0 (
    netsh advfirewall firewall add rule name="Security Management - Isolated API" dir=in action=allow protocol=TCP localport=8089 > nul 2>&1
    echo    ✅ Port 8089 izni eklendi
) else (
    echo    ℹ️ Port 8089 izni zaten mevcut
)
echo.

echo Container durumları:
docker ps --filter "name=security" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo.
pause
