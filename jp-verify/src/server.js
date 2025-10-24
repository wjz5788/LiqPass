/**
 * @file server.js
 * @description 日本验证服务器主文件，负责验证交易所订单的真实性
 */

// 导入必要的依赖包
import express from 'express';  // Web服务器框架
import cors from 'cors';        // 跨域资源共享
import fs from 'node:fs';       // 文件系统操作
import path from 'node:path';   // 路径处理
import { config as loadEnv } from 'dotenv';  // 环境变量加载
import { fileURLToPath } from 'node:url';  // URL转文件路径
import { verifyOrder } from './verifier.js';

// 获取当前文件路径和目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVICE_ROOT = path.resolve(__dirname, '..');

// 加载环境变量配置
loadEnv({ path: path.resolve(SERVICE_ROOT, '.env') });

// 服务器配置常量
const PORT = Number.parseInt(process.env.JP_PORT ?? process.env.PORT ?? '8787', 10);  // 服务器端口
const VERIFY_MODE = process.env.VERIFY_MODE ?? 'real';  // 验证模式（real或stub）
const OKX_BASE_URL = process.env.OKX_BASE_URL ?? 'https://www.okx.com';  // OKX交易所API基础URL
const BINANCE_BASE_URL = process.env.BINANCE_BASE_URL ?? 'https://api.binance.com';  // Binance交易所API基础URL
const GOOGLE_MCP_BASE_URL = process.env.GOOGLE_MCP_BASE_URL ?? 'https://generativelanguage.googleapis.com';  // Google MCP API基础URL

const app = express();  // 创建Express应用实例

// CORS配置 - 允许所有来源的跨域请求
const corsOptions = {
  origin: '*',  // 允许所有来源
  methods: ['GET', 'POST', 'OPTIONS'],  // 允许的HTTP方法
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],  // 允许的HTTP头
  optionsSuccessStatus: 204,  // OPTIONS请求的成功状态码
  maxAge: 600,  // 预检请求缓存时间（秒）
};

// 应用中间件
app.use(cors(corsOptions));  // 启用CORS
app.options('*', cors(corsOptions));  // 处理OPTIONS预检请求
app.use(express.json({ limit: '512kb' }));  // 解析JSON请求体，限制512KB

// 健康检查端点
app.get('/healthz', (req, res) => {
  res.json({
    status: 'ok',
    verifyMode: VERIFY_MODE,  // 当前验证模式
    okxBaseUrl: OKX_BASE_URL,  // OKX API地址
    binanceBaseUrl: BINANCE_BASE_URL,  // Binance API地址
    googleMCPBaseUrl: GOOGLE_MCP_BASE_URL,  // Google MCP API地址
    googleMCPConfigured: !!process.env.GOOGLE_MCP_API_KEY,  // Google MCP是否已配置
    timestamp: new Date().toISOString(),  // 当前时间戳
  });
});

// 订单验证端点 - 验证交易所订单的真实性
app.post('/verify/order', async (req, res) => {
  const { exchange, pair, orderRef, wallet } = req.body ?? {};  // 从请求体提取验证参数

  // 验证必需字段
  if (!exchange || !pair || !orderRef || !wallet) {
    return res.status(400).json({
      status: 'fail',
      reason: 'Missing exchange, pair, orderRef, or wallet',  // 缺少必需字段
    });
  }

  // 根据验证模式执行操作
  if (VERIFY_MODE === 'stub') {
    // 在存根模式下，直接返回成功
    return res.json({
      status: 'ok',
      exchange,
      pair,
      orderRef,
      wallet,
      diagnostics: {
        message: 'Verification stub response',
        verifyMode: VERIFY_MODE,
        receivedAt: new Date().toISOString(),
      },
    });
  }

  try {
    // 在真实模式下，调用API进行验证
    const verificationResult = await verifyOrder(exchange, pair, orderRef);
    
    // 处理Google MCP的特殊响应格式
    if (exchange.toLowerCase() === 'google-mcp' && typeof verificationResult === 'object') {
      if (verificationResult.valid) {
        // 如果订单有效，返回成功
        res.json({
          status: 'ok',
          exchange,
          pair,
          orderRef,
          wallet,
          confidence: verificationResult.confidence,
          riskLevel: verificationResult.riskLevel,
          details: verificationResult.details,
          diagnostics: {
            message: 'Order successfully verified via Google MCP',
            verifyMode: VERIFY_MODE,
            verifiedAt: new Date().toISOString(),
          },
        });
      } else {
        // 如果订单无效，返回失败
        res.status(404).json({
          status: 'fail',
          reason: verificationResult.details || 'Order not found or invalid',
          confidence: verificationResult.confidence,
          riskLevel: verificationResult.riskLevel,
          diagnostics: {
            message: 'Order verification failed via Google MCP',
            verifyMode: VERIFY_MODE,
            failedAt: new Date().toISOString(),
          },
        });
      }
    } else {
      // 处理传统交易所的布尔响应
      if (verificationResult) {
        // 如果订单有效，返回成功
        res.json({
          status: 'ok',
          exchange,
          pair,
          orderRef,
          wallet,
          diagnostics: {
            message: 'Order successfully verified',
            verifyMode: VERIFY_MODE,
            verifiedAt: new Date().toISOString(),
          },
        });
      } else {
        // 如果订单无效，返回失败
        res.status(404).json({
          status: 'fail',
          reason: 'Order not found or invalid',
          diagnostics: {
            message: 'Order verification failed',
            verifyMode: VERIFY_MODE,
            failedAt: new Date().toISOString(),
          },
        });
      }
    }
  } catch (error) {
    // 处理验证过程中发生的内部错误
    res.status(500).json({
      status: 'error',
      reason: 'Internal server error during verification',
      diagnostics: {
        message: error.message,
        verifyMode: VERIFY_MODE,
        errorAt: new Date().toISOString(),
      },
    });
  }
});

// 404错误处理 - 处理不存在的路由
app.use((req, res) => {
  res.status(404).json({ status: 'not_found', path: req.path });  // 返回404状态
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`[jp-verify] listening on http://localhost:${PORT} (mode=${VERIFY_MODE})`);  // 服务器启动日志
});
