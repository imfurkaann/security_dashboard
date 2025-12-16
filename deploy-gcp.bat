@echo off
REM ===========================================
REM Google Cloud Deployment Script for Windows
REM ===========================================

setlocal enabledelayedexpansion

echo =========================================
echo   Security Management - GCP Deployment
echo =========================================

REM Değişkenler
if "%GOOGLE_CLOUD_PROJECT%"=="" (
    echo Hata: GOOGLE_CLOUD_PROJECT environment variable tanimli degil
    echo Kullanim: set GOOGLE_CLOUD_PROJECT=your-project-id
    echo           deploy-gcp.bat
    exit /b 1
)

set PROJECT_ID=%GOOGLE_CLOUD_PROJECT%
if "%GOOGLE_CLOUD_REGION%"=="" (
    set REGION=europe-west1
) else (
    set REGION=%GOOGLE_CLOUD_REGION%
)

set DB_INSTANCE_NAME=security-db
set BACKEND_SERVICE=security-backend
set FRONTEND_SERVICE=security-frontend

echo Project: %PROJECT_ID%
echo Region: %REGION%

REM Proje ayarla
call gcloud config set project %PROJECT_ID%

REM API'leri etkinleştir
echo Gerekli API'ler etkinlestiriliyor...
call gcloud services enable cloudbuild.googleapis.com run.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com containerregistry.googleapis.com

REM Backend build ve deploy
echo Backend build ediliyor...
call gcloud builds submit ./backend --tag gcr.io/%PROJECT_ID%/%BACKEND_SERVICE%

echo Backend deploy ediliyor...
call gcloud run deploy %BACKEND_SERVICE% ^
    --image gcr.io/%PROJECT_ID%/%BACKEND_SERVICE% ^
    --region %REGION% ^
    --platform managed ^
    --allow-unauthenticated ^
    --memory=512Mi ^
    --cpu=1 ^
    --min-instances=0 ^
    --max-instances=10 ^
    --port=5000

REM Backend URL al
for /f "tokens=*" %%i in ('gcloud run services describe %BACKEND_SERVICE% --region=%REGION% --format="value(status.url)"') do set BACKEND_URL=%%i
echo Backend URL: %BACKEND_URL%

REM Frontend build ve deploy
echo Frontend build ediliyor...
call gcloud builds submit ./frontend --tag gcr.io/%PROJECT_ID%/%FRONTEND_SERVICE% --build-arg VITE_API_URL=%BACKEND_URL%/api

echo Frontend deploy ediliyor...
call gcloud run deploy %FRONTEND_SERVICE% ^
    --image gcr.io/%PROJECT_ID%/%FRONTEND_SERVICE% ^
    --region %REGION% ^
    --platform managed ^
    --allow-unauthenticated ^
    --memory=256Mi ^
    --cpu=1 ^
    --min-instances=0 ^
    --max-instances=5 ^
    --port=80

REM Frontend URL al
for /f "tokens=*" %%i in ('gcloud run services describe %FRONTEND_SERVICE% --region=%REGION% --format="value(status.url)"') do set FRONTEND_URL=%%i

echo.
echo =========================================
echo   Deployment Tamamlandi!
echo =========================================
echo.
echo Frontend URL: %FRONTEND_URL%
echo Backend URL: %BACKEND_URL%
echo.

endlocal
