@echo off
setlocal
cd /d "%~dp0"
title PROVSOFT POS 2026 V18 - IMPRESION DIRECTA

echo ======================================================================
echo  PROVSOFT POS 2026 V18
echo  IMPRESION DIRECTA WINDOWS
echo.
echo  Impresora objetivo: se toma de IMPRESORA_WINDOWS.txt
echo  Configurada para esta caja: MINIPRINTEREXCEL
echo  Driver detectado: Generic / Text Only
echo  Puerto detectado: COM1:
echo.
echo  Chrome/Edge se abre con un PERFIL AISLADO y --kiosk-printing.
echo  Esto evita que un Chrome normal ya abierto quite la impresion directa.
echo ======================================================================
echo.

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
echo ERROR: No se encontro Python 3 instalado.
echo Instala Python y activa "Add Python to PATH".
echo.
pause
exit /b 1

:fin
if not %errorlevel%==0 pause
endlocal
