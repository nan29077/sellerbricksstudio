@echo off
title seller-bricks E2E simulation
cd /d "%~dp0"
echo Running the brand-flow E2E simulation against http://localhost:3007 (dev server + DB must be running)...
echo NOTE: this creates test data in the local DB. Result is saved to e2e-test.log
node scripts/simulate-brand-flow.mjs > e2e-test.log 2>&1
type e2e-test.log
echo.
echo Done. This window closes in 10 seconds.
timeout /t 10 /nobreak >nul
