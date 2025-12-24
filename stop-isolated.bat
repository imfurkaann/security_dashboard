@echo off
chcp 65001 > nul
echo.
echo 🛑 İzole Security Management durduruluyor...
echo.

docker compose -f docker-compose.isolated.yml down

echo.
echo ✅ Sistem durduruldu.
echo.
echo 📋 Kalan container'lar:
docker ps --filter "name=security" --format "table {{.Names}}\t{{.Status}}"
echo.
pause
