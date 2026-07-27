@echo off
:: Adds 127.0.0.1 zastermaster to the Windows hosts file (needs Administrator).
setlocal EnableExtensions
set HOSTS=%SystemRoot%\System32\drivers\etc\hosts
findstr /i /c:"zastermaster" "%HOSTS%" >nul 2>&1
if not errorlevel 1 (
  echo Eintrag fuer zastermaster ist bereits vorhanden.
  pause
  exit /b 0
)

net session >nul 2>&1
if errorlevel 1 (
  echo Bitte diese Datei mit Rechtsklick „Als Administrator ausfuehren“.
  pause
  exit /b 1
)

echo.>>"%HOSTS%"
echo 127.0.0.1 zastermaster>>"%HOSTS%"
echo Fertig. Im Browser: http://zastermaster
pause
endlocal
