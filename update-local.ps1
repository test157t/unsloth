param(
    [ValidateRange(1,65535)][int]$Port = 8981,
    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$stage = 'preflight'
$logDirectory = Join-Path $env:USERPROFILE '.unsloth\studio\logs\update'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$logPath = Join-Path $logDirectory ("update-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
Start-Transcript -Path $logPath | Out-Null
try {
    Set-Location -LiteralPath $repo
    $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq $Port)
    $owners = @($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($ownerId in $owners) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerId"
        if ($process.CommandLine -notmatch '(?i)unsloth.*studio') {
            throw "Port $Port belongs to another application (PID $ownerId). It will not be stopped."
        }
    }
    if (-not $owners.Count) {
        $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        try { $probe.Start() } finally { $probe.Stop() }
    }
    Write-Host "[Studio] Local URL: http://127.0.0.1:$Port"
    Write-Host "[Studio] Update log: $logPath"
    if ($CheckOnly) {
        Write-Host '[Studio] Preflight passed. No server stopped or update performed.'
    } else {
        $stage = 'updating checkout'
        & git -C $repo pull --ff-only
        if ($LASTEXITCODE -ne 0) { throw "git pull failed (exit $LASTEXITCODE). Local changes were not discarded." }
        $stage = 'stopping Studio'
        foreach ($ownerId in $owners) {
            Stop-Process -Id $ownerId -Force -ErrorAction Stop
        }
        $stage = 'rebuilding Studio'
        $env:UNSLOTH_SKIP_AUTOSTART = '1'
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'install.ps1') --local
        if ($LASTEXITCODE -ne 0) { throw "Studio rebuild failed (exit $LASTEXITCODE)." }
        $stage = 'starting Studio'
        $launcher = Join-Path $env:USERPROFILE '.unsloth\studio\unsloth_studio\Scripts\unsloth.exe'
        if (-not (Test-Path -LiteralPath $launcher)) { throw "Launcher not found: $launcher" }
        & $launcher studio -p $Port
        if ($LASTEXITCODE -ne 0) { throw "Studio exited with code $LASTEXITCODE." }
    }
} catch {
    Write-Host "[Studio] FAILED during ${stage}: $_" -ForegroundColor Red
    Write-Host "[Studio] Saved log: $logPath"
    Stop-Transcript | Out-Null
    exit 1
}
Stop-Transcript | Out-Null
exit 0
