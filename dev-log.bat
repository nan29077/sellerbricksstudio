@echo off
title seller-bricks dev server (with log)
cd /d "%~dp0"
rem Same as dev.bat, but also writes everything to dev-server.out.log so it can be diagnosed
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-dev.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Continue'; npm run dev 2>&1 | Tee-Object -FilePath dev-server.out.log"
pause
