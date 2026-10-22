# Isolated fixture preview. No game files, models, or DSH process are touched.
$ErrorActionPreference = 'Stop'
$workspacePath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$previewPort = 43178
$previewUrl = "http://127.0.0.1:$previewPort"
function Get-PreviewHealth {
    try { Invoke-RestMethod -Uri "$previewUrl/health" -TimeoutSec 2 } catch { $null }
}
$health = Get-PreviewHealth
if ($null -ne $health) {
    if ($health.app -ne 'dsh-tavern-game-simple' -or $health.version -ne 32 -or $health.build -ne '0.8.15') { throw 'Preview port is used by another server or older preview. Close that preview first.' }
    Write-Output $previewUrl
    return
}
$previewProbe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $previewPort)
try { $previewProbe.Start() } finally { $previewProbe.Stop() }
$nodePath = (Get-Command node -ErrorAction Stop).Source
$serverPath = Join-Path $workspacePath 'tools\browser-dev-server.mjs'
$logDirectory = Join-Path $workspacePath 'dist'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$previousPort = $env:PORT
try {
    $env:PORT = "$previewPort"
    Start-Process -FilePath $nodePath -ArgumentList @('"' + $serverPath + '"') -WorkingDirectory $workspacePath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'simple-demo.out.log') -RedirectStandardError (Join-Path $logDirectory 'simple-demo.err.log') | Out-Null
} finally { $env:PORT = $previousPort }
for ($attempt = 0; $attempt -lt 20; $attempt++) {
    $health = Get-PreviewHealth
    if ($health.app -eq 'dsh-tavern-game-simple' -and $health.version -eq 32 -and $health.build -eq '0.8.15') { Write-Output $previewUrl; return }
    Start-Sleep -Milliseconds 250
}
throw 'Preview did not start. See dist/simple-demo.err.log.'
