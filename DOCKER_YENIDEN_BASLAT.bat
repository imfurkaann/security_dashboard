@echo off
cd /d "%~dp0"

echo Docker yeniden baslatiliyor...
docker compose up -d
if %errorLevel% neq 0 (
  echo [HATA] docker compose up -d basarisiz.
  pause
  exit /b 1
)

echo Erisim bilgileri guncelleniyor...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0update-access-info.ps1"

if %errorLevel% neq 0 (
  echo [UYARI] Erisim bilgileri guncellenemedi.
  pause
  exit /b 1
)

echo [OK] Docker ve erisim bilgileri guncellendi.
pause
