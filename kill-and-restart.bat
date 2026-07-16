@echo off
title seller-bricks restart
cd /d "%~dp0"

echo Killing process on port 3007...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr " :3007 "') do (
    echo Killing PID %%a
    taskkill /F /PID %%a 2>nul
)

timeout /t 2 /nobreak > nul

echo Starting dev server on port 3007...
call npm run dev
pause
