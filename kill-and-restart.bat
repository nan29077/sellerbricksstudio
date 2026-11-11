@echo off
title seller-bricks restart
cd /d "%~dp0"

echo Stopping dev server (port 3007 + orphaned node processes of this project)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-dev.ps1"

echo Starting dev server on port 3007...
call npm run dev
pause
