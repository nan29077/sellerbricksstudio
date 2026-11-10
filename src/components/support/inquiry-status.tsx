import { CheckCircle2, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function InquiryStatus({ answered }: { answered: boolean }) {
  const Icon = answered ? CheckCircle2 : Clock3;
  return (
    <span className={cn("inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", answered ? "bg-emerald-100 text-emerald-800" : "bg-brand-100 text-brand-800")}>
      <Icon className="h-3.5 w-3.5" />{answered ? "답변 완료" : "답변 대기"}
    </span>
  );
}
