@echo off
cd /d "%~dp0"
title PROVSOFT - DEUDA INTEGRA V1
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 server.py
) else (
    python server.py
)
if errorlevel 1 (
    echo.
    echo No se pudo iniciar Python. Verifica que Python este instalado.
    pause
)
