[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$utf8Encoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8Encoding
try {
    [Console]::InputEncoding = $utf8Encoding
    [Console]::OutputEncoding = $utf8Encoding
} catch { }
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$failures = [System.Collections.Generic.List[string]]::new()
function Assert-Check {
    param([bool]$Condition, [string]$Message)
    if ($Condition) {
        Write-Host "[OK] $Message"
    } else {
        Write-Host "[HATA] $Message" -ForegroundColor Red
        $failures.Add($Message)
    }
}

$environment = @{}
Get-Content (Join-Path $projectRoot '.env') | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') { $environment[$matches[1].Trim()] = $matches[2].Trim() }
}

$siteIp = $environment['SITE_IP']
$siteSubnet = $environment['SITE_SUBNET']
Assert-Check ([bool]$siteIp) 'Tesise özel IP yapılandırması mevcut'
Assert-Check ($environment['AUTH_COOKIE_SECURE'] -eq 'true') 'Güvenli oturum çerezi zorunlu'
Assert-Check ($environment['WHATSAPP_ENABLED'] -eq 'true') 'WhatsApp entegrasyonu etkin'

$brandingDirectory = Join-Path $projectRoot 'branding'
$requiredBrandingFiles = @('logo.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'manifest.webmanifest', 'site.json')
$missingBrandingFiles = @($requiredBrandingFiles | Where-Object { -not (Test-Path -LiteralPath (Join-Path $brandingDirectory $_)) })
Assert-Check ($missingBrandingFiles.Count -eq 0) 'Müşteriye özel PWA adı, logo ve ikonları hazır'
if ($missingBrandingFiles.Count -eq 0) {
    try {
        $brandingManifest = Get-Content -LiteralPath (Join-Path $brandingDirectory 'manifest.webmanifest') -Raw | ConvertFrom-Json
        Assert-Check ($brandingManifest.display -eq 'standalone') 'PWA bağımsız masaüstü penceresi olarak yapılandırıldı'
        Assert-Check (@($brandingManifest.icons).Count -ge 3) 'PWA normal ve maskelenebilir ikonları mevcut'
        Assert-Check ($brandingManifest.name -like "*$($environment['SITE_NAME'])*") 'PWA adı tesis adıyla eşleşiyor'
    } catch {
        Assert-Check $false "PWA manifesti okunamadı: $($_.Exception.Message)"
    }
}

$dockerEngineVersionText = (docker version --format '{{.Server.Version}}').Trim()
try {
    $dockerEngineIsCurrent = [version](($dockerEngineVersionText -split '[-+]')[0]) -ge [version]'29.6.2'
} catch {
    $dockerEngineIsCurrent = $false
}
Assert-Check $dockerEngineIsCurrent "Docker Engine güvenli alt sürümü karşılıyor ($dockerEngineVersionText)"

$dockerSecurityOptions = @(docker info --format '{{range .SecurityOptions}}{{println .}}{{end}}')
Assert-Check (@($dockerSecurityOptions | Where-Object { $_ -match 'name=seccomp,profile=(builtin|default)' }).Count -gt 0) 'Docker seccomp güvenlik profili etkin'

$requiredContainers = @('security_db', 'security_backend', 'security_frontend', 'security_gateway')
foreach ($containerName in $requiredContainers) {
    $status = docker inspect --format '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' $containerName 2>$null
    Assert-Check ($status -match '^running\|(healthy|none)$') "$containerName çalışıyor ve sağlıklı"
    $containerSecurity = @(docker inspect --format '{{range .HostConfig.SecurityOpt}}{{println .}}{{end}}' $containerName 2>$null)
    Assert-Check (@($containerSecurity | Where-Object { $_ -eq 'no-new-privileges:true' }).Count -gt 0) "$containerName yeni yetki kazanımına kapalı"
}

$publishedPorts = docker compose config --format json | ConvertFrom-Json
$backendPublished = if ($publishedPorts.services.backend.PSObject.Properties.Name -contains 'ports') {
    @($publishedPorts.services.backend.ports).Count
} else { 0 }
$databasePublished = if ($publishedPorts.services.postgres.PSObject.Properties.Name -contains 'ports') {
    @($publishedPorts.services.postgres.ports).Count
} else { 0 }
Assert-Check ($backendPublished -eq 0) 'Backend host ağına yayınlanmıyor'
Assert-Check ($databasePublished -eq 0) 'PostgreSQL host ağına yayınlanmıyor'

$roleState = docker exec security_db psql -U postgres -d security_management -Atc `
    "SELECT rolsuper::text || ',' || rolcreatedb::text || ',' || rolcreaterole::text FROM pg_roles WHERE rolname='security_app';"
Assert-Check ($roleState -eq 'false,false,false') 'Uygulama veritabanı rolü yönetici yetkisine sahip değil'

$rootCertificate = Join-Path $projectRoot 'client-setup\guvenlik-sistemi-root-ca.crt'
Assert-Check (Test-Path $rootCertificate) 'Tesise özel istemci kök sertifikası üretildi'

if ($siteIp) {
    Add-Type -AssemblyName System.Net.Http
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.CheckCertificateRevocationList = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    try {
        $response = $client.GetAsync("https://$siteIp/api/health").GetAwaiter().GetResult()
        Assert-Check ($response.IsSuccessStatusCode) 'HTTPS API sağlık kontrolü başarılı'
        $response.Dispose()

        $manifestResponse = $client.GetAsync("https://$siteIp/branding/manifest.webmanifest").GetAwaiter().GetResult()
        $manifestMediaType = $manifestResponse.Content.Headers.ContentType.MediaType
        Assert-Check ($manifestResponse.IsSuccessStatusCode -and $manifestMediaType -eq 'application/manifest+json') 'PWA manifesti HTTPS üzerinden doğru içerik tipiyle sunuluyor'
        $manifestResponse.Dispose()

        $serviceWorkerResponse = $client.GetAsync("https://$siteIp/sw.js").GetAwaiter().GetResult()
        $serviceWorkerContent = $serviceWorkerResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        $workerNoStore = [bool]$serviceWorkerResponse.Headers.CacheControl.NoStore
        $workerScope = @($serviceWorkerResponse.Headers.GetValues('Service-Worker-Allowed')) -contains '/'
        Assert-Check ($serviceWorkerResponse.IsSuccessStatusCode -and $workerNoStore -and $workerScope) 'Service worker güncel, cache dışı ve kök kapsamda sunuluyor'
        Assert-Check ([bool]$serviceWorkerContent) 'PWA service worker dosyası HTTPS üzerinden sunuluyor'
        Assert-Check ($serviceWorkerContent -notmatch 'caches\.open|cache\.put') 'Service worker kritik verileri çevrimdışı önbelleğe almıyor'
        $serviceWorkerResponse.Dispose()
    } catch {
        Assert-Check $false "HTTPS API sağlık kontrolü başarısız: $($_.Exception.Message)"
    } finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

$httpsRule = Get-NetFirewallRule -DisplayName 'GuvenlikSistemi-HTTPS' -ErrorAction SilentlyContinue
$httpsRemote = if ($httpsRule) { ($httpsRule | Get-NetFirewallAddressFilter).RemoteAddress } else { @() }
Assert-Check ([bool]$httpsRule.Enabled) 'HTTPS güvenlik duvarı kuralı etkin'
Assert-Check (($httpsRemote -notcontains 'Any') -and $httpsRemote.Count -gt 0) 'HTTPS yalnızca yerel ağ aralığına açık'

$internalBlock = Get-NetFirewallRule -DisplayName 'GuvenlikSistemi-Internal-Ports-Block' -ErrorAction SilentlyContinue
Assert-Check ([bool]$internalBlock.Enabled -and $internalBlock.Action -eq 'Block') 'Backend ve DB portları için açık engelleme kuralı etkin'

if ($failures.Count -gt 0) {
    Write-Host "Kurulum doğrulamasında $($failures.Count) hata bulundu." -ForegroundColor Red
    exit 1
}

Write-Host 'Tüm yerel kurulum kontrolleri başarılı.' -ForegroundColor Green
