@echo off
title seller-bricks DB fix
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-dev.ps1" -Quiet
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fix-db.ps1"
if errorlevel 1 (
    pause
    exit /b 1
)
echo.
choice /m "Start the dev server now"
if errorlevel 2 exit /b 0
call "%~dp0dev.bat"
