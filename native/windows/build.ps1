param(
    [string]$Dotnet = 'dotnet',
    [string]$CacheRoot = (Join-Path $env:LOCALAPPDATA 'WorkspaceObservatoryBuild\cache')
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'runtime-assets.ps1')
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not [IO.Path]::IsPathRooted($CacheRoot)) { throw 'CacheRoot must be absolute.' }
New-Item -ItemType Directory -Path $CacheRoot -Force | Out-Null

# Keep build tools and package caches on the Windows build machine.
$nodeVersion = (Get-Content (Join-Path $PSScriptRoot 'runtime-assets.json') -Raw | ConvertFrom-Json).node.version
$archive = Get-ObservatoryArchive -Name node -CacheRoot $CacheRoot
$nodeRoot = Join-Path $CacheRoot "node-v$nodeVersion-win-x64"
if (-not (Test-Path (Join-Path $nodeRoot 'node.exe'))) { Expand-Archive $archive -DestinationPath $CacheRoot }
$node = Join-Path $nodeRoot 'node.exe'
$npm = Join-Path $nodeRoot 'node_modules\npm\bin\npm-cli.js'
$previousPath = $env:PATH
$previousTelemetry = $env:DOTNET_CLI_TELEMETRY_OPTOUT
$previousCertificateOption = $env:DOTNET_GENERATE_ASPNET_CERTIFICATE
Push-Location $sourceRoot
try {
    $env:PATH = "$nodeRoot;$previousPath"
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
    $env:DOTNET_GENERATE_ASPNET_CERTIFICATE = 'false'
    & $node $npm ci --cache (Join-Path $CacheRoot 'npm') --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
    & $node scripts/build-brand.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Brand generation failed.' }
    & $node node_modules/vite/bin/vite.js build --config native/vite.config.mts
    if ($LASTEXITCODE -ne 0) { throw 'Dashboard build failed.' }
    if (Test-Path '.native-build/web/local') { throw 'Private snapshots must not enter the build.' }
    & $Dotnet restore native/windows/WorkspaceObservatory.csproj --locked-mode
    if ($LASTEXITCODE -ne 0) { throw 'Locked Windows dependency restore failed.' }
    & $Dotnet build native/windows/WorkspaceObservatory.csproj -c Release --no-restore
    if ($LASTEXITCODE -ne 0) { throw 'Windows build failed.' }
    & $Dotnet native/windows/bin/Release/net10.0-windows/WorkspaceObservatory.dll --self-test
    if ($LASTEXITCODE -ne 0) { throw 'Windows self-tests failed.' }
    & $node --test scripts/windows-snapshot.test.mjs scripts/read-settings.test.mjs scripts/web-licenses.test.mjs scripts/package-content.test.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Windows collector contract tests failed.' }
    Write-Output 'Windows development build passed. This is not a self-contained release or installer.'
} finally {
    Pop-Location
    $env:PATH = $previousPath
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = $previousTelemetry
    $env:DOTNET_GENERATE_ASPNET_CERTIFICATE = $previousCertificateOption
}
