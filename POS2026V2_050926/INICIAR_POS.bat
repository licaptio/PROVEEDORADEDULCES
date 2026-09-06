@echo off
setlocal
title PROVSOFT POS 2026 - Servidor Local
cd /d "%~dp0"

where py >nul 2>&1
if %errorlevel%==0 (
    py -3 server.py
    goto fin
)

where python >nul 2>&1
if %errorlevel%==0 (
    python server.py
    goto fin
)

echo.
echo No se encontro Python instalado en esta computadora.
echo Instala Python 3 y activa la opcion "Add Python to PATH".
echo.
pause
exit /b 1

:fin
if not %errorlevel%==0 pause
endlocal
