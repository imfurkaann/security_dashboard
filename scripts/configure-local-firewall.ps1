#requires -RunAsAdministrator
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^\d{1,3}(\.\d{1,3}){3}/([0-9]|[12][0-9]|3[0-2])$')]
    [string]$AllowedSubnet
)

$ErrorActionPreference = 'Stop'
$utf8Encoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8Encoding
try {
    [Console]::InputEncoding = $utf8Encoding
    [Console]::OutputEncoding = $utf8Encoding
} catch { }

$legacyRule = Get-NetFirewallRule -DisplayName 'GuvenlikSistemi-FE' -ErrorAction SilentlyContinue
if ($legacyRule) {
    $legacyRule | Disable-NetFirewallRule | Out-Null
}

$managedRules = @(
    'GuvenlikSistemi-HTTPS',
    'GuvenlikSistemi-HTTP-Redirect',
    'GuvenlikSistemi-Internal-Ports-Block'
)
foreach ($ruleName in $managedRules) {
    Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue |
        Remove-NetFirewallRule
}

New-NetFirewallRule `
    -DisplayName 'GuvenlikSistemi-HTTPS' `
    -Description 'Güvenlik sistemi HTTPS erişimi; yalnızca kurulumun yerel ağından.' `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 443 `
    -RemoteAddress $AllowedSubnet `
    -Profile Any `
    -EdgeTraversalPolicy Block | Out-Null

New-NetFirewallRule `
    -DisplayName 'GuvenlikSistemi-Internal-Ports-Block' `
    -Description 'Backend ve PostgreSQL portlarının ağdan doğrudan erişimini engeller.' `
    -Direction Inbound `
    -Action Block `
    -Protocol TCP `
    -LocalPort 5000,5432 `
    -RemoteAddress Any `
    -Profile Any `
    -EdgeTraversalPolicy Block | Out-Null

New-NetFirewallRule `
    -DisplayName 'GuvenlikSistemi-HTTP-Redirect' `
    -Description 'Yerel ağdaki eski HTTP adreslerini güvenli HTTPS adresine yönlendirir.' `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 80 `
    -RemoteAddress $AllowedSubnet `
    -Profile Any `
    -EdgeTraversalPolicy Block | Out-Null

Write-Host "Güvenlik duvarı yalnızca $AllowedSubnet ağı için 80/443 portlarına izin verecek şekilde ayarlandı."
