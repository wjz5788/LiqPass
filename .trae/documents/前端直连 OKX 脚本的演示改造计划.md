**目标概述**

* 首次：在 `ApiSettings` 输入并保存完整 OKX API 凭据与固定交易对；做一次连通性校验。

* 后续：在 `ClaimsManage` 仅输入订单号，直接用已保存凭据与固定交易对做验证。

* 多用户：按照 `userId` 隔离本地存储，互不影响。

* 持久化：用 `localStorage` 保留配置，刷新后仍有效。

* 不依赖远程后端：在本机开发服务里桥接 Python 脚本。

**关键改动**

* 将现有的模拟脚本服务 `pythonScriptService.ts` 改为真实桥接：通过本机开发服务启动 Python，捕获脚本输出（JSON），返回给前端。

* 在 `ApiSettings.tsx` 首次保存密钥时即做一次脚本校验，并保存用户选择的固定交易对。

* 在 `ClaimsManage.tsx` 验证时只需要订单号，从本地读取凭据与固定交易对，调用脚本并展示结果。

**数据存储（localStorage 命名空间）**

* 键设计：`okx:keys:<userId>` 保存 `{ apiKey, secretKey, passphrase, uid }`

* 键设计：`okx:instId:<userId>` 保存固定交易对，如 `BTC-USDT-SWAP`

* 工具方法：`saveApiKeys(userId, keys)`、`getApiKeys(userId)`、`hasApiKeys(userId)`、`saveInstId(userId, instId)`、`getInstId(userId)`

**Python 桥接（开发服务中间件）**

* 在 `apps/us-frontend/vite.config.ts` 里注册中间件路由（例如 `/_scripts/okx/verify`）。

* 接口协议：`POST` JSON `{ userId, ordId, instId }`；从 `localStorage` 不可读，因此需由前端随请求安全传递凭据（或首次校验后缓存到本机安全区）。演示场景下使用请求体传递。

* 执行方式：`child_process.spawn('python3', [scriptPath], { env: { OKX_API_KEY, OKX_SECRET_KEY, OKX_PASSPHRASE, OKX_UID, ORD_ID, INST_ID } })`

* 输出约定：脚本 `stdout` 输出标准 JSON，如 `{ success, consistencyCheck, liquidationStatus, proof }`；`stderr` 作为错误信息。

* 安全与限制：仅开发演示使用；不在生产环境启用；不记录或回显敏感凭据。

**Python 脚本模板**

* 位置：`apps/us-frontend/scripts/okx_verify.py`（或复用 `reports/` 中已有查询逻辑抽象成通用模块）。

* 入参：从环境变量读取 `OKX_API_KEY/OKX_SECRET_KEY/OKX_PASSPHRASE/OKX_UID/ORD_ID/INST_ID`。

* 行为：调用 OKX 订单查询接口，做一致性与清算状态判断，打印 JSON 结果到 `stdout`。

**页面改造**

* `ApiSettings.tsx`

  * 增加固定交易对选择并保存到 `localStorage`。

  * 点击“保存并验证”时：

    * 保存 `keys` 与 `instId` 到命名空间键；

    * 调用 `pythonScriptService.verify({ userId, ordId: demoOrdId, instId })` 做连通性校验；

    * 校验成功后标记账号为已验证并提示成功。

* `ClaimsManage.tsx`

  * 表单仅输入订单号；

  * 读取 `keys` 与 `instId`（按 `userId`）；

  * 调用 `pythonScriptService.verify({ userId, ordId, instId })` 并展示返回结果；

  * 保持现有错误提示：“请先在API设置页面配置并保存API密钥”。

**脚本服务实现（前端调用封装）**

* `pythonScriptService.ts`

  * 方法：`saveApiKeys(userId, keys)`、`saveInstId(userId, instId)`、`hasApiKeys(userId)`。

  * 方法：`verify({ userId, ordId, instId })` → `fetch('/_scripts/okx/verify', { method: 'POST', body: JSON.stringify({ userId, ordId, instId, keys }) })`，返回脚本 JSON。

  * 方法：`simpleVerify(orderRef)` → 直接用固定交易对，不再做多交易对试探。

**错误处理与体验**

* 统一错误模型：`{ code, message, detail }`；超时与网络错误清晰提示。

* 校验失败场景：凭据错误、订单不存在、交易对不匹配、API 限频；分别给出可操作建议。

* 加载与进度：按钮 loading、结果抽屉保留现有交互。

**演示与验证**

* 本机运行 `pnpm -C apps/us-frontend dev` 后，前端通过中间件路由触发 Python。

* 首次在 `ApiSettings` 录入并验证；后续在 `ClaimsManage` 仅输入订单号完成验证。

* 用示例用户 `58359497793` 验证多用户隔离与持久化。

**风险与取舍**

* 在浏览器中无法直接运行 Python，需通过本机开发服务桥接，这不适合生产环境，但满足演示。

* `localStorage` 明文存储存在风险，演示场景可接受；如需提升，可用 Web Crypto 对称加密后再存储。

**实施步骤**

1. 改造 `pythonScriptService.ts` 增加按 `userId` 的存取与真实 `fetch` 调用。
2. 在 `vite.config.ts` 注册 `/_scripts/okx/verify` 路由，桥接 Python 执行并返回 JSON。
3. 建立或抽象通用 `okx_verify.py` 脚本，使用环境变量入参并输出标准 JSON。
4. 修改 `ApiSettings.tsx`：增加交易对保存与“保存并验证”流程。
5. 修改 `ClaimsManage.tsx`：仅订单号输入，读取本地配置调用脚本。
6. 联调与演示，覆盖连通性、错误提示、持久化与多用户场景。

