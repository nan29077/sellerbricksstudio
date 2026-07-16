import { cn } from "@/lib/utils";

export function EmptyState({ title, description, icon, action, className }:
  { title: string; description?: string; icon?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 py-16 px-6 text-center", className)}>
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <p className="text-base font-semibold text-navy">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ label = "불러오는 중..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label}
    </div>
  );
}
