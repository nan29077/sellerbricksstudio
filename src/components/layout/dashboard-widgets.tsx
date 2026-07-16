import type { LucideIcon } from "lucide-react";

/**
 * Server-safe widgets — no "use client". These can receive LucideIcon/ElementType
 * props directly from Server Components without crossing the serialization boundary.
 */

export function StatCard({
  label, value, sub, icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon | React.ElementType;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      {Icon && <Icon className="h-5 w-5 text-brand-500 mb-2" />}
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function PageHeader({
  title, description, action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-navy">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Table({
  headers, children, rows, className,
}: {
  headers: string[];
  children?: React.ReactNode;
  rows?: React.ReactNode[][];
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-border bg-white ${className ?? ""}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows
            ? rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-3 text-sm text-navy align-middle">{cell}</td>
                  ))}
                </tr>
              ))
            : children}
        </tbody>
      </table>
    </div>
  );
}

export function Td({
  children, className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-sm text-navy align-middle ${className ?? ""}`}>{children}</td>
  );
}
