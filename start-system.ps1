<#
.SYNOPSIS
    Guvenlik Yonetim Sistemi - Tek Tikla Baslatici
.DESCRIPTION
    Docker Desktop kontrol eder, IP cakismasini kontrol eder,
    ayni WiFi agindaki cihazlarin erisimini saglar
#>

# ============================================================================
# YAPILANDIRMA
# ============================================================================

# Guvenlik kamerasi IP araliklari (bu araliklar kullanilmayacak)
$CameraIPRanges = @(
    @{ Start = "192.168.1.100"; End = "192.168.1.200" }
    @{ Start = "192.168.1.240"; End = "192.168.1.254" }
    @{ Start = "192.168.0.100"; End = "192.168.0.200" }
    @{ Start = "10.0.0.100"; End = "10.0.0.200" }
)

# Rezerve portlar (kamera/guvenlik sistemleri)
$ReservedPorts = @(554, 8554, 8080, 8081, 37777, 34567, 9000, 3702)

# ============================================================================
# FONKSIYONLAR
# ============================================================================

function Show-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  =================================================================" -ForegroundColor Cyan
    Write-Host "  |                                                               |" -ForegroundColor Cyan
    Write-Host "  |       GUVENLIK YONETIM SISTEMI - BASLATICI                    |" -ForegroundColor Cyan
    Write-Host "  |                                                               |" -ForegroundColor Cyan
    Write-Host "  =================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Step, [string]$Message)
    Write-Host "  [$Step] $Message" -ForegroundColor Blue
}

function Write-OK {
    param([string]$Message)
    Write-Host "      [OK] $Message" -ForegroundColor Green
}

function Write-ERR {
    param([string]$Message)
    Write-Host "      [HATA] $Message" -ForegroundColor Red
}

function Write-WARN {
    param([string]$Message)
    Write-Host "      [UYARI] $Message" -ForegroundColor Yellow
}

function Write-INF {
    param([string]$Message)
    Write-Host "      [BILGI] $Message" -ForegroundColor Gray
}

function ConvertTo-IPInteger {
    param([string]$IP)
    $parts = $IP.Split('.')
    return [int64]($parts[0]) * 16777216 + [int64]($parts[1]) * 65536 + [int64]($parts[2]) * 256 + [int64]($parts[3])
}

function Test-IPInCameraRange {
    param([string]$IP)
    $ipInt = ConvertTo-IPInteger $IP
    
    foreach ($range in $CameraIPRanges) {
        $startInt = ConvertTo-IPInteger $range.Start
        $endInt = ConvertTo-IPInteger $range.End
        
        if ($ipInt -ge $startInt -and $ipInt -le $endInt) {
            return $true
        }
    }
    return $false
}

function Test-PortAvailable {
    param([int]$Port)
    
    if ($ReservedPorts -contains $Port) {
        return $false
    }
    
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    } catch {
        return $false
    }
}

function Find-AvailablePort {
    param([int]$Preferred, [int]$RangeStart, [int]$RangeEnd)
    
    if (Test-PortAvailable $Preferred) {
        return $Preferred
    }
    
    for ($p = $RangeStart; $p -le $RangeEnd; $p++) {
        if (Test-PortAvailable $p) {
            return $p
        }
    }
    return $null
}

function Get-HostIPAddress {
    $adapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }
    
    foreach ($adapter in $adapters) {
        $ipConfig = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
        
        foreach ($ip in $ipConfig) {
            if ($ip.IPAddress -ne "127.0.0.1" -and $ip.IPAddress -notlike "169.254.*") {
                return @{
                    IP = $ip.IPAddress
                    Adapter = $adapter.Name
                    InCameraRange = Test-IPInCameraRange $ip.IPAddress
                }
            }
        }
    }
    return $null
}

# ============================================================================
# ANA PROGRAM
# ============================================================================

Show-Banner

$projectPath = $PSScriptRoot
Set-Location $projectPath

# ----------------------------------------------------------------------------
# ADIM 1: Docker Kontrolu
# ----------------------------------------------------------------------------
Write-Step "1/6" "Docker Desktop kontrol ediliyor..."

$dockerInstalled = $false
try {
    $null = Get-Command docker -ErrorAction Stop
    $dockerInstalled = $true
} catch { }

if (-not $dockerInstalled) {
    Write-ERR "Docker kurulu degil!"
    Write-INF "Docker Desktop indirin: https://docker.com/products/docker-desktop"
    Start-Process "https://docker.com/products/docker-desktop"
    Write-Host ""
    Read-Host "  Cikmak icin Enter"
    exit 1
}
Write-OK "Docker kurulu"

# Docker calisiyir mu?
$dockerRunning = $false
try {
    $result = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerRunning = $true
    }
} catch { }

if (-not $dockerRunning) {
    Write-WARN "Docker Desktop calismiyorbaslatiliyor..."
    
    $dockerPaths = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
    )
    
    $dockerExe = $null
    foreach ($path in $dockerPaths) {
        if (Test-Path $path) {
            $dockerExe = $path
            break
        }
    }
    
    if ($dockerExe) {
        # Docker Desktop'i baslat
        Start-Process $dockerExe
    }
    
    Write-INF "Docker baslamasi bekleniyor (max 90 saniye)..."
    
    $maxWait = 90
    $waited = 0
    
    while ($waited -lt $maxWait) {
        Start-Sleep -Seconds 3
        $waited += 3
        
        try {
            $result = docker info 2>&1
            if ($LASTEXITCODE -eq 0) {
                $dockerRunning = $true
                break
            }
        } catch { }
        
        Write-Host "." -NoNewline
    }
    Write-Host ""
    
    if (-not $dockerRunning) {
        Write-ERR "Docker baslatilamadi!"
        Read-Host "  Cikmak icin Enter"
        exit 1
    }
}
Write-OK "Docker Desktop calisiyor"

# ----------------------------------------------------------------------------
# ADIM 2: Ag Yapilandirmasi
# ----------------------------------------------------------------------------
Write-Host ""
Write-Step "2/6" "Ag yapilandirmasi kontrol ediliyor..."

$networkInfo = Get-HostIPAddress
$hostIP = "localhost"
$networkAccess = $false

if ($networkInfo) {
    $hostIP = $networkInfo.IP
    $networkAccess = $true
    
    if ($networkInfo.InCameraRange) {
        Write-WARN "IP ($hostIP) guvenlik kamerasi araliginda olabilir!"
        Write-INF "Sistem calisacak ama IP cakismasi riski var"
    } else {
        Write-OK "Guvenli IP bulundu: $hostIP"
    }
    Write-INF "Adaptor: $($networkInfo.Adapter)"
} else {
    Write-WARN "Ag baglantisi bulunamadi - sadece localhost"
}

# ----------------------------------------------------------------------------
# ADIM 3: Port Kontrolu
# ----------------------------------------------------------------------------
Write-Host ""
Write-Step "3/6" "Uygun portlar araniyor..."

$frontendPort = Find-AvailablePort -Preferred 80 -RangeStart 8000 -RangeEnd 8999
$backendPort = Find-AvailablePort -Preferred 5000 -RangeStart 5001 -RangeEnd 5999

if (-not $frontendPort -or -not $backendPort) {
    Write-ERR "Uygun port bulunamadi!"
    Read-Host "  Cikmak icin Enter"
    exit 1
}

Write-OK "Frontend: $frontendPort | Backend: $backendPort"

# ----------------------------------------------------------------------------
# ADIM 4: Firewall Kurallari
# ----------------------------------------------------------------------------
Write-Host ""
Write-Step "4/6" "Firewall kurallari ayarlaniyor..."

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdmin) {
    try {
        Remove-NetFirewallRule -DisplayName "GuvenlikSistemi-FE" -ErrorAction SilentlyContinue
        Remove-NetFirewallRule -DisplayName "GuvenlikSistemi-BE" -ErrorAction SilentlyContinue
        
        New-NetFirewallRule -DisplayName "GuvenlikSistemi-FE" -Direction Inbound -Protocol TCP -LocalPort $frontendPort -Action Allow -Profile Any | Out-Null
        New-NetFirewallRule -DisplayName "GuvenlikSistemi-BE" -Direction Inbound -Protocol TCP -LocalPort $backendPort -Action Allow -Profile Any | Out-Null
        
        Write-OK "Firewall kurallari eklendi (ag erisimi aktif)"
    } catch {
        Write-WARN "Firewall ayarlanamadi: $_"
    }
} else {
    Write-WARN "Yonetici yetkisi yok - ag erisimi kisitli olabilir"
    Write-INF "Ag erisimi icin: Sag tikla > Yonetici olarak calistir"
}

# ----------------------------------------------------------------------------
# ADIM 5: Docker Compose
# ----------------------------------------------------------------------------
Write-Host ""
Write-Step "5/6" "Docker containerlari baslatiliyor..."
Write-INF "Bu islem 1-3 dakika surebilir..."

# Override dosyasi olustur
$overrideContent = @"
services:
  frontend:
    ports:
      - "${frontendPort}:80"
  backend:
    ports:
      - "${backendPort}:5000"
    environment:
      - CORS_ORIGIN=http://${hostIP}:${frontendPort}
"@

Set-Content -Path "docker-compose.override.yml" -Value $overrideContent -Encoding UTF8

# Mevcut containerlari durdur
docker compose down 2>$null

# Eski build cache'ini temizle ve yeniden baslat
Write-INF "Eski cache temizleniyor ve yeniden build ediliyor..."
docker compose build --no-cache
docker compose up -d

if ($LASTEXITCODE -ne 0) {
    Write-ERR "Docker baslatma hatasi!"
    Write-INF "Detay icin: docker compose logs"
    Read-Host "  Cikmak icin Enter"
    exit 1
}

Write-OK "Containerlar baslatildi"

# ----------------------------------------------------------------------------
# ADIM 6: Sistem Hazirlik Kontrolu
# ----------------------------------------------------------------------------
Write-Host ""
Write-Step "6/6" "Sistem hazirlaniyor..."

$systemReady = $false
$maxRetries = 30
$retryCount = 0

while ($retryCount -lt $maxRetries -and -not $systemReady) {
    Start-Sleep -Seconds 2
    $retryCount++
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$backendPort/api/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $systemReady = $true
        }
    } catch {
        Write-Host "." -NoNewline
    }
}
Write-Host ""

if ($systemReady) {
    Write-OK "Sistem hazir!"
} else {
    Write-WARN "Sistem hala basliyor olabilir, birka saniye bekleyin"
}

# ----------------------------------------------------------------------------
# SONUC
# ----------------------------------------------------------------------------
$localUrl = "http://localhost:$frontendPort"
$networkUrl = "http://${hostIP}:$frontendPort"

Write-Host ""
Write-Host "  =================================================================" -ForegroundColor Green
Write-Host "  |            SISTEM BASARIYLA BASLATILDI!                       |" -ForegroundColor Green
Write-Host "  =================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  ERISIM ADRESLERI:" -ForegroundColor Cyan
Write-Host ""
Write-Host "     Bu Bilgisayar:" -ForegroundColor White
Write-Host "     $localUrl" -ForegroundColor Yellow
Write-Host ""

if ($networkAccess) {
    Write-Host "     Diger Cihazlar (ayni WiFi):" -ForegroundColor White
    Write-Host "     $networkUrl" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "     Telefon, tablet veya baska bilgisayarlardan" -ForegroundColor Gray
    Write-Host "     yukaridaki adresi tarayiciya yazin." -ForegroundColor Gray
}

Write-Host ""
Write-Host "  -----------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Sistemi durdurmak: docker compose down" -ForegroundColor Gray
Write-Host "  Loglari gormek:    docker compose logs -f" -ForegroundColor Gray
Write-Host "  -----------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# Erisim bilgilerini dosyaya kaydet
$accessInfo = @"
Guvenlik Sistemi Erisim Bilgileri
==================================
Tarih: $(Get-Date -Format "yyyy-MM-dd HH:mm")

Bu Bilgisayar: $localUrl
Ag Erisimi: $networkUrl

Frontend Port: $frontendPort
Backend Port: $backendPort
Host IP: $hostIP

Ayni WiFi agindaki cihazlar $networkUrl adresinden erisebilir.
"@

Set-Content -Path "ERISIM_BILGILERI.txt" -Value $accessInfo -Encoding UTF8
Write-INF "Erisim bilgileri ERISIM_BILGILERI.txt dosyasina kaydedildi"

# Tarayici ac
Start-Process $localUrl

Write-Host ""
Write-Host "  Tarayici acildi." -ForegroundColor Green
Write-Host ""

# 3 saniye bekle ve otomatik kapat
Write-Host "  Pencere 3 saniye icinde kapanacak..." -ForegroundColor DarkGray
Start-Sleep -Seconds 3
