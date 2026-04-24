param(
    [int]$FrontendPort = 0,
    [int]$BackendPort = 0,
    [string]$HostIP = '',
    [switch]$Silent
)

$ErrorActionPreference = 'SilentlyContinue'
Set-Location $PSScriptRoot

function Get-PreferredHostIPv4 {
    try {
        $defaultRoute = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' |
            Sort-Object RouteMetric, ifMetric |
            Select-Object -First 1

        if ($defaultRoute) {
            $ip = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $defaultRoute.InterfaceIndex |
                Where-Object {
                    $_.IPAddress -ne '127.0.0.1' -and
                    $_.IPAddress -notlike '169.254.*' -and
                    $_.AddressState -eq 'Preferred'
                } |
                Select-Object -First 1

            if ($ip) {
                return $ip.IPAddress
            }
        }
    } catch { }

    $physicalAdapters = Get-NetAdapter |
        Where-Object {
            $_.Status -eq 'Up' -and
            $_.Name -notlike 'vEthernet*' -and
            $_.Name -notlike 'Docker*' -and
            $_.Name -notlike 'WSL*' -and
            $_.InterfaceDescription -notlike '*Virtual*' -and
            $_.InterfaceDescription -notlike '*Hyper-V*'
        }

    foreach ($adapter in $physicalAdapters) {
        $ip = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $adapter.InterfaceIndex |
            Where-Object {
                $_.IPAddress -ne '127.0.0.1' -and
                $_.IPAddress -notlike '169.254.*' -and
                $_.AddressState -eq 'Preferred'
            } |
            Select-Object -First 1

        if ($ip) {
            return $ip.IPAddress
        }
    }

    return 'localhost'
}

function Get-MappedDockerPort {
    param(
        [string]$Service,
        [int]$ContainerPort
    )

    try {
        $mapped = docker compose port $Service $ContainerPort 2>$null
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mapped)) {
            return 0
        }

        $firstLine = ($mapped -split "`r?`n")[0].Trim()
        if ([string]::IsNullOrWhiteSpace($firstLine)) {
            return 0
        }

        if ($firstLine -match ':(\d+)\s*$') {
            return [int]$Matches[1]
        }

        if ($firstLine -match '^(\d+)\s*$') {
            return [int]$Matches[1]
        }
    } catch { }

    return 0
}

if ($FrontendPort -le 0) {
    $FrontendPort = Get-MappedDockerPort -Service 'frontend' -ContainerPort 80
    if ($FrontendPort -le 0) { $FrontendPort = 80 }
}

if ($BackendPort -le 0) {
    $BackendPort = Get-MappedDockerPort -Service 'backend' -ContainerPort 5000
    if ($BackendPort -le 0) { $BackendPort = 5000 }
}

if ([string]::IsNullOrWhiteSpace($HostIP)) {
    $HostIP = Get-PreferredHostIPv4
}

$localUrl = "http://localhost:$FrontendPort"
$networkUrl = "http://${HostIP}:$FrontendPort"

$accessInfo = @"
Guvenlik Sistemi Erisim Bilgileri
==================================
Tarih: $(Get-Date -Format "yyyy-MM-dd HH:mm")

Bu Bilgisayar: $localUrl
Ag Erisimi: $networkUrl

Frontend Port: $FrontendPort
Backend Port: $BackendPort
Host IP: $HostIP

Ayni WiFi agindaki cihazlar $networkUrl adresinden erisebilir.
"@

Set-Content -Path (Join-Path $PSScriptRoot 'ERISIM_BILGILERI.txt') -Value $accessInfo -Encoding UTF8

if (-not $Silent) {
    Write-Host "[OK] ERISIM_BILGILERI.txt guncellendi" -ForegroundColor Green
    Write-Host "[INFO] Frontend: $localUrl" -ForegroundColor Gray
    Write-Host "[INFO] Ag Erisimi: $networkUrl" -ForegroundColor Gray
}
