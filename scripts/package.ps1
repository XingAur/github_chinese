param(
    # When omitted, the version is read from manifest.json
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $root "manifest.json") -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $Version) {
    $Version = $manifest.version
}

$dist = Join-Path $root "dist"
$packageName = "github-cn-enhancer-$Version"
$tempDir = Join-Path $dist $packageName
$zipPath = Join-Path $dist "$packageName.zip"

if (Test-Path $tempDir) {
  Remove-Item -Recurse -Force $tempDir
}

if (Test-Path $zipPath) {
  Remove-Item -Force $zipPath
}

New-Item -ItemType Directory -Force $dist | Out-Null
New-Item -ItemType Directory -Force $tempDir | Out-Null

$include = @(
  "manifest.json",
  "README.md",
  "CHANGELOG.md",
  "src",
  "popup",
  "assets"
)

foreach ($item in $include) {
  Copy-Item -Recurse -Force (Join-Path $root $item) $tempDir
}

Compress-Archive -Path (Join-Path $tempDir "*") -DestinationPath $zipPath -Force

Write-Output "Package created: $zipPath"
