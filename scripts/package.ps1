param()
$ErrorActionPreference = 'Stop'
$workspacePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $workspacePath 'package.json') | ConvertFrom-Json
if ($manifest.name -ne 'dsh-tavern-game') { throw 'Unexpected package identity.' }
& node (Join-Path $PSScriptRoot 'integrity.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Runtime integrity generation failed.' }
$distPath = Join-Path $workspacePath 'dist'
New-Item -ItemType Directory -Path $distPath -Force | Out-Null
$stagePath = Join-Path $distPath ('.stage-' + [Guid]::NewGuid().ToString('N'))
$pluginPath = Join-Path $stagePath $manifest.name
New-Item -ItemType Directory -Path $pluginPath -Force | Out-Null
try {
    foreach ($entry in @('package.json','index.mjs','client.js','README.md','LICENSE','update-integrity.json')) {
        Copy-Item -LiteralPath (Join-Path $workspacePath $entry) -Destination $pluginPath
    }
    $simpleTarget = Join-Path $pluginPath 'simple'
    New-Item -ItemType Directory -Path $simpleTarget -Force | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $workspacePath 'simple') -File -Filter '*.mjs' | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $simpleTarget }
    Copy-Item -LiteralPath (Join-Path $workspacePath 'assets') -Destination $pluginPath -Recurse
    $archivePath = Join-Path $distPath ($manifest.name + '-' + $manifest.version + '.zip')
    Compress-Archive -LiteralPath $pluginPath -DestinationPath $archivePath -Force
    foreach ($entry in @('docs','test-simple','tools','scripts','skills')) {
        if (Test-Path -LiteralPath (Join-Path $workspacePath $entry)) { Copy-Item -LiteralPath (Join-Path $workspacePath $entry) -Destination $pluginPath -Recurse }
    }
    foreach ($entry in @('HANDOFF.md','AGENTS.md','plan.md','.gitignore','.gitattributes')) {
        if (Test-Path -LiteralPath (Join-Path $workspacePath $entry)) { Copy-Item -LiteralPath (Join-Path $workspacePath $entry) -Destination $pluginPath }
    }
    $sourceArchivePath = Join-Path $distPath ($manifest.name + '-' + $manifest.version + '-source.zip')
    Compress-Archive -LiteralPath $pluginPath -DestinationPath $sourceArchivePath -Force
    foreach ($filePath in @($archivePath,$sourceArchivePath)) {
        $stream = [IO.File]::OpenRead($filePath)
        try { $sha = [Security.Cryptography.SHA256]::Create(); try { $hash = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() } } finally { $stream.Dispose() }
        ($hash + '  ' + [IO.Path]::GetFileName($filePath)) | Set-Content -LiteralPath ($filePath + '.sha256') -Encoding ascii
    }
    Write-Output $archivePath
    Write-Output $sourceArchivePath
} finally {
    $resolvedStage = [IO.Path]::GetFullPath($stagePath)
    $safePrefix = [IO.Path]::GetFullPath($distPath).TrimEnd('\') + '\.stage-'
    if (-not $resolvedStage.StartsWith($safePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe staging path.' }
    if (Test-Path -LiteralPath $resolvedStage) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force }
}
