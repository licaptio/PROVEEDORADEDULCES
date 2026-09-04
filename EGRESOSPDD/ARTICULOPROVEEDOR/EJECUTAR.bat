@echo off
setlocal
cd /d "%~dp0"
title PROVSOFT - Buscador de Articulos Proveedores

where python >nul 2>nul
if %errorlevel%==0 (
    python server.py
    goto :fin
)

where py >nul 2>nul
if %errorlevel%==0 (
    py server.py
    goto :fin
)

echo.
echo ERROR: No se encontro Python instalado en este equipo.
echo Instala Python 3 y marca la opcion "Add Python to PATH".
echo.
pause

:fin
endlocal
