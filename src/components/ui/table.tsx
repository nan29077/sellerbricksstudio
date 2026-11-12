import { Children, Fragment, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// 표의 각 칸에 머리글을 data-label 로 붙인다. 모바일(767px 이하)에서는 globals.css 의 .rtable 규칙으로
// 줄 하나가 카드 한 장(머리글 | 값)으로 바뀌어 좌우로 밀지 않아도 된다.
type AnyEl = ReactElement<any>;

function labelRows(children: ReactNode, headers: string[]): ReactNode {
  return Children.map(children, (row) => {
    if (!isValidElement(row)) return row;
    const el = row as AnyEl;
    if (el.type === Fragment) return labelRows(el.props.children, headers);
    if (el.type !== "tr") return row;
    let i = 0;
    const cells = Children.map(el.props.children, (cell) => {
      if (!isValidElement(cell)) return cell;
      const label = headers[i] ?? "";
      i += 1;
      return cloneElement(cell as AnyEl, { "data-label": label });
    });
    return cloneElement(el, {}, cells);
  });
}

export function Table({
  headers, children, rows, className, mobile = "cards",
}: {
  headers: string[];
  children?: React.ReactNode;
  rows?: React.ReactNode[][];
  className?: string;
  /** cards: 모바일에서 줄마다 카드로 (기본) · scroll: 모바일에서도 표 그대로 좌우 스크롤 */
  mobile?: "cards" | "scroll";
}) {
  const cards = mobile === "cards";
  return (
    <div className={cn("min-w-0 max-w-full overflow-x-auto rounded-xl border border-border bg-white", cards && "rtable-wrap", className)}>
      <table className={cn("w-full text-sm", cards && "rtable")}>
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h, i) => (
              <th key={`${i}-${h}`} className="px-4 py-3 text-left font-semibold text-navy whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows
            ? rows.map((row, ri) => (
                <tr key={ri} className="hover:bg-muted/30 transition-colors">
                  {row.map((cell, ci) => (
                    <td key={ci} data-label={headers[ci] ?? ""} className="px-4 py-3 whitespace-nowrap text-sm text-navy">{cell}</td>
                  ))}
                </tr>
              ))
            : cards ? labelRows(children, headers) : children}
        </tbody>
      </table>
    </div>
  );
}

export function Td({ children, className, ...rest }: { children?: React.ReactNode; className?: string } & React.TdHTMLAttributes<HTMLTableCellElement> & { "data-label"?: string }) {
  return <td {...rest} className={cn("px-4 py-3 whitespace-nowrap", className)}>{children}</td>;
}
