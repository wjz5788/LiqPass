## 问题原因
- 前端当前调用 `POST http://localhost:3000/api/v1/claims/verify`（相对路径命中 Vite 开发服务器端口 3000）。
- 该路径需通过代理转发到后端 `http://127.0.0.1:3002`；若代理未生效或后端路由未注册/未热重载，会返回 404。
- 实仓代码已存在该端点并挂载在 `/api/v1`：apps/us-backend/src/routes/index.ts:42 → `app.use('/api/v1', claimsRoutes(...))`；具体路由在 apps/us-backend/src/routes/claims.ts:369。

## 后端端点现状
- 路由：`POST /api/v1/claims/verify`（apps/us-backend/src/routes/claims.ts:369）。需 JWT（`claimAuth`）。
- 入参：支持仅传 `{ claimId, orderRef }`，路由会自动解析 `orderId/claimToken`（apps/us-backend/src/routes/claims.ts:371–404）。
- 服务：`ClaimsService.verifyClaim(...)` 生成“证据链字段”，保存证据（apps/us-backend/src/services/claimsService.ts:274、347、354），并转为卡片详情（apps/us-backend/src/services/claimsService.ts:455）。

## 快速验证与联调建议
- 后端就绪检测：`GET http://127.0.0.1:3002/api/v1/health/ready` 应返回 200。
- 代理确认：apps/us-frontend/vite.config.ts:15–21 已将 `/api` 代理到 `VITE_API_BASE`（当前命令行已设置为 3002）。若代理异常，临时改用绝对地址：`POST http://127.0.0.1:3002/api/v1/claims/verify`。
- 认证：确保请求带 `Authorization: Bearer <JWT>`；否则返回 401（不是 404）。

## 最小可用版（Demo 证据）
- 在 `ClaimsService.verifyClaim` 增加短路：当 `process.env.JP_VERIFY_TEST_MODE === '1'` 时，直接返回固定 Demo 证据：
  - `eligible/payout/currency` 与 `evidence: { type, time: now, pair: 'BTC-USDT-SWAP' }`
  - 生成 `evidenceId` 并通过 `evidenceStorage.saveEvidence(...)` 落盘；返回 `expiresAt/evidenceId`。
- 不改动路由与请求体；仍支持 `{ claimId, orderRef }`。

## 接入日本服务器（可切换实现）
- 增加开关 `USE_JP_VERIFY=1`：开启时改为调用 `http://127.0.0.1:8082/api/verify/standard`（apps/jp-verify/start.sh 启动于 8082）。
- 载荷含 `ordId=orderRef` 与 `instId`（取订单 `pair`）；需要时复用用户在 `api_keys` 表记录的 OKX 密钥（apps/us-backend/src/services/claimsService.ts:386–412 已有解密封装）。
- 解析 JP 返回的规范化结果判断是否清算，生成统一返回结构并保存证据/审计事件。
- 错误与回退：JP 不可用时回退至 Demo 或现有 OKX 验证逻辑，保证接口稳定。

## 交付与记录
- 仅变更 `apps/us-backend/src/services/claimsService.ts`：新增 Demo 短路与 JP 接入分支；读取开关环境变量。
- 不新增文件；不改路由；提交信息与变更说明遵循项目约定（使用 git 提交记录）。