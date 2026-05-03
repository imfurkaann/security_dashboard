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
    }
    catch {
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

function Test-IsAdmin {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Add-FirewallRulesIfNeeded {
    param([int]$FrontendPort, [int]$BackendPort)
    
    $isAdmin = Test-IsAdmin
    
    # Frontend kuralini kontrol et
    $frontendRule = Get-NetFirewallRule -DisplayName "Guvenlik Sistemi Frontend ($FrontendPort)" -ErrorAction SilentlyContinue
    $backendRule = Get-NetFirewallRule -DisplayName "Guvenlik Sistemi Backend ($BackendPort)" -ErrorAction SilentlyContinue
    
    if ($frontendRule -and $backendRule) {
        return @{ Success = $true; Message = "Firewall kurallari zaten mevcut" }
    }
    
    if (-not $isAdmin) {
        return @{ 
            Success  = $false
            Message  = "Firewall kurallari icin yonetici yetkisi gerekli"
            Commands = @(
                "New-NetFirewallRule -DisplayName `"Guvenlik Sistemi Frontend ($FrontendPort)`" -Direction Inbound -Protocol TCP -LocalPort $FrontendPort -Action Allow -Profile Any"
                "New-NetFirewallRule -DisplayName `"Guvenlik Sistemi Backend ($BackendPort)`" -Direction Inbound -Protocol TCP -LocalPort $BackendPort -Action Allow -Profile Any"
            )
        }
    }
    
    try {
        if (-not $frontendRule) {
            New-NetFirewallRule -DisplayName "Guvenlik Sistemi Frontend ($FrontendPort)" -Direction Inbound -Protocol TCP -LocalPort $FrontendPort -Action Allow -Profile Any | Out-Null
        }
        if (-not $backendRule) {
            New-NetFirewallRule -DisplayName "Guvenlik Sistemi Backend ($BackendPort)" -Direction Inbound -Protocol TCP -LocalPort $BackendPort -Action Allow -Profile Any | Out-Null
        }
        return @{ Success = $true; Message = "Firewall kurallari eklendi" }
    }
    catch {
        return @{ Success = $false; Message = "Firewall kurali eklenemedi: $_" }
    }
}

function Get-HostIPAddress {
    function Test-IsVirtualAdapter($adapter) {
        if (-not $adapter) { return $true }

        # Birçok sanal adaptörde HardwareInterface=false olur (Hyper-V/WSL/Docker/VPN)
        if ($adapter.PSObject.Properties.Name -contains 'HardwareInterface') {
            if (-not $adapter.HardwareInterface) { return $true }
        }

        $name = ($adapter.Name | ForEach-Object { "$_" }).ToLowerInvariant()
        $desc = ($adapter.InterfaceDescription | ForEach-Object { "$_" }).ToLowerInvariant()

        if ($name -match 'docker|wsl|vethernet|hyper-v|virtualbox|vmware|loopback|nat|tap|vpn') { return $true }
        if ($desc -match 'docker|wsl|hyper-v|virtual|virtualbox|vmware|loopback|nat|tap|vpn') { return $true }

        return $false
    }

    function Get-ScoredCandidate($ipAddress, $adapterName) {
        $score = 0
        if ($ipAddress.StartsWith('192.168.')) { $score += 100 }
        elseif ($ipAddress.StartsWith('10.')) { $score += 80 }
        elseif ($ipAddress -match '^172\.(1[6-9]|2\d|3[0-1])\.') { $score += 60 }

        $adapterLower = ("$adapterName").ToLowerInvariant()
        if ($adapterLower -match 'wi-?fi|wireless') { $score += 10 }
        if ($adapterLower -match 'ethernet') { $score += 5 }

        return @{ Score = $score; IP = $ipAddress; Adapter = $adapterName }
    }

    # Oncelik: Varsayilan internet rotasinin bagli oldugu adaptor
    try {
        $defaultRoutes = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' |
            Sort-Object RouteMetric, ifMetric |
            Select-Object -First 5

        $routeCandidates = @()

        foreach ($route in $defaultRoutes) {
            $adapter = Get-NetAdapter -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue
            if (Test-IsVirtualAdapter $adapter) { continue }

            $ipConfig = Get-NetIPAddress -InterfaceIndex $route.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
            foreach ($ip in $ipConfig) {
                if ($ip.IPAddress -eq '127.0.0.1') { continue }
                if ($ip.IPAddress -like '169.254.*') { continue }
                if ($ip.AddressState -ne 'Preferred') { continue }

                $isPrivate = (
                    $ip.IPAddress.StartsWith('192.168.') -or
                    $ip.IPAddress.StartsWith('10.') -or
                    ($ip.IPAddress -match '^172\.(1[6-9]|2\d|3[0-1])\.')
                )
                if (-not $isPrivate) { continue }

                $scored = Get-ScoredCandidate $ip.IPAddress $adapter.Name
                $routeCandidates += @{
                    Score      = $scored.Score
                    IP         = $scored.IP
                    Adapter    = $scored.Adapter
                    RouteMetric = $route.RouteMetric
                    IfMetric    = $route.ifMetric
                }
            }
        }

        if ($routeCandidates.Count -gt 0) {
            $best = $routeCandidates | Sort-Object -Property @(
                @{ Expression = 'Score'; Descending = $true },
                @{ Expression = 'RouteMetric'; Descending = $false },
                @{ Expression = 'IfMetric'; Descending = $false }
            ) | Select-Object -First 1
            return @{
                IP            = $best.IP
                Adapter       = $best.Adapter
                InCameraRange = Test-IPInCameraRange $best.IP
            }
        }
    }
    catch { }

    # Fallback: Fiziksel adaptorler (Wi-Fi, Ethernet)
    # Sanal adaptorleri (Docker/WSL/Hyper-V/VPN) atla
    $physicalAdapters = Get-NetAdapter | Where-Object { 
        $_.Status -eq 'Up' -and 
        -not (Test-IsVirtualAdapter $_)
    }
    
    # Once fiziksel adaptorlerden IP bul
    foreach ($adapter in $physicalAdapters) {
        $ipConfig = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
        
        foreach ($ip in $ipConfig) {
            if ($ip.IPAddress -ne "127.0.0.1" -and $ip.IPAddress -notlike "169.254.*") {
                return @{
                    IP            = $ip.IPAddress
                    Adapter       = $adapter.Name
                    InCameraRange = Test-IPInCameraRange $ip.IPAddress
                }
            }
        }
    }
    
    # Fiziksel bulunamazsa tum adaptorlerden skorlu secim yap (en iyi aday)
    $candidates = @()
    $allAdapters = Get-NetAdapter | Where-Object { $_.Status -eq 'Up' }
    foreach ($adapter in $allAdapters) {
        if (Test-IsVirtualAdapter $adapter) { continue }

        $ipConfig = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue
        foreach ($ip in $ipConfig) {
            if ($ip.IPAddress -eq '127.0.0.1') { continue }
            if ($ip.IPAddress -like '169.254.*') { continue }
            if ($ip.AddressState -ne 'Preferred') { continue }

            $isPrivate = (
                $ip.IPAddress.StartsWith('192.168.') -or
                $ip.IPAddress.StartsWith('10.') -or
                ($ip.IPAddress -match '^172\.(1[6-9]|2\d|3[0-1])\.')
            )
            if (-not $isPrivate) { continue }

            $candidates += (Get-ScoredCandidate $ip.IPAddress $adapter.Name)
        }
    }

    if ($candidates.Count -gt 0) {
        $best = $candidates | Sort-Object Score -Descending | Select-Object -First 1
        return @{
            IP            = $best.IP
            Adapter       = $best.Adapter
            InCameraRange = Test-IPInCameraRange $best.IP
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
}
catch { }

# Docker calisiyir mu?
$dockerRunning = $false
try {
    $result = docker info 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerRunning = $true
    }
}
catch { }

if (-not $dockerRunning) {
    Write-WARN "Docker Desktop calismiyor baslatiliyor..."
    
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
    
    Write-INF "Docker baslamasi bekleniyor"
    
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
        }
        catch { }
        
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
    }
    else {
        Write-OK "Guvenli IP bulundu: $hostIP"
    }
    Write-INF "Adaptor: $($networkInfo.Adapter)"
}
else {
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
    }
    catch {
        Write-WARN "Firewall ayarlanamadi: $_"
    }
}
else {
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
            # Yerel ag paylasimi icin tum originlere izin ver
            - CORS_ORIGIN=*
            - FRONTEND_PORT=${frontendPort}
            - PUBLIC_HOST_IP=${hostIP}
"@

Set-Content -Path "docker-compose.override.yml" -Value $overrideContent -Encoding UTF8

# Mevcut containerlari durdur
# docker compose down 2>$null

# Kod degisikliklerini uygula ve baslat
Write-INF "Sistem calistiriliyor..."
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
    }
    catch {
        Write-Host "." -NoNewline
    }
}
Write-Host ""

if ($systemReady) {
    Write-OK "Sistem hazir!"
}
else {
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
& "$PSScriptRoot\update-access-info.ps1" -FrontendPort $frontendPort -BackendPort $backendPort -HostIP $hostIP -Silent
Write-INF "Erisim bilgileri ERISIM_BILGILERI.txt dosyasina kaydedildi"

# Tarayici ac
Start-Process $localUrl

Write-Host ""
Write-Host "  Tarayici acildi." -ForegroundColor Green
Write-Host ""

# 3 saniye bekle ve otomatik kapat
Write-Host "  Pencere 1 saniye icinde kapanacak..." -ForegroundColor DarkGray
Start-Sleep -Seconds 1
