// 개발 서버 시작 전에 Prisma Client · DB 구조를 schema.prisma 와 맞춘다.
//
// 왜 필요한가: Windows 에서는 개발 서버가 켜져 있는 동안 Prisma 엔진 파일(query_engine-windows.dll.node)이
// 잠겨 `prisma generate` 가 조용히 실패한다. 그러면 코드는 새 스키마를 쓰는데 실행 중인 클라이언트·DB 는 옛날 구조라
// "데이터를 불러오지 못했습니다" / "일시적인 오류가 발생했습니다(오류 코드 …)" 가 여러 화면에서 동시에 뜬다.
//
// 또한 DB(Docker 컨테이너)가 꺼져 있으면 "데이터베이스에 연결할 수 없습니다" 가 뜨므로,
// 매 실행마다 DB 접속 가능 여부를 먼저 확인하고 꺼져 있으면 Docker Desktop · DB 컨테이너를 자동으로 켠다.
//
// 사용: npm run dev 시 자동 실행(predev).  강제 재동기화: npm run db:sync  (db-sync.bat)
//       DB 만 켜기: npm run db:start  (db-start.bat)
import { createHash } from "node:crypto";
import { execSync, spawn } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const force = process.argv.includes("--force");
const schemaPath = path.join(root, "prisma", "schema.prisma");
const clientDir = path.join(root, "node_modules", ".prisma", "client");
const marker = path.join(clientDir, ".schema-sync");

// 패키지가 비어 있으면(npm install/ci 가 중간에 멈춘 경우) npx 가 엉뚱한 prisma 를 내려받지 않도록 먼저 멈춘다
if (!fs.existsSync(path.join(root, "node_modules", "next", "package.json")) || !fs.existsSync(path.join(root, "node_modules", "prisma", "package.json"))) {
  console.log("\x1b[31m[db-sync]\x1b[0m node_modules 가 비어 있거나 불완전합니다. 먼저 `npm install` (또는 repair-install.bat) 을 실행해 주세요.");
  process.exit(1);
}

const line = "─".repeat(60);
const say = (m) => console.log(`\x1b[33m[db-sync]\x1b[0m ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const quiet = (cmd, timeout = 20000) => {
  try { return execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "ignore"], timeout }).toString().trim(); } catch { return null; }
};

// ── DB 가 켜져 있는지 확인하고, 꺼져 있으면 자동으로 켠다 ─────────────────────────
const CONTAINER = "sellerbricks-db";
function readDbTarget() {
  let url = process.env.DATABASE_URL || "";
  for (const f of [".env.local", ".env"]) {
    if (url) break;
    try { url = (fs.readFileSync(path.join(root, f), "utf8").match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m) || [])[1] || ""; } catch { /* 파일 없음 */ }
  }
  try { const u = new URL(url); return { host: u.hostname || "localhost", port: Number(u.port) || 5432 }; } catch { return { host: "localhost", port: 5434 }; }
}
const portOpen = ({ host, port }) => new Promise((resolve) => {
  const s = net.connect({ host: host === "localhost" ? "127.0.0.1" : host, port });
  const done = (ok) => { s.destroy(); resolve(ok); };
  s.setTimeout(1500); s.once("connect", () => done(true)); s.once("timeout", () => done(false)); s.once("error", () => done(false));
});
const dockerRunning = () => quiet('docker version --format "{{.Server.Version}}"', 15000) !== null;
const pgReady = () => quiet(`docker exec ${CONTAINER} pg_isready -q -U sellerbricks`, 10000) !== null;

async function ensureDbRunning() {
  const target = readDbTarget();
  const local = ["localhost", "127.0.0.1", "::1"].includes(target.host);
  if (await portOpen(target) && (!local || !dockerRunning() || pgReady())) return true;
  if (!local) { say(`\x1b[31mDB 서버(${target.host}:${target.port})에 연결할 수 없습니다.\x1b[0m`); return false; }

  console.log(line);
  say(`DB(localhost:${target.port})가 꺼져 있어 자동으로 시작합니다.`);
  if (quiet("docker --version") === null) { say("\x1b[31mDocker 가 설치되어 있지 않습니다.\x1b[0m Docker Desktop 을 설치한 뒤 다시 실행해 주세요."); return false; }

  if (!dockerRunning()) {
    if (process.platform === "win32") {
      const exe = [process.env.ProgramFiles, process.env.ProgramW6432, "C:\\Program Files"].filter(Boolean)
        .map((d) => path.join(d, "Docker", "Docker", "Docker Desktop.exe")).find((f) => fs.existsSync(f));
      if (exe) { say("Docker Desktop 을 켜는 중... (처음에는 1~2분 걸릴 수 있습니다)"); try { spawn(exe, [], { detached: true, stdio: "ignore" }).unref(); } catch { /* 아래 대기에서 판별 */ } }
    } else if (process.platform === "darwin") { quiet("open -a Docker"); }
    let up = false;
    for (let i = 0; i < 60 && !up; i++) { await sleep(3000); up = dockerRunning(); }
    if (!up) { say("\x1b[31mDocker Desktop 이 켜지지 않았습니다.\x1b[0m 직접 실행해 고래 아이콘이 Running 이 된 뒤 다시 시도해 주세요."); return false; }
  }

  try { execSync("docker compose up -d db", { cwd: root, stdio: "inherit" }); }
  catch { say("\x1b[31mDB 컨테이너를 시작하지 못했습니다.\x1b[0m 위 메시지를 확인하거나 fix-db.bat 을 실행해 주세요."); return false; }
  for (let i = 0; i < 40; i++) {
    if (pgReady() && await portOpen(target)) { say(`\x1b[32mDB 시작 완료\x1b[0m (localhost:${target.port})`); return true; }
    await sleep(1500);
  }
  say(`\x1b[31mDB 가 60초 안에 준비되지 않았습니다.\x1b[0m  docker logs ${CONTAINER} 로 확인해 주세요.`);
  return false;
}

const dbUp = await ensureDbRunning();
// --db-only: 개발 서버를 끄지 않고 DB 만 켜고 구조를 맞춘다 (서버가 켜져 있으면 엔진 파일이 잠겨 generate 는 건너뜀)
const dbOnly = process.argv.includes("--db-only");
if (dbOnly && !dbUp) process.exit(1);

const hash = createHash("sha256").update(fs.readFileSync(schemaPath, "utf8").replace(/\r/g, "")).digest("hex");
const prev = fs.existsSync(marker) ? fs.readFileSync(marker, "utf8").trim() : "";
if (!force && !dbOnly && prev === hash) process.exit(0);

console.log(line);
say(dbOnly ? "DB 구조를 최신 스키마와 맞춥니다." : force ? "Prisma Client · DB 구조를 다시 맞춥니다." : "schema.prisma 가 바뀌어 Prisma Client · DB 구조를 맞춥니다.");

// 이전 generate 실패로 남은 엔진 임시 파일 정리
try {
  for (const f of fs.readdirSync(clientDir)) if (/\.node\.tmp\d*$/.test(f)) fs.rmSync(path.join(clientDir, f), { force: true });
} catch { /* 폴더가 없으면 무시 */ }

const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit", env: process.env });

try {
  if (!dbOnly) run("npx prisma generate");
} catch {
  console.log(line);
  say("\x1b[31mPrisma Client 생성 실패\x1b[0m — 개발 서버나 node 프로세스가 Prisma 엔진 파일을 잡고 있을 가능성이 큽니다.");
  say("켜져 있는 개발 서버 창을 모두 닫은 뒤 db-sync.bat 을 실행해 주세요.");
  console.log(line);
  process.exit(1);
}

// 한 번만 필요한 정리 SQL (prisma/cleanup/*.sql, 이름 순). 데이터 삭제 확인 없이 db push 가 되도록 먼저 맞춘다.
// 각 파일은 여러 번 실행해도 안전하게 작성한다. 실패해도 db push 단계에서 다시 안내한다.
const cleanupDir = path.join(root, "prisma", "cleanup");
if (dbUp && fs.existsSync(cleanupDir)) {
  for (const f of fs.readdirSync(cleanupDir).filter((n) => n.endsWith(".sql")).sort()) {
    try { execSync(`npx prisma db execute --schema prisma/schema.prisma --file "prisma/cleanup/${f}"`, { cwd: root, stdio: ["ignore", "ignore", "inherit"], env: process.env }); }
    catch { say(`\x1b[31m정리 SQL 실행 실패\x1b[0m — prisma/cleanup/${f}`); }
  }
}

let dbOk = true;
try {
  run("npx prisma db push --skip-generate");
} catch {
  dbOk = false;
  console.log(line);
  say("\x1b[31mDB 구조 반영 실패\x1b[0m — 다음을 확인해 주세요.");
  say("  1) Docker DB 가 켜져 있는지:  npm run db:start  (db-start.bat)");
  say("  2) 데이터 삭제가 필요한 변경이면 직접 확인 후:  npx prisma db push");
  say("개발 서버는 계속 시작하지만, DB 를 맞추기 전까지 일부 화면에서 오류가 날 수 있습니다.");
  console.log(line);
}

if (dbOk && !dbOnly) fs.writeFileSync(marker, hash);
// DB 가 비어 있으면(처음 만들어진 볼륨) 테스트 계정 · 샘플 데이터를 넣는다
if (dbOk && quiet(`docker exec ${CONTAINER} psql -U sellerbricks -d sellerbricks -tAc "select count(*) from \\"User\\""`) === "0") {
  say("DB 가 비어 있어 테스트 계정 · 샘플 데이터를 생성합니다 (npm run db:seed).");
  try { run("npm run db:seed"); } catch { say("\x1b[31m시드 실패\x1b[0m — npm run db:seed 를 직접 실행해 확인해 주세요."); }
}
say(dbOk ? (dbOnly ? "\x1b[32m완료\x1b[0m — DB 가 켜져 있고 구조가 최신 스키마와 일치합니다." : "\x1b[32m완료\x1b[0m — Prisma Client 와 DB 가 최신 스키마와 일치합니다.") : "Client 만 갱신했습니다. DB 를 맞춘 뒤 다시 실행하면 완료됩니다.");
console.log(line);
