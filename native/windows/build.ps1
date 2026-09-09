param(
    [string]$Dotnet = 'dotnet',
    [string]$CacheRoot = (Join-Path $env:LOCALAPPDATA 'WorkspaceObservatoryBuild\cache')
)
$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not [IO.Path]::IsPathRooted($CacheRoot)) { throw 'CacheRoot must be absolute.' }
New-Item -ItemType Directory -Path $CacheRoot -Force | Out-Null

# Keep build tools and package caches on the Windows build machine.
$nodeVersion = '22.23.2'
$archiveName = "node-v$nodeVersion-win-x64.zip"
$archive = Join-Path $CacheRoot $archiveName
$expectedHash = '1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97'
if (-not (Test-Path $archive)) {
    Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/v$nodeVersion/$archiveName" -OutFile $archive
}
if ((Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
    throw 'Node archive checksum mismatch. No archive contents were executed.'
}
$nodeRoot = Join-Path $CacheRoot "node-v$nodeVersion-win-x64"
if (-not (Test-Path (Join-Path $nodeRoot 'node.exe'))) { Expand-Archive $archive -DestinationPath $CacheRoot }
$node = Join-Path $nodeRoot 'node.exe'
$npm = Join-Path $nodeRoot 'node_modules\npm\bin\npm-cli.js'
$previousPath = $env:PATH
$previousTelemetry = $env:DOTNET_CLI_TELEMETRY_OPTOUT
Push-Location $sourceRoot
try {
    $env:PATH = "$nodeRoot;$previousPath"
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
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
    & $node --test scripts/windows-snapshot.test.mjs scripts/read-settings.test.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Windows collector contract tests failed.' }
    Write-Output 'Windows development build passed. This is not a self-contained release or installer.'
} finally {
    Pop-Location
    $env:PATH = $previousPath
    $env:DOTNET_CLI_TELEMETRY_OPTOUT = $previousTelemetry
}
