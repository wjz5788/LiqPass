/**
 * 环境变量加载器 —— 必须是 server.ts 的第一个 import。
 *
 * 修复：原先 server.ts 的写法是
 *
 *   import app from './app.js';          // ← 第 4 行
 *   ...
 *   dotenv.config();                     // ← 第 12 行
 *
 * ESM 规范里 import 会被提升并在模块体执行前全部求值完毕，所以 app.ts
 * （连同它创建的 AuthService、OrderService，以及 database/db.ts 的顶层
 * await 建库）在 dotenv.config() 之前就已经跑完了。结果是 .env 里的
 * JWT_SECRET / DB_FILE / ALLOWED_ORIGINS 等全部读不到：
 *   - AuthService 拿不到 JWT_SECRET
 *   - 数据库落在默认路径而不是 DB_FILE 指定的位置
 *   - CORS 白名单为空
 *   - EnvValidator 的校验在一切都已初始化之后才执行，形同虚设
 *
 * 把加载动作独立成模块并放在首位，利用「ESM 按 import 顺序求值」保证
 * 环境变量在任何业务模块被求值之前就绪。
 */
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const nodeEnv = process.env.NODE_ENV || 'development';

// 后加载的文件不覆盖已存在的变量（dotenv 默认行为），
// 因此优先级为：进程环境 > .env.local > .env.<NODE_ENV> > .env
const candidates = [
  '.env.local',
  `.env.${nodeEnv}`,
  '.env'
];

const loaded: string[] = [];
for (const file of candidates) {
  const full = path.resolve(process.cwd(), file);
  if (fs.existsSync(full)) {
    dotenv.config({ path: full });
    loaded.push(file);
  }
}

if (loaded.length === 0) {
  console.warn('⚠️  未找到任何 .env 文件，将只使用进程环境变量。可从 .env.example 复制一份。');
} else {
  console.log(`🔧 已加载环境变量文件: ${loaded.join(', ')}`);
}

export const NODE_ENV = nodeEnv;
export default loaded;
