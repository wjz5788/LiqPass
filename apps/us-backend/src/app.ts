import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import registerRoutes from './routes/index.js';
import AuthService from './services/authService.js';
import OrderService from './services/orderService.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { requestIdMiddleware } from './middleware/requestId.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 部署在 Nginx / Cloudflare 等反向代理后面时，限流必须按真实客户端 IP 计数
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));

// 安全中间件
app.use(helmet());

// CORS配置 - 严格白名单
// 生产环境必须显式配置 ALLOWED_ORIGINS；否则配合 credentials:true 等于对任意站点开放带凭证的跨域请求。
const isProd = (process.env.NODE_ENV || 'development') === 'production';
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (isProd && allowedOrigins.length === 0) {
  throw new Error('[config] 生产环境必须配置 ALLOWED_ORIGINS（逗号分隔的来源白名单）。');
}

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // 同源 / 非浏览器请求（curl、服务端调用）没有 Origin 头
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // 开发环境放行 localhost，其余一律拒绝
    if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    console.warn(`CORS阻止了来源: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  // 补齐实际用到的自定义头，否则跨域预检会直接拒绝携带 API Key 的请求
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-API-Key',
    'X-Admin-Api-Key',
    'Idempotency-Key',
    'X-Request-Id'
  ]
};
app.use(cors(corsOptions));
app.use(compression());

// 请求限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 限制每个IP 15分钟内最多100个请求
});
app.use(limiter);

// 解析中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 日志中间件
app.use(requestIdMiddleware);
app.use(requestLogger);

// Swagger 暂时关闭（最小可运行后端）

const authService = new AuthService();
const orderService = new OrderService();
registerRoutes(app, { authService, orderService });


// 错误处理中间件
app.use(errorHandler);

export default app;
