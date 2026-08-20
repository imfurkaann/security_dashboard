# Guvenlik Yonetim Sistemi - Gunluk Otomatik Yedekleme Gorevi Olusturucu
# Yonetici yetkisi kontrolu
$ErrorActionPreference = 'Stop'
$utf8Encoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8Encoding
try {
    [Console]::InputEncoding = $utf8Encoding
    [Console]::OutputEncoding = $utf8Encoding
} catch { }

function Test-IsAdmin {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
    Write-Host "UYARI: Otomatik gorev eklemek icin Yonetici yetkisi gereklidir!" -ForegroundColor Yellow
    Write-Host "Lutfen PowerShell'i veya terminali Yonetici Olarak calistirin." -ForegroundColor Red
    Read-Host "Kapatmak icin Enter'a basin"
    exit 1
}

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$backupScriptPath = Join-Path $projectRoot "scripts\backup-db.ps1"

if (-not (Test-Path $backupScriptPath)) {
    Write-Host "HATA: Yedekleme betiği bulunamadı! Yol: $backupScriptPath" -ForegroundColor Red
    exit 1
}

$taskName = "GuvenlikSistemi_Gunluk_Yedekleme"
$description = "Güvenlik Yönetim Sistemi veritabanını her gün saat 03:00'da otomatik olarak yedekler."
$triggerTime = "03:00"

Write-Host "Görev ayarlanıyor..."
Write-Host "Görev Adı: $taskName"
Write-Host "Çalıştırılacak Dosya: $backupScriptPath"
Write-Host "Zaman: Her gün $triggerTime"

# Task Scheduler (Görev Zamanlayıcı) görevi oluştur/güncelle
# -Force parametresi eski görev varsa üzerine yazar
try {
    # Windows Task Scheduler eylemi
    $action = New-ScheduledTaskAction `
        -Execute "powershell.exe" `
        -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$backupScriptPath`"" `
        -WorkingDirectory $projectRoot
    
    # Her gün saat 03:00 tetikleyicisi
    $trigger = New-ScheduledTaskTrigger -Daily -At $triggerTime
    
    # Şu anki kullanıcının yetkileriyle çalıştır (Docker Desktop'a erişim için gereklidir)
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $principal = New-ScheduledTaskPrincipal -UserId $currentUser -RunLevel Highest
    
    # Görev ayarları (Pille çalışırken çalıştır, kaçırılırsa en kısa sürede çalıştır vb.)
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    
    # Görevi kaydet
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description $description -Force | Out-Null
    
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host " BAŞARILI: Günlük otomatik yedekleme görevi oluşturuldu!  " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Sistem her gün saat $triggerTime'da yedek alacaktır." -ForegroundColor Gray
    Write-Host "Alınan yedekler project_root/backups/ klasöründe saklanır." -ForegroundColor Gray
    Write-Host "Son 30 günün yedekleri korunur, eskiler otomatik silinir." -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "HATA: Görev oluşturulurken bir hata oluştu: $_" -ForegroundColor Red
}
