## 必要文件清单（US 后端 + 前端）
- 后端可执行与依赖：
  - `apps/us-backend/dist/`（由 `npm run build` 生成的 .js 与 .d.ts）
  - `apps/us-backend/package.json`、`apps/us-backend/package-lock.json`
  - `apps/us-backend/.env.production`（由您提供真实值；不进版本库）
  - `apps/us-backend/ecosystem.config.js`（若用 PM2 管理进程）
- 后端数据库迁移（必须随包拷贝到 dist，对运行至关重要）：
  - `apps/us-backend/src/database/migrations/*.sql`
  - 拷贝目标：`apps/us-backend/dist/database/migrations/*.sql`
  - 说明：迁移管理器运行时通过 `__dirname/migrations` 读取 SQL 文件（源码位置：`apps/us-backend/src/database/migrationManager.ts:24,60-91`）。若缺失将导致数据库初始化失败。
- 前端静态资源：
  - `apps/us-frontend/dist/`（由 `npm run build` 生成的静态站点）
  - `apps/us-frontend/.env.production`（用于设置 `VITE_API_BASE` 等；构建前已使用）
- 可选（按需）：
  - `apps/us-backend/openapi.json`（若需对外展示/调试 API）
  - 链上监听器 `apps/chain-listener/`（仅在需要链上事件回填时）

## 环境变量最小集（US 后端 `.env.production`）
- 基础：`PORT=3002`、`NODE_ENV=production`
- 安全：`JWT_SECRET=<强随机>`、`KMS_KEY=<强随机>`
- 数据库：`DB_URL=sqlite:/opt/liqpass/data/liqpass.db`（或 Postgres 连接串）
- CORS：`ALLOWED_ORIGINS=http://<前端域名或IP>`（可多值逗号分隔）
- 验证服务（如联动日本服务器）：`JP_VERIFY_BASE_URL=http://<jp-host>:8082`
- 首启临时：`DISABLE_PAYMENT_ENV_VALIDATION=true`（避免严格校验阻塞；完成配置后关闭）

## 本地打包与拷贝（确保迁移文件进入 dist）
- 构建：
  - `cd apps/us-frontend && npm ci && npm run build`
  - `cd apps/us-backend && npm ci && npm run build`
- 拷贝迁移 SQL 到 dist（关键防止缺失）：
  - `mkdir -p apps/us-backend/dist/database/migrations`
  - `cp apps/us-backend/src/database/migrations/*.sql apps/us-backend/dist/database/migrations/`
- 生成部署包（剔除 `node_modules`、`.git`、测试与缓存）：
  - `tar -czf liqpass-us-$(date +%Y%m%d-%H%M).tar.gz \
    apps/us-backend/dist \
    apps/us-backend/package.json apps/us-backend/package-lock.json apps/us-backend/ecosystem.config.js \
    apps/us-frontend/dist`
  - `.env.production` 不入包；在服务器侧放置于 `apps/us-backend/` 运行目录

## 服务器侧部署（107.173.223.175）
- 上传：`scp -P 22 liqpass-us-*.tar.gz root@107.173.223.175:/opt/liqpass/`
- 解包与环境：
  - `ssh -p 22 root@107.173.223.175`
  - `mkdir -p /opt/liqpass/data && cd /opt/liqpass && tar -xzf liqpass-us-*.tar.gz`
  - 安装 Node.js≥20 与 PM2（Ubuntu 示例）：`curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs && npm i -g pm2`
  - 安装后端依赖：`cd apps/us-backend && npm ci`
  - 放置 `.env.production` 至 `apps/us-backend/`
- 启动后端：
  - 直接：`pm2 start dist/server.js --name liqpass-api`
  - 或：`pm2 start ecosystem.config.js --env production`
- 前端托管（Nginx 示例）：
  - `mkdir -p /var/www/liqpass && cp -r /opt/liqpass/apps/us-frontend/dist/* /var/www/liqpass/`
  - 站点：`server { listen 80; server_name <域名或IP>; root /var/www/liqpass; index index.html; location / { try_files $uri /index.html; } location /api/ { proxy_pass http://127.0.0.1:3002/api/; } }`
  - `nginx -t && systemctl reload nginx`
- 验证：
  - 健康检查：`curl http://127.0.0.1:3002/api/v1/health/live`
    - 路由：`apps/us-backend/src/routes/health.ts:10`
    - 入口：`apps/us-backend/src/server.ts:33`
  - 前端访问与 API 请求无 CORS 报错（`ALLOWED_ORIGINS` 与前端来源一致）

## 关键不漏项回顾
- 迁移 SQL 必须被拷贝到 `dist/database/migrations/`（否则数据库初始化失败）。
- `.env.production` 必须在服务器侧存在且内容完整（密钥、DB、CORS、JP_VERIFY）。
- 创建数据库目录（SQLite）：`/opt/liqpass/data/`，保证读写权限。
- 若联动日本 `jp-verify`，美国后端的 `JP_VERIFY_BASE_URL` 指向正确地址与端口。

—— 您确认后，我按此清单与步骤执行打包与部署，保证 US 服务器运行不缺文件。