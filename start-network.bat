@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ╔═══════════════════════════════════════════════════════════════╗
echo ║     SECURITY MANAGEMENT - AĞ PAYLAŞIMLI BAŞLATMA              ║
echo ╠═══════════════════════════════════════════════════════════════╣
echo ║  Bu script projeyi yerel ağda paylaşımlı olarak başlatır     ║
echo ║  Mevcut veritabanı verileri korunur, silinmez                ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

:: IP adresini otomatik al
echo [1/5] Bilgisayarın IP adresi tespit ediliyor...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    set IP=!IP: =!
    :: Sadece 192.168, 10. veya 172. ile başlayan adresleri al
    echo !IP! | findstr /r "^192\.168\. ^10\. ^172\." >nul
    if !errorlevel! equ 0 (
        set HOST_IP=!IP!
        goto :found_ip
    )
)

:found_ip
if not defined HOST_IP (
    echo [HATA] Yerel ağ IP adresi bulunamadı!
    echo Lütfen WiFi veya Ethernet bağlantınızı kontrol edin.
    pause
    exit /b 1
)

echo [OK] IP Adresi: %HOST_IP%
echo.

:: Docker kontrolü
echo [2/5] Docker kontrol ediliyor...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Docker çalışmıyor! Lütfen Docker Desktop'ı başlatın.
    pause
    exit /b 1
)
echo [OK] Docker çalışıyor.
echo.

:: Mevcut container'ları durdur
echo [3/5] Eski container'lar durduruluyor...
docker compose -f docker-compose.network.yml down 2>nul
echo [OK] Eski container'lar durduruldu.
echo.

:: Mevcut veritabanı volume kontrolü
echo [4/5] Veritabanı volume kontrol ediliyor...
docker volume inspect security_postgres_data >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Mevcut veritabanı volume bulundu. Veriler korunacak.
) else (
    echo [BILGI] Veritabanı volume bulunamadı. Yeni oluşturulacak.
    echo [UYARI] Eğer mevcut verileriniz varsa, önce volume'u oluşturun veya backup'tan yükleyin.
)
echo.

:: Docker Compose başlat
echo [5/5] Uygulama başlatılıyor...
echo.

set VITE_API_URL=http://%HOST_IP%:5000/api
set HOST_IP=%HOST_IP%

echo Kullanılan ayarlar:
echo   - API URL: %VITE_API_URL%
echo   - Host IP: %HOST_IP%
echo.

:: Build ve başlat
docker compose -f docker-compose.network.yml up --build -d

if %errorlevel% neq 0 (
    echo.
    echo [HATA] Uygulama başlatılamadı!
    pause
    exit /b 1
)

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║                    BAŞARILI ŞEKİLDE BAŞLATILDI                ║
echo ╠═══════════════════════════════════════════════════════════════╣
echo ║                                                               ║
echo ║  Bu bilgisayardan erişim:                                    ║
echo ║    http://localhost                                          ║
echo ║                                                               ║
echo ║  Ağdaki diğer cihazlardan erişim:                            ║
echo ║    http://%HOST_IP%                                    ║
echo ║                                                               ║
echo ║  API Adresi:                                                  ║
echo ║    http://%HOST_IP%:5000/api                           ║
echo ║                                                               ║
echo ╠═══════════════════════════════════════════════════════════════╣
echo ║  NOT: Aynı WiFi ağına bağlı cihazlar yukarıdaki             ║
echo ║       adresleri kullanarak uygulamaya erişebilir.            ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

:: Container durumlarını göster
echo Container Durumları:
docker compose -f docker-compose.network.yml ps
echo.

echo Logları görmek için: docker compose -f docker-compose.network.yml logs -f
echo Durdurmak için: docker compose -f docker-compose.network.yml down
echo.

pause
