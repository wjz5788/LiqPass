## 总体目标
- 为“新用户第一次使用”提供一条明确、可验证的闭环：填写交易所 API → 用订单号进行一次标准验证 → 如满足强平条件则进入理赔流程。
- 前端提供两个入口：`API 设置` 与 `赔付管理`；后端保证最小必要接口“等待用户输入订单号即可完成验证与理赔提交”。

## 首次 API 设置（前端）
- 入口：`/settings/api` 页面，已存在组件与交互（apps/us-frontend/src/pages/ApiSettings.tsx）。
- 动作：
  - 保存密钥：`POST /api/v1/api-keys`（apps/us-backend/src/routes/apiKeys.ts:239-243）。
  - 首次验证：用户输入 `ordId` 与 `instId`，调用 `POST /api/v1/verify/okx/standard` 返回 `verifyStatus PASS/FAIL`（apps/us-backend/src/routes/okx-verify.ts:382-384）。
- 关键点：
  - jp-verify 要求 inline 模式提供 `apiKey/secretKey/passphrase`（apps/jp-verify/main.py:520-528, 843-850）。
  - DEV 环境可直连 `http://127.0.0.1:8082/api/verify/standard`（apps/us-frontend/src/pages/ApiSettings.tsx:569-587）。
  - 验证通过后在页面展示标准视图与状态徽章；密钥保存为“脱敏显示”。

## 赔付管理（前端）
- 入口：`/claims` 与 `/claims/new` 页面（apps/us-frontend/src/pages/ClaimsPage.tsx）。
- 流程：
  - 输入订单号：调用 `POST /api/v1/claims/prepare` 获取初始 `claimToken/claimId`（apps/us-backend/src/routes/claims.ts:321-351）。
  - 触发验证：`POST /api/v1/claims/verify`，后端会去 jp-verify/verify_results 判断强平与资格（apps/us-backend/src/routes/claims.ts:369-427）。
  - 展示结果：是否可赔付、建议赔付金额、证据摘要；用户“提交理赔”→ `POST /api/v1/claims/:claimId/submit`（apps/us-backend/src/routes/claims.ts:215-252）。

## 后端“等待订单号即可”最小闭环
- 验证代理：`POST /api/v1/verify/okx` 与 `POST /api/v1/verify/okx/standard`，将 `ordId+instId` 转发至 jp-verify（apps/us-backend/src/routes/okx-verify.ts:291-293, 382-384）。
- 理赔接口：
  - `POST /api/v1/claims/prepare` 仅需 `orderId`。
  - `POST /api/v1/claims/verify` 支持 `orderId/claimId+claimToken`，内部解析并调用验证（apps/us-backend/src/routes/claims.ts:369-410）。
- jp-verify 行为：按 `ordId/instId` 拉取订单、持仓、成交，归一化证据并计算 `evidence_root`；返回标准视图含 `isLiquidated/verifyStatus`（apps/jp-verify/main.py:492-700, 834-997）。
- 证据落盘：`apps/jp-verify/reports/evidence/<date>/<evi>.json`，同时后端写入 `verify_results`（apps/us-backend/src/routes/okx-verify.ts:194-241）。

## 安全与合规
- 密钥格式/频率校验与黑名单（apps/jp-verify/main.py:172-193）。
- CORS/限流/错误处理与日志脱敏（apps/jp-verify/main.py:27-37, 465-490, 499-508）。
- 后端认证中间件：用户态、管理员态与 API-Key 旁路（apps/us-backend/src/routes/apiKeys.ts:239-247, apps/us-backend/src/routes/claims.ts:35-41）。

## 数据契约（示例）
- 保存密钥：`POST /api/v1/api-keys` body `{ exchange: 'okx', api_key, secret, passphrase }`。
- 标准验证：`POST /api/v1/verify/okx/standard` body `{ ordId, instId, keyMode: 'inline', apiKey, secretKey, passphrase }` → resp `{ status: 'verified'|'failed', isLiquidated, verifyStatus }`。
- 理赔准备：`POST /api/v1/claims/prepare` body `{ orderId }` → resp `{ ok: true, claimId, claimToken }`。
- 理赔验证：`POST /api/v1/claims/verify` body `{ orderId, claimToken }` → resp `verifiedClaimDetail`（含资格与证据摘要）。
- 理赔提交：`POST /api/v1/claims/:claimId/submit`。

## 首次使用引导文案与交互
- 检测 `GET /api/v1/api-keys` 为空 → 引导到 `API 设置`，显示“需要您的 OKX API（只读）以便自动验证订单”。
- 完成保存后弹窗提示“请输入最近一次强平的订单号与交易对进行一次验证”。
- 验证通过即显示“可发起理赔”，跳转 `赔付管理` 并自动填入订单号。

## 里程碑
- M1：启用现有 `ApiSettings` 与 `ClaimsPage`，打通“保存密钥→标准验证→理赔准备/验证/提交”。
- M2：优化首次引导（空列表引导、表单校验提示、DEV 回退直连 jp-verify）。
- M3：补充管理员理赔审核页与统计（已具备接口，强化 UI）。