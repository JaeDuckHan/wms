$ErrorActionPreference = "Continue"

Write-Host "[check] Node/NPM versions"
node -v
npm -v

Write-Host ""
Write-Host "[check] Working directory"
Write-Host (Get-Location).Path

Write-Host ""
Write-Host "[check] npm cache location"
$cachePath = npm config get cache
Write-Host $cachePath

Write-Host ""
Write-Host "[check] write test to npm cache"
$globalWriteOk = $false
try {
  if (-not (Test-Path $cachePath)) {
    New-Item -ItemType Directory -Path $cachePath -Force -ErrorAction Stop | Out-Null
  }
  $probeDir = Join-Path $cachePath "_codex_probe"
  New-Item -ItemType Directory -Path $probeDir -Force -ErrorAction Stop | Out-Null
  $probeFile = Join-Path $probeDir "write-test.txt"
  "ok $(Get-Date -Format o)" | Out-File -FilePath $probeFile -Encoding utf8 -Force -ErrorAction Stop
  Get-Item $probeFile | Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize
  $globalWriteOk = $true
} catch {
  Write-Host "global cache write failed: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "[check] local cache fallback"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$localCache = Join-Path $projectRoot ".npm-cache"
try {
  New-Item -ItemType Directory -Path $localCache -Force | Out-Null
  $localProbe = Join-Path $localCache "write-test.txt"
  "ok $(Get-Date -Format o)" | Out-File -FilePath $localProbe -Encoding utf8 -Force
  Get-Item $localProbe | Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize
  Write-Host "local cache write: ok"
} catch {
  Write-Host "local cache write failed: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "[check] npm registry ping (best effort)"
try {
  npm ping 2>$null | Out-Null
  Write-Host "npm registry ping: ok"
} catch {
  Write-Host "npm ping failed: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "[check] install recommendation"
if ($globalWriteOk) {
  Write-Host "Global npm cache is writable. You can run: npm install"
} else {
  Write-Host "Global npm cache is not writable. Run: npm run install:local"
}
