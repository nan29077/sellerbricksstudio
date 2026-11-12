import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SHOWCASE_SPACES, SPACE_TYPE_LABELS } from "@/lib/showcase";

export default function ShowcaseDetail({ params }: { params: { id: string } }) {
  const space = SHOWCASE_SPACES.find((item) => item.id === params.id);
  if (!space) notFound();

  return (
    <article className="px-4 pb-12 pt-4 sm:px-6">
      <Link href="/#spaces" className={buttonVariants({ variant: "outline", className: "mb-3 rounded-xl px-3" })}><ArrowLeft aria-hidden="true" className="h-4 w-4" />공간 목록</Link>
      <div className="relative aspect-[4/3] overflow-hidden rounded-[24px] bg-navy sm:aspect-[16/10]">
        <Image src={space.image} alt={space.name + " 연출 이미지"} fill priority unoptimized className="object-cover" />
        <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-navy">예시 공간 · 생성형 이미지</span>
      </div>
      <p className="mt-6 flex items-center gap-1.5 text-sm font-bold text-brand-700"><MapPin className="h-4 w-4" />{space.location} · {SPACE_TYPE_LABELS[space.type]}</p>
      <h1 className="mt-2 break-keep text-3xl font-black tracking-tight text-navy">{space.name}</h1>
      <p className="mt-3 break-keep text-sm leading-7 text-slate-700">{space.description}</p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {space.tags.map((tag) => <li key={tag} className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-navy">{tag}</li>)}
      </ul>
      <div className="mt-7 rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm">
        <p className="flex items-center gap-2 text-sm font-bold text-slate-600">예시 이용료 <strong className="rounded-md bg-emerald-50 px-2 py-1 text-sm font-extrabold text-emerald-800">무료</strong></p>
        <p className="mt-3 break-keep text-sm leading-6 text-slate-600">공간 구성을 보여주는 가상의 공간입니다. 예약 가능한 공간은 등록 공간 목록에서 확인할 수 있습니다.</p>
        <Link href={"/facilities?type=" + space.type} className={buttonVariants({ variant: "secondary", className: "mt-4 w-full rounded-xl sm:w-auto" })}>등록된 {SPACE_TYPE_LABELS[space.type]} 보기</Link>
      </div>
    </article>
  );
}
