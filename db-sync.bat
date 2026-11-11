@echo off
title seller-bricks DB sync
cd /d "%~dp0"

echo [1/3] Stopping dev server (releases the locked Prisma engine file)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-dev.ps1"

echo [2/3] Regenerating Prisma Client + pushing schema to DB...
call npm run db:sync
if errorlevel 1 (
    echo.
    echo DB sync failed. Check the messages above.
    pause
    exit /b 1
)

echo [3/3] Starting dev server: http://localhost:3007
call "%~dp0dev.bat"
pause
