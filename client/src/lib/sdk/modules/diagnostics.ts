import { sdkReq } from './core';

export interface HealthResponse {
  ok: boolean;
  service: string;
  timestamp: number;
}

export interface StatusResponse {
  ok: boolean;
  version: string;
  uptime: number;
  uptimeFormatted: string;
  timestamp: number;
  modules: {
    crypto: boolean;
    session: boolean;
    anchor: boolean;
    identity: boolean;
    zk: boolean;
    media: boolean;
    explorer: boolean;
  };
}

export interface MetricsResponse {
  ok: boolean;
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    uptime: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  timestamp: number;
}

export interface PingResponse {
  ok: boolean;
  latency: number;
  timestamp: number;
}

export async function health(): Promise<HealthResponse> {
  return sdkReq<HealthResponse>('/api/sdk/diagnostics/health');
}

export async function status(): Promise<StatusResponse> {
  return sdkReq<StatusResponse>('/api/sdk/diagnostics/status');
}

export async function metrics(): Promise<MetricsResponse> {
  return sdkReq<MetricsResponse>('/api/sdk/diagnostics/metrics');
}

export async function ping(): Promise<PingResponse> {
  return sdkReq<PingResponse>('/api/sdk/diagnostics/ping');
}
