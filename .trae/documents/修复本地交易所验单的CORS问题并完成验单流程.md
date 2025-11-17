## 问题定位

* 后端在 `apps/us-backend/src/app.ts:25-42` 通过 `ALLOWED_ORIGINS` 严格白名单控制 CORS；当白名单非空且不含当前前端来源时会抛出 `Not allowed by CORS`（堆栈指向 `app.ts:36`）。

* 前端本地开发端口由 `apps/us-frontend/vite.config.ts:12-18` 设置为 `3000`，并将 `/api` 代理到后端；当前白名单很可能只包含 `http://localhost:5173`，与实际 `http://127.0.0.1:3000`/`http://localhost:3000` 不一致，导致被CORS拦截。

* 前端请求使用 `credentials: 'include'`（`apps/us-frontend/src/lib/authFetch.ts:17`），因此后端必须返回特定 `Access-Control-Allow-Origin`，不能使用通配 `*`。

## 修改计划

1. 更新后端白名单

   * 在 `apps/us-backend/.env` 增加或修正：

     * `ALLOWED_ORIGINS=http://127.0.0.1:3000,http://localhost:3000`

     * 如偶尔使用Vite默认端口，也可追加：`http://127.0.0.1:5173,http://localhost:5173`

   * 说明：`apps/us-backend/src/server.ts:8-13` 已加载 `.env`，修改后重启即可生效。
2. 重启后端与前端

   * 停止并重新启动后端开发服务（端口 `3012`）。

   * 重新启动前端开发服务（端口 `3000`）。
3. 验证CORS修复

   * 在浏览器打开 `http://localhost:3000` 或 `http://127.0.0.1:3000`。

   * 触发一次「验证」操作，确认 `/api/v1/claims/prepare` 与 `/api/v1/claims/verify` 返回 200，且不再出现 `Not allowed by CORS`。

## 完成交易所验单

1. 选择需要验单的保单，在「交易所订单号」输入框填入：`2940071038556348417`。
2. 点击「验证」按钮（`apps/us-frontend/src/pages/ClaimsManage.tsx:133-176`）。
3. 期望后端逻辑：

   * `POST /api/v1/claims/prepare` 生成 `claimId/claimToken`（`apps/us-backend/src/routes/claims.ts:321-351`）。

   * `POST /api/v1/claims/verify` 校验保单归属与 `orderRef` 一致（`apps/us-backend/src/services/claimsService.ts:283-306`），返回标准化验单结果（`apps/us-backend/src/services/claimsService.ts:550-566`）。
4. UI 应显示验证详情（交易所/币对/方向/数量/是否爆仓等）并把状态更新为待放款。

## 可能的业务校验提示

* 若仍失败并提示 `ORDER_REF_MISMATCH`：请确保当前保单的 `orderRef` 与输入的 `2940071038556348417` 完全一致（仅允许验证该保单绑定账户的该订单）。

* 若提示 `UNAUTHORIZED`：请先完成钱包登录，因接口受认证中间件保护（`apps/us-backend/src/routes/claims.ts:37-40`）。

## 交付与后续

* 修改内容仅为 `.env` 的白名单配置，不改动业务代码；遵循“开发环境未配置时宽松允许”的既有约定。

* 如需上线环境，请将前端正式域名加入 `ALLOWED_ORIGINS` 并保留最小集合，避免过度放开。

好，我们把这个事拆开，按“你要的效果”来重写一版后端逻辑，顺便帮你区分好两个世界：

&#x20;

* **API 管理验证** = 填 API Key + 订单号 + 交易对，主要是“你的密钥能不能拉到这笔订单？”
* **赔付管理验证** = 站在“保单”视角，只输入 **交易所订单号 orderRef**，其它都由后端根据保单/配置自动补齐，返回一张“是否爆仓”的证据卡片，状态切到“等待放款”。

***

## 你要的目标（重新表述一遍）

1. **API 管理页**：
   * 继续用原来的 `/api/v1/verify/okx` 或类似路由；
   * 前端给：API 信息（key/secret/passphrase）、交易对 symbol、订单号 orderRef；
   * 后端只是帮你测试，这套 API 能否拉到这个订单；不改保单状态。
2. **赔付管理页**：
   * 卡片已经有：保单信息（24h 爆仓保）、principal、leverage、premium、payoutMax、倒计时、订单内部 ID。
   * 现在你只想要：
     * 用户输入：**交易所订单号 orderRef**；
     * 点击「验证」；
     * 后端自动：用“固定交易对 + 绑定账号 + 订单号”去验一次，落证据，更新 claim 状态为 `WAITING_PAYOUT`；
     * 前端展示：交易所 / 币对 / 方向 / 数量 / 清算情况 / 时间 / PnL / 货币 / 证据编号。

所以，后端这边，**不要再要求赔付管理页面再去填 symbol / exchange / apiKey**，这些都在“API 管理”阶段完成+存库了。

***

## 给你已经写好的一版后端重构（放在画布里）

我已经在画布里帮你写了一份完整示例，包括两个文件：

* `apps/us-backend/src/routes/claims.ts`
* `apps/us-backend/src/services/claimsService.ts`

核心改动思想是：

### 1）路由：claims.ts 只暴露两个简单入口

```
// POST /api/v1/claims/prepare
// body: { orderId }
// 作用：按订单 ID + 当前用户生成/复用一条 claim，返回 { claimId, claimToken, orderId }

// POST /api/v1/claims/verify
// body: { claimId?, orderId?, orderRef }
// 作用：
//   - claimId 有的话按 claimId 找订单；
//   - 没有的话可以用 orderId 找已有 claim；
//   - 统一只收一个 orderRef（交易所订单号），symbol/exchange/apiKey 全部后端推导。

```

并且两个接口都挂了 `requireJwtAuth`，继续走你现在的 JWT 鉴权：

```
router.post("/prepare", requireJwtAuth, async (req, res, next) => { ... });

router.post("/verify", requireJwtAuth, async (req, res, next) => { ... });

```

前端赔付管理那边现在只要做：

1. 先 `POST /api/v1/claims/prepare` `{ orderId }` 拿到 `claimId`；
2. 再 `POST /api/v1/claims/verify` `{ claimId, orderRef }`。

完全不需要 symbol / apiKey 等字段。

***

### 2）服务：claimsService.ts 把“赔付验证”彻底和“API 验证”解耦

我在服务里写了两个核心函数：

#### prepareClaimForOrder({ orderId, userId })

* 查订单是否存在、是否属于当前用户；
* 看是否已经有绑定这个订单的 claim：
  * 有 → 直接复用，返回 `{ claimId, claimToken, orderId }`；
  * 没有 → 生成一条新 claim：
    * `id = uuid()`
    * `token = uuid()`
    * `status = 'PENDING_VERIFY'`
* 这样赔付管理页点「验证」之前，先保证有一条清晰的理赔记录。

#### verifyClaimAndCaptureEvidence({ claimId?, orderId?, orderRef, userId })

* 用 `claimId` 或 `orderId` 找到对应 claim 和 order：
  * 找不到 → `CLAIM_NOT_FOUND` / `ORDER_NOT_FOUND`；
  * 用户不匹配 → `ORDER_FORBIDDEN`。
* **不再从 body 里拿 symbol / exchange / apiKey**，全部内部决定：
  * 默认交易所：`CLAIM_DEFAULT_EXCHANGE`（没设就用 `okx`）；
  * 默认交易对：`CLAIM_DEFAULT_SYMBOL`（没设就用 `BTC-USDT-SWAP`）；
  * 绑定账号：从 `order.latestAccount` 或你订单里保存的账号字段拿。
* 根据模式选择验证来源：
  * `JP_VERIFY_TEST_MODE=1` → 返回固定 Demo 证据，方便前端调样式；
  * `USE_JP_VERIFY=1` → 调日本服务器 `jp-verify`；
  * 否则 → 用你本地直连 OKX 的实现（示例里叫 `fetchOkxEvidenceViaApiService`）。

得到 evidence 后：

1. 把证据落库到 `claimEvidences`（结构包含：exchange/symbol/side/size/isLiquidated/liquidationTime/pnl/currency/raw 等）；
2. 把 claim 状态更新为 `WAITING_PAYOUT`；
3. 返回一个前端刚好需要的 `ClaimEvidenceSummary`：
   ```
   {
     claimId,
     orderId,
     exchange,
     symbol,
     side,
     size,
     isLiquidated,
     liquidationTime,
     pnl,
     currency,
     evidenceRef, // 本地证据主键 / 目录名
   }

   ```

赔付管理页面拿到这个对象，直接画你之前想要的那张“卡片式证据链”。

***

## 配套环境变量（让“交易对固定”落地）

既然你说“现在交易对是固定的”，那就把它变成后端配置：

在 `apps/us-backend/.env.production` 或 `.env` 中加：

```
# 当前 MVP 下，赔付验证默认只看这一家交易所 / 交易对
CLAIM_DEFAULT_EXCHANGE=okx
CLAIM_DEFAULT_SYMBOL=BTC-USDT-SWAP

# Demo 模式（前端联调非常好用）
JP_VERIFY_TEST_MODE=1
USE_JP_VERIFY=0

```

之后要扩交易对，只要：

* 把产品表 / 订单表里加一个 `symbol` 字段；
* 在 `verifyClaimAndCaptureEvidence` 里改成优先用 `order.symbol`，没有才 fallback 到 `CLAIM_DEFAULT_SYMBOL`。

***

## 前端这边你需要对齐的点

1. **API 管理页**：继续用旧的 `/api/v1/verify/okx` 流程，不动。
2. **赔付管理页**：
   * 卡片里只保留一个输入框：`交易所订单号 orderRef`；
   * 点击「验证」时：
     * 先 `ensureWalletLogin()`，拿到 JWT（你前面我们已经一起改过）；
     * 调 `/api/v1/claims/prepare` `{ orderId }`；
     * 再调 `/api/v1/claims/verify` `{ claimId, orderRef }`；
   * 用返回的 `ClaimEvidenceSummary` 渲染证据区块，并把本地状态里的 `status` 更新为“待放款”。

***

## 总结一下你现在的状态

* CORS 白名单问题：你已经写了诊断，“`ALLOWED_ORIGINS` 要覆盖 127.0.0.1:3000 / localhost:3000”，这个改好之后，网络通路就干净了；
* 鉴权问题：赔付管理页要和下单页一样，先走一次钱包登录 / SIWE，拿到 JWT；
* 业务差异：**API 验证 = 填 API + 交易对 + 订单号；赔付验证 = 只填订单号，交易对和账号交给后端**。

后端这版重写，我已经放在画布里，你可以照着覆盖/对比你现有的 `claims.ts` 和 `claimsService.ts`，然后前端只保留 orderRef 输入就行。接下来，你就可以专心在这个“证据卡片 → 标记已赔付 → 人工打款”这个闭环上继续加细节了。
