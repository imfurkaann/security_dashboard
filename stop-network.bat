@echo off
chcp 65001 >nul

echo ╔═══════════════════════════════════════════════════════════════╗
echo ║     SECURITY MANAGEMENT - AĞ PAYLAŞIMLI DURDURMA              ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

echo Container'lar durduruluyor...
docker compose -f docker-compose.network.yml down

echo.
echo [OK] Tüm container'lar durduruldu.
echo [BILGI] Veritabanı verileri volume'da korunmaya devam ediyor.
echo.

pause
