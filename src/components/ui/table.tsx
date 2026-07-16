import { cn } from "@/lib/utils";

export function Table({
  headers, children, rows, className,
}: {
  headers: string[];
  children?: React.ReactNode;
  rows?: React.ReactNode[][];
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-white", className)}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left font-semibold text-navy whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows
            ? rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-muted/30 transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-3 whitespace-nowrap text-sm text-navy">{cell}</td>
                  ))}
                </tr>
              ))
            : children}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 whitespace-nowrap", className)}>{children}</td>;
}
