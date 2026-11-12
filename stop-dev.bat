@echo off
title seller-bricks stop dev server
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-dev.ps1"
pause
