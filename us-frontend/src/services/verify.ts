import type { ExchangeId, TradingPairId } from '../config/verification';
import { apiRequest, JP_API_BASE, US_API_BASE } from './apiClient';
import { jpApiRequestWithKeys, ApiRequestWithKeysOptions } from './apiClientWithKeys';
import { getAuthState } from './auth';

/**
 * SKU选项接口 - 保险产品选项
 */
export interface SkuOption {
  code: string; // SKU代码
  label: string; // 显示标签
  description?: string; // 描述信息
  premium?: number; // 保费金额
  payout?: number; // 赔付金额
  exchange?: string; // 支持的交易所
  raw?: unknown; // 原始数据
}

/**
 * 验证请求接口 - 订单验证请求参数
 */
export interface VerificationRequest {
  exchange: ExchangeId; // 交易所
  pairId: TradingPairId; // 交易对ID
  orderId: string; // 订单号
  wallet: string; // 钱包地址
  skuCode: string; // SKU代码
  env: string; // 环境（生产/测试）
  principal: number; // 本金金额
  leverage: number; // 杠杆倍数
  refCode?: string; // 推荐码（可选）
}

// 验证状态枚举
export type VerificationStatus = 'pending' | 'processing' | 'success' | 'failed' | 'error' | 'warning' | 'invalid';

// 验证结果详情接口
export interface VerificationResultDetail {
  code: string; // 结果代码
  message: string; // 结果消息
  severity: 'info' | 'warning' | 'error' | 'success'; // 严重程度
  timestamp?: string; // 时间戳
}

export interface VerificationResponse {
  status: VerificationStatus;
  exchange?: string;
  pair?: string;
  orderRef?: string;
  eligible?: boolean;
  parsed?: {
    side?: string;
    avgPx?: string;
    qty?: string;
    liqPx?: string;
    [key: string]: unknown;
  };
  quote?: {
    premium?: number;
    payoutCap?: number;
    currency?: string;
  };
  evidenceHint?: string;
  diag?: unknown[];
  refCode?: string;
  env?: string;
  
  // 新增字段
  errorCode?: string; // 错误代码
  errorMessage?: string; // 错误消息
  details?: VerificationResultDetail[]; // 详细结果
  timestamp?: string; // 验证时间戳
  retryable?: boolean; // 是否可重试
}

type RawSku =
  | {
      id?: string;
      code?: string;
      skuCode?: string;
      label?: string;
      title?: string;
      name?: string;
      description?: string;
      detail?: string;
      premium?: number;
      payout?: number;
      exchange?: string;
      [key: string]: unknown;
    }
  | string;

function normaliseSkuLabel(raw: RawSku): SkuOption {
  if (typeof raw === 'string') {
    return {
      code: raw,
      label: raw,
    };
  }

  const code = String(raw.skuCode ?? raw.code ?? raw.id ?? '').trim();
  const labelSource = raw.label ?? raw.title ?? raw.name ?? raw.description ?? raw.detail ?? code;
  const label = String(labelSource ?? 'SKU').trim() || code || 'SKU';

  const description = raw.description ?? raw.detail;
  const premium =
    typeof raw.premium === 'number' ? Number(raw.premium) : undefined;
  const payout =
    typeof raw.payout === 'number' ? Number(raw.payout) : undefined;
  const exchange =
    typeof raw.exchange === 'string' && raw.exchange ? String(raw.exchange) : undefined;

  return {
    code: code || label,
    label,
    description: typeof description === 'string' ? description : undefined,
    premium,
    payout,
    exchange,
    raw,
  };
}

export async function fetchSkus(): Promise<SkuOption[]> {
  const response = await apiRequest<unknown>('/catalog/skus');

  if (Array.isArray(response)) {
    return response.map(normaliseSkuLabel).filter((item) => Boolean(item.code));
  }

  if (response && typeof response === 'object') {
    const maybeSkus = (response as { skus?: RawSku[] }).skus;
    if (Array.isArray(maybeSkus)) {
      return maybeSkus.map(normaliseSkuLabel).filter((item) => Boolean(item.code));
    }
  }

  return [
    {
      code: 'DAY_24H_FIXED',
      label: 'DAY_24H_FIXED',
      raw: response,
    },
  ];
}

function mapExchangeId(exchange: ExchangeId): string {
  switch (exchange) {
    case 'OKX':
      return 'okx';
    case 'Binance':
      return 'binance';
    default:
      return exchange.toLowerCase();
  }
}

interface RawVerificationResponse {
  status?: string;
  exchange?: string;
  pair?: string;
  orderRef?: string;
  diagnostics?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function submitVerification(
  request: VerificationRequest,
  apiKeys?: {
    binanceApiKey?: string;
    binanceSecretKey?: string;
    okxApiKey?: string;
    okxSecretKey?: string;
    okxPassphrase?: string;
  }
): Promise<VerificationResponse> {
  const auth = getAuthState();
  const payload: Record<string, unknown> = {
    exchange: mapExchangeId(request.exchange),
    pair: request.pairId,
    orderRef: request.orderId,
    wallet: request.wallet,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  // Add API keys to headers if provided
  if (apiKeys) {
    // Add exchange-specific API key headers
    switch (mapExchangeId(request.exchange)) {
      case 'binance':
        if (apiKeys.binanceApiKey) {
          headers['X-MBX-APIKEY'] = apiKeys.binanceApiKey;
        }
        break;
      case 'okx':
        if (apiKeys.okxApiKey) {
          headers['OK-ACCESS-KEY'] = apiKeys.okxApiKey;
          // Note: In actual implementation, signature generation and other headers are needed
          // For simplicity, only API keys are added here
          if (apiKeys.okxPassphrase) {
            headers['OK-ACCESS-PASSPHRASE'] = apiKeys.okxPassphrase;
          }
        }
        break;
    }
  }

  try {
    const raw = await jpApiRequestWithKeys<RawVerificationResponse>('/verify/order', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      includeApiKeys: true,
      exchange: mapExchangeId(request.exchange) as 'binance' | 'okx',
    });

    // 处理成功响应
    const status = raw.status ?? 'ok';
    const exchange = raw.exchange ?? mapExchangeId(request.exchange);
    const pair = raw.pair ?? request.pairId;
    const orderRef = raw.orderRef ?? request.orderId;
    const diagnostics = raw.diagnostics ? [raw.diagnostics] : undefined;

    const parsed: VerificationResponse['parsed'] = {
      exchange,
      pair,
      orderRef,
    };

    if (raw.diagnostics && typeof raw.diagnostics === 'object') {
      const detail = raw.diagnostics as Record<string, unknown>;
      const { side, avgPx, qty, liqPx } = detail;
      if (typeof side === 'string') parsed.side = side;
      if (avgPx !== undefined) parsed.avgPx = String(avgPx);
      if (qty !== undefined) parsed.qty = String(qty);
      if (liqPx !== undefined) parsed.liqPx = String(liqPx);
    }

    // 根据原始状态映射到新的状态枚举
    let verificationStatus: VerificationStatus = 'success';
    let eligible = true;
    let details: VerificationResultDetail[] = [];

    if (status === 'ok') {
      verificationStatus = 'success';
      details.push({
        code: 'VERIFICATION_SUCCESS',
        message: '订单验证成功，符合理赔条件',
        severity: 'success'
      });
    } else if (status === 'fail') {
      verificationStatus = 'failed';
      eligible = false;
      details.push({
        code: 'VERIFICATION_FAILED',
        message: '订单验证失败，不符合理赔条件',
        severity: 'error'
      });
    } else {
      verificationStatus = 'warning';
      details.push({
        code: 'VERIFICATION_WARNING',
        message: '订单验证存在警告，请检查订单信息',
        severity: 'warning'
      });
    }

    return {
      status: verificationStatus,
      exchange,
      pair,
      orderRef,
      eligible,
      parsed,
      diag: diagnostics,
      evidenceHint:
        typeof raw.diagnostics === 'object' && raw.diagnostics && 'message' in raw.diagnostics
          ? String((raw.diagnostics as { message?: unknown }).message ?? '')
          : undefined,
      refCode: request.refCode,
      env: request.env,
      details,
      timestamp: new Date().toISOString(),
      retryable: verificationStatus !== 'success'
    };

  } catch (error: any) {
    // 处理错误响应
    console.error('Verification request failed:', error);
    
    let errorStatus: VerificationStatus = 'error';
    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = '验证请求失败，请稍后重试';
    let retryable = true;

    if (error?.status === 401) {
      errorStatus = 'invalid';
      errorCode = 'AUTHENTICATION_ERROR';
      errorMessage = '认证失败，请检查API密钥或重新登录';
      retryable = false;
    } else if (error?.status === 403) {
      errorStatus = 'invalid';
      errorCode = 'PERMISSION_DENIED';
      errorMessage = '权限不足，无法验证订单';
      retryable = false;
    } else if (error?.status === 404) {
      errorStatus = 'failed';
      errorCode = 'ORDER_NOT_FOUND';
      errorMessage = '订单不存在，请检查订单号是否正确';
      retryable = true;
    } else if (error?.status === 429) {
      errorStatus = 'error';
      errorCode = 'RATE_LIMIT_EXCEEDED';
      errorMessage = '请求过于频繁，请稍后重试';
      retryable = true;
    } else if (error?.status >= 500) {
      errorStatus = 'error';
      errorCode = 'SERVER_ERROR';
      errorMessage = '服务器内部错误，请稍后重试';
      retryable = true;
    }

    const details: VerificationResultDetail[] = [{
      code: errorCode,
      message: errorMessage,
      severity: errorStatus === 'error' || errorStatus === 'failed' ? 'error' : 'warning'
    }];

    return {
      status: errorStatus,
      exchange: mapExchangeId(request.exchange),
      pair: request.pairId,
      orderRef: request.orderId,
      eligible: false,
      errorCode,
      errorMessage,
      details,
      timestamp: new Date().toISOString(),
      retryable
    };
  }
}

export interface CreateOrderRequest {
  skuId: string;
  exchange: string;
  pair: string;
  orderRef: string;
  wallet: string;
  premium: number;
  payout: number;
  paymentMethod: string;
}

export interface OrderRecord {
  orderId: number;
  status: string;
  createdAt: string;
}

export interface CreateOrderOptions {
  idempotencyKey?: string;
}

export function createOrder(
  payload: CreateOrderRequest,
  options: CreateOrderOptions = {}
): Promise<OrderRecord> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  return apiRequest<OrderRecord>(`${US_API_BASE}/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}

export interface CreateClaimRequest {
  orderId: number;
  wallet: string;
  evidenceHash: string;
  reason: string;
}

export interface ClaimRecord {
  claimId: number;
  status: string;
  createdAt: string;
}

export interface CreateClaimOptions {
  idempotencyKey?: string;
}

export function createClaim(
  payload: CreateClaimRequest,
  options: CreateClaimOptions = {}
): Promise<ClaimRecord> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey;
  }

  return apiRequest<ClaimRecord>(`${US_API_BASE}/claim`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}
