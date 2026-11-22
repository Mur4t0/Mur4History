@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Mur4History MCP - Sunucuyu Durdur

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"
set "MUR4_STOP_DIR=%APP_DIR%"

echo.
echo [Mur4History] Calisan Next.js web sunucusu durduruluyor...
powershell -NoProfile -Command "$dir = $env:MUR4_STOP_DIR; $esc = [regex]::Escape($dir); $targets = @(); $procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'next' -and $_.CommandLine -notmatch 'mcp-stdio' }; foreach ($p in $procs) { if (($p.CommandLine -match $esc) -or ($p.CommandLine -match 'next(?:.js)?\s+start\s+--port\s+3000')) { $targets += $p } }; if (-not $targets -and (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) { $c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($c) { $p = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $c.OwningProcess) -ErrorAction SilentlyContinue; if ($p -and $p.Name -eq 'node.exe' -and $p.CommandLine -match 'next' -and $p.CommandLine -notmatch 'mcp-stdio') { $targets += $p } } }; $targets = $targets | Sort-Object ProcessId -Unique; if (-not $targets) { Write-Host '[Bilgi] Calisan Mur4History web sunucusu bulunamadi.' } else { foreach ($t in $targets) { Stop-Process -Id $t.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host ('[OK] Sunucu durduruldu (PID ' + $t.ProcessId + ').') } }"
echo.
if /i not "%~1"=="--headless" timeout /t 2 >nul 2>nul
exit /b 0
