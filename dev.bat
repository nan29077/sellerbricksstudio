@echo off
title seller-bricks dev server (port 3007)
cd /d "%~dp0"
echo Starting seller-bricks on http://localhost:3007 ...
call npm run dev
pause
