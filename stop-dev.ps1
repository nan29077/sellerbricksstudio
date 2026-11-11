# Stops every dev server of THIS project that is still alive (including orphaned node processes).
# Why: closing the terminal window or an AI tool (Codex etc.) running "npm run dev" in the background
# can leave next-server alive -> http://localhost:3007 keeps answering and the Prisma engine DLL stays
# locked, so "prisma generate" fails and pages show stale-schema errors.
param([int]$Port = 3007, [switch]$Quiet)
$ErrorActionPreference = "SilentlyContinue"
$root = (Split-Path -Parent $MyInvocation.MyCommand.Path).TrimEnd('\')

$targets = @{}
# 1) whatever listens on the dev port
foreach ($c in (Get-NetTCPConnection -LocalPort $Port -State Listen)) { $targets[[int]$c.OwningProcess] = "listening on :$Port" }
# 2) node processes started from this project folder (next dev, start-server, prisma ...)
foreach ($p in (Get-CimInstance Win32_Process -Filter "Name='node.exe'")) {
  if ($p.CommandLine -and $p.CommandLine.ToLower().Contains($root.ToLower())) { $targets[[int]$p.ProcessId] = "node in project folder" }
}

if ($targets.Count -eq 0) {
  if (-not $Quiet) { Write-Host "[stop-dev] No dev server running for this project (port $Port is free)." -ForegroundColor Green }
  exit 0
}

foreach ($id in $targets.Keys) {
  $info = Get-CimInstance Win32_Process -Filter "ProcessId=$id"
  $cmd = if ($info.CommandLine) { $info.CommandLine } else { $info.Name }
  if ($cmd.Length -gt 140) { $cmd = $cmd.Substring(0, 140) + "..." }
  Write-Host "[stop-dev] kill PID $id ($($targets[$id])): $cmd" -ForegroundColor Yellow
  & taskkill.exe /PID $id /T /F | Out-Null
}
Start-Sleep -Milliseconds 800
if (Get-NetTCPConnection -LocalPort $Port -State Listen) {
  Write-Host "[stop-dev] Port $Port is STILL in use. Another program (or another project) is using it:" -ForegroundColor Red
  Get-NetTCPConnection -LocalPort $Port -State Listen | ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)" | Select-Object ProcessId, Name, CommandLine | Format-List }
  exit 1
}
Write-Host "[stop-dev] Done. http://localhost:$Port is now closed." -ForegroundColor Green
