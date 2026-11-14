@echo off
title seller-bricks dev server (port 3007)
cd /d "%~dp0"
rem Stop any leftover dev server of this project first (orphaned node keeps port 3007 + locks Prisma DLL)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-dev.ps1" -Quiet

rem Packages missing (node_modules emptied by an unfinished npm install/ci) -> reinstall first
rem New packages added to package.json (e.g. exceljs for order-sheet Excel upload) are installed too
set NEED_INSTALL=
if not exist "node_modules\next\package.json" set NEED_INSTALL=1
if not exist "node_modules\exceljs\package.json" set NEED_INSTALL=1
if defined NEED_INSTALL (
    echo node_modules is missing or incomplete or new packages were added. Running npm install...
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
