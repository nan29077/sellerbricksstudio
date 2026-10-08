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

  // 시설 목록 로드 (본인 소유 시설만)
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="셀러 문의"
        description="셀러가 보낸 문의를 확인하고 답변하세요"
      />

      {/* 시설 탭 */}
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
      <div className="grid grid-cols-2 gap-3">
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

      {/* 문의 목록 */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중...</div>
      ) : inquiries.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-25" />
            <p className="text-sm font-semibold">아직 문의가 없습니다</p>
            <p className="text-xs mt-1">셀러가 시설 페이지에서 문의를 보내면 여기에 표시됩니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {inquiries.map((q) => {
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
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-brand-500 text-white rounded-full">
                                NEW
                              </span>
                            )}
                            {q.reply && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
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
                          <p className="text-[10px] text-muted-foreground mt-2">
                            {q.repliedAt ? timeAgo(q.repliedAt) : ""}
                          </p>
                        </div>
                      )}

                      {/* 답변 입력 */}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground">
                          {q.reply ? "답변 수정" : "답변 작성"}
                        </p>
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
