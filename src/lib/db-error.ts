// DB/Prisma 오류를 사람이 이해할 수 있는 원인으로 분류한다.
// 화면에는 원인과 해결 방법만 보여 주고, 원문은 서버 로그에 남긴다.
export type DbIssue = "schema" | "connection" | "unknown";

export function classifyDbError(message: string | undefined | null): DbIssue {
  const m = message ?? "";
  if (/P2021|P2022|does not exist in the current database|Unknown (field|arg|argument)|Invalid value for argument|Unknown column|column .* does not exist|relation .* does not exist|Invalid enum value|is not a valid enum|Value .* not found in enum/i.test(m)) return "schema";
  if (/P1001|P1000|P1017|Can't reach database|ECONNREFUSED|Connection refused|Authentication failed|timed out/i.test(m)) return "connection";
  return "unknown";
}

export const DB_ISSUE_HELP: Record<DbIssue, { title: string; body: string }> = {
  schema: {
    title: "DB 구조가 최신 코드와 맞지 않습니다",
    body: "개발 서버를 모두 끄고 프로젝트 폴더의 db-sync.bat 을 실행하면 Prisma Client 재생성과 DB 구조 반영 후 서버가 다시 켜집니다.",
  },
  connection: {
    title: "데이터베이스에 연결할 수 없습니다",
    body: "DB(Docker 컨테이너)가 꺼져 있습니다. 프로젝트 폴더의 db-start.bat 을 실행하면 Docker Desktop 과 DB 가 자동으로 켜집니다. 켜진 뒤 이 화면을 새로고침해 주세요.",
  },
  unknown: {
    title: "데이터를 불러오지 못했습니다",
    body: "잠시 후 다시 시도해 주세요. 계속되면 개발 서버를 끄고 db-sync.bat 을 실행해 DB 구조를 맞춰 보세요.",
  },
};

/** 서버 컴포넌트에서 데이터 로딩 실패 시: 로그를 남기고 원인을 돌려준다 */
export function reportDbError(where: string, error: unknown): DbIssue {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${where}] 데이터 로딩 실패:`, message.slice(0, 2000));
  return classifyDbError(message);
}
