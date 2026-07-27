@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo === Zaster Master — Start ===

where docker >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] Docker wurde nicht gefunden. Bitte Docker Desktop installieren und starten.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] Docker laeuft nicht. Bitte Docker Desktop starten und erneut versuchen.
  pause
  exit /b 1
)

if not exist ".env.ship" (
  echo Erstelle .env.ship aus Vorlage...
  copy /Y ".env.ship.example" ".env.ship" >nul
  powershell -NoProfile -Command ^
    "$p='.env.ship'; $s=-join((48..57)+(65..90)+(97..122)|Get-Random -Count 48|%%{[char]$_}); (Get-Content $p) -replace 'change-me-to-a-long-random-string',$s | Set-Content $p -Encoding UTF8"
  echo JWT_SECRET wurde zufaellig gesetzt.
)

echo Baue und starte Container (erster Lauf kann lange dauern)...
docker compose -f docker-compose.ship.yml --env-file .env.ship up --build -d
if errorlevel 1 (
  echo [FEHLER] docker compose ist fehlgeschlagen.
  pause
  exit /b 1
)

echo.
echo App sollte erreichbar sein unter:
echo   http://zastermaster
echo   Fallback: http://127.0.0.1:3080
echo API: http://zastermaster:3002
echo.
echo Falls zastermaster nicht aufloest: setup-hosts.bat als Administrator ausfuehren.
echo.

start "" "http://zastermaster"
endlocal
