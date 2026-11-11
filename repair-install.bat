@echo off
title seller-bricks repair (reinstall + DB sync + start)
cd /d "%~dp0"

echo [1/4] Stopping leftover dev servers of this project...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-dev.ps1"

echo [2/4] Installing packages (npm install) - this can take a few minutes...
call npm install
if errorlevel 1 (
    echo.
    echo npm install failed. Close other terminals / editors using this folder and run this file again.
    pause
    exit /b 1
)

echo [3/4] Syncing Prisma Client + DB schema...
call npm run db:sync
if errorlevel 1 (
    echo.
    echo DB sync failed. Is Docker Desktop running? Try: npm run db:up
    pause
    exit /b 1
)

echo [4/4] Starting dev server: http://localhost:3007
call "%~dp0dev.bat"
pause
