## 目标
- 让 `jp-verify` 服务稳定运行并可访问。
- 配好 `us-backend` 的环境变量，让它能打到 `jp-verify`。
- 验证 `/api/v1/claims/verify` 能返回正常数据，若出现 500，按代码定位并修复。

## 服务启动
- 在 `apps/jp-verify` 启动 FastAPI：
  - 命令建议：`uvicorn main:app --host 127.0.0.1 --port 8082 --reload`
  - 依据：`apps/jp-verify/main.py:1005-1007` 内置端口 `8082`；健康检查在 `apps/jp-verify/main.py:460-463`。
- 自测健康：`curl http://127.0.0.1:8082/healthz` 预期返回 JSON（`status: healthy`）。

## 后端环境配置
- 打开 `apps/us-backend/.env`（或 `.env.production`）：
  - 设置：`JP_VERIFY_BASE_URL=http://127.0.0.1:8082`
  - 可选测试模式（跳过真实 OKX 验证以跑通流程）：`JP_VERIFY_TEST_MODE=1`
  - 依据：`apps/us-backend/src/services/jpVerifyClient.ts:40-47` 使用该地址；`apps/us-backend/src/services/claimsService.ts:310-345` 在测试模式走本地假数据并写入证据与审计。
- 重启后端：`cd apps/us-backend && npm run dev`（脚本在 `apps/us-backend/package.json`，端口见 `apps/us-backend/src/server.ts:29-37` 默认 `3002`）。

## 连通性验证
- 在运行 `us-backend` 的机器（通常即本机）检查连通：
  - `curl "$JP_VERIFY_BASE_URL/healthz"` 或 `curl http://127.0.0.1:8082/healthz`
  - 正常返回 → 网络打通；`Connection refused/ENOTFOUND` → 服务未起或 URL 写错。
- 代码引用路径：
  - 路由入口：`apps/us-backend/src/routes/index.ts` 以 `/api/v1` 挂载；
  - 验证接口：`apps/us-backend/src/routes/claims.ts:370-427`（`POST /api/v1/claims/verify`）。

## 触发与观察
- 回前端点击“验证”，并在 `us-backend` 控制台观察日志：
  - 典型 500 源头与定位：
    - 认证缺失：`apps/us-backend/src/routes/claims.ts:381-391`（未登录或 `req.auth` 无用户）→ 返回 401；
    - `jp-verify` 连接失败：`apps/us-backend/src/services/jpVerifyClient.ts:44-55`（`axios.post` 到 `/api/verify/standard`）→ 控制台会见 `ECONNREFUSED/ENOTFOUND`；
    - API 密钥问题：`apps/us-backend/src/services/claimsService.ts:349-376`（解密并请求 `jp-verify`）→ 抛 `DATABASE_ERROR/API_KEY_NOT_FOUND` 或解密异常；
    - 统一错误输出：`apps/us-backend/src/middleware/errorHandler.ts:25-50,70-109`；请求级 500 日志：`apps/us-backend/src/middleware/requestLogger.ts:42-51`。

## 快速解堵方案
- 先用测试模式验证链路（不依赖 `jp-verify` 与真实 OKX）：
  - 配置 `JP_VERIFY_TEST_MODE=1`，重启后端；接口将返回演示证据与审计事件（见 `claimsService.ts:310-345`）。
- 若需真实验单：确保 `jp-verify` 运行且 `.env` 设置正确，再确保 `api_keys` 表存在用户的 OKX 加密密钥（`claimsService.ts:349-366` 会取并解密）。

## 出现 500 时需提供的信息
- 浏览器 Network 中这次 `POST /api/v1/claims/verify` 的：Request URL / Payload / Response 文本。
- `apps/us-backend` 终端的完整错误栈（从首行到堆栈结尾）。
- 相关代码段：
  - 路由处理器：`apps/us-backend/src/routes/claims.ts:370-427`
  - 服务方法：`apps/us-backend/src/services/claimsService.ts:275-420` 与 `apps/us-backend/src/services/jpVerifyClient.ts:40-55`
- `.env` 片段（值可打码）：`JP_VERIFY_BASE_URL`、`JP_VERIFY_TEST_MODE`、数据库与加密相关变量。

## 预期结果
- 测试模式下：点击“验证”得到证据卡片数据且无 500。
- 真实模式下：`jp-verify` 健康且能返回标准验证结果；后端能将结果转换为理赔详情（`claimsService.ts:465-481`）。

## 下一步（确认后我来执行）
- 我按以上步骤逐一检查与修复；若仍 500，我将基于提供的错误栈与代码位置给出精确补丁（包含空值防御、超时/重试、错误码标准化），并回传可直接应用的改动。