[CmdletBinding()]
param(
    [string]$Username
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$utf8Encoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8Encoding
try {
    [Console]::InputEncoding = $utf8Encoding
    [Console]::OutputEncoding = $utf8Encoding
} catch { }

function ConvertFrom-SecureValue {
    param([Parameter(Mandatory = $true)][Security.SecureString]$Value)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try {
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

if (-not $Username) {
    $Username = (Read-Host 'Parolası değiştirilecek kullanıcı adı').Trim()
}

if ($Username -notmatch '^[A-Za-z0-9._-]{3,64}$') {
    throw 'Kullanıcı adı yalnızca harf, rakam, nokta, alt çizgi ve tire içerebilir.'
}

docker inspect security_backend --format '{{.State.Running}}' 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'security_backend çalışmıyor. Önce sistemi başlatın.'
}

$securePassword = Read-Host 'Yeni güçlü parola' -AsSecureString
$secureConfirmation = Read-Host 'Yeni güçlü parolayı tekrar girin' -AsSecureString
$plainPassword = ConvertFrom-SecureValue $securePassword
$plainConfirmation = ConvertFrom-SecureValue $secureConfirmation

try {
    if ($plainPassword -cne $plainConfirmation) {
        throw 'Parolalar eşleşmiyor.'
    }
    if ($plainPassword.Length -lt 12 -or $plainPassword.Length -gt 128) {
        throw 'Parola 12-128 karakter arasında olmalıdır.'
    }
    if ($plainPassword -match '\s') {
        throw 'Parola boşluk içeremez.'
    }

    $groups = 0
    if ($plainPassword.ToCharArray() | Where-Object { [char]::IsLower($_) } | Select-Object -First 1) { $groups++ }
    if ($plainPassword.ToCharArray() | Where-Object { [char]::IsUpper($_) } | Select-Object -First 1) { $groups++ }
    if ($plainPassword.ToCharArray() | Where-Object { [char]::IsDigit($_) } | Select-Object -First 1) { $groups++ }
    if ($plainPassword.ToCharArray() | Where-Object { -not [char]::IsLetterOrDigit($_) } | Select-Object -First 1) { $groups++ }
    if ($groups -lt 3) {
        throw 'Parola küçük harf, büyük harf, rakam ve özel karakter gruplarından en az üçünü içermelidir.'
    }
    if ($plainPassword.ToLowerInvariant().Contains($Username.ToLowerInvariant())) {
        throw 'Parola kullanıcı adını içeremez.'
    }

    $encodedPassword = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($plainPassword))
    $hashScript = @'
const bcrypt = require('bcryptjs');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', async () => {
  const password = Buffer.from(input.trim(), 'base64').toString('utf8');
  process.stdout.write(await bcrypt.hash(password, 12));
});
'@
    $passwordHash = $encodedPassword | docker exec -i security_backend node -e $hashScript
    if ($LASTEXITCODE -ne 0 -or -not $passwordHash) {
        throw 'Parola güvenli biçimde özetlenemedi.'
    }

    $sql = @'
BEGIN;
WITH target AS (
    UPDATE personnel
       SET password = :'password_hash', updated_at = CURRENT_TIMESTAMP
     WHERE username = :'username'
       AND deleted_at IS NULL
       AND is_active = TRUE
 RETURNING id
), closed_sessions AS (
    UPDATE personnel_records
       SET logout_time = CURRENT_TIMESTAMP
     WHERE personnel_id IN (SELECT id FROM target)
       AND logout_time IS NULL
)
SELECT count(*) FROM target;
COMMIT;
'@
    $result = $sql | docker exec -i security_db psql -U postgres -d security_management -At -v "username=$Username" -v "password_hash=$passwordHash"
    if ($LASTEXITCODE -ne 0 -or @($result) -notcontains '1') {
        throw 'Aktif kullanıcı bulunamadı veya parola güncellenemedi.'
    }

    Write-Host 'Parola değiştirildi ve hesabın açık oturumları kapatıldı.' -ForegroundColor Green
} finally {
    $plainPassword = $null
    $plainConfirmation = $null
    $encodedPassword = $null
}
