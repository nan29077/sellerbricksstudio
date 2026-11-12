// 방송 영상 표시 도우미
//  - 셀러가 입력한 유튜브 방송 주소에서 영상 ID 를 뽑아 구매자 화면에 끼워 넣는다.
//  - 인스타그램 · 틱톡 등은 끼워 넣을 수 없어 '앱에서 보기' 버튼으로 연다.
//  스토리지마켓은 직접 송출하지 않는다. 방송은 셀러의 외부 채널에서 하고, 여기서는 연결만 한다.

export const CHANNEL_LABEL: Record<string, string> = {
  YOUTUBE: "유튜브", INSTAGRAM: "인스타그램", TIKTOK: "틱톡", ETC: "기타 채널",
};

/** http(s) 주소만 받는다. 아니면 null */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch { return null; }
}

/** 유튜브 주소(watch · youtu.be · live · embed · shorts)에서 영상 ID 를 꺼낸다. */
export function youtubeId(raw: string | null | undefined): string | null {
  const url = safeHttpUrl(raw);
  if (!url) return null;
  const u = new URL(url);
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const ok = (id: string | null | undefined) => (id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null);
  if (host === "youtu.be") return ok(u.pathname.split("/")[1]);
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") return ok(u.searchParams.get("v"));
    const m = u.pathname.match(/^\/(live|embed|shorts)\/([^/?#]+)/);
    if (m) return ok(m[2]);
  }
  return null;
}

/** 이 주소가 해당 채널의 주소처럼 보이는지 (오입력 방지용, 기타 채널은 통과) */
export function looksLikeChannel(type: string, url: string) {
  const host = (() => { try { return new URL(url).hostname.replace(/^www\.|^m\./, ""); } catch { return ""; } })();
  if (type === "YOUTUBE") return host === "youtube.com" || host === "youtu.be";
  if (type === "INSTAGRAM") return host === "instagram.com";
  if (type === "TIKTOK") return host === "tiktok.com" || host.endsWith(".tiktok.com");
  return true;
}
