# 셀러브릭스 스튜디오 DB 진단 · 복구
#  - P1000 (Authentication failed) 의 흔한 원인:
#    (1) 다른 프로젝트나 PC에 설치된 PostgreSQL 이 5432 포트를 먼저 쓰고 있어 엉뚱한 DB 로 접속
#    (2) Docker DB 가 꺼져 있음
#    (3) DB 볼륨이 예전에 다른 비밀번호로 만들어짐
#  이 스크립트는 이 프로젝트 전용 포트(5434)로 DB 를 띄우고, 계정 · 비밀번호를 .env 와 맞춘 뒤 스키마를 반영합니다.
$ErrorActionPreference = "Continue"
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Port = 5434
$Container = "sellerbricks-db"
function Info($m) { Write-Host "[fix-db] $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "[fix-db] $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host "[fix-db] $m" -ForegroundColor Red; exit 1 }

# 0) 현재 5432 포트 사용 현황 (진단용)
$l = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
if ($l) {
  foreach ($c in $l | Select-Object -Unique OwningProcess) {
    $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    Info "5432 포트 사용 중: $($p.ProcessName) (PID $($c.OwningProcess))"
  }
  Info "다른 PostgreSQL 과 겹치지 않도록 이 프로젝트는 $Port 포트를 사용합니다."
}

# 1) Docker 확인
docker version --format "{{.Server.Version}}" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "Docker 가 실행 중이 아닙니다. Docker Desktop 을 켠 뒤(고래 아이콘이 Running 상태) 이 파일을 다시 실행해 주세요." }

# 2) docker-compose.yml 포트 · .env DATABASE_URL 을 전용 포트로
$compose = Get-Content docker-compose.yml -Raw
$newCompose = $compose -replace '"\d+:5432"', ('"' + $Port + ':5432"')
if ($newCompose -ne $compose) { [IO.File]::WriteAllText((Resolve-Path docker-compose.yml), $newCompose); Info "docker-compose.yml 포트를 $Port 로 변경" }
foreach ($f in ".env", ".env.local") {
  if (Test-Path $f) {
    $t = Get-Content $f -Raw
    $n = $t -replace 'postgresql://sellerbricks:sellerbricks@localhost:\d+/', ("postgresql://sellerbricks:sellerbricks@localhost:" + $Port + "/")
    if ($n -ne $t) { [IO.File]::WriteAllText((Resolve-Path $f), $n); Info "$f 의 DATABASE_URL 포트를 $Port 로 변경" }
  }
}

# 3) 컨테이너 (재)시작
Info "DB 컨테이너 시작 중..."
docker compose up -d --force-recreate db
if ($LASTEXITCODE -ne 0) { Fail "DB 컨테이너를 시작하지 못했습니다. 위 메시지를 확인해 주세요." }
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  docker exec $Container pg_isready -q 2>$null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep 2
}
if (-not $ready) { Fail "DB 가 60초 안에 준비되지 않았습니다. docker logs $Container 로 확인해 주세요." }

# 4) 계정 · 비밀번호 · DB 를 .env 와 일치시키기 (컨테이너 내부 접속은 비밀번호 없이 가능)
$super = "sellerbricks"
docker exec $Container psql -U sellerbricks -d postgres -tAc "select 1" 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { $super = "postgres" }
Info "관리 계정: $super"
docker exec $Container psql -U $super -d postgres -v ON_ERROR_STOP=1 -c "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='sellerbricks') THEN CREATE ROLE sellerbricks LOGIN SUPERUSER PASSWORD 'sellerbricks'; ELSE ALTER ROLE sellerbricks WITH LOGIN PASSWORD 'sellerbricks'; END IF; END `$`$;" | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "DB 계정을 맞추지 못했습니다." }
$hasDb = docker exec $Container psql -U $super -d postgres -tAc "select 1 from pg_database where datname='sellerbricks'"
if (-not "$hasDb".Trim()) { docker exec $Container psql -U $super -d postgres -c "CREATE DATABASE sellerbricks OWNER sellerbricks" | Out-Null; Info "sellerbricks 데이터베이스 생성" }
Info "DB 계정 확인 완료 (sellerbricks / localhost:$Port)"

# 5) 스키마 반영 + Prisma Client
Info "스키마 반영 중 (npm run db:sync)..."
npm run db:sync
if ($LASTEXITCODE -ne 0) { Fail "스키마 반영에 실패했습니다. 위 메시지를 확인해 주세요." }

# 6) 데이터가 비어 있으면 테스트 계정 시드
$users = docker exec $Container psql -U sellerbricks -d sellerbricks -tAc 'select count(*) from "User"' 2>$null
if ("$users".Trim() -eq "0") { Info "테스트 계정 · 샘플 데이터 생성 (npm run db:seed)"; npm run db:seed }

Write-Host ""
Write-Host "[fix-db] 완료! 이제 dev.bat 으로 서버를 시작하세요." -ForegroundColor Green
