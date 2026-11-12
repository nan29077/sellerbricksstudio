@echo off
title seller-bricks update (2026-11-11 security + brand features)
cd /d "%~dp0"
echo [1/5] Stopping dev server...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-dev.ps1" -Quiet
echo [2/5] npm install (next 14.2.35, next-auth 4.24.15, eslint) - a few minutes...
echo ==== npm install ==== > update-20261111.log
call npm install --no-audit --no-fund >> update-20261111.log 2>&1
if errorlevel 1 goto failed
echo [3/5] Prisma Client...
echo ==== prisma generate ==== >> update-20261111.log
call npx prisma generate >> update-20261111.log 2>&1
if errorlevel 1 goto failed
echo [4/5] DB schema (new columns/tables only, existing data kept)...
echo ==== prisma db push ==== >> update-20261111.log
call npx prisma db push --skip-generate --accept-data-loss >> update-20261111.log 2>&1
if errorlevel 1 goto failed
call npm run db:sync >> update-20261111.log 2>&1
echo [5/5] Starting dev server in a new window: http://localhost:3007
start "seller-bricks dev server (port 3007)" cmd /c "%~dp0dev.bat"
echo ==== UPDATE OK ==== >> update-20261111.log
echo Done. This window closes in 5 seconds.
timeout /t 5 /nobreak >nul
exit /b 0
:failed
echo ==== UPDATE FAILED ==== >> update-20261111.log
type update-20261111.log
echo.
echo Update failed. See update-20261111.log
pause
exit /b 1
