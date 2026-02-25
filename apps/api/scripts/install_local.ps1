$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$cachePath = Join-Path $projectRoot ".npm-cache"

Write-Host "[install] project root: $projectRoot"
Write-Host "[install] npm cache: $cachePath"

New-Item -ItemType Directory -Path $cachePath -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $cachePath "_logs") -Force | Out-Null

$env:npm_config_cache = $cachePath

Write-Host "[install] npm install --no-audit --no-fund"
npm install --no-audit --no-fund
