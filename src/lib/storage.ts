import { createHash, createHmac, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// 이미지 저장소
//  - S3 호환 저장소(AWS S3 · Cloudflare R2 · NCP Object Storage)가 설정되어 있으면 서버가 서명(SigV4)해서 올린다.
//    S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (+ 선택: S3_ENDPOINT, S3_PUBLIC_URL)
//  - 설정이 없으면 개발 환경에서만 public/uploads 에 저장한다. (배포 환경에서는 업로드 거절)
// ---------------------------------------------------------------------------
export function s3Configured() {
  return !!(process.env.S3_BUCKET && process.env.S3_REGION && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();

async function putS3(key: string, body: Buffer, contentType: string) {
  const bucket = process.env.S3_BUCKET!;
  const region = process.env.S3_REGION!;
  const endpoint = (process.env.S3_ENDPOINT || `https://s3.${region}.amazonaws.com`).replace(/\/$/, "");
  const url = new URL(`${endpoint}/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const day = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const headers: Record<string, string> = {
    host: url.host, "content-type": contentType, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate,
    "cache-control": "public, max-age=31536000, immutable",
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonical = ["PUT", url.pathname, "", ...Object.keys(headers).sort().map((k) => `${k}:${headers[k]}`), "", signedHeaders, payloadHash].join("\n");
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${process.env.S3_SECRET_ACCESS_KEY}`, day), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(toSign).digest("hex");
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...headers, Authorization: `AWS4-HMAC-SHA256 Credential=${process.env.S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` },
    body: new Uint8Array(body),
  });
  if (!res.ok) throw new Error(`저장소 업로드 실패 (HTTP ${res.status})`);
  const publicBase = (process.env.S3_PUBLIC_URL || `${endpoint}/${bucket}`).replace(/\/$/, "");
  return `${publicBase}/${key}`;
}

export const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// 파일 앞부분(매직 넘버)으로 실제 이미지인지 확인한다. (확장자·Content-Type 만 믿지 않음)
export function sniffImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  return null;
}

export async function saveImage(buf: Buffer, contentType: string, folder: string) {
  const ext = IMAGE_TYPES[contentType];
  const month = new Date().toISOString().slice(0, 7).replace("-", "");
  const key = `uploads/${folder}/${month}/${randomUUID()}.${ext}`;
  if (s3Configured()) return putS3(key, buf, contentType);
  if (process.env.NODE_ENV === "production") throw new Error("파일 저장소(S3)가 설정되지 않아 업로드할 수 없습니다. 이미지 주소를 직접 입력해 주세요.");
  const target = path.join(process.cwd(), "public", key);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, buf);
  return `/${key}`;
}
