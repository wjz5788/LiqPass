## 目标
- 明确两条流程的差异：输入与落库不同；共同点：都调用日本服务器能力。
- 统一后端访问 jp-verify 的方式与配置，避免环境变量和返回格式不一致。
- 保持现有路由不变，前端无需额外填写交易所与密钥（赔付页只填 orderRef）。

## 现状确认
- CORS 白名单：严格白名单已生效，未配置时开发环境放宽（apps/us-backend/src/app.ts:24-42）。
- 赔付验证：当 `USE_JP_VERIFY=1` 时已直接调用日本服务器标准接口（apps/us-backend/src/services/claimsService.ts:425-476）。
- API 管理验证：路由直接代理到日本服务器 `/api/verify` 与 `/api/verify/standard`（apps/us-backend/src/routes/okx-verify.ts:295-400）。
- 证据与审计：两条链路都会写入 `evidenceStorage` 与 `verify_results/audit_events`（claimsService.ts:383-408，okx-verify.ts:202-248）。

## 差异界定
- API 管理验证
  - 输入：`ordId、instId`，可选 `apiKey/secret/passphrase` 或别名。
  - 目的：检查密钥是否能拉到该订单；不动保单与理赔状态。
  - 入口：`POST /api/v1/verify/okx` 或 `POST /api/v1/verify/standard`（okx-verify.ts）。
- 赔付管理验证
  - 输入：`orderRef`（交易所订单号），与 `claimId` 或 `orderId`；不需要 symbol/apiKey。
  - 目的：落证据、更新理赔展示为待放款；写审计事件。
  - 入口：`POST /api/v1/claims/prepare` → `POST /api/v1/claims/verify`（claims.ts:321-427）。

## 一致性改造
- 统一配置
  - 使用同一变量 `JP_VERIFY_BASE_URL` 作为日本服务器基地址，兼容当前 `JP_VERIFY_BASE`，逐步弃用旧名。
  - 强制赔付链路走日本服务器：`USE_JP_VERIFY=1`，保留 `JP_VERIFY_TEST_MODE=1` 作为前端联调演示模式。
- 抽象客户端
  - 新增 `src/services/jpVerifyClient.ts`：封装 `verify({ ordId, instId, keyMode, apiKey... })` 与 `verifyStandard(...)`，统一超时、错误映射、规范化字段。
  - 路由 `okx-verify.ts` 改用该客户端；`claimsService.verifyViaJpServer` 也改用该客户端，避免重复 axios 代码与环境名分歧。
- 返回与证据对齐
  - 统一生成 `ClaimEvidenceSummary`：`exchange/symbol/side/size/isLiquidated/liquidationTime/pnl/currency/evidenceId`；
  - 赔付页 `toVerifiedClaimDetail(...)` 保持把 `status` 更新为 `WAITING_PAYOUT`（claimsService.ts:550-565）。
  - API 管理页返回 `status/verdict/is_liquidated/eligible_for_purchase/evidence_root/evidenceId`（okx-verify.ts:184-200）。
- 错误码规范
  - 日本服务器错误统一映射为：`SERVICE_UNAVAILABLE/TIMEOUT/VALIDATION_ERROR/UNSUPPORTED_EXCHANGE`；
  - 赔付链路保留：`ORDER_NOT_FOUND/ORDER_NOT_OWNED/ORDER_REF_MISMATCH/API_KEY_NOT_FOUND`。

## 前端协同
- API 管理页
  - 沿用 `POST /api/v1/verify/okx` 或 `/standard`；
  - 展示 `verdict/is_liquidated/eligible_for_purchase`，不改变保单状态。
- 赔付管理页
  - 只保留 `orderRef` 输入；流程：`prepare` → `verify`；
  - 使用返回的 `ClaimEvidenceSummary` 渲染卡片，把本地状态更新为“待放款”。

## 配置清单
- `ALLOWED_ORIGINS=http://127.0.0.1:3000,http://localhost:3000`（开发）
- `USE_JP_VERIFY=1`
- `JP_VERIFY_TEST_MODE=0`（联调时可设为 1）
- `JP_VERIFY_BASE_URL=http://127.0.0.1:8082`（或日本线上地址）

## 验证步骤
- API 管理：用示例密钥调用 `POST /api/v1/verify/okx`，确认返回 `verified/failed` 与 `evidenceId`，并检查 `verify_results` 入库（okx-verify.ts:202-248）。
- 赔付管理：`prepare` + `verify(orderRef=2940071038556348417)`，确认 `WAITING_PAYOUT` 与证据保存；查看 `apps/jp-verify/reports/evidence/...` 存档。

## 代码定位
- CORS 白名单：apps/us-backend/src/app.ts:24-42
- 赔付路由：apps/us-backend/src/routes/claims.ts:321-427
- 赔付服务：apps/us-backend/src/services/claimsService.ts:425-476、383-408、550-565
- OKX 代理：apps/us-backend/src/routes/okx-verify.ts:295-400、102-121、202-248

请确认以上方案；确认后我将按此统一配置与抽象客户端，确保两条验证链路最终都稳定调用日本服务器。