// 服务器启动文件
import dotenv from 'dotenv';
import path from 'path';
import app from './app.js';
import { EnvValidator } from './utils/envValidator.js';

// 加载环境变量
const env = process.env.NODE_ENV || 'development';
if (env === 'production') {
  dotenv.config({ path: path.resolve('.env.production') });
} else {
  dotenv.config();
}

// 启动前校验环境变量
const skipValidation = process.env.DISABLE_PAYMENT_ENV_VALIDATION === 'true';
if (!skipValidation) {
  try {
    console.log('🔍 校验支付环境变量配置...');
    EnvValidator.validatePaymentConfig();
  } catch (error) {
    console.error('❌ 启动失败:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
} else {
  console.log('⚠️ 跳过支付环境变量校验');
}

const PORT: number = Number(process.env.API_PORT) || 3002;
const HOST = process.env.HOST || '0.0.0.0';

// 启动服务器
app.listen(PORT, HOST, () => {
  console.log(`🚀 LiqPass API Server is running on http://${HOST}:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
});

// 优雅关闭处理
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
