# LiqPass 本地运行手册

从零把这套东西跑起来的完整步骤。**先读最后一节"已知仍不可用的部分"**，避免在死路上浪费时间。

---

## 0. 前置：密钥轮换（如果还没做）

仓库历史里有过真实主网私钥。在做任何部署之前：

- `0x32a13b8ac717C793e0dd3DA4c683409626bD17A9`（原 `PRICER_PRIVATE_KEY`）
- `0x00195EcF4FF21aB985b13FC741Cdf276C71D88A1`（原 `ISSUER_PRIVATE_KEY`，同时是 `PAYMENT_VAULT_ADDRESS`）

资产转走 → 合约 owner/treasury 换掉 → `git filter-repo` 清历史 → force push。
细节见 `AUDIT_REPORT.md` 第 1 节。

---

## 1. 环境要求

```bash
node -v     # 需要 >= 20
pnpm -v     # 需要 >= 8，没有就 npm i -g pnpm
```

`better-sqlite3` 是原生模块，需要能编译：macOS 装 Xcode Command Line Tools，Linux 装 `build-essential` + `python3`。

---

## 2. 安装依赖

```bash
cd LiqPass-main
pnpm install
```

> 根 `package.json` 里的 `pnpm --filter` 脚本原先全部写错了包名（`us-frontend` 实际叫
> `liqpass-frontend`），已修正；`pnpm-workspace.yaml` 原先漏了 `packages/*`，已补上。

---

## 3. 生成本地环境变量

```bash
pnpm setup:env
```

在 `apps/us-backend/.env.local` 生成一份随机密钥配置（权限 600，已被 `.gitignore` 排除）。
每次生成的 `JWT_SECRET` / `ADMIN_API_KEY` / 两把私钥都是新的随机值。

前端：

```bash
cp apps/us-frontend/.env.example apps/us-frontend/.env.local
```

> 生成的 `CHECKOUT_CONTRACT_ADDRESS` / `PAYMENT_VAULT_ADDRESS` / `USDC_ADDRESS` 是随机占位值，
> 只为让启动校验通过。部署完合约后必须替换成真实地址，否则支付相关接口全部无意义。

---

## 4. 验证能编译

```bash
pnpm typecheck      # 两个包分别 tsc --noEmit
pnpm build          # 前端 vite build + 后端 tsc
```

**这一步是本次改动唯一没被验证过的环节** —— 审计环境连不上 npm registry，
装不了依赖，所以所有类型检查都是在缺失第三方类型的情况下做的。
如果这里报错，把错误贴回来。

---

## 5. 启动

```bash
pnpm dev
```

- 后端 `http://127.0.0.1:3002`
- 前端 `http://localhost:5173`

单独启：

```bash
pnpm --filter us-backend dev
pnpm --filter liqpass-frontend dev
```

冒烟测试：

```bash
curl -s http://127.0.0.1:3002/api/v1/health | jq
```

启动时应当能看到 `🔧 已加载环境变量文件: .env.local`。
**看不到这行就说明环境变量没进来** —— 参见下面的说明。

> 原来的 `server.ts` 把 `dotenv.config()` 写在模块体里，而 `import app from './app.js'`
> 在它前面。ESM 会先把 import 全部求值完，所以 app.ts（连同 AuthService、
> 数据库初始化）在环境变量加载之前就跑完了 —— `.env` 里的配置一个都读不到。
> 现在改成 `import './loadEnv.js'` 放在首位。

---

## 6. 合约

```bash
cd contracts
cp .env.example .env        # 填入你自己的部署私钥和 BASESCAN_API_KEY
npx hardhat compile
```

⚠️ 合约的改动（`quoteHash` 绑定买家/订单/金额、金额规则改为区间校验）
**不会影响已部署在 `0xc423c3…d68` 的那份**。需要重新部署，然后：

1. 更新后端 `CHECKOUT_CONTRACT_ADDRESS` 和前端 `VITE_CHECKOUT_CONTRACT_ADDRESS`
2. 重新导出 ABI 到 `packages/abi/`（`isValidAmount` 和
   `validateAndNormalizeAmount` 已从 `pure` 改为 `view`，ABI 变了）
3. 报价流程改为：后端 `POST /api/v1/pricing/quote-hash`（需要 `X-Admin-Api-Key`）
   传 `wallet` + `orderId` + `amountUSDC`，返回绑定好的 `quoteHash`

构造函数原先无条件 `require(usdc_ == BASE_USDC)`，把合约钉死在 Base 主网 ——
任何测试网、本地链都部署不了，也就没法在上主网前跑通一次完整流程。
现在只在 `block.chainid == 8453` 时才强制校验官方 USDC 地址，其它链可传入自己的
MockUSDC。

---

## 已知仍不可用的部分

**1. 链上 `orderId` 与后端订单号没有关联**

`payPolicy.ts` 用 `ethers.id(地址:时间戳:随机数)` 现编一个 `orderId`，后端订单是另一套 ID。
支付核验只能靠「付款人 + 金额」匹配，同一用户同金额连续下两单时会有歧义。
建议改成后端创建订单时下发 `bytes32 orderId`，前端原样传给 `buyPolicy`。

**2. 半个后端是死代码**

从 `server.ts` 出发能到达的只有 39 个文件，另外 36 个（含 `adapters/`、`models/`、
`transparencyService`、`contractListenerService`、`verification*`）没有任何引用。
之前绝大多数编译错误都出在这批文件里。要么接上，要么删掉。

**3. 用浮点数算钱**

保费与赔付一路是 `Math.round(principal * ratio * 1e6)`。金额建议全程 BigInt。

**4. `minimal-create` 这条路径不记录赔付额**

它写入 `payout_usdc = 0`，理赔时得另行按产品规则计算。正式下单应该走
`POST /orders`（`createOrder`，服务端算保费和赔付），`minimal-create` 只适合演示。

---

## 鉴权模型（本轮接上）

仓库里本来就有完整的钱包签名登录（`POST /api/v1/auth/wallet/nonce` →
`/auth/wallet/verify`，配合 `wallet_login_challenges` 表），`authService.validateSession`
也强制 `loginType === 'wallet'`。只是订单相关接口一直没接上去。现在按常规做法接好了：

| 接口 | 现在的要求 |
|---|---|
| `GET /orders/my` | 需登录；**以会话里的钱包为准**，忽略客户端传入的 `address` 参数 |
| `POST /orders/:id/submit-tx` | 需登录 + 调用者钱包必须等于 `order.wallet` |
| `POST /orders/minimal-create` | 需登录 + 只能为自己的钱包建单 + 必须带已确认的 `txHash` |
| `POST /pricing/quote-hash` | 需 `X-Admin-Api-Key`（会花 owner 的 gas） |
| `GET /orders` | 需 `X-API-Key`（管理员全量列表） |

归属校验集中在 `src/middleware/walletOwnership.ts`：`getAuthWallet(req)` 取
`req.auth.profile.walletAddress`，`assertWalletMatches` 不匹配时返回 403（且不透露
订单是否存在）。

前端相应改动：`payPolicy.ts` 与 `Payment.tsx` 原先都用裸 `fetch` 不带任何凭证，
已改走 `api` 客户端（`requireAuth: true`，自动附上 `Authorization`）。
`Payment.tsx` 原先把两个调用都包在 `try{}catch{}` 里静默吞掉 —— 后端全部拒绝时
用户依然看到「支付完成」，现在失败会如实报错。

**所以：购买流程现在要求先完成钱包登录。** 前端如果还有未接登录态的入口，
会收到 401，需要引导用户先走 `/auth/wallet/nonce` + `/auth/wallet/verify`。

---

## 本轮已解决（此前列在本节里的）

- **两套互不兼容的 `buyPolicy` ABI** —— 查清了：`Products.tsx` 里那份 7 参数的
  `POLICY_ABI` 和 `ERC20_ABI` 从未被引用，实际支付走的是 `lib/payPolicy.ts` 的
  `buyPolicy(bytes32,uint256,bytes32)`。已删除死常量，不存在两套路径。
- **`orders` 表冲突** —— 已定位为根因并修复，见下节。
- **支付状态不落 SQL** —— `submit-tx` 现在会 `UPDATE orders SET status='paid', payment_tx_hash=...`。
- **两个 sqlite 驱动** —— us-backend 的 `sqlite3` 依赖已移除（实际驱动是
  better-sqlite3），并补上了 `@types/better-sqlite3`。
- **没有 CI** —— 已加 `.github/workflows/ci.yml`：typecheck + build + 单测，
  外加一个密钥扫描 job（拦截被提交的 `.env` 和硬编码私钥）。
- **`submit-tx` 无鉴权 / `GET /orders/my` 不验证地址归属** —— 已接上钱包登录，
  见上面「鉴权模型」一节。
- **第二条支付路径 `payPolicyWithWallet`** —— 和 `payPolicy` 一样会在拿不到后端
  报价时本地伪造 quoteHash（必定 revert，但用户已付掉 approve 的 gas），已一并修掉。

---

## ⚠️ 数据库需要重建

这是本轮最重要的发现：**`orders` 表此前建错了，应用层对它的每一次读写都会失败。**

`migrationManager.ts` 里的迁移顺序把 `001_create_contract_events.sql` 排在最前，
而它有一句 `CREATE TABLE IF NOT EXISTS orders`，建出来的是链上监听子系统的表结构
（`id` 自增、`order_id`、`buyer_address`、`amount`）。之后 `002_verify_schema.sql`
和 `010_persist_memory_tables.sql` 里的同名建表因为 `IF NOT EXISTS` 全部静默跳过 ——
包括应用层真正需要的那份（`id TEXT PRIMARY KEY`、`wallet_address`、`premium_usdc`…）。

结果就是 `orderServiceDb`、`orderDAO`、`minimal-create` 对 `orders` 的每一次
INSERT/SELECT 都会 `no such column`。这大概也是为什么订单要额外维护一份文件账本。

已做的处理：

- `001_create_contract_events.sql` 的表改名为 `contract_orders`
- `002_verify_schema.sql` 的表改名为 `order_verifications`（它存的是订单验证记录，同名不同义；没有任何代码读写它）
- `orders` 交回 `010_persist_memory_tables.sql`，并补上 `payment_tx_hash` / `payment_block_number`

**因此现有的 .db 文件必须删掉重建**（反正里面的 `orders` 本来就是不可用的）：

```bash
rm -f apps/us-backend/data/*.db apps/us-backend/*.sqlite
pnpm --filter us-backend dev     # 启动时自动重跑迁移
```

如果线上库里有真实数据，先备份，再人工核对 `contract_orders` 与新 `orders` 的对应关系。
