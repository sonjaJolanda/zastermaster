@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo === Zaster Master — Backup ===

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

if not exist "backups" mkdir backups
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set STAMP=%%I
set OUT=backups\zastermaster_%STAMP%.sql

echo Schreibe %OUT% ...
docker exec zastermaster-ship-db pg_dump -U zaster -d zastermaster > "%OUT%"
if errorlevel 1 (
  echo [FEHLER] Backup fehlgeschlagen. Laeuft die App? start.bat ausfuehren.
  pause
  exit /b 1
)

echo Backup gespeichert: %OUT%
endlocal
