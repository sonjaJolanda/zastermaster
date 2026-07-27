@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo === Zaster Master — Backup (Dev-DB) ===

where docker >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] Docker wurde nicht gefunden.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] Docker laeuft nicht.
  pause
  exit /b 1
)

docker inspect zastermaster-db >nul 2>&1
if errorlevel 1 (
  echo [FEHLER] Container zastermaster-db laeuft nicht.
  echo Starte die Dev-DB mit: docker compose up -d db
  pause
  exit /b 1
)

if not exist "backups" mkdir backups
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set STAMP=%%I
set OUT=backups\zastermaster_dev_%STAMP%.sql

echo Schreibe %OUT% ...
docker exec zastermaster-db pg_dump -U zaster -d zastermaster > "%OUT%"
if errorlevel 1 (
  echo [FEHLER] Backup fehlgeschlagen.
  pause
  exit /b 1
)

echo Backup gespeichert: %OUT%
echo ^(Ship-Backup weiterhin: backup.bat -^> zastermaster-ship-db^)
endlocal
