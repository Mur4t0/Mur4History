@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Mur4History MCP - Sunucuyu Durdur

echo.
echo [Mur4History] Calisan Next.js web sunucusu durduruluyor...
powershell -NoProfile -Command "$procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'Mur4History|paxhistoryMur4t' -and $_.CommandLine -match 'next' }; if (-not $procs) { Write-Host '[Bilgi] Calisan Mur4History web sunucusu bulunamadi.' } else { foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host ('[OK] Sunucu durduruldu (PID ' + $p.ProcessId + ').') } }"
echo.
if /i not "%~1"=="--headless" timeout /t 2 >nul
exit /b 0
