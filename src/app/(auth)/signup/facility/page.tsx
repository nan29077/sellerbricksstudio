import { redirect } from "next/navigation";

// 창고(스튜디오) 가입은 없어졌다 — 창고는 스토리지마켓 본사가 직접 운영한다 (2026-11-14)
export default function Page() { redirect("/signup"); }
