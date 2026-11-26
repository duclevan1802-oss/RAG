# Khởi động frontend, backend và theo dõi nhật ký của hai tiến trình.

$ErrorActionPreference = 'Stop'
# Dựng đường dẫn từ thư mục script để có thể chạy lệnh từ terminal khác thư mục.
$root = $PSScriptRoot
$python = Join-Path $root 'backend\.venv\Scripts\python.exe'
$vite = Join-Path $root 'frontend\node_modules\vite\bin\vite.js'
$node = Get-Command node.exe -ErrorAction SilentlyContinue

if (!(Test-Path -LiteralPath $python)) { throw 'Backend Python not found: backend\.venv\Scripts\python.exe' }
if (!(Test-Path -LiteralPath $vite)) { throw 'Frontend dependencies not found. Run npm install in frontend.' }
if (-not $node) { throw 'Node.js was not found on PATH.' }

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

# Gom stdout và stderr vào một thư mục riêng cho mỗi lần khởi động.
$logDir = Join-Path $root ('storage\logs\run-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + $PID)
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$started = [System.Collections.Generic.List[object]]::new()
$logs = [System.Collections.Generic.List[object]]::new()

function Add-Log([string]$Label, [string]$Path) {
    $logs.Add([pscustomobject]@{ Label = $Label; Path = $Path; Offset = 0L })
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
            # Dùng vị trí đọc lần trước để chỉ in phần log mới.
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
    # Chỉ dùng lại tiến trình chiếm cổng backend sau khi endpoint kiểm tra phản hồi đúng.
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
    # Danh sách này chỉ chứa tiến trình do script hiện tại khởi động.
    foreach ($entry in $started) {
        $entry.Process.Refresh()
        if (-not $entry.Process.HasExited) {
            & taskkill.exe /PID $entry.Process.Id /T /F 2>$null | Out-Null
            Write-Host "[$($entry.Label)] Stopped process started by this script."
        }
    }
}
