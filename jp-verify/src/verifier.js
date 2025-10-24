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
 * 使用Google MCP验证订单
 * @param {string} exchange - 交易所名称
 * @param {string} pair - 交易对
 * @param {string} orderRef - 客户自定义订单ID
 * @returns {Promise<{valid: boolean, confidence: number, details: string}>} - 返回验证结果
 */
async function verifyWithGoogleMCP(exchange, pair, orderRef) {
  try {
    // 获取Google MCP配置
    const googleMCPApiKey = process.env.GOOGLE_MCP_API_KEY;
    const googleMCPBaseUrl = process.env.GOOGLE_MCP_BASE_URL ?? 'https://generativelanguage.googleapis.com';
    
    if (!googleMCPApiKey) {
      console.error('Google MCP API key not configured');
      return { valid: false, confidence: 0, details: 'Google MCP API密钥未配置' };
    }
    
    // 构建更详细的验证请求
    const verificationRequest = {
      contents: [{
        parts: [{
          text: `请作为金融订单验证专家，分析以下订单信息：\n` +
                `交易所：${exchange}\n` +
                `交易对：${pair}\n` +
                `订单参考号：${orderRef}\n\n` +
                `请执行以下分析：\n` +
                `1. 检查订单格式是否符合标准规范\n` +
                `2. 评估订单参考号的合理性\n` +
                `3. 分析交易对的合法性\n` +
                `4. 判断订单是否存在潜在风险\n\n` +
                `请用JSON格式回复，包含以下字段：\n` +
                `- valid: 布尔值，表示订单是否有效\n` +
                `- confidence: 0-100的数值，表示验证置信度\n` +
                `- details: 验证结果的详细说明\n` +
                `- riskLevel: 风险等级（low/medium/high）`
        }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
        responseMimeType: 'application/json'
      }
    };
    
    const response = await axios.post(
      `${googleMCPBaseUrl}/v1beta/models/gemini-pro:generateContent?key=${googleMCPApiKey}`,
      verificationRequest,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000 // 30秒超时
      }
    );
    
    // 解析Google MCP响应
    const responseText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      console.error('Invalid response from Google MCP');
      return { valid: false, confidence: 0, details: 'Google MCP响应无效' };
    }
    
    try {
      // 尝试解析JSON响应
      const parsedResponse = JSON.parse(responseText);
      return {
        valid: Boolean(parsedResponse.valid),
        confidence: Math.min(100, Math.max(0, Number(parsedResponse.confidence) || 0)),
        details: parsedResponse.details || '验证完成',
        riskLevel: parsedResponse.riskLevel || 'medium'
      };
    } catch (parseError) {
      // 如果JSON解析失败，使用备用逻辑
      console.warn('Failed to parse Google MCP JSON response, using fallback logic');
      const lowerResponse = responseText.toLowerCase();
      const valid = lowerResponse.includes('有效') || 
                   lowerResponse.includes('真实') || 
                   lowerResponse.includes('确认') ||
                   lowerResponse.includes('存在');
      
      // 基于关键词计算置信度
      let confidence = 50; // 基础置信度
      if (lowerResponse.includes('高置信度') || lowerResponse.includes('高度确认')) confidence = 85;
      if (lowerResponse.includes('中等') || lowerResponse.includes('部分')) confidence = 60;
      if (lowerResponse.includes('低') || lowerResponse.includes('不确定')) confidence = 30;
      
      return { 
        valid, 
        confidence, 
        details: '使用备用验证逻辑完成验证',
        riskLevel: confidence > 70 ? 'low' : confidence > 40 ? 'medium' : 'high'
      };
    }
    
  } catch (error) {
    console.error('Google MCP verification failed:', error.message);
    return { 
      valid: false, 
      confidence: 0, 
      details: `验证失败: ${error.message}`,
      riskLevel: 'high'
    };
  }
}

/**
 * 根据交易所名称动态调用相应的验证函数
 * @param {string} exchange - 交易所名称 ('okx' 或 'binance' 或 'google-mcp')
 * @param {string} pair - 交易对
 * @param {string} orderRef - 客户自定义订单ID
 * @returns {Promise<boolean|object>} - 返回订单验证结果
 */
export async function verifyOrder(exchange, pair, orderRef) {
  const exchangeLower = exchange.toLowerCase();
  
  switch (exchangeLower) {
    case 'okx':
      return verifyOkxOrder(pair, orderRef);
    case 'binance':
      return verifyBinanceOrder(pair, orderRef);
    case 'google-mcp':
      return verifyWithGoogleMCP(exchange, pair, orderRef);
    default:
      console.warn(`Unsupported exchange: ${exchange}`);
      return false;
  }
}
