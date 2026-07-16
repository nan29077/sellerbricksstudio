@echo off
title seller-bricks dev server
cd /d "%~dp0"

echo.
echo [1/5] Installing node_modules (no scripts)...
call npm install --ignore-scripts
if %errorlevel% neq 0 (
    echo npm install failed. Is Node.js installed?
    pause
    exit /b 1
)

echo.
echo [2/5] Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo prisma generate failed.
    pause
    exit /b 1
)

echo.
echo [3/5] Starting Docker PostgreSQL (optional)...
docker compose up -d 2>nul
if %errorlevel% neq 0 (
    echo Docker not available - skipping. Install Docker Desktop if you need the DB.
) else (
    echo Waiting 5s for DB...
    timeout /t 5 /nobreak > nul

    echo.
    echo Pushing Prisma schema to DB...
    call npx prisma db push --skip-generate
    if %errorlevel% neq 0 (
        echo prisma db push failed - continuing anyway
    ) else (
        call npm run db:seed 2>nul
        echo Seed done
    )
)

echo.
echo ============================================
echo   Starting dev server: http://localhost:3007
echo   (DB may not be connected - install Docker)
echo ============================================
echo.
call npm run dev
pause
