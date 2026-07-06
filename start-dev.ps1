$ErrorActionPreference = "Stop"

$nodeDir = Join-Path $PSScriptRoot ".tools\node-v24.18.0-win-x64"
if (!(Test-Path $nodeDir)) {
  Write-Error "Node portable est introuvable dans $nodeDir"
}

$env:PATH = "$nodeDir;$env:PATH"
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
npm run dev
