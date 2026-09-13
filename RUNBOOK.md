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

⚠️ 合约构造函数里有 `require(usdc_ == BASE_USDC)`，**写死了 Base 主网 USDC 地址**，
所以目前无法部署到任何测试网。要在本地链或测试网跑通，得先把这行改成可配置。

---

## 已知仍不可用的部分

这几项我没有动，因为需要你先做产品决策，盲改只会把问题埋更深。

**1. 前端有两套互不兼容的 `buyPolicy` ABI**

- `src/lib/payPolicy.ts` → `buyPolicy(bytes32,uint256,bytes32)`，与已部署合约一致
- `src/pages/Products.tsx` → 一个 7 参数的凭证版签名，当前合约里根本没有这个函数

走 `Products.tsx` 这条路一定失败。需要你确认哪一套是目标设计。

**2. 链上 `orderId` 与后端订单号没有关联**

`payPolicy.ts` 用 `ethers.id(地址:时间戳:随机数)` 现编一个 `orderId`，
后端订单是另一套 ID。两边对不上账，`submit-tx` 只能靠「付款人 + 金额」匹配，
同一用户同金额连续下两单时会有歧义。建议改成后端创建订单时下发 `bytes32 orderId`。

**3. 数据库迁移编号重复，`orders` 表有四份冲突定义**

`000`/`001` 重复，另有两个 `001_`、两个 `002_`、两个 `003_`、两个 `004_`。
`orders` 表在 `000`/`001`/`002`/`010` 和 `orderDAO.ts` 里各定义一次，
列还不一样（`payment_tx_hash` vs `payment_tx`，有的干脆没这列）。
因为都是 `CREATE TABLE IF NOT EXISTS`，谁先跑谁生效 —— 表结构取决于执行顺序，
不同机器会长出不同的库。需要你定哪份是权威 schema。

**4. 支付状态没有落到 SQL**

`submit-tx` 成功后只写文件账本（`appendOrder`），SQL 里的 `orders.status` 从不更新。

**5. `POST /orders/:orderId/submit-tx` 仍然没有鉴权**

任何人都能对任意订单号提交交易哈希。我加了链上事件核验（付款人、金额、确认数、
txHash 唯一性），伪造支付已经不成立，但接口本身仍应挂鉴权，并校验调用者钱包
与 `order.wallet` 一致。我不清楚这条路径该用哪套登录态，所以没动。

**6. `GET /orders/my` 不验证调用者是否拥有该地址**

填别人的钱包地址就能看到对方订单。仓库里有
`011_wallet_login_challenges.sql`，说明钱包签名登录本来是设计过的，只是没接上。

**7. 后端同时依赖 `better-sqlite3` 和 `sqlite3` 两个驱动**

`db.ts` 用的是 better-sqlite3（同步 API）。`models/quote.ts`、`routes/min.ts`、
`database/dao/base.ts` 却按 node-sqlite3 的回调风格写 —— 回调永远不会被调用，
Promise 永远挂起。这三处已按同步 API 改写，但两个驱动依赖都留在
`package.json` 里，建议删掉 `sqlite3`。

**8. 半个后端是死代码**

从 `server.ts` 出发能到达的只有 39 个文件，另外 36 个（含 `adapters/`、
`models/`、`transparencyService`、`contractListenerService`、`verification*`）
没有任何引用。绝大多数编译错误都出在这批文件里。要么接上，要么删掉。

**9. 没有 CI**

`.github/` 下只有一个 PR 模板。`.gitignore` 原先还把所有 `*.test.ts` 排除在
版本库之外（已修）。建议加一条跑 `pnpm verify` 的 workflow。
