@echo off
REM ===========================================
REM Google Cloud - EN UCUZ Deployment
REM Compute Engine e2-micro (Free Tier)
REM ===========================================

setlocal enabledelayedexpansion

echo =========================================
echo   En Ucuz GCP Deployment (Free Tier)
echo =========================================

if "%GOOGLE_CLOUD_PROJECT%"=="" (
    echo Hata: GOOGLE_CLOUD_PROJECT environment variable tanimli degil
    echo Kullanim: set GOOGLE_CLOUD_PROJECT=your-project-id
    echo           deploy-cheapest-gcp.bat
    exit /b 1
)

set PROJECT_ID=%GOOGLE_CLOUD_PROJECT%
set REGION=us-central1
set ZONE=%REGION%-a
set INSTANCE_NAME=security-app
set MACHINE_TYPE=e2-micro

echo Project: %PROJECT_ID%
echo Region: %REGION% (Free Tier)
echo Instance: %INSTANCE_NAME% (%MACHINE_TYPE%)

REM Proje ayarla
call gcloud config set project %PROJECT_ID%

REM API'leri etkinleştir
echo API'ler etkinlestiriliyor...
call gcloud services enable compute.googleapis.com

REM Firewall kuralları
echo Firewall kurallari olusturuluyor...
call gcloud compute firewall-rules create allow-http --allow tcp:80 --source-ranges 0.0.0.0/0 2>nul
call gcloud compute firewall-rules create allow-https --allow tcp:443 --source-ranges 0.0.0.0/0 2>nul

REM VM oluştur
echo e2-micro instance olusturuluyor...
call gcloud compute instances create %INSTANCE_NAME% ^
    --zone=%ZONE% ^
    --machine-type=%MACHINE_TYPE% ^
    --image-family=cos-stable ^
    --image-project=cos-cloud ^
    --boot-disk-size=30GB ^
    --boot-disk-type=pd-standard ^
    --tags=http-server,https-server

REM Projeyi kopyala
echo Proje dosyalari kopyalaniyor...
call gcloud compute scp --recurse --zone=%ZONE% * %INSTANCE_NAME%:/tmp/security/

REM Docker compose çalıştır
echo Docker compose baslatiliyor...
call gcloud compute ssh %INSTANCE_NAME% --zone=%ZONE% --command="cd /tmp/security && sudo docker compose up -d --build"

REM IP al
for /f "tokens=*" %%i in ('gcloud compute instances describe %INSTANCE_NAME% --zone=%ZONE% --format="value(networkInterfaces[0].accessConfigs[0].natIP)"') do set EXTERNAL_IP=%%i

echo.
echo =========================================
echo   Deployment Tamamlandi! (UCRETSIZ)
echo =========================================
echo.
echo Uygulama URL: http://%EXTERNAL_IP%
echo.

endlocal
