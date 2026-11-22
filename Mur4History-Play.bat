@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Mur4History MCP - Baslatici

cd /d "%~dp0"
set "HEADLESS=0"
if /i "%~1"=="--headless" set "HEADLESS=1"

echo.
echo ========================================================
echo   MUR4HISTORY MCP - ALTERNATIF TARIH ^& BUYUK STRATEJI
echo ========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [HATA] Node.js bulunamadi! Lutfen Node.js kurun.
  if "%HEADLESS%"=="0" pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/4] Bagimliliklar yukleniyor ^(npm install^)...
  call npm install
  if errorlevel 1 (
    echo [HATA] npm install basarisiz oldu.
    if "%HEADLESS%"=="0" pause
    exit /b 1
  )
)

if not exist "prisma\dev.db" (
  echo [2/4] Veritabani hazirlaniyor ^(Prisma Push ^& Seed^)...
  call npx prisma db push --accept-data-loss
  if errorlevel 1 (
    echo [HATA] Veritabani olusturulamadi.
    if "%HEADLESS%"=="0" pause
    exit /b 1
  )
  call npm run db:seed
)

if not exist "public\maplibre-gl-worker.mjs" (
  if exist "node_modules\maplibre-gl\dist\maplibre-gl-worker.mjs" (
    copy /y "node_modules\maplibre-gl\dist\maplibre-gl-worker.mjs" "public\maplibre-gl-worker.mjs" >nul
  )
)

if not exist ".next\BUILD_ID" (
  echo [3/4] Production derlemesi yapiliyor ^(ilk kurulum^)...
  call npm run build
  if errorlevel 1 (
    echo [HATA] Derleme basarisiz oldu.
    if "%HEADLESS%"=="0" pause
    exit /b 1
  )
)

:check_running
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/scenarios' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if not errorlevel 1 goto :already_running

:start_server
echo [4/4] Mur4History sunucusu baslatiliyor ^(http://localhost:3000^)...
start "Mur4History Sunucu (Port 3000)" /min node "%~dp0node_modules\next\dist\bin\next" start --port 3000

set WAIT_COUNT=0
:wait_loop
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/scenarios' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if not errorlevel 1 goto :server_ready
set /a WAIT_COUNT+=1
if %WAIT_COUNT% GEQ 30 goto :wait_timeout
ping -n 2 127.0.0.1 >nul
goto :wait_loop

:wait_timeout
echo [HATA] Sunucu 30 saniye icinde yanit vermedi.
if "%HEADLESS%"=="0" pause
exit /b 1

:server_ready
echo.
echo [OK] Mur4History hazir!
echo      Web Arayuzu : http://localhost:3000
echo      MCP Koprusu : Antigravity / Cursor / Claude ile otomatik baglanir
echo      Durdurmak   : Mur4History-Stop.bat dosyasini calistirabilir
echo                    veya simge durumundaki sunucu penceresini kapatabilirsiniz.
echo.
if "%HEADLESS%"=="0" (
  start "" "http://localhost:3000"
  timeout /t 4 >nul
)
exit /b 0

:already_running
echo [OK] Mur4History sunucusu zaten calisiyor: http://localhost:3000
echo.
if "%HEADLESS%"=="1" exit /b 0

start "" "http://localhost:3000"
echo  [C] Devam et ve pencereyi kapat ^(5 sn icinde otomatik kapanir^)
echo  [R] Sunucuyu yeniden baslat
echo  [X] Sunucuyu durdur
echo.
choice /c CRX /n /t 5 /d C /m "Seciminiz: "
if errorlevel 3 goto :stop_only
if errorlevel 2 goto :restart_server
exit /b 0

:stop_only
call "%~dp0Mur4History-Stop.bat"
exit /b 0

:restart_server
call "%~dp0Mur4History-Stop.bat" --headless
goto :start_server
