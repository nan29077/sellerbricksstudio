// 대시보드 페이지가 데이터를 불러오는 동안 보여주는 자리 표시 화면
export default function Loading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="불러오는 중">
      <div className="h-8 w-48 rounded-lg bg-slate-200" />
      <div className="h-4 w-72 rounded bg-slate-200/70" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-white shadow-sm" />)}
      </div>
      <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-slate-100" />)}
      </div>
    </div>
  );
}
