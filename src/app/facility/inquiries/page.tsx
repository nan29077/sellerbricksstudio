"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/layout/dashboard-widgets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, CheckCircle2, Clock, Send,
  ChevronDown, ChevronUp, Building2,
} from "lucide-react";

function timeAgo(date: string) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

export default function FacilityInquiriesPage() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [tab, setTab] = useState<"ALL" | "UNANSWERED" | "ANSWERED" | "UNREAD">("ALL");
  const [search, setSearch] = useState("");

  // 창고(스튜디오) 목록 로드 (본인 소유 창고(스튜디오)만)
  useEffect(() => {
    fetch("/api/facility/facilities")
      .then((r) => r.json())
      .then((data) => {
        setFacilities(data.facilities ?? []);
        if (data.facilities?.length > 0) {
          setSelectedFacilityId(data.facilities[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const loadInquiries = useCallback(async (facilityId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/facilities/${facilityId}/inquiries`);
      const data = await res.json();
      setInquiries(data.inquiries ?? []);
    } catch {
      setInquiries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedFacilityId) loadInquiries(selectedFacilityId);
  }, [selectedFacilityId, loadInquiries]);

  async function markRead(iqId: string) {
    if (!selectedFacilityId) return;
    await fetch(`/api/facilities/${selectedFacilityId}/inquiries/${iqId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead: true }),
    });
    setInquiries((prev) =>
      prev.map((q) => (q.id === iqId ? { ...q, isRead: true } : q)),
    );
  }

  async function sendReply(iqId: string) {
    if (!selectedFacilityId) return;
    const reply = replyText[iqId]?.trim();
    if (!reply) return;
    setSending(iqId);
    try {
      const res = await fetch(`/api/facilities/${selectedFacilityId}/inquiries/${iqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply, isRead: true }),
      });
      const data = await res.json();
      setInquiries((prev) =>
        prev.map((q) => (q.id === iqId ? { ...q, ...data.inquiry } : q)),
      );
      setReplyText((prev) => ({ ...prev, [iqId]: "" }));
    } finally {
      setSending(null);
    }
  }

  const unreadCount = inquiries.filter((q) => !q.isRead).length;
  const unansweredCount = inquiries.filter((q) => !q.reply).length;
  const kw = search.trim().toLowerCase();
  const visible = inquiries.filter((q) =>
    (tab === "ALL" || (tab === "UNANSWERED" && !q.reply) || (tab === "ANSWERED" && q.reply) || (tab === "UNREAD" && !q.isRead)) &&
    (!kw || `${q.message} ${q.seller?.profile?.name ?? ""} ${q.seller?.email ?? ""}`.toLowerCase().includes(kw)));
  // 평균 응답 시간 (답변 완료 건)
  const answered = inquiries.filter((q) => q.reply && q.repliedAt);
  const avgHours = answered.length ? Math.round(answered.reduce((s, q) => s + (new Date(q.repliedAt).getTime() - new Date(q.createdAt).getTime()) / 3600000, 0) / answered.length * 10) / 10 : null;
  const REPLY_TEMPLATES = [
    "문의 감사합니다. 요청하신 날짜는 예약 가능합니다. 예약 신청해 주시면 바로 확인하겠습니다.",
    "문의 감사합니다. 해당 장비는 기본 제공되며 추가 비용은 없습니다.",
    "아쉽게도 해당 일정은 이미 예약이 차 있습니다. 다른 날짜를 알려주시면 확인해 드리겠습니다.",
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="셀러 문의"
        description="셀러가 보낸 문의를 확인하고 답변하세요"
      />

      {/* 창고(스튜디오) 탭 */}
      {facilities.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {facilities.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFacilityId(f.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                selectedFacilityId === f.id
                  ? "bg-brand-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">답변 대기</p><p className="text-2xl font-extrabold text-red-600">{unansweredCount}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4"><p className="text-xs text-muted-foreground">평균 응답 시간</p><p className="text-2xl font-extrabold text-navy">{avgHours === null ? "-" : `${avgHours}시간`}</p></CardContent></Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">미읽음</p>
              <p className="text-2xl font-extrabold text-navy">{unreadCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 shrink-0">
              <MessageSquare className="h-5 w-5 text-brand-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">전체 문의</p>
              <p className="text-2xl font-extrabold text-navy">{inquiries.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 필터 */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex gap-1.5 overflow-x-auto">
          {([["ALL", "전체", inquiries.length], ["UNANSWERED", "답변 대기", unansweredCount], ["UNREAD", "미읽음", unreadCount], ["ANSWERED", "답변 완료", inquiries.length - unansweredCount]] as const).map(([k, l, n]) => (
            <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${tab === k ? "border-navy bg-navy text-white" : "border-[#E5E0D6] bg-white text-slate-600"}`}>{l} <span className="text-[11px] opacity-70">{n}</span></button>
          ))}
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="셀러명 · 내용 검색" className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:max-w-xs sm:ml-auto" />
      </div>

      {/* 문의 목록 */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중...</div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-25" />
            <p className="text-sm font-semibold">아직 문의가 없습니다</p>
            <p className="text-xs mt-1">셀러가 창고(스튜디오) 페이지에서 문의를 보내면 여기에 표시됩니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((q) => {
            const isExpanded = expanded === q.id;
            const sellerName = q.seller?.profile?.name ?? q.seller?.email ?? "셀러";
            return (
              <Card
                key={q.id}
                className={`transition ${!q.isRead ? "border-brand-300 bg-brand-50/30" : ""}`}
              >
                <CardContent className="pt-4 pb-4">
                  <button
                    className="w-full text-left"
                    onClick={() => {
                      setExpanded(isExpanded ? null : q.id);
                      if (!q.isRead) markRead(q.id);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-brand-700">
                            {sellerName.slice(0, 1)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-navy">{sellerName}</span>
                            {!q.isRead && (
                              <span className="text-[11px] font-bold px-1.5 py-0.5 bg-brand-500 text-white rounded-full">
                                NEW
                              </span>
                            )}
                            {q.reply && (
                              <span className="text-[11px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                                답변완료
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {timeAgo(q.createdAt)}
                          </p>
                          {!isExpanded && (
                            <p className="text-sm text-slate-600 mt-1 line-clamp-1">{q.message}</p>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-4 space-y-4">
                      {/* 문의 내용 */}
                      <div className="rounded-xl bg-muted/50 p-4">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">셀러 문의</p>
                        <p className="text-sm text-navy leading-relaxed">{q.message}</p>
                      </div>

                      {/* 기존 답변 */}
                      {q.reply && (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                          <p className="text-xs font-semibold text-emerald-700 mb-2">내 답변</p>
                          <p className="text-sm text-navy leading-relaxed">{q.reply}</p>
                          <p className="text-[11px] text-muted-foreground mt-2">
                            {q.repliedAt ? timeAgo(q.repliedAt) : ""}
                          </p>
                        </div>
                      )}

                      {/* 답변 입력 */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {q.reply ? "답변 수정" : "답변 작성"}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {REPLY_TEMPLATES.map((t) => (
                            <button key={t} type="button" onClick={() => setReplyText((prev) => ({ ...prev, [q.id]: t }))}
                              className="rounded-full border border-border px-2 py-0.5 text-[11px] text-slate-600 hover:border-brand-300">{t.slice(0, 20)}…</button>
                          ))}
                        </div>
                        <textarea
                          value={replyText[q.id] ?? q.reply ?? ""}
                          onChange={(e) =>
                            setReplyText((prev) => ({ ...prev, [q.id]: e.target.value }))
                          }
                          rows={3}
                          placeholder="셀러에게 답변을 남겨주세요..."
                          className="w-full rounded-xl border border-border bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
                        />
                        <Button
                          size="sm"
                          onClick={() => sendReply(q.id)}
                          disabled={sending === q.id || !replyText[q.id]?.trim()}
                          className="gap-1.5"
                        >
                          <Send className="h-3.5 w-3.5" />
                          {sending === q.id ? "전송 중..." : q.reply ? "답변 수정" : "답변 보내기"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
