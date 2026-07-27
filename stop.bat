@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo === Zaster Master — Stop ===
if not exist ".env.ship" (
  docker compose -f docker-compose.ship.yml down
) else (
  docker compose -f docker-compose.ship.yml --env-file .env.ship down
)
echo Gestoppt.
endlocal
