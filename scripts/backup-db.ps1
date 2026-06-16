# Guvenlik Yonetim Sistemi - Veritabani Otomatik Yedekleme Scripti
$ErrorActionPreference = 'Stop'

# Klasör yolları
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$backupDir = Join-Path $projectRoot "backups"
$logFile = Join-Path $backupDir "backup_log.txt"

# Günlük yedek temizleme süresi (gün)
$keepDays = 30

# Log yazma fonksiyonu
function Write-Log {
    param([string]$Message, [string]$Type="INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMsg = "[$timestamp] [$Type] $Message"
    Write-Host $logMsg
    Add-Content -Path $logFile -Value $logMsg -Encoding UTF8
}

try {
    # 1. Backups klasörü yoksa oluştur
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }

    Write-Log "Yedekleme islemi baslatildi."

    # 2. Docker çalışıyor mu kontrol et
    $dockerRunning = $false
    try {
        $null = docker info
        $dockerRunning = $true
    } catch {
        Write-Log "Docker calismiyor veya erisilemiyor!" "ERROR"
        exit 1
    }

    # 3. security_db container'ı çalışıyor mu kontrol et
    $containerStatus = docker inspect -f '{{.State.Running}}' security_db 2>$null
    if ($containerStatus -ne "true") {
        Write-Log "security_db container'i calismiyor! Yedek alinamadi." "ERROR"
        exit 1
    }

    # 4. Dosya ismi oluştur (yıl-ay-gün_saat-dakika)
    $dateStr = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupFileName = "db_backup_$dateStr.dump"
    $containerTempPath = "/tmp/security_management_$dateStr.dump"
    $localBackupPath = Join-Path $backupDir $backupFileName

    Write-Log "Veritabani dump aliniyor..."
    # Container içinde pg_dump çalıştır
    docker exec -t security_db pg_dump -U postgres -d security_management -Fc -f $containerTempPath
    
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump komutu hata koduyla sonlandi: $LASTEXITCODE"
    }

    Write-Log "Yedek dosyası container'dan kopyalanıyor..."
    # Yedeği yerel bilgisayara kopyala
    docker cp "security_db:$containerTempPath" $localBackupPath

    # Geçici dosyayı container içinden sil
    docker exec -t security_db rm $containerTempPath

    if (Test-Path $localBackupPath) {
        $fileSize = (Get-Item $localBackupPath).Length / 1KB
        Write-Log "Yedek basariyla alindi: $backupFileName ({0:N2} KB)" "SUCCESS"
    } else {
        throw "Yedek dosyası kopyalandıktan sonra yerel diskte bulunamadı!"
    }

    # 5. Eski yedekleri temizle (30 günden eski olanlar)
    Write-Log "$keepDays gunden eski yedekler temizleniyor..."
    $limitDate = (Get-Date).AddDays(-$keepDays)
    $deletedCount = 0
    Get-ChildItem -Path $backupDir -Filter "db_backup_*.dump" | ForEach-Object {
        if ($_.LastWriteTime -lt $limitDate) {
            Write-Log "Eski yedek siliniyor: $($_.Name)" "INFO"
            Remove-Item $_.FullName -Force
            $deletedCount++
        }
    }
    if ($deletedCount -gt 0) {
        Write-Log "$deletedCount adet eski yedek temizlendi." "SUCCESS"
    } else {
        Write-Log "Temizlenecek eski yedek bulunamadi." "INFO"
    }

} catch {
    Write-Log "Yedekleme sırasında hata olustu: $_" "ERROR"
    exit 1
}
