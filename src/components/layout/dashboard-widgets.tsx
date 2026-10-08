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
    <div className="rounded-[22px] border border-[#E9E5DC] bg-white p-6 shadow-sm">
      {Icon && <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span>}
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-navy">{value}</p>
      {sub && <p className="mt-2 text-xs text-slate-500">{sub}</p>}
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
    <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}
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
    <div className={`overflow-x-auto rounded-[22px] border border-[#E9E5DC] bg-white shadow-sm ${className ?? ""}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#EEEAE2] bg-[#F9F7F2]">
            {headers.map((h) => (
              <th key={h} className="px-5 py-4 text-left text-xs font-bold text-slate-500 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows
            ? rows.map((row, ri) => (
                <tr key={ri} className="border-b border-[#F0ECE6] last:border-0 hover:bg-brand-50/50 transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-5 py-4 text-sm text-navy align-middle">{cell}</td>
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
    <td className={`px-5 py-4 text-sm text-navy align-middle ${className ?? ""}`}>{children}</td>
  );
}
