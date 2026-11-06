import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { StatusTabs } from "@/components/list/status-tabs";
import { FilterBar } from "@/components/list/filter-bar";
import { ResourceForm, DeleteButton, PatchButton, type Field } from "@/components/resource-form";
import { CopyText } from "@/components/copy-text";
import { ASSET_TYPES } from "@/lib/marketing-labels";
import { formatDate } from "@/lib/utils";
import { sp, type SP } from "@/lib/list";
import { ImageIcon, Film, Type, Link2, Star, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";
const API = "/api/seller/marketing/assets";
const ICON: Record<string, React.ElementType> = { IMAGE: ImageIcon, VIDEO: Film, COPY: Type, LINK: Link2 };

const fields: Field[] = [
  { name: "title", label: "소재명", required: true, placeholder: "예: 겨울 패딩 라이브 썸네일 A안" },
  { name: "type", label: "유형", type: "select", half: true, options: Object.entries(ASSET_TYPES).map(([value, label]) => ({ value, label })) },
  { name: "channel", label: "사용 채널", half: true, placeholder: "인스타그램 피드 등" },
  { name: "url", label: "파일 · 링크 주소", type: "url", placeholder: "https:// (이미지·영상은 클라우드 공유 링크)" },
  { name: "content", label: "광고 문구 · 설명", type: "textarea", placeholder: "카피, 해시태그, 메모" },
  { name: "tags", label: "태그", placeholder: "콤마로 구분: 겨울, 패딩, 특가" },
  { name: "isFavorite", label: "즐겨찾기", type: "checkbox" },
];

export default async function SellerAssets({ searchParams }: { searchParams: SP }) {
  const user = await requireRole(["SELLER"]);
  const type = sp(searchParams, "type");
  const q = sp(searchParams, "q");
  const fav = sp(searchParams, "fav") === "1";
  const where: Prisma.MarketingAssetWhereInput = {
    sellerId: user.id, ...(type && { type }), ...(fav && { isFavorite: true }),
    ...(q && { OR: [{ title: { contains: q, mode: "insensitive" } }, { tags: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }] }),
  };
  const [rows, grouped] = await Promise.all([
    prisma.marketingAsset.findMany({ where, orderBy: [{ isFavorite: "desc" }, { updatedAt: "desc" }], take: 200 }),
    prisma.marketingAsset.groupBy({ by: ["type"], where: { sellerId: user.id }, _count: true }),
  ]);
  const counts = Object.fromEntries(grouped.map((g) => [g.type, g._count]));
  const total = grouped.reduce((s, g) => s + g._count, 0);

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      <PageHeader title="광고 소재" description="썸네일·숏폼·광고 문구·랜딩 링크를 한 곳에 모아두고 바로 복사해 쓰세요."
        action={<ResourceForm url={API} fields={fields} title="소재 추가" initial={{ type: "IMAGE" }} />} />
      <StatusTabs base="/seller/marketing/assets" params={searchParams} paramKey="type" tabs={[
        { value: "", label: "전체", count: total },
        ...Object.entries(ASSET_TYPES).map(([value, label]) => ({ value, label, count: counts[value] ?? 0 })),
      ]} />
      <FilterBar fields={[
        { type: "search", key: "q", placeholder: "소재명 · 태그 · 문구 검색" },
        { type: "select", key: "fav", label: "즐겨찾기", options: [{ value: "1", label: "즐겨찾기만" }] },
      ]} />
      {rows.length === 0 ? <EmptyState icon={<ImageIcon className="h-10 w-10" />} title="소재가 없습니다" description="자주 쓰는 썸네일·문구를 등록해 두면 방송 준비가 빨라집니다." /> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((a) => {
            const Icon = ICON[a.type] ?? ImageIcon;
            const isImg = a.type === "IMAGE" && a.url && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(a.url);
            return (
              <Card key={a.id} className="flex flex-col overflow-hidden">
                <div className="flex h-36 items-center justify-center bg-gradient-to-br from-slate-100 to-brand-50">
                  {isImg ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={a.url!} alt={a.title} className="h-full w-full object-cover" /> : <Icon className="h-10 w-10 text-slate-400" />}
                </div>
                <CardContent className="flex flex-1 flex-col gap-2 pt-4">
                  <div className="flex items-center gap-2"><Badge tone="gray">{ASSET_TYPES[a.type] ?? a.type}</Badge>{a.channel && <span className="truncate text-[11px] text-muted-foreground">{a.channel}</span>}
                    <PatchButton url={`${API}/${a.id}`} body={{ isFavorite: !a.isFavorite }} variant="ghost" className="ml-auto h-8 px-2" aria-label="즐겨찾기">
                      <Star className={`h-4 w-4 ${a.isFavorite ? "fill-brand-500 text-brand-500" : "text-slate-300"}`} />
                    </PatchButton>
                  </div>
                  <p className="font-bold text-navy">{a.title}</p>
                  {a.content && <p className="line-clamp-4 whitespace-pre-line text-xs text-slate-600">{a.content}</p>}
                  {a.tags && <div className="flex flex-wrap gap-1">{a.tags.split(",").map((t) => t.trim()).filter(Boolean).map((t) => <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-slate-600">#{t}</span>)}</div>}
                  <div className="mt-auto flex flex-wrap items-center gap-1 pt-2">
                    {a.content && <CopyText text={a.content} label="문구 복사" />}
                    {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-navy hover:bg-muted"><ExternalLink className="h-3.5 w-3.5" />열기</a>}
                    <span className="ml-auto text-[10px] text-muted-foreground">{formatDate(a.updatedAt)}</span>
                    <ResourceForm url={API} id={a.id} fields={fields} title="소재 수정" iconOnly triggerVariant="ghost" initial={a} />
                    <DeleteButton url={`${API}/${a.id}`} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
