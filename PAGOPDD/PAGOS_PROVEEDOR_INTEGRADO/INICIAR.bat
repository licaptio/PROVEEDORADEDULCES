@echo off
cd /d "%~dp0"
title PROVSOFT - Pagos a Proveedores
py server.py 2>nul || python server.py
pause
