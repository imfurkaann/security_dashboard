[CmdletBinding()]
param(
    [string]$SiteName,
    [string]$LogoPath
)

$ErrorActionPreference = 'Stop'
$utf8Encoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8Encoding
try {
    [Console]::InputEncoding = $utf8Encoding
    [Console]::OutputEncoding = $utf8Encoding
} catch {
    # Grafik ortamdan veya yönlendirilmiş terminalden çalıştırıldığında devam et.
}

$currentPrincipal = New-Object Security.Principal.WindowsPrincipal(
    [Security.Principal.WindowsIdentity]::GetCurrent()
)
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    try {
        $elevatedArguments = @(
            '-STA',
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', ('"' + $PSCommandPath + '"')
        )
        $elevatedProcess = Start-Process `
            -FilePath 'powershell.exe' `
            -Verb RunAs `
            -Wait `
            -PassThru `
            -ArgumentList $elevatedArguments
        exit $elevatedProcess.ExitCode
    } catch {
        Write-Host 'Kurulum için yönetici izni verilmedi veya yönetici oturumu başlatılamadı.' -ForegroundColor Red
        Read-Host 'Bu pencereyi kapatmak için Enter tuşuna basın'
        exit 1
    }
}

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot
$installLogPath = Join-Path $projectRoot 'KURULUM_LOG.txt'
$exitCode = 0

function Test-InstallationPackageIntegrity {
    $checksumPath = Join-Path $projectRoot 'SHA256SUMS.txt'
    if (-not (Test-Path -LiteralPath $checksumPath -PathType Leaf)) {
        throw 'SHA256SUMS.txt bulunamadı. Kurulum paketini eksiksiz kopyalayın.'
    }

    $checkedFiles = 0
    foreach ($line in Get-Content -LiteralPath $checksumPath) {
        if ($line -notmatch '^([0-9a-fA-F]{64})  (.+)$') {
            throw 'SHA256SUMS.txt biçimi geçersiz. Paketi yeniden kopyalayın.'
        }

        $expectedHash = $matches[1].ToLowerInvariant()
        $relativePath = $matches[2]
        $targetPath = [IO.Path]::GetFullPath((Join-Path $projectRoot $relativePath))
        if (-not $targetPath.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Paket doğrulamasında geçersiz yol bulundu: $relativePath"
        }
        if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
            throw "Kurulum dosyası eksik: $relativePath"
        }

        $actualHash = (Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -ne $expectedHash) {
            throw "Kurulum dosyası bozuk veya eksik kopyalanmış: $relativePath"
        }
        $checkedFiles++
    }

    if ($checkedFiles -eq 0) {
        throw 'Paket bütünlüğü doğrulanamadı.'
    }
}

try {
    Start-Transcript -LiteralPath $installLogPath -Append | Out-Null
    Write-Host 'Kurulum paketi kontrol ediliyor...'
    Test-InstallationPackageIntegrity
    Write-Host 'Kurulum paketi sağlam.' -ForegroundColor Green

    if (-not $SiteName) {
        $SiteName = Read-Host 'Tesis/işletme adı'
    }

    $existingBrandLogo = Join-Path $projectRoot 'branding\logo.png'
    if (-not $LogoPath -and -not (Test-Path -LiteralPath $existingBrandLogo)) {
        Add-Type -AssemblyName System.Windows.Forms
        $logoDialog = New-Object System.Windows.Forms.OpenFileDialog
        $logoDialog.Title = 'Müşterinin logo dosyasını seçin'
        $logoDialog.Filter = 'Logo dosyaları (*.png;*.jpg;*.jpeg;*.bmp;*.gif)|*.png;*.jpg;*.jpeg;*.bmp;*.gif'
        $logoDialog.Multiselect = $false
        if ($logoDialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
            throw 'Yeni kurulum için müşteri logosu seçilmelidir.'
        }
        $LogoPath = $logoDialog.FileName
    }

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker Desktop bulunamadı. Desteklenen Docker Desktop/Engine kurulup lisans koşulları kabul edilmelidir.'
    }

    try {
        docker info | Out-Null
    } catch {
        Write-Host 'Docker Desktop başlatılıyor...'
        docker desktop start | Out-Null
        $deadline = (Get-Date).AddMinutes(4)
        do {
            try {
                docker info | Out-Null
                $dockerReady = $true
            } catch {
                $dockerReady = $false
                Start-Sleep -Seconds 4
            }
        } while (-not $dockerReady -and (Get-Date) -lt $deadline)
        if (-not $dockerReady) { throw 'Docker Desktop zamanında başlatılamadı.' }
    }

    $imageArchive = Join-Path $projectRoot 'docker-images.tar'
    $installParameters = @{ SiteName = $SiteName; LogoPath = $LogoPath }
    if (Test-Path $imageArchive) {
        Write-Host 'Çevrimdışı Docker image paketi yükleniyor...'
        docker load --input $imageArchive
        if ($LASTEXITCODE -ne 0) { throw 'Docker image paketi yüklenemedi.' }
        $installParameters.SkipBuild = $true
    }

    & (Join-Path $projectRoot 'scripts\install-local-server.ps1') @installParameters
    if ($LASTEXITCODE -ne 0) { throw 'Yerel sunucu kurulumu tamamlanamadı.' }

    & (Join-Path $projectRoot 'scripts\setup-auto-backup.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Otomatik yedekleme görevi oluşturulamadı.' }

    & (Join-Path $projectRoot 'scripts\verify-local-installation.ps1')
    if ($LASTEXITCODE -ne 0) { throw 'Kurulum sonu doğrulaması başarısız oldu.' }

    $accessInfo = Join-Path $projectRoot 'client-setup\ERISIM_BILGILERI.txt'
    $urlLine = Get-Content $accessInfo | Where-Object { $_ -match '^HTTPS Adresi:' } | Select-Object -First 1
    $serverUrl = ($urlLine -replace '^HTTPS Adresi:\s*', '').Trim()

    Write-Host ''
    Write-Host 'Kurulum ve güvenlik doğrulaması tamamlandı.' -ForegroundColor Green
    Write-Host "Sunucu adresi: $serverUrl"
    Write-Host 'Diğer bilgisayarlara yalnızca client-setup klasörünü kopyalayın.'
    Start-Process $serverUrl
} catch {
    $exitCode = 1
    Write-Host ''
    Write-Host 'KURULUM TAMAMLANAMADI' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Ayrıntılı kayıt: $installLogPath" -ForegroundColor Yellow
} finally {
    try { Stop-Transcript | Out-Null } catch { }
    Write-Host ''
    if ($exitCode -eq 0) {
        Read-Host 'Kurulum tamamlandı. Bu pencereyi kapatmak için Enter tuşuna basın'
    } else {
        Read-Host 'Hata mesajını not alın. Bu pencereyi kapatmak için Enter tuşuna basın'
    }
}

exit $exitCode
