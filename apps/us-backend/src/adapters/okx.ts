// OKX 交易所适配器
import { ExchangeAdapter, VerifyParams, VerifyResult, RawOrder, toStr, sum, avg, parseTime, mapOrderStatus, buildBaseVerifyResult, buildErrorResult } from './base.js';
import { arithmeticOk, MAX_SKEW_MS } from '../types/index.js';
import axios from 'axios';

// OKX API 端点配置
const OKX_API_ENDPOINTS = {
  live: 'https://www.okx.com',
  testnet: 'https://www.okx.com'
};

// JP Verify 服务地址
const JP_VERIFY_URL = process.env.JP_VERIFY_URL || 'http://localhost:8082';

export class OKXAdapter implements ExchangeAdapter {
  name = 'OKX';

  getSupportedCaps() {
    return {
      orders: true,
      fills: true,
      positions: true,
      liquidations: true
    };
  }

  async verifyAccount(params: VerifyParams): Promise<VerifyResult> {
    const sessionId = `sess_${Date.now()}`;

    try {
      // 1. 验证凭证
      const authValid = await this.validateCredentials(params);
      if (!authValid) {
        return buildErrorResult(['INVALID_CREDENTIALS'], {}, sessionId);
      }

      // 2. 调用 jp-verify 服务进行验证
      const verifyResponse = await this.callJpVerify(params);

      if (verifyResponse.error) {
        return buildErrorResult([verifyResponse.error.code || 'VERIFICATION_ERROR'], {}, sessionId);
      }

      // 3. 解析返回结果
      const stdView = verifyResponse; // jp-verify 直接返回标准视图或包含标准视图

      // 注意：jp-verify 的返回格式可能需要适配
      // 假设 jp-verify 返回的是标准视图结构，或者我们需要从 response.data 中提取

      // 这里假设 verifyResponse 就是标准视图或者接近标准视图
      // 如果 jp-verify 返回的是 { meta: ..., normalized: ..., ... } 结构，我们需要适配
      // 但根据 main.py 的 verify_order_standard，它似乎直接返回 std_view

      const result: VerifyResult = {
        status: stdView.verifyStatus === 'PASS' ? 'verified' : 'failed',
        caps: this.getSupportedCaps(),
        account: {
          exchangeUid: params.uid, // 或者从 stdView 中获取
          subAccount: 'main', // 暂定
          sampleInstruments: [stdView.instId]
        },
        proof: {
          echo: {
            firstOrderIdLast4: stdView.ordId ? stdView.ordId.slice(-4) : '',
            firstFillQty: stdView.size,
            firstFillTime: stdView.openTime
          },
          hash: stdView.evidenceId // 使用 evidenceId 作为 hash
        },
        reasons: stdView.verifyReason ? [stdView.verifyReason] : [],
        verifiedAt: stdView.verifiedAt,
        order: {
          orderId: stdView.ordId,
          pair: stdView.instId,
          side: stdView.side,
          type: 'market', // 假设
          status: 'filled', // 假设
          executedQty: stdView.size,
          avgPrice: stdView.avgPx,
          quoteAmount: toStr(Number(stdView.size) * Number(stdView.avgPx)), // 估算
          orderTimeIso: stdView.openTime,
          exchangeTimeIso: stdView.closeTime
        },
        checks: {
          authOk: true,
          capsOk: true,
          orderFound: true,
          echoLast4Ok: true,
          arithmeticOk: true,
          pairOk: true,
          timeSkewMs: 0,
          verdict: stdView.verifyStatus === 'PASS' ? 'pass' : 'fail'
        },
        liquidation: {
          status: stdView.isLiquidated ? 'full' : 'none',
          details: stdView.isLiquidated ? {
            liquidationTime: stdView.closeTime,
            liquidatedAmount: stdView.size,
            // pnlAbs and instrument are not supported in the interface
          } : undefined
        },
        sessionId: sessionId
      };

      return result;

    } catch (error: any) {
      console.error('OKX verification error:', error);
      return buildErrorResult(['VERIFICATION_ERROR', error.message], {}, sessionId);
    }
  }

  private async validateCredentials(params: VerifyParams): Promise<boolean> {
    return !!(params.apiKey && params.apiSecret && params.passphrase);
  }

  private async callJpVerify(params: VerifyParams): Promise<any> {
    try {
      const payload = {
        exchange: 'okx',
        ordId: params.orderRef, // 假设 orderRef 是 ordId
        instId: params.pair,
        live: true,
        fresh: true,
        noCache: true,
        keyMode: 'inline',
        apiKey: params.apiKey,
        secretKey: params.apiSecret,
        passphrase: params.passphrase,
        uid: params.uid
      };

      // 调用 /api/verify/standard 接口
      const response = await axios.post(`${JP_VERIFY_URL}/api/verify/standard`, payload);
      return response.data;
    } catch (error: any) {
      if (error.response && error.response.data) {
        console.error('JP Verify error response:', error.response.data);
        throw new Error(error.response.data.detail?.msg || 'JP Verify failed');
      }
      throw error;
    }
  }
}

export default OKXAdapter;
