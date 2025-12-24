@echo off
chcp 65001 >nul

echo ╔═══════════════════════════════════════════════════════════════╗
echo ║     SECURITY MANAGEMENT - WINDOWS GÜVENLIK DUVARI AYARLARI   ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.
echo Bu script, ağdaki diğer cihazların uygulamaya erişebilmesi için
echo gerekli güvenlik duvarı kurallarını ekler.
echo.
echo Yönetici (Administrator) olarak çalıştırmanız gerekiyor!
echo.

:: Yönetici kontrolü
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [HATA] Bu script'i Yönetici olarak çalıştırın!
    echo        Sağ tıklayıp "Yönetici olarak çalıştır" seçin.
    pause
    exit /b 1
)

echo [1/3] Port 80 (HTTP - Frontend) açılıyor...
netsh advfirewall firewall add rule name="Security Management - HTTP" dir=in action=allow protocol=TCP localport=80 >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Port 80 açıldı.
) else (
    echo [BILGI] Port 80 zaten açık veya bir hata oluştu.
)

echo [2/3] Port 5000 (API - Backend) açılıyor...
netsh advfirewall firewall add rule name="Security Management - API" dir=in action=allow protocol=TCP localport=5000 >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Port 5000 açıldı.
) else (
    echo [BILGI] Port 5000 zaten açık veya bir hata oluştu.
)

echo [3/3] Port 5432 (PostgreSQL) açılıyor...
netsh advfirewall firewall add rule name="Security Management - PostgreSQL" dir=in action=allow protocol=TCP localport=5432 >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Port 5432 açıldı.
) else (
    echo [BILGI] Port 5432 zaten açık veya bir hata oluştu.
)

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║                          TAMAMLANDI                           ║
echo ╠═══════════════════════════════════════════════════════════════╣
echo ║  Güvenlik duvarı kuralları başarıyla eklendi.                ║
echo ║  Artık ağdaki diğer cihazlar uygulamaya erişebilir.          ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

pause
