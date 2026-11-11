@echo off
title seller-bricks dev server (port 3007)
cd /d "%~dp0"
rem Stop any leftover dev server of this project first (orphaned node keeps port 3007 + locks Prisma DLL)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-dev.ps1" -Quiet

rem A production build (next build / E2E) left in .next mixes with the dev server and the pages lose all CSS.
rem next dev never writes BUILD_ID, so its presence means .next must be cleared before starting.
if exist ".next\BUILD_ID" (
    echo Clearing production build output in .next ...
    rmdir /s /q ".next"
)

rem Packages missing (node_modules emptied by an unfinished npm install/ci) -> reinstall first
if not exist "node_modules\next\package.json" (
    echo node_modules is missing or incomplete. Running npm install...
    call npm install
    if errorlevel 1 (
        echo npm install failed. Close other programs using this folder and try again.
        pause
        exit /b 1
    )
)

echo Starting seller-bricks on http://localhost:3007 ...
echo The browser opens automatically in a few seconds.
echo Close with Ctrl+C, or run stop-dev.bat if the page is still alive after closing.
start "" /min powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 90;$i++){try{$r=Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://localhost:3007/robots.txt; if($r.StatusCode){Start-Process 'http://localhost:3007'; break}}catch{}; Start-Sleep 2}"
call npm run dev
pause
