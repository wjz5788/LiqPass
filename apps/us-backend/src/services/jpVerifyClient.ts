import axios from 'axios';

export interface VerifyRequest {
  exchange: string;
  ordId: string;
  instId: string;
  live?: boolean;
  fresh?: boolean;
  noCache?: boolean;
  keyMode?: 'inline' | 'alias';
  apiKey?: string;
  secretKey?: string;
  passphrase?: string;
  uid?: string;
  keyAlias?: string;
  clientMeta?: { source: string; requestId: string };
}

function normalizeInstId(input: string): string {
  const raw = String(input || '').trim();
  if (!raw) return raw;
  const low = raw.toLowerCase().replace(/\s+/g, '');
  if (low === 'btuusdc') return 'BTC-USDC-SWAP';
  if (raw.includes('-')) {
    const parts = raw.split('-').map(p => p.trim().toUpperCase()).filter(Boolean);
    if (parts.length === 2) return `${parts[0]}-${parts[1]}-SWAP`;
    if (parts.length >= 3) return `${parts[0]}-${parts[1]}-${parts[2]}`;
  }
  if (low.endsWith('usdt')) {
    const base = low.slice(0, low.length - 4).toUpperCase();
    return `${base}-USDT-SWAP`;
  }
  if (low.endsWith('usdc')) {
    const base = low.slice(0, low.length - 4).toUpperCase();
    return `${base}-USDC-SWAP`;
  }
  return raw.toUpperCase();
}

function baseUrl(): string {
  return process.env.JP_VERIFY_BASE_URL || process.env.JP_VERIFY_BASE || 'http://127.0.0.1:8082';
}

export async function verify(request: VerifyRequest, timeout = 30000): Promise<{ data: any; status: number }> {
  const payload = { ...request, instId: normalizeInstId(request.instId) } as any;
  const url = `${baseUrl()}/api/verify`;
  const resp = await axios.post(url, payload, { timeout, headers: { 'Content-Type': 'application/json' } });
  return { data: resp.data, status: resp.status };
}

export async function verifyStandard(request: VerifyRequest, timeout = 30000): Promise<{ data: any; status: number }> {
  const payload = { ...request, instId: normalizeInstId(request.instId) } as any;
  const url = `${baseUrl()}/api/verify/standard`;
  const resp = await axios.post(url, payload, { timeout, headers: { 'Content-Type': 'application/json' } });
  return { data: resp.data, status: resp.status };
}

