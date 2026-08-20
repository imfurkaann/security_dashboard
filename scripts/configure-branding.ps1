[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SiteName,
    [string]$LogoPath,
    [string]$OutputDirectory
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$utf8Encoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8Encoding
try {
    [Console]::InputEncoding = $utf8Encoding
    [Console]::OutputEncoding = $utf8Encoding
} catch { }

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $projectRoot 'branding'
}

$safeSiteName = ($SiteName -replace '[\x00-\x1F\x7F]', ' ' -replace '\s{2,}', ' ').Trim()
if ($safeSiteName.Length -lt 2 -or $safeSiteName.Length -gt 80) {
    throw 'Tesis/uygulama adı 2-80 karakter arasında olmalıdır.'
}
if ($safeSiteName -match '[#=$"]') {
    throw 'Tesis/uygulama adı #, =, $ veya çift tırnak karakterlerini içeremez.'
}

if (-not $LogoPath) {
    $existingLogo = Join-Path $OutputDirectory 'logo.png'
    if (Test-Path -LiteralPath $existingLogo) {
        $LogoPath = $existingLogo
    } else {
        throw 'Yeni kurulum için müşteriye ait PNG/JPG logo dosyası seçilmelidir.'
    }
}

$resolvedLogo = (Resolve-Path -LiteralPath $LogoPath).Path
$logoFile = Get-Item -LiteralPath $resolvedLogo
if ($logoFile.Length -gt 10MB) {
    throw 'Logo dosyası en fazla 10 MB olabilir.'
}
if ($logoFile.Extension.ToLowerInvariant() -notin @('.png', '.jpg', '.jpeg', '.bmp', '.gif')) {
    throw 'Logo biçimi PNG, JPG, JPEG, BMP veya GIF olmalıdır.'
}

Add-Type -AssemblyName System.Drawing
$sourceImage = $null
$stagingDirectory = Join-Path ([IO.Path]::GetTempPath()) ("security-branding-" + [guid]::NewGuid().ToString('N'))

function Save-SquareBrandImage {
    param(
        [Parameter(Mandatory = $true)][Drawing.Image]$Image,
        [Parameter(Mandatory = $true)][int]$Size,
        [Parameter(Mandatory = $true)][double]$ContentRatio,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    $bitmap = [Drawing.Bitmap]::new($Size, $Size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([Drawing.Color]::White)
        $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality

        $maximumContent = [double]$Size * $ContentRatio
        $scale = [Math]::Min($maximumContent / $Image.Width, $maximumContent / $Image.Height)
        $width = [Math]::Max(1, [int][Math]::Round($Image.Width * $scale))
        $height = [Math]::Max(1, [int][Math]::Round($Image.Height * $scale))
        $x = [int][Math]::Floor(($Size - $width) / 2)
        $y = [int][Math]::Floor(($Size - $height) / 2)

        $graphics.DrawImage($Image, [Drawing.Rectangle]::new($x, $y, $width, $height))
        $bitmap.Save($Destination, [Drawing.Imaging.ImageFormat]::Png)
    } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

try {
    $loadedImage = [Drawing.Image]::FromFile($resolvedLogo)
    try {
        $sourceImage = [Drawing.Bitmap]::new($loadedImage)
    } finally {
        $loadedImage.Dispose()
    }
    if ($sourceImage.Width -lt 128 -or $sourceImage.Height -lt 128) {
        throw 'Logo en az 128x128 piksel olmalıdır.'
    }
    if (([long]$sourceImage.Width * [long]$sourceImage.Height) -gt 25000000) {
        throw 'Logo piksel boyutu güvenli sınırı aşıyor.'
    }

    New-Item -ItemType Directory -Path $stagingDirectory -Force | Out-Null
    Save-SquareBrandImage -Image $sourceImage -Size 800 -ContentRatio 0.9 -Destination (Join-Path $stagingDirectory 'logo.png')
    Save-SquareBrandImage -Image $sourceImage -Size 192 -ContentRatio 0.84 -Destination (Join-Path $stagingDirectory 'icon-192.png')
    Save-SquareBrandImage -Image $sourceImage -Size 512 -ContentRatio 0.84 -Destination (Join-Path $stagingDirectory 'icon-512.png')
    Save-SquareBrandImage -Image $sourceImage -Size 512 -ContentRatio 0.68 -Destination (Join-Path $stagingDirectory 'icon-maskable-512.png')

    $shortName = if ($safeSiteName.Length -le 24) { $safeSiteName } else { $safeSiteName.Substring(0, 24).TrimEnd() }
    $manifest = [ordered]@{
        id = '/'
        name = "$safeSiteName - Güvenlik Yönetimi"
        short_name = $shortName
        description = "$safeSiteName güvenlik kayıt ve yönetim uygulaması"
        lang = 'tr-TR'
        dir = 'ltr'
        start_url = '/login?source=pwa'
        scope = '/'
        display = 'standalone'
        display_override = @('window-controls-overlay', 'standalone')
        orientation = 'any'
        background_color = '#f8fafc'
        theme_color = '#0f172a'
        categories = @('business', 'productivity', 'security')
        icons = @(
            [ordered]@{ src = '/branding/icon-192.png'; sizes = '192x192'; type = 'image/png'; purpose = 'any' },
            [ordered]@{ src = '/branding/icon-512.png'; sizes = '512x512'; type = 'image/png'; purpose = 'any' },
            [ordered]@{ src = '/branding/icon-maskable-512.png'; sizes = '512x512'; type = 'image/png'; purpose = 'maskable' }
        )
    }

    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $stagingDirectory 'manifest.webmanifest') -Encoding UTF8

    [ordered]@{
        siteName = $safeSiteName
        applicationName = "$safeSiteName - Güvenlik Yönetimi"
        configuredAt = (Get-Date).ToString('o')
    } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stagingDirectory 'site.json') -Encoding UTF8

    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
    Get-ChildItem -LiteralPath $stagingDirectory -File | ForEach-Object {
        Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $OutputDirectory $_.Name) -Force
    }

    Write-Host "Müşteri markalaması hazırlandı: $safeSiteName" -ForegroundColor Green
} finally {
    if ($sourceImage) { $sourceImage.Dispose() }
    if (Test-Path -LiteralPath $stagingDirectory) {
        $resolvedTempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar)
        $resolvedStaging = [IO.Path]::GetFullPath($stagingDirectory)
        $isSafeStagingPath = $resolvedStaging.StartsWith(
            $resolvedTempRoot + [IO.Path]::DirectorySeparatorChar,
            [StringComparison]::OrdinalIgnoreCase
        ) -and ([IO.Path]::GetFileName($resolvedStaging) -like 'security-branding-*')
        if (-not $isSafeStagingPath) {
            throw "Geçici markalama klasörü güvenli konumda değil: $resolvedStaging"
        }
        Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
    }
}
