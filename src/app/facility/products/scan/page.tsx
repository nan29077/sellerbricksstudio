"use client";

import { useState, useRef } from "react";
import {
  ScanBarcode, Camera, Search, ArrowDownToLine, ArrowUpFromLine,
  Share2, Check, Package, X, LayoutList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── 더미 데이터 ──────────────────────────────────────────────────────────────

type HistoryEntry = { date: string; type: "IN" | "OUT"; qty: number; note: string };
type Product = {
  id: string;
  name: string;
  barcode: string;
  category: string;
  stock: number;
  price: number;
  history: HistoryEntry[];
};

const PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "딸기잼 홈메이드",
    barcode: "8801234567890",
    category: "식품/잼류",
    stock: 45,
    price: 12000,
    history: [
      { date: "2026-07-01", type: "IN", qty: 50, note: "신규 입고" },
      { date: "2026-07-02", type: "OUT", qty: 5, note: "셀러 A 출고" },
    ],
  },
  {
    id: "p2",
    name: "유기농 사과 3kg",
    barcode: "8809876543210",
    category: "농산물/과일",
    stock: 120,
    price: 28000,
    history: [
      { date: "2026-06-28", type: "IN", qty: 150, note: "수확 입고" },
      { date: "2026-07-01", type: "OUT", qty: 30, note: "셀러 B 출고" },
    ],
  },
  {
    id: "p3",
    name: "제주 감귤 스무디",
    barcode: "8805432109876",
    category: "음료/가공",
    stock: 78,
    price: 8500,
    history: [
      { date: "2026-06-30", type: "IN", qty: 100, note: "제주 농협 입고" },
      { date: "2026-07-03", type: "OUT", qty: 22, note: "셀러 C 출고" },
    ],
  },
  {
    id: "p4",
    name: "블루베리 유기농 잼",
    barcode: "8807654321098",
    category: "식품/잼류",
    stock: 32,
    price: 15000,
    history: [
      { date: "2026-07-01", type: "IN", qty: 40, note: "신규 입고" },
      { date: "2026-07-04", type: "OUT", qty: 8, note: "셀러 A 출고" },
    ],
  },
  {
    id: "p5",
    name: "고창 복분자 착즙",
    barcode: "8802109876543",
    category: "음료/건강음료",
    stock: 56,
    price: 35000,
    history: [
      { date: "2026-06-25", type: "IN", qty: 80, note: "농장 직납" },
      { date: "2026-07-02", type: "OUT", qty: 24, note: "셀러 B 출고" },
    ],
  },
];

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function formatKRW(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export default function ProductScanPage() {
  const [tab, setTab] = useState<"scan" | "list">("scan");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [shared, setShared] = useState(false);
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function lookupBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    const found = PRODUCTS.find((p) => p.barcode === trimmed);
    if (found) {
      setScannedProduct(found);
      setNotFound(false);
    } else {
      setScannedProduct(null);
      setNotFound(true);
    }
    setShared(false);
  }

  function handleSearch() {
    lookupBarcode(barcodeInput);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSearch();
  }

  // 카메라 파일 선택 시 — 실제 파싱 없이 시뮬레이션
  function handleCameraFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // 시뮬레이션: 임의의 더미 바코드를 스캔한 것처럼 처리
    const randomProduct = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
    setBarcodeInput(randomProduct.barcode);
    setScannedProduct(randomProduct);
    setNotFound(false);
    setShared(false);
    e.target.value = "";
  }

  function handleShare() {
    setShared(true);
    setTimeout(() => setShared(false), 3000);
  }

  function clearResult() {
    setScannedProduct(null);
    setNotFound(false);
    setBarcodeInput("");
    setShared(false);
  }

  const filteredProducts = PRODUCTS.filter(
    (p) =>
      p.name.includes(search) ||
      p.barcode.includes(search) ||
      p.category.includes(search),
  );

  return (
    <div className="pb-24 md:pb-0">
      {/* 헤더 */}
      <div className="mb-6 flex items-center gap-3">
        <ScanBarcode className="h-6 w-6 text-brand-500" />
        <div>
          <h1 className="text-2xl font-bold text-navy">제품관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">바코드 스캔으로 제품 재고와 이력을 확인하세요.</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50 border border-border mb-6 w-fit">
        <button
          onClick={() => setTab("scan")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
            tab === "scan"
              ? "bg-white text-navy shadow-sm"
              : "text-muted-foreground hover:text-navy",
          )}
        >
          <ScanBarcode className="h-4 w-4" />
          바코드 스캔
        </button>
        <button
          onClick={() => setTab("list")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
            tab === "list"
              ? "bg-white text-navy shadow-sm"
              : "text-muted-foreground hover:text-navy",
          )}
        >
          <LayoutList className="h-4 w-4" />
          제품 목록
        </button>
      </div>

      {/* ── 바코드 스캔 탭 ────────────────────────────────────── */}
      {tab === "scan" && (
        <div className="space-y-4">
          {/* 스캔 입력 카드 */}
          <Card>
            <CardContent className="p-5 space-y-4">
              <p className="text-sm font-semibold text-navy">바코드 스캔 / 직접 입력</p>

              {/* 카메라 버튼 (모바일) */}
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/50 py-8 text-brand-600 hover:bg-brand-50 transition-colors"
              >
                <Camera className="h-8 w-8" />
                <span className="text-sm font-semibold">카메라로 바코드 스캔</span>
                <span className="text-xs text-muted-foreground">모바일에서 카메라를 열어 바코드를 인식합니다</span>
              </button>

              {/* 히든 파일 입력 */}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCameraFile}
              />

              {/* 직접 입력 */}
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="바코드 번호 직접 입력 (예: 8801234567890)"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                />
                <Button onClick={handleSearch} variant="outline" size="default">
                  <Search className="h-4 w-4 mr-1" />
                  검색
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                테스트용 바코드: 8801234567890 / 8809876543210 / 8805432109876
              </p>
            </CardContent>
          </Card>

          {/* 미검색 상태 */}
          {notFound && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 flex items-center justify-between">
                <p className="text-sm text-red-700 font-medium">바코드 <span className="font-bold">{barcodeInput}</span>에 해당하는 제품을 찾을 수 없습니다.</p>
                <button onClick={clearResult} className="text-muted-foreground hover:text-navy">
                  <X className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          )}

          {/* 스캔 결과 */}
          {scannedProduct && (
            <div className="space-y-4">
              {/* 제품 기본 정보 */}
              <Card className="border-brand-200">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center">
                        <Package className="h-6 w-6 text-brand-500" />
                      </div>
                      <div>
                        <p className="font-bold text-navy text-lg">{scannedProduct.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge tone="blue">{scannedProduct.category}</Badge>
                          <span className="text-xs text-muted-foreground font-mono">{scannedProduct.barcode}</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={clearResult} className="text-muted-foreground hover:text-navy p-1">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* 재고 / 가격 */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">현재 재고</p>
                      <p className={cn("text-xl font-bold", scannedProduct.stock === 0 ? "text-red-600" : "text-navy")}>
                        {scannedProduct.stock}개
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground mb-0.5">판매가</p>
                      <p className="text-xl font-bold text-navy">{formatKRW(scannedProduct.price)}</p>
                    </div>
                  </div>

                  {/* 셀러에게 공유 버튼 */}
                  <Button
                    className="w-full"
                    variant={shared ? "success" : "default"}
                    onClick={handleShare}
                    disabled={shared}
                  >
                    {shared ? (
                      <>
                        <Check className="h-4 w-4" />
                        공유 완료
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4" />
                        셀러에게 공유
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* 입출고 이력 */}
              <Card>
                <CardContent className="p-5">
                  <p className="text-sm font-semibold text-navy mb-3">입출고 이력</p>
                  <div className="space-y-2">
                    {scannedProduct.history.map((h, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                        <div className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                          h.type === "IN" ? "bg-emerald-50" : "bg-orange-50",
                        )}>
                          {h.type === "IN"
                            ? <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                            : <ArrowUpFromLine className="h-4 w-4 text-orange-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge tone={h.type === "IN" ? "green" : "yellow"} className="text-[10px]">
                              {h.type === "IN" ? "입고" : "출고"}
                            </Badge>
                            <span className="text-sm font-semibold text-navy">{h.qty}개</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{h.date}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── 제품 목록 탭 ─────────────────────────────────────── */}
      {tab === "list" && (
        <div className="space-y-4">
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="제품명, 바코드, 카테고리 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 필터 뱃지 */}
          <div className="flex flex-wrap gap-2">
            {["전체", "식품/잼류", "농산물/과일", "음료/가공", "음료/건강음료"].map((cat) => (
              <button
                key={cat}
                onClick={() => setSearch(cat === "전체" ? "" : cat)}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-full border font-medium transition-colors",
                  (cat === "전체" ? search === "" : search === cat)
                    ? "bg-brand-500 text-white border-brand-500"
                    : "bg-white text-muted-foreground border-border hover:border-brand-300",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* 제품 카드 목록 */}
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">검색 결과가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProducts.map((p) => (
                <Card key={p.id} className="hover:border-brand-200 transition-colors">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center shrink-0">
                      <Package className="h-6 w-6 text-brand-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-navy truncate">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge tone="blue">{p.category}</Badge>
                        <span className="text-xs text-muted-foreground font-mono">{p.barcode}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>재고 <span className={cn("font-semibold", p.stock === 0 ? "text-red-600" : "text-navy")}>{p.stock}개</span></span>
                        <span>판매가 <span className="font-semibold text-navy">{formatKRW(p.price)}</span></span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTab("scan");
                        setBarcodeInput(p.barcode);
                        setScannedProduct(p);
                        setNotFound(false);
                        setShared(false);
                      }}
                    >
                      <ScanBarcode className="h-3.5 w-3.5 mr-1" />
                      스캔
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
