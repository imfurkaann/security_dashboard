<#
.SYNOPSIS
  Docker kullanmadan backend + frontend'i LAN (mobil) erişimine uygun başlatır.

.DESCRIPTION
  - Aktif Wi-Fi/LAN IPv4 adresini otomatik bulur
  - Port çakışması varsa backend/frontend için boş port seçer
  - Frontend'i doğru VITE_API_URL ile çalıştırır
  - İki ayrı PowerShell penceresi açar (backend ve frontend)
#>

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Get-HostIPv4 {
    # Öncelik: Wi-Fi
    $wifiIp = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias 'Wi-Fi' -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.AddressState -eq 'Preferred' } |
        Select-Object -First 1

    if ($wifiIp) {
        return $wifiIp.IPAddress
    }

    # Fallback: aktif fiziksel adaptörler
    $physicalAdapters = Get-NetAdapter -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Status -eq 'Up' -and
            $_.Name -notlike 'vEthernet*' -and
            $_.Name -notlike 'Docker*' -and
            $_.Name -notlike 'WSL*' -and
            $_.InterfaceDescription -notlike '*Virtual*' -and
            $_.InterfaceDescription -notlike '*Hyper-V*'
        }

    foreach ($adapter in $physicalAdapters) {
        $ip = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $adapter.InterfaceIndex -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.AddressState -eq 'Preferred' } |
            Select-Object -First 1

        if ($ip) {
            return $ip.IPAddress
        }
    }

    return '127.0.0.1'
}

function Test-PortFree {
    param([int]$Port)

    $existingListener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($existingListener) {
        return $false
    }

    try {
        $ipv6Socket = [System.Net.Sockets.Socket]::new(
            [System.Net.Sockets.AddressFamily]::InterNetworkV6,
            [System.Net.Sockets.SocketType]::Stream,
            [System.Net.Sockets.ProtocolType]::Tcp
        )

        $ipv6Socket.DualMode = $true
        $ipv6Socket.Bind([System.Net.IPEndPoint]::new([System.Net.IPAddress]::IPv6Any, $Port))
        $ipv6Socket.Listen(1)
        $ipv6Socket.Close()

        $ipv4Socket = [System.Net.Sockets.Socket]::new(
            [System.Net.Sockets.AddressFamily]::InterNetwork,
            [System.Net.Sockets.SocketType]::Stream,
            [System.Net.Sockets.ProtocolType]::Tcp
        )

        $ipv4Socket.Bind([System.Net.IPEndPoint]::new([System.Net.IPAddress]::Any, $Port))
        $ipv4Socket.Listen(1)
        $ipv4Socket.Close()

        return $true
    }
    catch {
        return $false
    }
}

function Get-FreePort {
    param(
        [int]$Preferred,
        [int]$RangeStart,
        [int]$RangeEnd
    )

    if (Test-PortFree -Port $Preferred) {
        return $Preferred
    }

    for ($p = $RangeStart; $p -le $RangeEnd; $p++) {
        if (Test-PortFree -Port $p) {
            return $p
        }
    }

    throw "Uygun port bulunamadi ($RangeStart-$RangeEnd)."
}

function Test-IsAdmin {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-FirewallRule {
    param([string]$Name, [int]$Port)

    $existing = Get-NetFirewallRule -DisplayName $Name -ErrorAction SilentlyContinue
    if ($existing) {
        return
    }

    New-NetFirewallRule -DisplayName $Name -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null
}

$hostIp = Get-HostIPv4
$backendPort = Get-FreePort -Preferred 5001 -RangeStart 5001 -RangeEnd 5099
$frontendPort = Get-FreePort -Preferred 5173 -RangeStart 5174 -RangeEnd 5199
$apiUrl = "http://${hostIp}:$backendPort/api"

$backendPath = Join-Path $PSScriptRoot 'backend'
$frontendPath = Join-Path $PSScriptRoot 'frontend'

if (-not (Test-Path (Join-Path $backendPath 'package.json'))) {
    throw 'backend/package.json bulunamadi.'
}

if (-not (Test-Path (Join-Path $frontendPath 'package.json'))) {
    throw 'frontend/package.json bulunamadi.'
}

if (Test-IsAdmin) {
    Ensure-FirewallRule -Name "Guvenlik Backend $backendPort" -Port $backendPort
    Ensure-FirewallRule -Name "Guvenlik Frontend $frontendPort" -Port $frontendPort
    Write-Host "[OK] Firewall kurallari kontrol edildi." -ForegroundColor Green
}
else {
    Write-Host "[UYARI] Yönetici olarak acilmadi; firewall engeli varsa mobil erisimde timeout olabilir." -ForegroundColor Yellow
}

$backendCmd = "Set-Location '$backendPath'; `$env:PORT='$backendPort'; `$env:PORT_FALLBACK='$backendPort'; `$env:PORT_ATTEMPT_COUNT='1'; npm run dev"
$frontendCmd = "Set-Location '$frontendPath'; `$env:VITE_API_URL='$apiUrl'; .\\node_modules\\.bin\\vite.cmd --host 0.0.0.0 --port $frontendPort"

Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoExit', '-Command', $backendCmd)
Start-Sleep -Milliseconds 500
Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoExit', '-Command', $frontendCmd)

Write-Host ''
Write-Host '=== NO-DOCKER MOBIL BASLADI ===' -ForegroundColor Cyan
Write-Host "Frontend: http://${hostIp}:$frontendPort" -ForegroundColor Green
Write-Host "Backend : http://${hostIp}:$backendPort/api" -ForegroundColor Green
Write-Host ''
Write-Host 'Telefon ayni Wi-Fi aginda olmali.' -ForegroundColor Gray
