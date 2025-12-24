@echo off
chcp 65001 > nul
echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║     🛡️ İZOLE SİSTEM İÇİN GÜVENLİK DUVARI YAPILANDIRMASI                      ║
echo ║     Security Management - Port İzinleri                                       ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.

REM Admin kontrolü
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Bu script yönetici olarak çalıştırılmalı!
    echo    Sağ tık yapıp "Yönetici olarak çalıştır" seçin.
    echo.
    pause
    exit /b 1
)

echo 📌 Eklenecek güvenlik duvarı kuralları:
echo    • Port 8088 (TCP) - Web Arayüzü
echo    • Port 8089 (TCP) - Backend API
echo.

REM Mevcut kuralları temizle
echo 🧹 Mevcut izole kurallar temizleniyor...
netsh advfirewall firewall delete rule name="Security Management - Isolated Frontend" > nul 2>&1
netsh advfirewall firewall delete rule name="Security Management - Isolated API" > nul 2>&1
echo    ✅ Temizlendi
echo.

REM Yeni kuralları ekle
echo 🛡️ Yeni kurallar ekleniyor...

echo    📌 Port 8088 (Frontend)...
netsh advfirewall firewall add rule name="Security Management - Isolated Frontend" ^
    dir=in action=allow protocol=TCP localport=8088 ^
    profile=private,domain description="Security Management Web Arayuzu - Izole Port"
if %errorlevel% equ 0 (
    echo       ✅ Başarılı
) else (
    echo       ❌ Hata!
)

echo    📌 Port 8089 (API)...
netsh advfirewall firewall add rule name="Security Management - Isolated API" ^
    dir=in action=allow protocol=TCP localport=8089 ^
    profile=private,domain description="Security Management Backend API - Izole Port"
if %errorlevel% equ 0 (
    echo       ✅ Başarılı
) else (
    echo       ❌ Hata!
)

echo.
echo ╔══════════════════════════════════════════════════════════════════════════════╗
echo ║  ✅ GÜVENLİK DUVARI YAPILANDIRMASI TAMAMLANDI                                ║
echo ╠══════════════════════════════════════════════════════════════════════════════╣
echo ║                                                                              ║
echo ║  Eklenen kurallar:                                                           ║
echo ║    • Security Management - Isolated Frontend (Port 8088)                     ║
echo ║    • Security Management - Isolated API (Port 8089)                          ║
echo ║                                                                              ║
echo ║  NOT: Kurallar sadece Private ve Domain ağ profillerinde aktiftir.           ║
echo ║       Public ağlarda çalışmaz (güvenlik için).                               ║
echo ╚══════════════════════════════════════════════════════════════════════════════╝
echo.

echo 📋 Mevcut Security Management kuralları:
netsh advfirewall firewall show rule name=all | findstr /i "Security Management"
echo.
pause
