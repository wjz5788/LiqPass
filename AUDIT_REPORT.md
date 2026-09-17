# LiqPass 代码审计报告

审计对象：`github.com/wjz5788/LiqPass` @ `8281ced`
日期：2026-09-13

---

## 🔴 P0 — 立刻处理（资金/凭证已泄露）

### 1. 生产环境私钥被提交进公开仓库

`apps/us-backend/.env.production` 已入库，内容是**真实的主网密钥**（非占位符）：

| 变量 | 形态 | 对应地址 |
|---|---|---|
| `PRICER_PRIVATE_KEY` | `0x` + 64 hex | `0x32a13b8ac717C793e0dd3DA4c683409626bD17A9` |
| `ISSUER_PRIVATE_KEY` | `0x` + 64 hex | `0x00195EcF4FF21aB985b13FC741Cdf276C71D88A1` |
| `JWT_SECRET` | 88 字符 | — |
| `ADMIN_API_KEY` | 64 字符 | — |

`ISSUER_PRIVATE_KEY` 对应的地址正是同一文件里的 `PAYMENT_VAULT_ADDRESS`（收款金库）。
配置指向 Base 主网（`PAYMENT_CHAIN_ID=8453`）。

**处置顺序（不可省略任何一步）：**

1. 把这两个地址里的全部资产转到新的冷钱包；
2. 合约 `owner` 若是泄露地址 → `transferOwnership` 到新地址；`treasury` 若是泄露地址 → `updateTreasury`；
3. 重新生成 `JWT_SECRET`、`ADMIN_API_KEY`（换 `JWT_SECRET` 会使所有已签发 token 失效，这是预期行为）；
4. 用 `git filter-repo` 或 BFG 清理历史，然后 force push；
5. **删文件 / 改 .gitignore 都不算修复** —— 仓库是公开的，历史已被抓取过，这些密钥永久作废。

已修复：`.gitignore` 现在会拦住所有 `.env*`（只放行 `.example` / `.sample`）。

### 2. 后端硬编码了公开的测试私钥作为兜底

```ts
// routes/pricing.ts:8  和  routes/voucher.ts:8
const PRICER_PRIVATE_KEY = process.env.PRICER_PRIVATE_KEY || '0xac0974bec...ff80';
```

`0xac0974be…` 是 **Hardhat / Anvil 的 0 号测试账户私钥**，全世界都知道。
一旦环境变量漏配，服务会静默地用一把公开私钥对报价和凭证签名，攻击者可以伪造任意报价。

`services/authService.ts:84` 同理：`process.env.JWT_SECRET ?? 'dev-secret'` —— 漏配即可任意伪造 JWT。

**已修复：** 新增 `src/utils/requireEnv.ts`，三处全部改为缺失即抛错（fail-fast），并要求 `JWT_SECRET` ≥ 32 字符。

### 3. `POST /orders/:orderId/submit-tx` 可以伪造支付

原实现只校验两件事：`tx.to === 合约地址`、`RPC 的链 ID === 期望链 ID`。第二条是同义反复（问的是 RPC 自己在哪条链，和这笔交易无关）。它**没有**校验：

- 这笔交易里有没有 `PremiumPaid` 事件
- 事件里的 `buyer` 是不是订单的钱包
- 事件里的 `amount` 是不是订单的保费
- 同一个 `txHash` 有没有被用过

后果：接口无鉴权 + 任何人只要从 basescan 抄一个打到该合约的交易哈希，就能把**任意订单**标记为已支付，而且同一个哈希可以无限复用。等于所有保单免费。

**已修复：** 解析 `PremiumPaid` 事件并逐项比对 buyer / amount，要求 `CONFIRMATIONS`（默认 3）个确认，`txHash` 与链上 `orderId` 均加唯一性校验。

> ⚠️ 该接口目前仍**没有鉴权**。我没有擅自加，因为不清楚前端此处走的是哪套登录态。建议挂上 `requireAuth` 并校验 `req.auth` 的钱包与 `order.wallet` 一致。

### 4. 合约里的 `quoteHash` 根本没有约束力

```solidity
require(isValidQuoteHash(quoteHash), "invalid or expired quote hash");
// 只查了 quoteHashExpiry[quoteHash] > block.timestamp
```

`quoteHash` 是一个和买家、订单、金额都无关的裸哈希，而 `registerQuoteHash` 又会公开 `emit QuoteHashRegistered(quoteHash, ...)`。
任何人都能从链上事件里抄一个尚未过期的 `quoteHash`，配上**自己的** `orderId` 和**任意金额**调用 `buyPolicy`。代码注释里写的"承诺买家/金额/金库"，一条都没有被强制执行。而且报价用完不作废，在有效期内可无限重放。

**已修复：**

```solidity
function quoteCommitment(address buyer, bytes32 orderId, uint256 amount) public pure returns (bytes32) {
    return keccak256(abi.encode(buyer, orderId, amount));
}
// buyPolicy 中：
require(quoteHash == quoteCommitment(msg.sender, orderId, normalizedAmount), "quote hash not bound to this purchase");
...
delete quoteHashExpiry[quoteHash];   // 一次性
```

新增 `registerQuote(buyer, orderId, amount, expiry)` 便捷入口、`MAX_QUOTE_TTL = 1 hours` 上限。后端 `/quote-hash` 已同步改为生成同款承诺哈希。

### 5. `POST /api/v1/pricing/quote-hash` 无鉴权且会花 gas

该接口用服务端 owner 私钥发起链上交易。原来完全匿名开放 —— 循环调用即可耗空 owner 钱包的 ETH，并写满 `quoteHashExpiry` 存储。

**已修复：** 挂上 `requireAdminApiKey`，`orderId` 与 `amountUSDC` 改为必填。

### 6. `GET /orders/my` 不带地址时返回全站订单

```ts
if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
  return res.json({ ok: true, orders: sorted });   // ← 全部用户的订单
}
```

**已修复：** 地址缺失或非法一律 400。

> ⚠️ 即使带了合法地址，该接口也**不验证调用者是否拥有这个地址**。任何人填别人的钱包地址就能看到对方的订单。要彻底修好需要钱包签名鉴权（项目里已有 `011_wallet_login_challenges.sql`，说明设计上是有的，只是这条路径没接上）。

### 7. CORS 在未配置时对全网开放，且带 credentials

```ts
if (allowedOrigins.length === 0) return callback(null, true);   // 配合 credentials:true
```

任意站点都能带着用户凭证跨域打你的 API。此外 `allowedHeaders` 里**没有** `X-API-Key`，而后端大量接口靠这个头鉴权 —— 跨域预检会直接拒掉，属于功能性 bug。

**已修复：** 生产环境未配 `ALLOWED_ORIGINS` 直接启动失败；开发环境只放行 localhost；补齐 `X-API-Key` / `X-Admin-Api-Key` / `Idempotency-Key` / `X-Request-Id`；加上 `trust proxy`（否则反代后面限流按代理 IP 计数，形同虚设）。

---

## 🟠 P1 — 功能性缺陷（当前流程跑不通）

### 8. 合约金额校验与文档、后端三方冲突

```solidity
return amount % (10 ** USDC_DECIMALS) == 0;   // 只接受整数个 USDC
```

`USDC_AMOUNT_RULES.md` 写的是"步长 1e-6，最小 0.01 USDC"，还举例 `✅ 10000（0.01 USDC）- 有效`。
实际上 `10000 % 1000000 = 10000 ≠ 0` → **无效**。文档举的两个"有效"例子在链上全部 revert。

而后端 `pricing.ts` 算的是 `Math.round(principal * feeRatio * 1e6)`，几乎不可能正好是 1e6 的整数倍。
**结论：当前任何一笔真实报价在链上都必然 revert。**

**已修复：** 改为 `minAmount <= amount <= maxAmount`（默认 0.01–100 USDC，与文档一致），新增 owner 可调的 `setAmountLimits`。

### 9. 前端在拿不到报价时**本地伪造** quoteHash

```ts
} catch {
  quoteHash = ethers.id(`${address}:${amountUSDC}:${Date.now()}`);   // 从未注册过
}
```

这个哈希不可能通过合约校验，`buyPolicy` 必定 revert —— 但用户已经先付掉了一笔 `approve` 的 gas，还拿不到任何有意义的报错。

**已修复：** 去掉兜底，拿不到报价直接抛出明确错误；请求体补上 `orderId`。

### 10. 前端存在两套互不兼容的 `buyPolicy` ABI

- `lib/payPolicy.ts` → `buyPolicy(bytes32,uint256,bytes32)` ← 与已部署合约一致
- `pages/Products.tsx` → `buyPolicy((address,uint32,bytes32,bytes32,uint256,uint256,bytes32),bytes,(...),bytes,uint32,uint96,bytes32) returns (uint256)`

后者在当前合约上不存在，走这条路必然失败。**未修复** —— 需要你确认哪一套是目标设计。

### 11. 链上 `orderId` 与后端订单号毫无关系

`payPolicy.ts` 用 `ethers.id(address:时间戳:随机数)` 生成 `orderId`，后端订单 ID 是另一套。两边对不上账，`submit-tx` 只能靠 buyer+amount 匹配（我的修复就是这么做的），在同一用户同金额下单两次时会歧义。**建议**：由后端在创建订单时下发 `bytes32 orderId`，前端原样使用。

### 12. 根 `package.json` 的所有 pnpm 脚本都是坏的

```json
"dev": "concurrently \"pnpm --filter us-frontend dev\" ..."
```

前端包名实际是 `liqpass-frontend`，`--filter us-frontend` 匹配不到任何包。`dev` / `build` / `test` / `lint` / `clean` 五条全部失效。

**已修复：** 全部改为 `liqpass-frontend`。

### 13. `pnpm-workspace.yaml` 漏了 `packages/*`

`packages/abi`（`@liqpass/abi`，声明为"ABI 与地址的唯一真相来源"）不在 workspace 里，任何 `workspace:` 引用都装不上。

**已修复。**

### 14. `.gitignore` 把整个测试套件排除在版本库外

```
*.test.js
*.test.ts
!/apps/us-backend/test/*.test.ts
```

除了后端 test 目录那一个例外，所有测试文件都不入库 —— 包括前端的全部单测。仓库里也没有任何 CI workflow（`.github/` 下只有一个 PR 模板），等于完全没有自动化验证。

**已修复：** 移除该规则。CI 仍需你自己补。

### 15. 数据库迁移编号重复、`orders` 表有 4 份互相冲突的定义

```
000_create_contract_events.sql   001_create_contract_events.sql   ← 重复
001_initial_schema.sql           002_org_structure.sql
002_verify_schema.sql            003_policy_claim_payout.sql
003_purchase_orders.sql          004_min_loop.sql
004_order_payments.sql           ...
```

`orders` 表在 `000` / `001` / `002` / `010` / `orderDAO.ts` 里各定义了一次，列不一样（`payment_tx_hash` vs `payment_tx`，有的根本没有该列）。因为都是 `CREATE TABLE IF NOT EXISTS`，谁先跑谁生效，其余静默失败 —— 表结构取决于迁移执行顺序，不同环境会长出不同的库。

**未修复** —— 这需要你决定哪一份是权威 schema，改动面太大不适合我盲改。建议：统一编号、删掉重复定义、`orders` 只保留一份，并让 `submit-tx` 的支付状态真正落到 SQL（目前只写文件账本 `appendOrder`，SQL 里的 `status` 从不更新）。

---

## 🟡 P2 — 卫生问题

| 问题 | 位置 | 说明 |
|---|---|---|
| 提交了 Python 虚拟环境 | `apps/jp-verify/.venv311/` | 26MB、2151 个文件，占仓库 2675 个受版本控制文件的 80%。已加进 `.gitignore`，仍需 `git rm -r --cached` |
| 提交了 SQLite WAL 文件 | `apps/us-backend/dev.sqlite-{shm,wal}`、`apps/chain-listener/database.db-{shm,wal}` | 已加 `.gitignore` |
| 订单保费由客户端传入 | `routes/orders.ts` `createSchema.premiumUSDC6d` | 客户端自报保费金额，服务端应自己算 |
| 用浮点数算钱 | `pricing.ts` / `orderService.ts` | `Math.round(principal * feeRatio * 1e6)`，建议全程 BigInt |
| EIP-712 类型缺 `skuId` | `pricing.ts` | 返回的 `quote` 有 10 个字段，签名的 `types.Quote` 只有 9 个，`skuId` 未被签名保护 |
| `requireAdminOrAuth` 名不副实 | `routes/apiKeys.ts:246` | 无条件 `next()`，只在 handler 里 401。非 admin 用户永远无法使用该路由 |
| `contracts/.env.test` 的私钥字段是中文占位符 | `TEST_WALLET_PRIVATE_KEY=你的测试钱包...` | 测试跑不起来 |
| 合约构造函数写死 `usdc_ == BASE_USDC` | `CheckoutUSDC.sol:54` | 无法部署到任何测试网，配合 `pricing.ts` 原先写死的 `chainId: 8453`，等于没有测试环境。已把后端改成读 `PAYMENT_CHAIN_ID` |
| `emergencyWithdraw` 排除 USDC | `CheckoutUSDC.sol` | 误转进合约的 USDC 将永久锁死 |
| `routes/voucher.ts` 是死代码 | 未在 `routes/index.ts` 注册 | 仍已修掉其中的硬编码私钥 |

---

## 本次改动清单

```
 .gitignore                                  |  29 ++++---
 apps/us-backend/src/app.ts                  |  43 +++++++---
 apps/us-backend/src/routes/orders.ts        |  96 ++++++++++++++++++---
 apps/us-backend/src/routes/pricing.ts       |  48 +++++++----
 apps/us-backend/src/routes/voucher.ts       |   7 +-
 apps/us-backend/src/services/authService.ts |  10 ++-
 apps/us-backend/src/utils/requireEnv.ts     |  新增
 apps/us-frontend/src/lib/payPolicy.ts       |  27 ++++---
 contracts/CheckoutUSDC.sol                  | 111 +++++++++++++++---------
 package.json                                |  10 +--
 pnpm-workspace.yaml                         |   1 +
```

完整 diff 见 `AUDIT_FIXES.patch`。

### ⚠️ 改动尚未编译验证

审计环境无法访问 npm registry 和 solc，所以这些修改**没有经过 `tsc` 和 `solc` 验证**，是静态审阅的结果。合并前请自行跑：

```bash
pnpm install
pnpm --filter us-backend exec tsc --noEmit
cd contracts && npx hardhat compile
```

### ⚠️ 合约改动需要重新部署

`CheckoutUSDC.sol` 的改动（`quoteHash` 绑定、金额规则）**不会影响已部署在 `0xc423c3…d68` 的合约**。需要：

1. 重新编译、部署新合约；
2. 更新 `CHECKOUT_CONTRACT_ADDRESS`（后端 + 前端 `VITE_` 变量）；
3. 重新导出 ABI 到 `packages/abi/`（`isValidAmount` / `validateAndNormalizeAmount` 已从 `pure` 改为 `view`，ABI 变了）；
4. 前端 `payPolicy.ts` 里的 `orderId` 与 `quoteHash` 必须来自后端同一次报价，否则新的绑定校验会拒绝。

在完成 P0 第 1 项（轮换密钥）之前，不要部署任何新合约 —— 部署交易会用到那把已泄露的私钥。
