// CatenoidAdapter: 자체 송출 어댑터. API 키 없으면 Mock 송출 URL 생성.
import { SnsChannelType } from "@prisma/client";

export interface CreateStreamInput { sessionId: string; title: string; }
export interface StreamInfo {
  streamId: string; status: string; ingestUrl?: string; playbackUrl: string;
}

export interface CatenoidAdapter {
  readonly provider: string;
  createLiveStream(input: CreateStreamInput): Promise<StreamInfo>;
  getStreamInfo(streamId: string): Promise<StreamInfo>;
  endLiveStream(streamId: string): Promise<{ ok: boolean }>;
  getPlaybackUrl(streamId: string): Promise<string>;
  registerExternalDestination(streamId: string, type: SnsChannelType, url: string): Promise<{ ok: boolean; externalId: string }>;
}

export class MockCatenoidAdapter implements CatenoidAdapter {
  readonly provider = "mock";
  async createLiveStream(input: CreateStreamInput): Promise<StreamInfo> {
    const streamId = `mock-stream-${input.sessionId}`;
    return {
      streamId, status: "READY",
      ingestUrl: `rtmp://mock.catenoid.local/live/${streamId}`,
      playbackUrl: `https://mock.catenoid.local/play/${streamId}.m3u8`,
    };
  }
  async getStreamInfo(streamId: string): Promise<StreamInfo> {
    return { streamId, status: "LIVE", playbackUrl: `https://mock.catenoid.local/play/${streamId}.m3u8` };
  }
  async endLiveStream(): Promise<{ ok: boolean }> { return { ok: true }; }
  async getPlaybackUrl(streamId: string): Promise<string> {
    return `https://mock.catenoid.local/play/${streamId}.m3u8`;
  }
  async registerExternalDestination(streamId: string, type: SnsChannelType): Promise<{ ok: boolean; externalId: string }> {
    return { ok: true, externalId: `mock-${type}-${streamId}` };
  }
}

// export class RealCatenoidAdapter implements CatenoidAdapter { ... } // TODO

export function getCatenoidAdapter(): CatenoidAdapter {
  const hasKeys = process.env.CATENOID_API_BASE && process.env.CATENOID_API_KEY;
  if (!hasKeys) return new MockCatenoidAdapter();
  // return new RealCatenoidAdapter();
  return new MockCatenoidAdapter();
}
