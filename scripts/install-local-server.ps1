[CmdletBinding()]
param(
    [string]$SiteName = 'Güvenlik Sistemi',
    [string]$LogoPath,
    [string]$NetworkInterfaceAlias,
    [string]$InitialAdminUsername,
    [string]$InitialAdminFirstName,
    [string]$InitialAdminLastName,
    [Security.SecureString]$InitialAdminPassword,
    [switch]$SkipFirewall,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$utf8Encoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8Encoding
try {
    [Console]::InputEncoding = $utf8Encoding
    [Console]::OutputEncoding = $utf8Encoding
} catch {
    # Grafik ortamdan veya yönlendirilmiş terminalden çalıştırıldığında devam et.
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

function Get-PrimaryLanConfiguration {
    $configurations = @(Get-NetIPConfiguration |
        Where-Object {
            # Bazı Windows/PowerShell sürümleri NetAdapter nesnesinde Status
            # alanını döndürmüyor. StrictMode altında doğrudan .Status okumak
            # kurulumu durdurur. Alan varsa bağdaştırıcının açık olduğunu
            # doğrula; yoksa kullanılabilir IPv4 adresi ve varsayılan ağ geçidi
            # bulunmasını aktif yerel ağ kanıtı olarak kabul et.
            $adapterProperty = $_.PSObject.Properties['NetAdapter']
            $statusProperty = $null
            if ($adapterProperty -and $adapterProperty.Value) {
                $statusProperty = $adapterProperty.Value.PSObject.Properties['Status']
            }

            $adapterIsUp = (-not $statusProperty) -or ([string]$statusProperty.Value -eq 'Up')
            $gatewayProperty = $_.PSObject.Properties['IPv4DefaultGateway']
            $addressProperty = $_.PSObject.Properties['IPv4Address']

            $adapterIsUp -and
            $gatewayProperty -and [bool]$gatewayProperty.Value -and
            $addressProperty -and [bool]$addressProperty.Value
        })

    if ($NetworkInterfaceAlias) {
        $configurations = @($configurations | Where-Object { $_.InterfaceAlias -eq $NetworkInterfaceAlias })
    }

    $configuration = $configurations | Select-Object -First 1

    if (-not $configuration) {
        throw 'Aktif IPv4 yerel ağ bağlantısı bulunamadı. Gerekirse -NetworkInterfaceAlias parametresi kullanın.'
    }

    $address = $configuration.IPv4Address | Select-Object -First 1
    [pscustomobject]@{
        InterfaceAlias = $configuration.InterfaceAlias
        IPAddress = $address.IPAddress
        PrefixLength = [int]$address.PrefixLength
    }
}

function Get-NetworkCidr {
    param(
        [Parameter(Mandatory = $true)][string]$IPAddress,
        [Parameter(Mandatory = $true)][int]$PrefixLength
    )

    $ipBytes = [System.Net.IPAddress]::Parse($IPAddress).GetAddressBytes()
    $networkBytes = New-Object byte[] 4
    $remainingBits = $PrefixLength

    for ($index = 0; $index -lt 4; $index++) {
        if ($remainingBits -ge 8) {
            $maskByte = 255
            $remainingBits -= 8
        } elseif ($remainingBits -gt 0) {
            $maskByte = 256 - [math]::Pow(2, 8 - $remainingBits)
            $remainingBits = 0
        } else {
            $maskByte = 0
        }

        $networkBytes[$index] = [byte]($ipBytes[$index] -band [int]$maskByte)
    }

    "$([System.Net.IPAddress]::new($networkBytes))/$PrefixLength"
}

function New-RandomSecret {
    param([int]$ByteCount)
    $bytes = New-Object byte[] $ByteCount
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    } finally {
        $generator.Dispose()
    }
    [Convert]::ToBase64String($bytes)
}

function Ensure-SecretFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][int]$MinimumLength,
        [Parameter(Mandatory = $true)][int]$NewSecretBytes
    )

    if (-not (Test-Path $Path)) {
        New-RandomSecret -ByteCount $NewSecretBytes |
            Set-Content -Path $Path -Encoding ASCII -NoNewline
    }

    $length = (Get-Content $Path -Raw).Trim().Length
    if ($length -lt $MinimumLength) {
        throw "$Path en az $MinimumLength karakter olmalıdır. Mevcut canlı anahtar otomatik değiştirilmedi."
    }
}

function Enable-DockerDesktopAutoStart {
    $settingsPath = Join-Path $env:APPDATA 'Docker\settings-store.json'
    if (-not (Test-Path $settingsPath)) {
        Write-Warning 'Docker Desktop ayar dosyası bulunamadı; otomatik başlangıç elle doğrulanmalıdır.'
        return
    }

    $settingsContent = Get-Content $settingsPath -Raw
    $updatedContent = $settingsContent -replace '"AutoStart"\s*:\s*false', '"AutoStart": true'
    if ($updatedContent -ne $settingsContent) {
        $updatedContent | Set-Content -Path $settingsPath -Encoding UTF8
    }
}

function ConvertFrom-SecurePassword {
    param([Parameter(Mandatory = $true)][Security.SecureString]$SecurePassword)
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)
    try {
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

try {
    docker info | Out-Null
} catch {
    throw 'Docker çalışmıyor. Docker Desktop/Engine başlatıldıktan sonra kurulumu yeniden çalıştırın.'
}

$minimumDockerEngineVersion = [version]'29.6.2'
$dockerEngineVersionText = (docker version --format '{{.Server.Version}}').Trim()
try {
    $dockerEngineVersion = [version](($dockerEngineVersionText -split '[-+]')[0])
} catch {
    throw "Docker Engine sürümü okunamadı: $dockerEngineVersionText"
}
if ($dockerEngineVersion -lt $minimumDockerEngineVersion) {
    throw "Docker Engine $dockerEngineVersionText güncel değil. Güvenlik düzeltmeleri için en az $minimumDockerEngineVersion gerekir. Docker Desktop'ı güncelleyin."
}

$dockerSecurityOptions = @(docker info --format '{{range .SecurityOptions}}{{println .}}{{end}}')
if (-not ($dockerSecurityOptions -match 'name=seccomp,profile=(builtin|default)')) {
    throw 'Docker seccomp güvenlik profili etkin değil. Docker Desktop güncellenip varsayılan güvenlik profili etkinleştirilmelidir.'
}

Enable-DockerDesktopAutoStart

$network = Get-PrimaryLanConfiguration
$siteIp = $network.IPAddress
$siteSubnet = Get-NetworkCidr -IPAddress $siteIp -PrefixLength $network.PrefixLength
$siteHostname = $env:COMPUTERNAME.ToLowerInvariant()
$frontendUrl = "https://$siteIp"
$corsOrigins = "$frontendUrl,https://$siteHostname"

$secretsDirectory = Join-Path $projectRoot 'secrets'
New-Item -ItemType Directory -Path $secretsDirectory -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $projectRoot 'backend\reports') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $projectRoot 'backend\sgk_kayitlari') -Force | Out-Null
Ensure-SecretFile -Path (Join-Path $secretsDirectory 'db_password.txt') -MinimumLength 32 -NewSecretBytes 48
Ensure-SecretFile -Path (Join-Path $secretsDirectory 'jwt_secret.txt') -MinimumLength 64 -NewSecretBytes 64

$safeSiteName = ($SiteName -replace "[`r`n]", ' ').Trim()
& (Join-Path $PSScriptRoot 'configure-branding.ps1') `
    -SiteName $safeSiteName `
    -LogoPath $LogoPath `
    -OutputDirectory (Join-Path $projectRoot 'branding')
if ($LASTEXITCODE -ne 0) {
    throw 'Müşteri adı/logo markalaması hazırlanamadı.'
}

$environmentLines = @(
    'COMPOSE_PROJECT_NAME=security'
    "SITE_NAME=$safeSiteName"
    "SITE_HOSTNAME=$siteHostname"
    "SITE_IP=$siteIp"
    "SITE_SUBNET=$siteSubnet"
    'HOST_BIND_ADDRESS=0.0.0.0'
    "PUBLIC_HOST_IP=$siteIp"
    'FRONTEND_PORT=443'
    "FRONTEND_URL=$frontendUrl"
    "CORS_ORIGINS=$corsOrigins"
    'AUTH_COOKIE_SECURE=true'
    'TRUST_PROXY_HOPS=2'
    'WHATSAPP_ENABLED=true'
    'ALLOW_LOCALHOST_ORIGIN=false'
)
$environmentLines | Set-Content -Path (Join-Path $projectRoot '.env') -Encoding UTF8

if (-not $SkipFirewall) {
    $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Güvenlik duvarını sınırlamak için yönetici yetkisi gerekir. Önce bu betiği yönetici olarak çalıştırın veya pilot için -SkipFirewall kullanın. Ağ: $siteSubnet"
    }
    & (Join-Path $PSScriptRoot 'configure-local-firewall.ps1') -AllowedSubnet $siteSubnet
}

docker compose config --quiet
if (-not $SkipBuild) {
    docker compose build
}

docker compose up -d postgres
$databaseDeadline = (Get-Date).AddMinutes(2)
do {
    $databaseHealth = docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' security_db 2>$null
    if ($databaseHealth -eq 'healthy') { break }
    Start-Sleep -Seconds 3
} while ((Get-Date) -lt $databaseDeadline)
if ($databaseHealth -ne 'healthy') {
    throw 'PostgreSQL zamanında sağlıklı duruma gelmedi.'
}

# Eski volume yeni kurulum secret'ından farklı bir uygulama parolasına sahip
# olabilir. Yönetici rolünü uygulamaya vermeden yalnızca kısıtlı runtime rolünü
# her kurulumda idempotent olarak eşleştir.
docker exec `
    -e POSTGRES_USER=postgres `
    -e POSTGRES_DB=security_management `
    -e DB_APP_USER=security_app `
    security_db /bin/sh /docker-entrypoint-initdb.d/02-create-application-role.sh | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'Kısıtlı uygulama veritabanı rolü hazırlanamadı.'
}

docker compose up -d

$requiredContainers = @('security_db', 'security_backend', 'security_frontend', 'security_gateway')
$deadline = (Get-Date).AddMinutes(4)
$pendingContainers = $requiredContainers
$nextProgressMessage = Get-Date
Write-Host 'Uygulama servislerinin sağlık kontrolleri bekleniyor...'
do {
    $pendingContainers = @()
    foreach ($containerName in $requiredContainers) {
        $containerStatus = docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' $containerName 2>$null
        if (-not $containerStatus) {
            $pendingContainers += $containerName
            continue
        }

        $parts = $containerStatus -split '\|', 2
        if ($parts[0] -ne 'running' -or ($parts[1] -ne 'healthy' -and $parts[1] -ne 'none')) {
            $pendingContainers += $containerName
        }
    }
    if ($pendingContainers.Count -eq 0) { break }
    if ((Get-Date) -ge $nextProgressMessage) {
        Write-Host "Beklenen servisler: $($pendingContainers -join ', ')"
        $nextProgressMessage = (Get-Date).AddSeconds(15)
    }
    Start-Sleep -Seconds 4
} while ((Get-Date) -lt $deadline)

if ($pendingContainers.Count -gt 0) {
    throw "Servisler zamanında hazır olmadı: $($pendingContainers -join ', ')"
}

$activeAdminCount = docker exec security_db psql -U postgres -d security_management -Atc `
    "SELECT count(*) FROM personnel WHERE role='admin' AND is_active=TRUE AND deleted_at IS NULL;"
if ($LASTEXITCODE -ne 0) {
    throw 'İlk yönetici kontrolü yapılamadı.'
}

if ([int]$activeAdminCount -eq 0) {
    if (-not $InitialAdminUsername) { $InitialAdminUsername = Read-Host 'İlk yönetici kullanıcı adı' }
    if (-not $InitialAdminFirstName) { $InitialAdminFirstName = Read-Host 'İlk yönetici adı' }
    if (-not $InitialAdminLastName) { $InitialAdminLastName = Read-Host 'İlk yönetici soyadı' }
    if (-not $InitialAdminPassword) { $InitialAdminPassword = Read-Host 'İlk yönetici güçlü parolası' -AsSecureString }

    $plainAdminPassword = ConvertFrom-SecurePassword -SecurePassword $InitialAdminPassword
    try {
        $bootstrapPayload = @{
            username = $InitialAdminUsername
            password = $plainAdminPassword
            firstName = $InitialAdminFirstName
            lastName = $InitialAdminLastName
        } | ConvertTo-Json -Compress

        # Windows PowerShell 5.1 yerel uygulama borularında varsayılan olarak
        # ASCII kullanabilir ve Ç/Ş/Ğ/İ/Ö/Ü/ı karakterlerini '?' yapabilir.
        # UTF-8 JSON'u Base64 ile ASCII güvenli stdin üzerinden taşı.
        $bootstrapTransport = 'base64:' + [Convert]::ToBase64String(
            [Text.Encoding]::UTF8.GetBytes($bootstrapPayload)
        )

        $bootstrapResult = $bootstrapTransport |
            docker exec -i security_backend node dist/scripts/bootstrapAdmin.js
        if ($LASTEXITCODE -ne 0) {
            throw 'İlk yönetici oluşturulamadı.'
        }
        $bootstrapJsonLine = $bootstrapResult |
            Where-Object { $_.TrimStart().StartsWith('{') } |
            Select-Object -Last 1
        if (-not $bootstrapJsonLine) {
            throw 'İlk yönetici oluşturma çıktısı doğrulanamadı.'
        }
        $bootstrapResponse = $bootstrapJsonLine | ConvertFrom-Json
        if (-not $bootstrapResponse.success) {
            throw 'İlk yönetici oluşturma doğrulanamadı.'
        }
    } finally {
        $plainAdminPassword = $null
        $bootstrapPayload = $null
        $bootstrapTransport = $null
    }
}

$clientSetupDirectory = Join-Path $projectRoot 'client-setup'
New-Item -ItemType Directory -Path $clientSetupDirectory -Force | Out-Null
$rootCertificatePath = Join-Path $clientSetupDirectory 'guvenlik-sistemi-root-ca.crt'
docker cp 'security_gateway:/data/caddy/pki/authorities/local/root.crt' $rootCertificatePath
Import-Certificate -FilePath $rootCertificatePath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null

$accessInfoLines = @(
    "Tesis: $safeSiteName"
    "Uygulama Adı: $safeSiteName - Güvenlik Yönetimi"
    "HTTPS Adresi: $frontendUrl"
    "Bilgisayar Adresi: https://$siteHostname"
    "Yerel Ağ: $siteSubnet"
    'API ve veritabanı portları dış ağa kapalıdır.'
    'İstemci kurulumu: client-setup klasöründeki install-client.ps1'
    'PWA kurulumu: İstemci kısayolunu açıp Uygulamayı kur düğmesine basın.'
)
$accessInfoLines | Set-Content -Path (Join-Path $clientSetupDirectory 'ERISIM_BILGILERI.txt') -Encoding UTF8

Copy-Item -Path (Join-Path $PSScriptRoot 'install-client.ps1') -Destination $clientSetupDirectory -Force

Write-Host ''
Write-Host 'Yerel sunucu kurulumu tamamlandı.'
Write-Host "HTTPS adresi: $frontendUrl"
Write-Host "Bilgisayar adıyla: https://$siteHostname"
Write-Host "İzin verilen yerel ağ: $siteSubnet"
Write-Host 'WhatsApp dış bağlantısı etkin; API ve veritabanı dışarı açılmadı.'
