[CmdletBinding()]
param(
    [string]$Version = '1.0.0'
)

$ErrorActionPreference = 'Stop'
$utf8Encoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8Encoding
try {
    [Console]::InputEncoding = $utf8Encoding
    [Console]::OutputEncoding = $utf8Encoding
} catch { }
$projectRoot = Split-Path -Parent $PSScriptRoot
$distributionRoot = Join-Path $projectRoot 'distribution'
$packageName = "Guvenlik-Sistemi-$Version-Windows"
$packageRoot = Join-Path $distributionRoot $packageName

$resolvedDistribution = [IO.Path]::GetFullPath($distributionRoot)
$resolvedPackage = [IO.Path]::GetFullPath($packageRoot)
if (-not $resolvedPackage.StartsWith($resolvedDistribution + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Paket hedefi distribution klasörü dışında olamaz.'
}

docker info | Out-Null
$dockerEngineVersionText = (docker version --format '{{.Server.Version}}').Trim()
if ([version](($dockerEngineVersionText -split '[-+]')[0]) -lt [version]'29.6.2') {
    throw "Paket güvenli olmayan Docker Engine ile oluşturulamaz: $dockerEngineVersionText"
}
docker compose build backend frontend
if ($LASTEXITCODE -ne 0) { throw 'Uygulama Docker imajlari olusturulamadi.' }

if (Test-Path $resolvedPackage) {
    Remove-Item -LiteralPath $resolvedPackage -Recurse -Force
}
New-Item -ItemType Directory -Path $resolvedPackage -Force | Out-Null

$requiredFiles = @(
    'docker-compose.yml',
    'Caddyfile',
    'KURULUM.ps1',
    'KURULUM.bat',
    'database\bootstrap_schema.sql',
    'database\init\02-create-application-role.sh',
    'database\init\03-baseline-migrations.sql',
    'scripts\backup-db.ps1',
    'scripts\configure-branding.ps1',
    'scripts\configure-local-firewall.ps1',
    'scripts\install-client.ps1',
    'scripts\install-local-server.ps1',
    'scripts\rotate-account-password.ps1',
    'scripts\setup-auto-backup.ps1',
    'scripts\verify-local-installation.ps1'
)

foreach ($relativePath in $requiredFiles) {
    $sourcePath = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Zorunlu kurulum dosyası bulunamadı: $relativePath"
    }

    $destinationPath = Join-Path $resolvedPackage $relativePath
    $destinationDirectory = Split-Path -Parent $destinationPath
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

$migrationSource = Join-Path $projectRoot 'database\migrations'
$migrationDestination = Join-Path $resolvedPackage 'database\migrations'
$migrationFiles = @(Get-ChildItem -LiteralPath $migrationSource -File -Filter '*.sql' | Sort-Object Name)
if ($migrationFiles.Count -eq 0) {
    throw 'Veritabanı migration dosyaları bulunamadı.'
}
New-Item -ItemType Directory -Path $migrationDestination -Force | Out-Null
foreach ($migrationFile in $migrationFiles) {
    Copy-Item -LiteralPath $migrationFile.FullName -Destination (Join-Path $migrationDestination $migrationFile.Name) -Force
}

$imageArchive = Join-Path $resolvedPackage 'docker-images.tar'
$images = @(
    'security-backend:1.0.0',
    'security-frontend:1.0.0',
    'postgres:17-alpine',
    'caddy:2.11.4-alpine',
    'alpine:3.23.5'
)
docker image save --output $imageArchive $images
if ($LASTEXITCODE -ne 0) { throw 'Çevrimdışı Docker image arşivi oluşturulamadı.' }

$forbiddenPaths = @(
    '.env', '.git', 'backend', 'frontend', 'secrets', 'backups', 'client-setup',
    'branding', 'node_modules', 'coverage', 'docker-compose.override.yml',
    'ERISIM_BILGILERI.txt', 'Guvenlik Sistemi.lnk', 'deploy.sh', 'README.md',
    'PAKET_BILGISI.txt', 'package.json', 'logo.ico'
)
foreach ($relativePath in $forbiddenPaths) {
    if (Test-Path (Join-Path $resolvedPackage $relativePath)) {
        throw "Hassas/tesise özel içerik pakete girdi: $relativePath"
    }
}

$forbiddenFileNames = @(
    'logo.jpg', 'logo.ico', 'create_test_user.js', 'get_users.js', '*.md',
    'cleanup_all_data.sql', 'seed_test_data.sql', 'test_data_manager_records.sql',
    'test_data_vehicle_records.sql', 'test_data_visitor_records.sql'
)
$forbiddenFiles = @(Get-ChildItem -LiteralPath $resolvedPackage -Recurse -File | Where-Object {
    ($forbiddenFileNames -contains $_.Name) -or $_.Extension -eq '.md'
})
if ($forbiddenFiles.Count -gt 0) {
    throw "Satış paketine test, temizleme veya sabit marka dosyası girdi: $($forbiddenFiles.FullName -join ', ')"
}

$forbiddenDirectories = @(Get-ChildItem -LiteralPath $resolvedPackage -Recurse -Directory | Where-Object {
    $_.Name -eq 'coverage'
})
if ($forbiddenDirectories.Count -gt 0) {
    throw "Satış paketine test raporu klasörü girdi: $($forbiddenDirectories.FullName -join ', ')"
}

$checksumTargets = @(Get-ChildItem -LiteralPath $resolvedPackage -Recurse -File | Sort-Object FullName)
$checksumLines = foreach ($targetPath in $checksumTargets) {
    $relativePath = $targetPath.FullName.Substring($resolvedPackage.Length + 1)
    $hash = Get-FileHash -LiteralPath $targetPath.FullName -Algorithm SHA256
    "$($hash.Hash.ToLowerInvariant())  $relativePath"
}
$checksumLines | Set-Content -Path (Join-Path $resolvedPackage 'SHA256SUMS.txt') -Encoding ASCII

Write-Host "Çevrimdışı paket hazır: $resolvedPackage"
Write-Host "Boyut: $([math]::Round((Get-ChildItem $resolvedPackage -Recurse -File | Measure-Object Length -Sum).Sum / 1GB, 2)) GB"
