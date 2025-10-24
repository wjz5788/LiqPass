/**
 * @file verifier.js
 * @description 订单验证模块，负责与交易所API交互以验证订单的真实性
 */

import axios from 'axios';
import crypto from 'node:crypto';

// 从环境变量中获取API基础URL，如果未设置则使用默认值
const OKX_BASE_URL = process.env.OKX_BASE_URL ?? 'https://www.okx.com';
const BINANCE_BASE_URL = process.env.BINANCE_BASE_URL ?? 'https://api.binance.com';

/**
 * 验证OKX交易所的订单
 * @param {string} pair - 交易对，例如 'BTC-USDT'
 * @param {string} orderRef - 客户自定义订单ID
 * @returns {Promise<boolean>} - 如果订单有效则返回true，否则返回false
 */
async function verifyOkxOrder(pair, orderRef) {
  try {
    // 获取生产环境API密钥
    const apiKey = process.env.OKX_API_KEY;
    const secretKey = process.env.OKX_SECRET_KEY;
    const passphrase = process.env.OKX_PASSPHRASE;
    
    if (!apiKey || !secretKey || !passphrase) {
      console.error('OKX API credentials not configured for production environment');
      return false;
    }
    
    // 创建OKX API签名（生产环境需要身份验证）
    const timestamp = new Date().toISOString();
    const method = 'GET';
    const requestPath = '/api/v5/trade/order';
    const queryString = `instId=${pair}&clOrdId=${orderRef}`;
    
    // 生成签名（简化版，实际生产环境需要完整签名逻辑）
    const signature = crypto.createHmac('sha256', secretKey)
      .update(timestamp + method + requestPath + queryString)
      .digest('base64');
    
    const response = await axios.get(`${OKX_BASE_URL}${requestPath}`, {
      params: { instId: pair, clOrdId: orderRef },
      headers: {
        'OK-ACCESS-KEY': apiKey,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': passphrase,
      },
    });
    
    // 检查响应数据中是否包含订单信息
    return response.data?.data?.length > 0;
  } catch (error) {
    console.error('OKX order verification failed:', error.message);
    return false;
  }
}

/**
 * 验证Binance交易所的订单
 * @param {string} pair - 交易对，例如 'BTCUSDT'
 * @param {string} orderRef - 客户自定义订单ID
 * @returns {Promise<boolean>} - 如果订单有效则返回true，否则返回false
 */
async function verifyBinanceOrder(pair, orderRef) {
  try {
    // 获取生产环境API密钥
    const apiKey = process.env.BINANCE_API_KEY;
    const secretKey = process.env.BINANCE_SECRET_KEY;
    
    if (!apiKey || !secretKey) {
      console.error('Binance API credentials not configured for production environment');
      return false;
    }
    
    // 创建Binance API签名
    const timestamp = Date.now();
    const queryString = `symbol=${pair}&origClientOrderId=${orderRef}&timestamp=${timestamp}`;
    
    // 生成签名
    const signature = crypto.createHmac('sha256', secretKey)
      .update(queryString)
      .digest('hex');
    
    const response = await axios.get(`${BINANCE_BASE_URL}/api/v3/order`, {
      params: { 
        symbol: pair, 
        origClientOrderId: orderRef,
        timestamp: timestamp,
        signature: signature
      },
      headers: {
        'X-MBX-APIKEY': apiKey
      }
    });
    
    // 检查响应数据中是否存在订单ID
    return !!response.data?.orderId;
  } catch (error) {
    console.error('Binance order verification failed:', error.message);
    return false;
  }
}

/**
 * 根据交易所名称动态调用相应的验证函数
 * @param {string} exchange - 交易所名称 ('okx' 或 'binance')
 * @param {string} pair - 交易对
 * @param {string} orderRef - 客户自定义订单ID
 * @returns {Promise<boolean>} - 返回订单验证结果
 */
export async function verifyOrder(exchange, pair, orderRef) {
  switch (exchange.toLowerCase()) {
    case 'okx':
      return verifyOkxOrder(pair, orderRef);
    case 'binance':
      return verifyBinanceOrder(pair, orderRef);
    default:
      console.warn(`Unsupported exchange: ${exchange}`);
      return false;
  }
}
