@echo off
setlocal
cd /d "%~dp0"
title PROVSOFT - MONTEMORELOS INVENTARIO 230926
cls
echo ==========================================================
echo   PROVSOFT - MONTEMORELOS INVENTARIO - 23/09/2026
echo ==========================================================
echo.
echo Iniciando servidor local SIN PYTHON...
echo No cierre esta ventana mientras utiliza la aplicacion.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor.ps1"
echo.
echo ==========================================================
echo EL SERVIDOR SE DETUVO.
echo ==========================================================
pause
