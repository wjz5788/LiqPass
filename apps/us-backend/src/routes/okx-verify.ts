// OKX 验证薄代理路由
import express, { type RequestHandler } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { evidenceStorage } from '../utils/evidenceStorage.js';

const router = express.Router();

// jp-verify 服务配置
const JP_VERIFY_BASE_URL = process.env.JP_VERIFY_BASE_URL || process.env.JP_VERIFY_BASE || 'http://127.0.0.1:8082';
import * as jpVerifyClient from '../services/jpVerifyClient.js';

interface VerifyOkxRequest {
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
  exchange?: string;
  clientMeta?: {
    source: string;
    requestId: string;
  };
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

/**
 * OKX 订单验证薄代理 - 转发到 jp-verify 服务
 */
const handleVerify: RequestHandler = async (req, res) => {
  try {
    const request: VerifyOkxRequest = req.body;
    const exchange = (request.exchange || 'okx').toLowerCase();
    const keyMode = request.keyMode ?? 'inline';
    const requestId = uuidv4();
    const normalizedInstId = normalizeInstId(request.instId);
    
    console.log(`[${requestId}] 收到 OKX 验证请求:`, {
      ordId: request.ordId,
      instId: normalizedInstId,
      exchange,
      keyMode
    });

    // 验证必填字段
    if (exchange !== 'okx') {
      return res.status(400).json({
        error: {
          code: 'UNSUPPORTED_EXCHANGE',
          msg: `暂不支持 ${exchange} 交易所的订单验证`,
          hint: '请确认 exchange 字段是否正确'
        }
      });
    }

    if (!request.ordId || !normalizedInstId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          msg: 'ordId 和 instId 是必填字段',
          hint: '请提供有效的订单ID和交易对'
        }
      });
    }

    if (keyMode === 'inline' && !(request.apiKey && request.secretKey && request.passphrase)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          msg: 'inline 模式下需要提供完整的 API 密钥信息',
          hint: '请提供 apiKey、secretKey 和 passphrase'
        }
      });
    }

    // 构建转发请求
    const jpVerifyRequest = {
      exchange: 'okx',
      ordId: request.ordId,
      instId: normalizedInstId,
      live: request.live ?? true,
      fresh: request.fresh ?? true,
      noCache: request.noCache ?? true,
      keyMode,
      apiKey: request.apiKey,
      secretKey: request.secretKey,
      passphrase: request.passphrase,
      uid: request.uid,
      keyAlias: request.keyAlias,
      clientMeta: {
        source: 'us-backend',
        requestId: requestId
      }
    };

    // 生成证据ID
    const evidenceId = evidenceStorage.generateEvidenceId();

    console.log(`[${requestId}] 转发到 jp-verify: ${JP_VERIFY_BASE_URL}/api/verify`);

    // 转发请求到 jp-verify
    const response = await jpVerifyClient.verify(jpVerifyRequest, 30000);

    console.log(`[${requestId}] jp-verify 响应状态: ${response.status}`);

    const meta = (response.data as any)?.meta || {};
    const normalizedData = (response.data as any)?.normalized?.data || null;
    const liqFlagStr = normalizedData?.liq_flag;
    const isLiquidated = liqFlagStr === 'true' || liqFlagStr === true;
    const ordMatches = String(request.ordId) === String(meta.ordId);
    const instMatches = String(normalizedInstId) === String(meta.instId);
    const hasNormalized = !!normalizedData;
    let eligibleForPurchase = ordMatches && instMatches && hasNormalized;
    let eligibilityReason: string | null = null;
    if (!ordMatches || !instMatches) {
      eligibilityReason = 'ORD_ID_MISMATCH';
      eligibleForPurchase = false;
    } else if (!hasNormalized) {
      eligibilityReason = 'NO_NORMALIZED_DATA';
      eligibleForPurchase = false;
    }
    const verdict = eligibleForPurchase ? 'pass' : 'fail';

    const evidenceData = {
      evidenceId,
      requestId,
      request: jpVerifyRequest,
      response: response.data,
      timestamp: new Date().toISOString(),
      status: response.status
    };

    try {
      const evidencePath = evidenceStorage.saveEvidence(evidenceId, evidenceData);
      console.log(`[${requestId}] 证据已保存: ${evidencePath}`);
    } catch (saveError) {
      console.error(`[${requestId}] 保存证据失败:`, saveError);
    }

    const responseWithEvidence = {
      ...response.data,
      evidenceId: evidenceId,
      verdict,
      eligible_for_purchase: eligibleForPurchase,
      is_liquidated: isLiquidated,
      eligibility_reason: eligibilityReason
    };

    const clientMode = (req.body as any)?.clientMode || 'minimal';
    const evidenceRoot = (response.data as any)?.normalized?.evidence_root || null;
    const minimalPayload = {
      meta: {
        exchange: 'okx',
        ordId: meta.ordId,
        instId: meta.instId,
        verifiedAt: meta.verifiedAt,
        source: 'okx-api'
      },
      status: verdict === 'pass' ? 'verified' : 'failed',
      evidenceId,
      evidence_root: evidenceRoot,
      eligible_for_purchase: eligibleForPurchase,
      is_liquidated: isLiquidated,
      eligibility_reason: eligibilityReason
    };

    

    if (clientMode === 'full') {
      res.status(response.status).json(responseWithEvidence);
    } else {
      res.status(response.status).json(minimalPayload);
    }

  } catch (error: any) {
    console.error('OKX 验证代理错误:', error);

    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          msg: 'jp-verify 服务不可用',
          hint: '请检查 jp-verify 服务是否已启动在端口 8082'
        }
      });
    }

    if (error.response) {
      // jp-verify 返回的错误
      return res.status(error.response.status).json(error.response.data);
    }

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: {
          code: 'TIMEOUT',
          msg: '请求超时',
          hint: '请稍后重试或检查网络连接'
        }
      });
    }

    // 其他错误
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        msg: '内部服务器错误',
        hint: '请稍后重试'
      }
    });
  }
};

/**
 * POST /api/v1/verify/okx
 * POST /api/verify
 */
router.post('/', handleVerify);
router.post('/okx', handleVerify);

const handleVerifyStandard: RequestHandler = async (req, res) => {
  try {
    const request: VerifyOkxRequest = req.body;
    const exchange = (request.exchange || 'okx').toLowerCase();
    const keyMode = request.keyMode ?? 'inline';
    const requestId = uuidv4();
    const normalizedInstId = normalizeInstId(request.instId);

    if (exchange !== 'okx') {
      return res.status(400).json({
        error: {
          code: 'UNSUPPORTED_EXCHANGE',
          msg: `暂不支持 ${exchange} 交易所的订单验证`,
          hint: '请确认 exchange 字段是否正确'
        }
      });
    }

    if (!request.ordId || !normalizedInstId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          msg: 'ordId 和 instId 是必填字段',
          hint: '请提供有效的订单ID和交易对'
        }
      });
    }

    if (keyMode === 'inline' && !(request.apiKey && request.secretKey && request.passphrase)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          msg: 'inline 模式下需要提供完整的 API 密钥信息',
          hint: '请提供 apiKey、secretKey 和 passphrase'
        }
      });
    }

    const jpVerifyRequest = {
      exchange: 'okx',
      ordId: request.ordId,
      instId: normalizedInstId,
      live: request.live ?? true,
      fresh: request.fresh ?? true,
      noCache: request.noCache ?? true,
      keyMode,
      apiKey: request.apiKey,
      secretKey: request.secretKey,
      passphrase: request.passphrase,
      uid: request.uid,
      keyAlias: request.keyAlias,
      clientMeta: {
        source: 'us-backend',
        requestId
      }
    };

    const response = await jpVerifyClient.verifyStandard(jpVerifyRequest, 30000);
    const std = response.data as any;
    const payload = {
      ...std,
      status: std.verifyStatus === 'PASS' ? 'verified' : 'failed'
    };
    res.status(response.status).json(payload);
  } catch (error: any) {
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          msg: 'jp-verify 服务不可用',
          hint: '请检查 jp-verify 服务是否已启动在端口 8082'
        }
      });
    }
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: { code: 'TIMEOUT', msg: '请求超时', hint: '请稍后重试或检查网络连接' }
      });
    }
    res.status(500).json({
      error: { code: 'INTERNAL_ERROR', msg: '内部服务器错误', hint: '请稍后重试' }
    });
  }
};

router.post('/standard', handleVerifyStandard);
router.post('/okx/standard', handleVerifyStandard);

router.post('/confirm', async (req, res) => {
  const { evidenceId, ordId, instId, kind } = req.body || {};
  if (!evidenceId || !ordId || !instId) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', msg: 'evidenceId、ordId、instId 必填' } });
  }
  const eventId = `evt_${uuidv4()}`;
  const eventType = typeof kind === 'string' && kind ? String(kind) : 'system_confirm';
  res.json({ status: 'confirmed', eventId, evidenceId: String(evidenceId), ordId: String(ordId), instId: String(instId), kind: eventType });
});

/**
 * GET /api/v1/verify/health
 * 检查 jp-verify 服务健康状态
 */
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${JP_VERIFY_BASE_URL}/healthz`, {
      timeout: 5000
    });

    res.json({
      service: 'jp-verify',
      status: 'healthy',
      response: response.data
    });

  } catch (error: any) {
    console.error('检查 jp-verify 健康状态失败:', error);

    res.status(503).json({
      service: 'jp-verify',
      status: 'unhealthy',
      error: error.message
    });
  }
});

export default router;
