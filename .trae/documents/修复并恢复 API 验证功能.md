## 问题概览
- 当前反馈为“API 验证无法使用”。基于仓库内实现，认证由 JWT/Bearer 会话与 API Key 两条线组成，并在部分端点通过增强认证合并。
- 历史提交摘要与现状相符：
  - 统一认证错误与速率限制（见 `apps/us-backend/src/app.ts` 与错误类型定义）
  - 请求 ID 中间件（`apps/us-backend/src/middleware/requestId.ts`）
  - 强制仅钱包登录（路由与会话两处拦截）
  - API Key 验证（`X-API-Key-Id`/`X-API-Key-Secret`，作用域检查、抗计时侧信道）

## 历史实现回顾（对应文件）
- 路由与钱包登录：`apps/us-backend/src/routes/auth.ts`
- 会话与 JWT：`apps/us-backend/src/services/authService.ts`
- JWT 中间件：`apps/us-backend/src/middleware/authMiddleware.ts`
- API Key 中间件：`apps/us-backend/src/middleware/apiKeyAuth.ts`
- 增强认证组合：`apps/us-backend/src/middleware/enhancedAuth.ts`
- 请求 ID：`apps/us-backend/src/middleware/requestId.ts`
- 全局速率限制：`apps/us-backend/src/app.ts`

## 可能故障点
- 受保护路由未挂载正确中间件（JWT 或 API Key，或增强认证未使用）。
- 客户端请求头不匹配：`X-API-Key-Id`/`X-API-Key-Secret` 名称或长度不符；`Authorization: Bearer <token>` 缺失或拼写错误。
- 环境变量或密钥问题：`JWT_SECRET` 未设置一致；API Key 存储禁用或过期；时间比较与哈希片段校验失败。
- 作用域不足：路由要求的 `requiredScopes` 未正确配置或未授予。
- 速率限制或失败计数误判，导致请求被统一报错但未显式说明。

## 修复方案（实施步骤）
1. 路由保护与中间件接入核对
   - 确认受保护端点统一使用对应中间件：
     - 使用 JWT：`createAuthMiddleware(authService)`。
     - 使用 API Key：`createApiKeyAuthMiddleware(dbManager, options)` 并传入 `requiredScopes`。
     - 使用组合：`enhancedAuth` 提供的场景函数（如订单、赔付）。
   - 检查 `apps/us-backend/src/app.ts` 中中间件注册顺序：`requestId`、`rateLimit`、路由与认证。
2. 校正 API Key 请求头与校验逻辑
   - 统一客户端请求头为：`X-API-Key-Id` 与 `X-API-Key-Secret`。
   - 校验片段长度与 SHA256+`timingSafeEqual` 比较逻辑未被改动；保留失败记录与缓存语义。
   - 确认 `ApiKeyRepository.findByKeyId` 与禁用旧 Key 的路径有效。
3. 会话与 JWT 测试与修复
   - 发起 `POST /wallet/nonce` → `POST /wallet/verify` → 得到 `token`，以 `Authorization: Bearer <token>` 访问受保护接口，确认 `validateSession` 正常。
   - 保持“仅钱包登录”：验证路由拒绝包含邮箱字段；会话校验强制 `loginType === 'wallet'`。
4. 作用域与增强认证
   - 对使用 API Key 的端点，确认 `requiredScopes` 与实际 Key 的 `scopes` 匹配。
   - 对需更高保护的端点，启用 `enhancedAuth` 组合认证并审计 `logAuthAttempt`。
5. 统一错误与速率限制检查
   - 确认错误均通过统一模型返回（未泄漏秘密）。
   - 保持全局 `express-rate-limit` 与 API Key 失败滑窗，仅作警告而不误封。
6. 回归测试
   - 针对 JWT 与 API Key 分支新增/修复测试：
     - 成功路径、过期/无效 Token、头部缺失、秘密片段错误、作用域不足。
     - 计时安全比较与失败日志遮蔽。
7. 文档与提交
   - 依据项目规则：每次修改以清晰 git 提交记录说明变更，更新认证与调用文档（不泄漏敏感信息）。

## 预计改动点（示例）
- 在特定路由文件中补挂或切换到 `enhancedAuth`；或将误用的 `authMiddleware` 改为 `apiKeyAuth`。
- 修正客户端或示例代码的请求头名称与格式；校准作用域。
- 添加/修复测试用例覆盖认证失败与成功边界。

## 验证方式
- 本地以钱包流程获取 JWT 并访问受保护接口；以真实/测试 API Key 访问需要作用域的端点。
- 观察统一错误码与速率限制行为；确认日志不含敏感片段。

请确认执行上述修复方案，我将按该计划逐项落实，并在关键节点提交变更与更新文档。