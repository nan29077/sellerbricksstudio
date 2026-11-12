@echo off
title seller-bricks DB start
cd /d "%~dp0"
echo Starting the database (Docker Desktop + sellerbricks-db container)...
call npm run db:start > db-start.log 2>&1
set ERR=%errorlevel%
type db-start.log
if not "%ERR%"=="0" (
    echo.
    echo DB start failed. Check the messages above, or run fix-db.bat.
    pause
    exit /b 1
)
echo.
echo DB is running. This window closes in 5 seconds.
timeout /t 5 /nobreak >nul
