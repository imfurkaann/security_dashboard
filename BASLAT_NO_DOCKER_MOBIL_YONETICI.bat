@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
  powershell -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start-no-docker-mobile.ps1"
pause
