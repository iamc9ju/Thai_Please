$ErrorActionPreference = 'Stop'

$mkcertCommand = Get-Command mkcert -ErrorAction SilentlyContinue
if (-not $mkcertCommand) {
  throw 'mkcert is not installed. Install it with: winget install FiloSottile.mkcert'
}

$privateAddresses = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -ne '127.0.0.1' -and
    $_.IPAddress -notlike '169.254.*' -and
    (
      $_.IPAddress -like '10.*' -or
      $_.IPAddress -like '192.168.*' -or
      $_.IPAddress -match '^172\.(1[6-9]|2[0-9]|3[01])\.'
    )
  } |
  Select-Object -ExpandProperty IPAddress -Unique

if (-not $privateAddresses) {
  throw 'No private IPv4 address was found. Connect this computer to the target Wi-Fi and try again.'
}

$certificateDirectory = Join-Path $PSScriptRoot '..\apps\web\certs'
$certificateDirectory = [System.IO.Path]::GetFullPath($certificateDirectory)
New-Item -ItemType Directory -Path $certificateDirectory -Force | Out-Null

$keyPath = Join-Path $certificateDirectory 'dev-key.pem'
$certificatePath = Join-Path $certificateDirectory 'dev-cert.pem'
$certificateHosts = @('localhost', '127.0.0.1', '::1') + $privateAddresses

& $mkcertCommand.Source -install
if ($LASTEXITCODE -ne 0) {
  throw 'mkcert could not install its local certificate authority.'
}

& $mkcertCommand.Source -key-file $keyPath -cert-file $certificatePath @certificateHosts
if ($LASTEXITCODE -ne 0) {
  throw 'mkcert could not generate the development certificate.'
}

$certificateAuthorityDirectory = & $mkcertCommand.Source -CAROOT

Write-Host ''
Write-Host 'Development HTTPS certificate created successfully.' -ForegroundColor Green
Write-Host "Certificate covers: $($certificateHosts -join ', ')"
Write-Host "Local CA directory: $certificateAuthorityDirectory"
Write-Host 'Restart the development server. Vite will enable HTTPS automatically.'
Write-Host 'For phone camera access, install rootCA.pem from the CA directory as a trusted CA on the phone.'
