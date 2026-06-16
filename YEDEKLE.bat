@echo off
title Guvenlik Yonetim Sistemi - Manuel Yedekleme
cd /d "%~dp0"
echo Veritabani yedegi aliniyor, lutfen bekleyin...
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0scripts\backup-db.ps1"
echo.
echo Islem tamamlandi.
pause
