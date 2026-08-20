[CmdletBinding()]
param(
    [string]$ServerUrl,
    [string]$CertificatePath
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
if (-not $ServerUrl) {
    $accessInfoPath = Join-Path $PSScriptRoot 'ERISIM_BILGILERI.txt'
    if (-not (Test-Path $accessInfoPath)) {
        throw 'ERISIM_BILGILERI.txt bulunamadı. ServerUrl parametresi verilmelidir.'
    }
    $urlLine = Get-Content $accessInfoPath | Where-Object { $_ -match '^HTTPS Adresi:' } | Select-Object -First 1
    $ServerUrl = ($urlLine -replace '^HTTPS Adresi:\s*', '').Trim()
}

$accessInfoPath = Join-Path $PSScriptRoot 'ERISIM_BILGILERI.txt'
$siteName = 'Güvenlik Sistemi'
if (Test-Path -LiteralPath $accessInfoPath) {
    $siteLine = Get-Content $accessInfoPath | Where-Object { $_ -match '^Tesis:' } | Select-Object -First 1
    if ($siteLine) { $siteName = ($siteLine -replace '^Tesis:\s*', '').Trim() }
}
$safeShortcutName = ($siteName -replace '[<>:"/\\|?*]', '').Trim()
if (-not $safeShortcutName) { $safeShortcutName = 'Güvenlik Sistemi' }
if ($safeShortcutName.Length -gt 80) { $safeShortcutName = $safeShortcutName.Substring(0, 80).TrimEnd() }

if (-not $CertificatePath) {
    $CertificatePath = Join-Path $PSScriptRoot 'guvenlik-sistemi-root-ca.crt'
}

if (-not (Test-Path $CertificatePath)) {
    throw "Kök sertifika bulunamadı: $CertificatePath"
}

$uri = [Uri]$ServerUrl
if ($uri.Scheme -ne 'https') {
    throw 'İstemci kurulumu yalnızca HTTPS adresini kabul eder.'
}

Import-Certificate -FilePath $CertificatePath -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null

$shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) "$safeShortcutName.url"
@(
    '[InternetShortcut]'
    "URL=$ServerUrl"
    'IconIndex=0'
) | Set-Content -Path $shortcutPath -Encoding ASCII

Write-Host "İstemci sertifikası kuruldu. $safeShortcutName kısayolu masaüstüne eklendi: $ServerUrl"
Write-Host 'Tarayıcı açıldığında Uygulamayı kur düğmesine basarak PWA kurulumunu tamamlayın.'
Start-Process $ServerUrl
