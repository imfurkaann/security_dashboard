@echo off
chcp 65001 > nul
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║     🔍 OTEL AĞ ÇAKIŞMA KONTROLÜ                                              ║
echo ║     IP ve Port Çakışma Tespiti                                                ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.

echo 📋 ADIM 1: Mevcut Ağ Bilgileri
echo ═══════════════════════════════════════════════════════════════════════════════
echo.
echo 🖥️ Bu bilgisayarın IP adresleri:
ipconfig | findstr /i "IPv4"
echo.

echo 📋 ADIM 2: Kullanılan Portlar (Standart Çakışma Riski)
echo ═══════════════════════════════════════════════════════════════════════════════
echo.
echo Kontrol edilen portlar:
echo   • 80 (HTTP/Kamera Web)
echo   • 443 (HTTPS)
echo   • 554 (RTSP - Kamera Stream)
echo   • 8080 (Alternatif HTTP/NVR)
echo   • 5000 (API/Flask)
echo   • 5432 (PostgreSQL)
echo.

echo 🔍 Port 80 (HTTP):
netstat -ano | findstr ":80 " | findstr "LISTENING"
if %errorlevel% neq 0 echo    ✅ Müsait
echo.

echo 🔍 Port 443 (HTTPS):
netstat -ano | findstr ":443 " | findstr "LISTENING"
if %errorlevel% neq 0 echo    ✅ Müsait
echo.

echo 🔍 Port 554 (RTSP - Kamera):
netstat -ano | findstr ":554 " | findstr "LISTENING"
if %errorlevel% neq 0 echo    ✅ Müsait
echo.

echo 🔍 Port 8080 (Alt HTTP/NVR):
netstat -ano | findstr ":8080 " | findstr "LISTENING"
if %errorlevel% neq 0 echo    ✅ Müsait
echo.

echo 🔍 Port 5000 (API):
netstat -ano | findstr ":5000 " | findstr "LISTENING"
if %errorlevel% neq 0 echo    ✅ Müsait
echo.

echo 🔍 Port 5432 (PostgreSQL):
netstat -ano | findstr ":5432 " | findstr "LISTENING"
if %errorlevel% neq 0 echo    ✅ Müsait
echo.

echo 📋 ADIM 3: İzole Portlar (Çakışma Kontrolü)
echo ═══════════════════════════════════════════════════════════════════════════════
echo.
echo İzole yapılandırma şu portları kullanacak:
echo   • 8088 (Frontend)
echo   • 8089 (Backend API)
echo   • 5433 (PostgreSQL)
echo.

set ISOLATED_OK=1

echo 🔍 Port 8088:
netstat -ano | findstr ":8088 " | findstr "LISTENING"
if %errorlevel% neq 0 (
    echo    ✅ Müsait
) else (
    echo    ❌ KULANIMDA!
    set ISOLATED_OK=0
)
echo.

echo 🔍 Port 8089:
netstat -ano | findstr ":8089 " | findstr "LISTENING"
if %errorlevel% neq 0 (
    echo    ✅ Müsait
) else (
    echo    ❌ KULANIMDA!
    set ISOLATED_OK=0
)
echo.

echo 🔍 Port 5433:
netstat -ano | findstr ":5433 " | findstr "LISTENING"
if %errorlevel% neq 0 (
    echo    ✅ Müsait
) else (
    echo    ❌ KULANIMDA!
    set ISOLATED_OK=0
)
echo.

echo 📋 ADIM 4: Docker Network Kontrolü
echo ═══════════════════════════════════════════════════════════════════════════════
echo.
echo Mevcut Docker network'leri:
docker network ls 2>nul
if %errorlevel% neq 0 (
    echo ⚠️ Docker çalışmıyor veya kurulu değil!
) else (
    echo.
    echo 172.28.0.0/16 bloğu kontrolü:
    docker network inspect bridge --format "{{range .IPAM.Config}}{{.Subnet}}{{end}}" 2>nul | findstr "172.28" > nul
    if %errorlevel% neq 0 (
        echo    ✅ 172.28.0.0/16 bloğu kullanılmıyor
    ) else (
        echo    ⚠️ 172.28.0.0/16 bloğu zaten kullanımda
    )
)
echo.

echo 📋 ADIM 5: Sonuç
echo ═══════════════════════════════════════════════════════════════════════════════
echo.
if %ISOLATED_OK%==1 (
    echo ╔══════════════════════════════════════════════════════════════════════════════╗
    echo ║  ✅ İZOLE YAPILANDIRMA KULLANILABİLİR!                                       ║
    echo ║                                                                              ║
    echo ║  Portlar 8088, 8089 ve 5433 müsait.                                          ║
    echo ║  Sistemi başlatmak için: start-isolated.bat                                  ║
    echo ╚══════════════════════════════════════════════════════════════════════════════╝
) else (
    echo ╔══════════════════════════════════════════════════════════════════════════════╗
    echo ║  ⚠️ BAZI PORTLAR KULANIMDA!                                                  ║
    echo ║                                                                              ║
    echo ║  Yukarıdaki çıktıları inceleyip çakışan uygulamaları kapatın                 ║
    echo ║  veya farklı portlar yapılandırın.                                           ║
    echo ╚══════════════════════════════════════════════════════════════════════════════╝
)
echo.
pause
