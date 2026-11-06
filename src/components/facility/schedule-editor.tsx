"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const W = ["일", "월", "화", "수", "목", "금", "토"];
type Slot = { id: string; weekday: number; startTime: string; endTime: string; isActive: boolean };

export function SlotEditor({ facilityId, slots, openTime, closeTime }: { facilityId: string; slots: Slot[]; openTime: string; closeTime: string }) {
  const router = useRouter();
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState(openTime);
  const [end, setEnd] = useState(closeTime);
  const [busy, setBusy] = useState(false);

  async function add(replace = false) {
    setBusy(true);
    try {
      const r = await api<{ created: number; skipped: number }>("/api/facility/slots", "POST", { facilityId, weekdays: days, startTime: start, endTime: end, replace });
      if (r.skipped) alert(`${r.created}개 추가, 겹치는 ${r.skipped}개 요일은 건너뛰었습니다.`);
      router.refresh();
    } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  }
  async function call(url: string, method: string, body?: object) {
    try { await api(url, method, body); router.refresh(); } catch (e) { alert((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-7 gap-1.5">
        {W.map((w, d) => {
          const list = slots.filter((s) => s.weekday === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
          return (
            <div key={d} className="min-h-[110px] rounded-xl border border-border bg-white p-1.5">
              <p className={cn("mb-1 text-center text-xs font-bold", d === 0 ? "text-red-500" : d === 6 ? "text-blue-600" : "text-navy")}>{w}</p>
              {list.length === 0 ? <p className="text-center text-[10px] text-slate-400">휴무</p> : list.map((s) => (
                <div key={s.id} className={cn("group mb-1 rounded-md px-1 py-1 text-center text-[10px] font-semibold", s.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-400 line-through")}>
                  {s.startTime}<br />~{s.endTime}
                  <div className="mt-0.5 flex justify-center gap-1">
                    <button onClick={() => call("/api/facility/slots", "PATCH", { id: s.id, isActive: !s.isActive })} className="rounded bg-white/80 px-1 text-[9px] text-slate-600">{s.isActive ? "끄기" : "켜기"}</button>
                    <button onClick={() => confirm("이 시간대를 삭제할까요?") && call(`/api/facility/slots?id=${s.id}`, "DELETE")} className="rounded bg-white/80 px-1 text-red-500"><Trash2 className="h-2.5 w-2.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/40 p-3">
        <p className="mb-2 text-xs font-bold text-navy">운영 시간대 추가</p>
        <div className="mb-2 flex flex-wrap gap-1">
          {W.map((w, d) => (
            <button key={d} type="button" onClick={() => setDays((s) => s.includes(d) ? s.filter((x) => x !== d) : [...s, d])}
              className={cn("h-8 w-8 rounded-full border text-xs font-bold", days.includes(d) ? "border-navy bg-navy text-white" : "border-border bg-white text-slate-600")}>{w}</button>
          ))}
          <button type="button" onClick={() => setDays([1, 2, 3, 4, 5])} className="rounded-full border border-border bg-white px-2 text-[11px]">평일</button>
          <button type="button" onClick={() => setDays([0, 6])} className="rounded-full border border-border bg-white px-2 text-[11px]">주말</button>
          <button type="button" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])} className="rounded-full border border-border bg-white px-2 text-[11px]">매일</button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div><Label className="text-xs">시작</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="h-9 w-28" /></div>
          <div><Label className="text-xs">종료</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9 w-28" /></div>
          <Button size="sm" disabled={busy || !days.length} onClick={() => add(false)}><Plus className="h-4 w-4" />추가</Button>
          <Button size="sm" variant="outline" disabled={busy || !days.length} onClick={() => confirm("선택한 요일의 기존 시간대를 지우고 이 시간대로 바꿀까요?") && add(true)}>선택 요일 교체</Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">시간대를 하나도 등록하지 않으면 운영 시간 안에서 자유롭게 예약됩니다. 등록하면 해당 시간대 안에서만 예약을 받습니다.</p>
      </div>
    </div>
  );
}

export function BlackoutEditor({ facilityId, items }: { facilityId: string; items: { id: string; date: string; reason: string | null }[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    try {
      const r = await api<{ created: number; conflicts: number }>("/api/facility/blackouts", "POST", { facilityId, date, endDate: endDate || undefined, reason });
      if (r.conflicts) alert(`휴무일 ${r.created}일 등록. 해당 기간에 진행 예정 예약이 ${r.conflicts}건 있습니다. 예약 관리에서 확인해 주세요.`);
      setDate(""); setEndDate(""); setReason(""); router.refresh();
    } catch (e) { alert((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div><Label className="text-xs">시작일</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" /></div>
        <div><Label className="text-xs">종료일(선택)</Label><Input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} className="h-9" /></div>
        <div className="min-w-[140px] flex-1"><Label className="text-xs">사유</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="정기 점검, 명절 등" className="h-9" /></div>
        <Button size="sm" disabled={busy || !date} onClick={add}><CalendarOff className="h-4 w-4" />휴무 등록</Button>
      </div>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">예정된 휴무일이 없습니다.</p> : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((b) => (
            <span key={b.id} className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-700">
              {b.date}{b.reason && ` · ${b.reason}`}
              <button onClick={async () => { try { await api(`/api/facility/blackouts?id=${b.id}`, "DELETE"); router.refresh(); } catch (e) { alert((e as Error).message); } }} aria-label="삭제"><Trash2 className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
