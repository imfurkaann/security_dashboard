@echo off
title Guvenlik Yonetim Sistemi

:: Yonetici yetkisi kontrolu
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Yonetici yetkisi isteniyor...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start-system.ps1"
