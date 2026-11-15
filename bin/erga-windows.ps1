# erga-windows.ps1: kept so that the line documented before keeps working (irm .../bin/erga-windows.ps1 | iex); erga-bootstrap.ps1 does it now.
$Base = if ($env:BOOTSTRAP_URL) { $env:BOOTSTRAP_URL } else { 'https://raw.githubusercontent.com/intellectual-frontiers/.github/main' }
$Here = if ($PSScriptRoot) { Join-Path $PSScriptRoot 'erga-bootstrap.ps1' } else { '' }
if ($Here -and (Test-Path $Here)) { & $Here @args } else { & ([scriptblock]::Create((Invoke-RestMethod "$Base/bin/erga-bootstrap.ps1"))) @args }
