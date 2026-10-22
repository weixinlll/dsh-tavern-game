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
if (Test-Path -LiteralPath $targetPath) {
    if (-not $Replace) { throw 'Plugin already exists. Review the target and use -Replace to update it.' }
    $oldManifestPath = Join-Path $targetPath 'package.json'
    if (-not (Test-Path -LiteralPath $oldManifestPath)) { throw 'Existing target is not an identified plugin.' }
    try { $oldManifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $oldManifestPath | ConvertFrom-Json }
    catch { throw 'Existing package.json is invalid; refusing to replace the existing target.' }
    if ($oldManifest.name -ne 'dsh-tavern-game') { throw 'Existing target belongs to another package.' }
}
& (Join-Path $PSScriptRoot 'package.ps1') | Out-Null
$archivePath = Join-Path $workspacePath ('dist\dsh-tavern-game-' + $manifest.version + '.zip')
$stagePath = Join-Path $workspacePath ('dist\.install-' + [Guid]::NewGuid().ToString('N'))
$publishId = [Guid]::NewGuid().ToString('N')
$publishPath = Join-Path $pluginsPath ('.dsh-tavern-game-install-' + $publishId)
$previousPath = Join-Path $pluginsPath ('.dsh-tavern-game-previous-' + $publishId)
$installed = $false
try {
    Expand-Archive -LiteralPath $archivePath -DestinationPath $stagePath
    $sourcePath = Join-Path $stagePath 'dsh-tavern-game'
    $packedManifestPath = Join-Path $sourcePath 'package.json'
    if (-not (Test-Path -LiteralPath (Join-Path $sourcePath 'client.js')) -or
        -not (Test-Path -LiteralPath (Join-Path $sourcePath 'index.mjs')) -or
        -not (Test-Path -LiteralPath $packedManifestPath)) { throw 'Package is incomplete.' }
    try { $packedManifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $packedManifestPath | ConvertFrom-Json }
    catch { throw 'Package manifest is invalid.' }
    if ($packedManifest.name -ne 'dsh-tavern-game' -or $packedManifest.version -ne $manifest.version) {
        throw 'Package identity or version does not match the workspace.'
    }
    New-Item -ItemType Directory -Path $pluginsPath -Force | Out-Null
    # Tavern ignores dot directories: its watcher sees only the complete package.
    Copy-Item -LiteralPath $sourcePath -Destination $publishPath -Recurse
    if (Test-Path -LiteralPath $targetPath) {
        # The profile patch may already reference Tavern's generated guard.
        # Preserve it before publishing an update; startup can precede the watcher.
        $oldGuardPath = Join-Path $targetPath '.tavern-entry.mjs'
        if (Test-Path -LiteralPath $oldGuardPath) {
            Copy-Item -LiteralPath $oldGuardPath -Destination (Join-Path $publishPath '.tavern-entry.mjs')
        }
        $backupPath = Join-Path $workspacePath ('dist\installed-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N') + '.zip')
        Compress-Archive -LiteralPath $targetPath -DestinationPath $backupPath
        Write-Output ('Previous plugin backed up: ' + $backupPath)
        Move-Item -LiteralPath $targetPath -Destination $previousPath
    }
    try {
        # Directory.Move refuses an existing destination. Move-Item would put
        # the stage inside it if another installer published there meanwhile.
        [IO.Directory]::Move($publishPath, $targetPath)
        $installed = $true
    } catch {
        if ((Test-Path -LiteralPath $previousPath) -and -not (Test-Path -LiteralPath $targetPath)) {
            Move-Item -LiteralPath $previousPath -Destination $targetPath
        }
        throw
    }
    Write-Output ('Installed: ' + $targetPath)
    Write-Output 'Refresh the Tavern page. For an update to an existing host plugin, restart DSH.'
} finally {
    foreach ($cleanupPath in @($publishPath, $previousPath)) {
        $resolvedCleanup = [IO.Path]::GetFullPath($cleanupPath)
        $expectedCleanup = if ($cleanupPath -eq $publishPath) {
            Join-Path $pluginsPath ('.dsh-tavern-game-install-' + $publishId)
        } else { Join-Path $pluginsPath ('.dsh-tavern-game-previous-' + $publishId) }
        if ($resolvedCleanup -ne $expectedCleanup) { throw 'Refusing to clean an unsafe publication stage.' }
        # A failed rollback keeps the previous directory available for recovery.
        if (($cleanupPath -eq $publishPath -or $installed) -and (Test-Path -LiteralPath $resolvedCleanup)) {
            Remove-Item -LiteralPath $resolvedCleanup -Recurse -Force
        }
    }
    $resolvedStage = [IO.Path]::GetFullPath($stagePath)
    $safePrefix = [IO.Path]::GetFullPath((Join-Path $workspacePath 'dist')).TrimEnd('\') + '\.install-'
    if (-not $resolvedStage.StartsWith($safePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing to clean an unsafe installation stage.'
    }
    if (Test-Path -LiteralPath $resolvedStage) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force }
}
