Set-Location $PSScriptRoot
Write-Host "`n=== seller-bricks dev setup ===" -ForegroundColor Cyan

Write-Host "`n[1/5] npm install..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { Write-Host "npm install failed" -ForegroundColor Red; Read-Host; exit 1 }

Write-Host "`n[2/5] Docker DB start..." -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) { Write-Host "Docker failed - make sure Docker Desktop is running" -ForegroundColor Red }

Write-Host "`n[3/5] Waiting 5s for DB..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "`n[4/5] prisma db push..." -ForegroundColor Yellow
npx prisma db push --skip-generate
if ($LASTEXITCODE -ne 0) { Write-Host "prisma db push failed" -ForegroundColor Red; Read-Host; exit 1 }

Write-Host "`n[5/5] seeding..." -ForegroundColor Yellow
npm run db:seed 2>$null
Write-Host "seed done (duplicate errors are OK)" -ForegroundColor Gray

Write-Host "`n=== Starting dev server: http://localhost:3007 ===" -ForegroundColor Green
npm run dev
Read-Host
