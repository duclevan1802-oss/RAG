
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$python = Join-Path $root 'backend\.venv\Scripts\python.exe'
$vite = Join-Path $root 'frontend\node_modules\vite\bin\vite.js'
$node = Get-Command node.exe -ErrorAction SilentlyContinue
$ollama = Get-Command ollama.exe -ErrorAction SilentlyContinue

if (!(Test-Path -LiteralPath $python)) { throw 'Backend Python not found: backend\.venv\Scripts\python.exe' }
if (!(Test-Path -LiteralPath $vite)) { throw 'Frontend dependencies not found. Run npm install in frontend.' }
if (-not $node) { throw 'Node.js was not found on PATH.' }
if (-not $ollama) { throw 'Ollama was not found on PATH.' }

function Test-LocalPort([int]$Port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $pending = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (!$pending.AsyncWaitHandle.WaitOne(400)) { return $false }
        $client.EndConnect($pending)
        return $true
    } catch { return $false } finally { $client.Dispose() }
}

function Test-JsonEndpoint([string]$Url) {
    try { return Invoke-RestMethod -Uri $Url -TimeoutSec 2 -ErrorAction Stop }
    catch { return $null }
}

$logDir = Join-Path $root ('storage\logs\run-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $PID)
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$started = [System.Collections.Generic.List[object]]::new()
$logs = [System.Collections.Generic.List[object]]::new()

function Add-Log([string]$Label, [string]$Path, [bool]$FromEnd = $false) {
    $offset = 0L
    if ($FromEnd -and (Test-Path -LiteralPath $Path)) { $offset = (Get-Item -LiteralPath $Path).Length }
    $logs.Add([pscustomobject]@{ Label = $Label; Path = $Path; Offset = $offset })
}

function Start-ServiceProcess([string]$Label, [string]$File, [string[]]$Arguments, [string]$Directory) {
    $stdout = Join-Path $logDir "$Label.out.log"
    $stderr = Join-Path $logDir "$Label.err.log"
    $process = Start-Process -FilePath $File -ArgumentList $Arguments -WorkingDirectory $Directory `
        -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru -WindowStyle Hidden
    $started.Add([pscustomobject]@{ Label = $Label; Process = $process; Reported = $false })
    Add-Log $Label $stdout
    Add-Log $Label $stderr
    Write-Host "[$Label] Started (PID $($process.Id))."
}

function Show-NewLogLines($Log) {
    if (!(Test-Path -LiteralPath $Log.Path)) { return }
    try {
        $file = [System.IO.File]::Open($Log.Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete)
        try {
            if ($file.Length -lt $Log.Offset) { $Log.Offset = 0L }
            if ($file.Length -eq $Log.Offset) { return }
            $null = $file.Seek($Log.Offset, [System.IO.SeekOrigin]::Begin)
            $reader = [System.IO.StreamReader]::new($file, [System.Text.Encoding]::UTF8)
            $content = $reader.ReadToEnd()
            $Log.Offset = $file.Position
            foreach ($line in ($content -split "`r?`n")) {
                if ($line) { Write-Host "[$($Log.Label)] $line" }
            }
        } finally { $file.Dispose() }
    } catch { Write-Warning "Cannot read $($Log.Label) log: $($_.Exception.Message)" }
}

try {
    $ollamaStatus = Test-JsonEndpoint 'http://127.0.0.1:11434/api/tags'
    if ($null -ne $ollamaStatus -and $null -ne $ollamaStatus.models) {
        Write-Host '[OLLAMA] Existing server detected.'
        if (-not ($ollamaStatus.models | Where-Object { $_.name -eq 'qwen3:4b' })) {
            Write-Warning 'qwen3:4b not found. Run: ollama pull qwen3:4b'
        }
        $existingLog = Join-Path $env:LOCALAPPDATA 'Ollama\server.log'
        if (Test-Path -LiteralPath $existingLog) { Add-Log 'OLLAMA' $existingLog $true }
        else { Write-Warning 'Ollama is already running; its server.log was not found.' }
    } elseif (Test-LocalPort 11434) {
        throw 'Port 11434 is occupied, but Ollama did not respond correctly.'
    } else {
        Start-ServiceProcess 'OLLAMA' $ollama.Source @('serve') $root
    }

    if (Test-LocalPort 8000) {
        $health = Test-JsonEndpoint 'http://127.0.0.1:8000/health'
        if ($null -eq $health -or $health.status -ne 'ok') { throw 'Port 8000 is occupied, but the backend health check failed.' }
        Write-Host '[BACKEND] Existing healthy backend detected; its terminal logs remain in its original window.'
    } else {
        Start-ServiceProcess 'BACKEND' $python @('-u', '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000', '--reload') (Join-Path $root 'backend')
    }

    if (Test-LocalPort 5173) {
        Write-Warning 'Port 5173 is already in use. Using the existing listener; verify it is the VIT AI frontend.'
    } else {
        Start-ServiceProcess 'FRONTEND' $node.Source @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort') (Join-Path $root 'frontend')
    }

    Write-Host ''
    Write-Host 'Frontend: http://127.0.0.1:5173'
    Write-Host 'Backend docs: http://127.0.0.1:8000/docs'
    Write-Host 'Logs below; press Ctrl+C to stop processes started by this script.'
    Write-Host "Log files: $logDir"
    Write-Host 'Ollama loaded models: run ollama ps in another terminal.'

    while ($true) {
        foreach ($log in $logs) { Show-NewLogLines $log }
        foreach ($entry in $started) {
            $entry.Process.Refresh()
            if ($entry.Process.HasExited -and -not $entry.Reported) {
                Write-Warning "$($entry.Label) stopped with exit code $($entry.Process.ExitCode). Check its logs above."
                $entry.Reported = $true
            }
        }
        Start-Sleep -Milliseconds 500
    }
} 
finally {
    foreach ($entry in $started) {
        $entry.Process.Refresh()
        if (-not $entry.Process.HasExited) {
            & taskkill.exe /PID $entry.Process.Id /T /F 2>$null | Out-Null
            Write-Host "[$($entry.Label)] Stopped process started by this script."
        }
    }
}
