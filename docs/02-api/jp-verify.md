# JP验证API规范

## 概述

JP验证服务器运行在端口8787，专门负责订单和理赔的真实性验证。该服务器使用只读API密钥访问交易所数据，确保验证的客观性和安全性。

## 通用规范

### 请求头
```http
Content-Type: application/json
Authorization: Bearer {us_backend_token}  # US后端认证令牌
X-API-Key: {exchange_api_key}           # 交易所API密钥（只读）
X-Request-ID: {request_id}             # 请求追踪ID
```

### 响应格式
```json
{
  "success": true,
  "data": {},
  "message": "验证成功"
}
```

### 错误响应格式
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

## API接口详情

### 1. GET /healthz

**描述**: 健康检查接口

**请求头**: 无特殊要求

**请求体**: 无

**响应Schema**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00Z",
    "version": "1.0.0",
    "exchange_connections": {
      "binance": "connected",
      "okx": "connected",
      "bybit": "connected"
    }
  },
  "message": "服务运行正常"
}
```

**错误码**: 无

**curl示例**:
```bash
curl -X GET http://localhost:8787/healthz
```

**幂等与重试语义**: 可无限重试，无副作用

---

### 2. POST /verify/order

**描述**: 验证订单真实性

**请求头**:
```http
Authorization: Bearer us_backend_token_abc123
X-API-Key: binance_readonly_key_xyz789
```

**请求JSON Schema**:
```json
{
  "exchange": "binance",
  "symbol": "BTCUSDT",
  "order_reference": "binance_order_123",
  "wallet_address": "0x742d35Cc6634C0532925a3b8D9d8B9b7c9d8b9b7",
  "expected_amount": 1.5,
  "expected_price": 50000,
  "verification_type": "order_existence"
}
```

**响应Schema**:
```json
{
  "success": true,
  "data": {
    "verified": true,
    "verification_id": "verif_abc123",
    "exchange": "binance",
    "symbol": "BTCUSDT",
    "order_reference": "binance_order_123",
    "actual_amount": 1.5,
    "actual_price": 50000.5,
    "order_status": "filled",
    "filled_at": "2024-01-01T10:30:00Z",
    "confidence_score": 0.95,
    "raw_data": {
      "order_id": "123456789",
      "client_order_id": "binance_order_123",
      "status": "FILLED",
      "executed_qty": "1.5",
      "cummulative_quote_qty": "75000.75"
    }
  },
  "message": "订单验证成功"
}
```

**错误码**:
- `EXCHANGE_CONNECTION_FAILED`: 交易所连接失败
- `ORDER_NOT_FOUND`: 订单不存在
- `INVALID_ORDER_REFERENCE`: 无效的订单引用
- `API_KEY_INVALID`: API密钥无效
- `RATE_LIMIT_EXCEEDED`: 请求频率超限

**curl示例**:
```bash
curl -X POST http://localhost:8787/verify/order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer us_backend_token_abc123" \
  -H "X-API-Key: binance_readonly_key_xyz789" \
  -d '{
    "exchange": "binance",
    "symbol": "BTCUSDT",
    "order_reference": "binance_order_123",
    "wallet_address": "0x742d35Cc6634C0532925a3b8D9d8B9b7c9d8b9b7",
    "expected_amount": 1.5,
    "expected_price": 50000,
    "verification_type": "order_existence"
  }'
```

**幂等与重试语义**: 可安全重试，验证结果基于实时数据

---

### 3. POST /verify/claim (扩展接口)

**描述**: 验证理赔条件真实性

**请求头**:
```http
Authorization: Bearer us_backend_token_abc123
X-API-Key: binance_readonly_key_xyz789
```

**请求JSON Schema**:
```json
{
  "exchange": "binance",
  "symbol": "BTCUSDT",
  "order_reference": "binance_order_123",
  "wallet_address": "0x742d35Cc6634C0532925a3b8D9d8B9b7c9d8b9b7",
  "claim_reason": "position_liquidated",
  "claimed_liquidation_price": 45000,
  "claimed_liquidation_time": "2024-01-01T14:30:00Z",
  "proof_uri": "https://example.com/liquidation_proof.json"
}
```

**响应Schema**:
```json
{
  "success": true,
  "data": {
    "verified": true,
    "verification_id": "claim_verif_xyz789",
    "exchange": "binance",
    "symbol": "BTCUSDT",
    "liquidation_confirmed": true,
    "actual_liquidation_price": 44980.5,
    "actual_liquidation_time": "2024-01-01T14:29:45Z",
    "liquidation_reason": "MARGIN_CALL",
    "confidence_score": 0.92,
    "raw_data": {
      "position_status": "LIQUIDATED",
      "liquidation_price": "44980.5",
      "liquidation_time": "1704119385",
      "remaining_margin": "0.00"
    }
  },
  "message": "理赔条件验证成功"
}
```

**错误码**:
- `LIQUIDATION_NOT_CONFIRMED`: 爆仓未确认
- `INVALID_LIQUIDATION_TIME`: 无效的爆仓时间
- `PROOF_VERIFICATION_FAILED`: 证明文件验证失败

**curl示例**:
```bash
curl -X POST http://localhost:8787/verify/claim \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer us_backend_token_abc123" \
  -H "X-API-Key: binance_readonly_key_xyz789" \
  -d '{
    "exchange": "binance",
    "symbol": "BTCUSDT",
    "order_reference": "binance_order_123",
    "wallet_address": "0x742d35Cc6634C0532925a3b8D9d8B9b7c9d8b9b7",
    "claim_reason": "position_liquidated",
    "claimed_liquidation_price": 45000,
    "claimed_liquidation_time": "2024-01-01T14:30:00Z",
    "proof_uri": "https://example.com/liquidation_proof.json"
  }'
```

**幂等与重试语义**: 可安全重试，基于实时数据验证

## 错误码总表

| 错误码 | HTTP状态码 | 描述 | 处理建议 |
|--------|------------|------|----------|
| EXCHANGE_CONNECTION_FAILED | 502 | 交易所连接失败 | 检查网络和API密钥 |
| ORDER_NOT_FOUND | 404 | 订单不存在 | 检查订单引用信息 |
| INVALID_ORDER_REFERENCE | 400 | 无效的订单引用 | 提供有效的订单引用 |
| API_KEY_INVALID | 401 | API密钥无效 | 更新API密钥 |
| RATE_LIMIT_EXCEEDED | 429 | 请求频率超限 | 降低请求频率 |
| LIQUIDATION_NOT_CONFIRMED | 404 | 爆仓未确认 | 检查爆仓时间和价格 |
| INVALID_LIQUIDATION_TIME | 400 | 无效的爆仓时间 | 提供有效的爆仓时间 |
| PROOF_VERIFICATION_FAILED | 422 | 证明文件验证失败 | 提供有效的证明文件 |

## 验证逻辑说明

### 订单验证流程
1. **连接交易所**：使用只读API密钥连接指定交易所
2. **查询订单**：根据订单引用信息查询订单详情
3. **验证匹配**：检查订单金额、价格、状态是否匹配
4. **计算置信度**：基于数据完整性和时效性计算置信分数
5. **记录日志**：将验证结果和原始数据记录到本地数据库

### 理赔验证流程  
1. **验证爆仓**：检查指定时间点的仓位状态
2. **确认价格**：验证爆仓价格是否与声称一致
3. **检查证明**：验证用户提供的爆仓证明文件
4. **综合评估**：结合多个数据源进行综合判断

## 安全考虑

- **只读API密钥**：JP验证服务器仅使用只读权限的API密钥
- **数据脱敏**：原始数据中的敏感信息在记录前进行脱敏处理
- **请求限流**：对每个交易所API实施严格的请求频率限制
- **连接超时**：设置合理的连接和响应超时时间
- **错误重试**：实现指数退避的重试机制

## 性能指标

- **响应时间**: < 300ms (95%分位，依赖交易所API响应)
- **可用性**: 99.5% (受交易所API可用性影响)
- **并发连接**: 100+
- **数据缓存**: 5分钟TTL缓存已验证结果

## 支持的交易所

| 交易所 | API端点 | 验证类型 | 备注 |
|--------|---------|----------|------|
| Binance | REST API | 现货/合约 | 支持订单和仓位验证 |
| OKX | REST API | 现货/合约 | 支持订单和仓位验证 |
| Bybit | REST API | 合约 | 主要支持合约仓位验证 |
| 其他交易所 | 按需扩展 | - | 可根据需求添加支持 |