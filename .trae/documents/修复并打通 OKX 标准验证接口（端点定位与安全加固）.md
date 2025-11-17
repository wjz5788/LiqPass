## 目标
- 直接在 `apps/jp-verify` 模块定位并修复“端点不存在”问题，打通 `POST /api/verify/standard` 验证。
- 用您提供的 `UID/ordId/instId(BTCUSDT)` 完成一次标准验证调用。
- 保持现有 `JP_VERIFY_TEST_MODE=1` 便于调试；同时规划密钥安全加固。

## 端点与请求模型
- 健康检查：`GET http://127.0.0.1:8082/healthz`（`apps/jp-verify/main.py:451-454`）。
- 标准验证：`POST http://127.0.0.1:8082/api/verify/standard`（`apps/jp-verify/main.py:825-995`）。
- 完整验证：`POST http://127.0.0.1:8082/api/verify`（`apps/jp-verify/main.py:483-768`）。
- 请求体模型：`VerifyRequest`（`apps/jp-verify/main.py:40-55`）。

## 关键差异与校准
- `instId` 需为 OKX V5 的合约标识；标准验证逻辑使用 `SWAP` 接口族（`fills-history`/`positions` 均以 `instType=SWAP`，见 `apps/jp-verify/main.py:547-550, 561-568, 855-859`）。
- 将 `BTCUSDT` 校正为 `BTC-USDT-SWAP`；如订单非合约而是现货，再改为 `BTC-USDT`（执行时以返回 `order_result` 校验）。

## 调试指令（占位不回显真实密钥）
```
curl -X POST 'http://127.0.0.1:8082/api/verify/standard' \
  -H 'Content-Type: application/json' \
  -d '{
    "exchange": "okx",
    "ordId": "2940071038556348417",
    "instId": "BTC-USDT-SWAP",
    "keyMode": "inline",
    "apiKey": "<REDACTED>",
    "secretKey": "<REDACTED>",
    "passphrase": "<REDACTED>",
    "uid": "201933253463154688",
    "live": true,
    "fresh": true,
    "noCache": true
  }'
```
- 返回为“标准视图”，含 `verifyStatus`/`isLiquidated` 等（`apps/jp-verify/main.py:782-824`）。

## 执行步骤
1. 运行健康检查确认服务正常。
2. 按上述 cURL 触发标准验证；若报 `MISSING_CREDENTIALS/OKX_AUTH_401`，因 `JP_VERIFY_TEST_MODE=1` 已放松格式，但仍需有效密钥与签名；如失败，以返回 `code/msg` 定位。
3. 若 `ordId` 找不到，服务会回退尝试 `clOrdId`；同时以 `public/instruments`/`positions`/`fills-history` 校验（代码参见上述行号）。
4. 记录并保存证据到 `reports/evidence/YYYY-MM-DD`（`apps/jp-verify/main.py:315-340`）。

## 安全加固（计划）
- 移除 `reports/order-details-*.py` 中硬编码密钥，改为环境变量读取（不进入仓库）；
- 支持后续 `keyAlias` 模式（已在模型中，`apps/jp-verify/main.py:53`），避免明文密钥在日志/证据中出现；
- CORS 通过 `ALLOWED_ORIGINS` 收敛（`apps/jp-verify/main.py:27-37`）。

## 验证与交付
- 验证通过后，输出一次标准视图响应简表与证据文件路径；
- 更新文档指向 `http://127.0.0.1:8082/api/verify/standard`，并附 `instId` 取值说明（SWAP/现货差异）。

确认后我将按此方案在 `apps/jp-verify` 内完成调试与验证。