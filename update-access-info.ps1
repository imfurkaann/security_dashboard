param(
    [int]$FrontendPort = 0,
    [int]$BackendPort = 0,
    [string]$HostIP = '',
    [switch]$Silent
)

$ErrorActionPreference = 'SilentlyContinue'
Set-Location $PSScriptRoot

function Get-PreferredHostIPv4 {
    function Test-IsVirtualAdapter($adapter) {
        if (-not $adapter) { return $true }

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

    try {
        $defaultRoutes = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' |
            Sort-Object RouteMetric, ifMetric |
            Select-Object -First 5

        $routeCandidates = @()

        foreach ($route in $defaultRoutes) {
            $adapter = Get-NetAdapter -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue
            if (Test-IsVirtualAdapter $adapter) { continue }

            $ips = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex |
                Where-Object {
                    $_.IPAddress -ne '127.0.0.1' -and
                    $_.IPAddress -notlike '169.254.*' -and
                    $_.AddressState -eq 'Preferred' -and
                    (
                        $_.IPAddress.StartsWith('192.168.') -or
                        $_.IPAddress.StartsWith('10.') -or
                        $_.IPAddress -match '^172\.(1[6-9]|2\d|3[0-1])\.'
                    )
                }

            foreach ($ip in $ips) {
                $scored = Get-ScoredCandidate $ip.IPAddress $adapter.Name
                $routeCandidates += @{
                    Score       = $scored.Score
                    IP          = $scored.IP
                    Adapter     = $scored.Adapter
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
            return $best.IP
        }
    } catch { }

    $physicalAdapters = Get-NetAdapter |
        Where-Object {
            $_.Status -eq 'Up' -and
            -not (Test-IsVirtualAdapter $_)
        }

    foreach ($adapter in $physicalAdapters) {
        $ip = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $adapter.InterfaceIndex |
            Where-Object {
                $_.IPAddress -ne '127.0.0.1' -and
                $_.IPAddress -notlike '169.254.*' -and
                $_.AddressState -eq 'Preferred' -and
                (
                    $_.IPAddress.StartsWith('192.168.') -or
                    $_.IPAddress.StartsWith('10.') -or
                    $_.IPAddress -match '^172\.(1[6-9]|2\d|3[0-1])\.'
                )
            } |
            Select-Object -First 1

        if ($ip) {
            return $ip.IPAddress
        }
    }

    # Son care: tum uygun adaptorlardan skorlu secim
    $candidates = @()
    foreach ($adapter in $physicalAdapters) {
        $ips = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $adapter.InterfaceIndex |
            Where-Object {
                $_.IPAddress -ne '127.0.0.1' -and
                $_.IPAddress -notlike '169.254.*' -and
                $_.AddressState -eq 'Preferred' -and
                (
                    $_.IPAddress.StartsWith('192.168.') -or
                    $_.IPAddress.StartsWith('10.') -or
                    $_.IPAddress -match '^172\.(1[6-9]|2\d|3[0-1])\.'
                )
            }

        foreach ($ip in $ips) {
            $candidates += (Get-ScoredCandidate $ip.IPAddress $adapter.Name)
        }
    }

    if ($candidates.Count -gt 0) {
        $best = $candidates | Sort-Object Score -Descending | Select-Object -First 1
        return $best.IP
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
