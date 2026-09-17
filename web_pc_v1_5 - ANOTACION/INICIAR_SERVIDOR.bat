@echo off
title PROVSOFT RECORDATORIOS
cd /d "%~dp0"
py server.py
if errorlevel 1 python server.py
pause
