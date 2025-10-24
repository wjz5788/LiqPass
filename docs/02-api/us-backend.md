# US后端API规范

## 概述

US后端服务器运行在端口8080，提供LiqPass核心业务逻辑API，包括产品目录、订单管理、理赔处理等功能。

## 通用规范

### 请求头
```http
Content-Type: application/json
Authorization: Bearer {token}  # 可选，用于管理员操作
Idempotency-Key: {unique_key}  # 幂等性键，防止重复操作
X-Request-ID: {request_id}     # 请求追踪ID
```

### 响应格式
```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
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
    "version": "1.0.0"
  },
  "message": "服务运行正常"
}
```

**错误码**: 无

**curl示例**:
```bash
curl -X GET http://localhost:8080/healthz
```

**幂等与重试语义**: 可无限重试，无副作用

---

### 2. GET /catalog/skus

**描述**: 获取产品SKU目录

**请求头**: 无特殊要求

**请求体**: 无

**响应Schema**:
```json
{
  "success": true,
  "data": {
    "skus": [
      {
        "id": "sku_5x_leverage",
        "name": "5倍杠杆保险",
        "description": "针对5倍杠杆交易的保险产品",
        "premium": 0.05,
        "payout_multiplier": 10,
        "leverage": 5,
        "duration_hours": 24,
        "max_coverage": 1000
      }
    ]
  },
  "message": "获取产品目录成功"
}
```

**错误码**:
- `CATALOG_UNAVAILABLE`: 产品目录不可用

**curl示例**:
```bash
curl -X GET http://localhost:8080/catalog/skus
```

**幂等与重试语义**: 可安全重试，数据只读

---

### 3. POST /orders

**描述**: 创建新订单

**请求头**:
```http
Idempotency-Key: order_create_{wallet}_{timestamp}
```

**请求JSON Schema**:
```json
{
  "sku_id": "sku_5x_leverage",
  "wallet_address": "0x742d35Cc6634C0532925a3b8D9d8B9b7c9d8b9b7",
  "exchange": "binance",
  "symbol": "BTCUSDT",
  "order_reference": "binance_order_123",
  "premium_amount": 0.05
}
```

**响应Schema**:
```json
{
  "success": true,
  "data": {
    "order_id": "order_abc123",
    "status": "paid",
    "created_at": "2024-01-01T00:00:00Z",
    "expires_at": "2024-01-02T00:00:00Z"
  },
  "message": "订单创建成功"
}
```

**错误码**:
- `INVALID_SKU`: 无效的SKU ID
- `INSUFFICIENT_FUNDS`: 资金不足
- `ORDER_ALREADY_EXISTS`: 订单已存在
- `VERIFICATION_FAILED`: JP验证失败

**curl示例**:
```bash
curl -X POST http://localhost:8080/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order_create_0x742d35Cc6634C0532925a3b8D9d8B9b7c9d8b9b7_1704067200" \
  -d '{
    "sku_id": "sku_5x_leverage",
    "wallet_address": "0x742d35Cc6634C0532925a3b8D9d8B9b7c9d8b9b7",
    "exchange": "binance",
    "symbol": "BTCUSDT",
    "order_reference": "binance_order_123",
    "premium_amount": 0.05
  }'
```

**幂等与重试语义**: 使用Idempotency-Key确保幂等性，相同键的请求返回相同结果

---

### 4. GET /orders/:id

**描述**: 查询订单详情

**请求头**: 无特殊要求

**路径参数**:
- `id`: 订单ID

**响应Schema**:
```json
{
  "success": true,
  "data": {
    "order_id": "order_abc123",
    "sku_id": "sku_5x_leverage",
    "wallet_address": "0x742d35Cc6634C0532925a3b8D9d8B9b7c9d8b9b7",
    "exchange": "binance",
    "symbol": "BTCUSDT",
    "order_reference": "binance_order_123",
    "premium_amount": 0.05,
    "status": "active",
    "created_at": "2024-01-01T00:00:00Z",
    "expires_at": "2024-01-02T00:00:00Z",
    "claims": []
  },
  "message": "获取订单详情成功"
}
```

**错误码**:
- `ORDER_NOT_FOUND`: 订单不存在

**curl示例**:
```bash
curl -X GET http://localhost:8080/orders/order_abc123
```

**幂等与重试语义**: 可安全重试，数据只读

---

### 5. POST /claim

**描述**: 提交理赔申请

**请求头**:
```http
Idempotency-Key: claim_create_{order_id}_{timestamp}
```

**请求JSON Schema**:
```json
{
  "order_id": "order_abc123",
  "reason": "position_liquidated",
  "proof_uri": "https://example.com/proof.json",
  "liquidated_amount": 100,
  "liquidated_price": 50000
}
```

**响应Schema**:
```json
{
  "success": true,
  "data": {
    "claim_id": "claim_xyz789",
    "order_id": "order_abc123",
    "status": "filed",
    "filed_at": "2024-01-01T12:00:00Z",
    "estimated_payout": 500
  },
  "message": "理赔申请提交成功"
}
```

**错误码**:
- `ORDER_NOT_FOUND`: 订单不存在
- `CLAIM_ALREADY_EXISTS`: 理赔已存在
- `ORDER_EXPIRED`: 订单已过期
- `INVALID_PROOF`: 无效的证明文件

**curl示例**:
```bash
curl -X POST http://localhost:8080/claim \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: claim_create_order_abc123_1704096000" \
  -d '{
    "order_id": "order_abc123",
    "reason": "position_liquidated",
    "proof_uri": "https://example.com/proof.json",
    "liquidated_amount": 100,
    "liquidated_price": 50000
  }'
```

**幂等与重试语义**: 使用Idempotency-Key确保幂等性

---

### 6. GET /claim/:id

**描述**: 查询理赔详情

**请求头**: 无特殊要求

**路径参数**:
- `id`: 理赔ID

**响应Schema**:
```json
{
  "success": true,
  "data": {
    "claim_id": "claim_xyz789",
    "order_id": "order_abc123",
    "status": "approved",
    "reason": "position_liquidated",
    "proof_uri": "https://example.com/proof.json",
    "filed_at": "2024-01-01T12:00:00Z",
    "verified_at": "2024-01-01T12:30:00Z",
    "payout_amount": 500,
    "payout_tx_hash": "0xabc123..."
  },
  "message": "获取理赔详情成功"
}
```

**错误码**:
- `CLAIM_NOT_FOUND`: 理赔不存在

**curl示例**:
```bash
curl -X GET http://localhost:8080/claim/claim_xyz789
```

**幂等与重试语义**: 可安全重试，数据只读

## 错误码总表

| 错误码 | HTTP状态码 | 描述 | 处理建议 |
|--------|------------|------|----------|
| CATALOG_UNAVAILABLE | 503 | 产品目录不可用 | 稍后重试 |
| INVALID_SKU | 400 | 无效的SKU ID | 检查SKU参数 |
| INSUFFICIENT_FUNDS | 402 | 资金不足 | 充值后重试 |
| ORDER_ALREADY_EXISTS | 409 | 订单已存在 | 使用现有订单ID |
| VERIFICATION_FAILED | 422 | JP验证失败 | 检查订单信息 |
| ORDER_NOT_FOUND | 404 | 订单不存在 | 检查订单ID |
| CLAIM_ALREADY_EXISTS | 409 | 理赔已存在 | 使用现有理赔ID |
| ORDER_EXPIRED | 410 | 订单已过期 | 创建新订单 |
| INVALID_PROOF | 400 | 无效的证明文件 | 提供有效证明 |
| CLAIM_NOT_FOUND | 404 | 理赔不存在 | 检查理赔ID |

## 性能指标

- **响应时间**: < 200ms (95%分位)
- **可用性**: 99.9%
- **并发连接**: 1000+
- **数据一致性**: 最终一致性

## 安全考虑

- 所有敏感操作需要Idempotency-Key
- 订单创建和理赔申请需要钱包地址验证
- 与JP验证服务器的通信需要TLS加密
- 数据库操作需要事务保护