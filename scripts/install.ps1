param(
    [string]$DataDirectory = '',
    [switch]$Replace
)
$ErrorActionPreference = 'Stop'
$workspacePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $workspacePath 'package.json') | ConvertFrom-Json
if ($manifest.name -ne 'dsh-tavern-game') { throw 'Unexpected package identity.' }
if ([string]::IsNullOrWhiteSpace($DataDirectory)) {
    $runtimePath = if ($env:DSH_HOME) { $env:DSH_HOME } else { Join-Path $env:USERPROFILE '.dsh' }
    $DataDirectory = Join-Path $runtimePath 'profile-data\tavern\data'
}
$pluginsPath = [IO.Path]::GetFullPath((Join-Path $DataDirectory 'plugins'))
$targetPath = [IO.Path]::GetFullPath((Join-Path $pluginsPath 'dsh-tavern-game'))
if ($targetPath -ne (Join-Path $pluginsPath 'dsh-tavern-game')) { throw 'Unsafe installation target.' }
& (Join-Path $PSScriptRoot 'package.ps1') | Out-Null
$archivePath = Join-Path $workspacePath ('dist\dsh-tavern-game-' + $manifest.version + '.zip')
$stagePath = Join-Path $workspacePath ('dist\.install-' + [Guid]::NewGuid().ToString('N'))
try {
    Expand-Archive -LiteralPath $archivePath -DestinationPath $stagePath
    $sourcePath = Join-Path $stagePath 'dsh-tavern-game'
    $mode = if ($Replace) { 'replace' } else { 'new' }
    # Share the updater's manifest checks, cross-process lock, complete local-data
    # preservation, staged publication and fault-safe recovery implementation.
    & node (Join-Path $PSScriptRoot 'install-package.mjs') $sourcePath $targetPath $manifest.version $mode
    if ($LASTEXITCODE -ne 0) { throw 'Installation failed; see the recovery details above.' }
    Write-Output ('Installed: ' + $targetPath)
    Write-Output 'Refresh the Tavern page. For an update to an existing host plugin, restart DSH.'
} finally {
    $resolvedStage = [IO.Path]::GetFullPath($stagePath)
    $safePrefix = [IO.Path]::GetFullPath((Join-Path $workspacePath 'dist')).TrimEnd('\') + '\.install-'
    if (-not $resolvedStage.StartsWith($safePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing to clean an unsafe installation stage.' }
    if (Test-Path -LiteralPath $resolvedStage) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force }
}
