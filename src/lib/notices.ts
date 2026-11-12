import { prisma } from "./prisma";
import { reportDbError } from "./db-error";

export type NoticeView = { id: string; title: string; body: string; link: string; pinned: boolean; createdAt: string };

/** 공개된 공지 (고정 공지 먼저, 최신순) */
export async function getPublishedNotices(take = 50): Promise<NoticeView[] | null> {
  try {
    const rows = await prisma.siteNotice.findMany({
      where: { isPublished: true }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take,
      select: { id: true, title: true, body: true, link: true, pinned: true, createdAt: true },
    });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  } catch (error) {
    reportDbError("notices", error);
    return null;
  }
}
