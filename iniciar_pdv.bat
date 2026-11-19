@echo off
title PDV Posto de Combustiveis - Terminal e Servidor de Persistencia
cd /d "%~dp0"
echo ==========================================================
echo   INICIANDO PDV POSTO DE COMBUSTIVEIS COM BACKUP SQL
echo ==========================================================
echo.
echo Abrindo servidor local e interface do operador...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor_pdv.ps1"
pause
