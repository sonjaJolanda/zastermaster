@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo === Zaster Master — Update ===

where git >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] Git wurde nicht gefunden. Bitte Git installieren.
  pause
  exit /b 1
)

where docker >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] Docker wurde nicht gefunden.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] Docker laeuft nicht. Bitte Docker Desktop starten.
  pause
  exit /b 1
)

echo Hole neuesten Code...
git pull
if errorlevel 1 (
  echo [FEHLER] git pull fehlgeschlagen.
  pause
  exit /b 1
)

if not exist ".env.ship" (
  echo .env.ship fehlt — starte start.bat zuerst.
  pause
  exit /b 1
)

echo Baue und starte neu...
docker compose -f docker-compose.ship.yml --env-file .env.ship up --build -d
if errorlevel 1 (
  echo [FEHLER] docker compose fehlgeschlagen.
  pause
  exit /b 1
)

echo Update fertig. Oeffne http://zastermaster
start "" "http://zastermaster"
endlocal
