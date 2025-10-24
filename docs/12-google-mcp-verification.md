# Google MCP验证功能文档

## 概述

Google MCP验证功能是LiqPass系统的一个高级验证模块，利用Google的生成式AI技术对订单进行智能验证。该功能提供了比传统API验证更智能、更灵活的验证机制。

## 功能特性

- **智能验证**: 使用Google MCP进行自然语言处理和智能分析
- **多维度评估**: 提供置信度评分、风险等级和详细说明
- **灵活配置**: 支持多种验证模式和自定义参数
- **备用逻辑**: 当Google MCP不可用时自动切换到备用验证逻辑

## 配置说明

### 环境变量

在`jp-verify/.env`文件中配置以下环境变量：

```bash
# Google MCP配置
GOOGLE_MCP_API_KEY=your_google_mcp_api_key_here
GOOGLE_MCP_BASE_URL=https://generativelanguage.googleapis.com

# 验证模式
VERIFY_MODE=real  # real: 真实验证模式, stub: 存根模式
```

### 验证模式

1. **stub模式**: 直接返回成功，用于开发和测试
2. **real模式**: 使用Google MCP进行真实验证

## API接口

### 验证订单

**端点**: `POST /verify/order`

**请求参数**:
```json
{
  "exchange": "google-mcp",
  "pair": "BTCUSDT",
  "orderRef": "your_order_reference",
  "wallet": "0x742d35Cc6634C0532925a3b8D6C0C5C68b7486eD"
}
```

**成功响应**:
```json
{
  "status": "ok",
  "exchange": "google-mcp",
  "pair": "BTCUSDT",
  "orderRef": "your_order_reference",
  "wallet": "0x742d35Cc6634C0532925a3b8D6C0C5C68b7486eD",
  "confidence": 85,
  "riskLevel": "low",
  "details": "订单验证通过，格式规范",
  "diagnostics": {
    "message": "Order successfully verified via Google MCP",
    "verifyMode": "real",
    "verifiedAt": "2025-10-24T12:26:08.885Z"
  }
}
```

**失败响应**:
```json
{
  "status": "fail",
  "reason": "订单格式不符合规范",
  "confidence": 30,
  "riskLevel": "high",
  "diagnostics": {
    "message": "Order verification failed via Google MCP",
    "verifyMode": "real",
    "failedAt": "2025-10-24T12:26:08.885Z"
  }
}
```

## 验证逻辑

### Google MCP验证流程

1. **请求构建**: 创建包含订单信息的验证请求
2. **AI分析**: 发送到Google MCP进行智能分析
3. **结果解析**: 解析AI响应并提取验证结果
4. **置信度评估**: 计算验证结果的置信度
5. **风险评级**: 评估订单的风险等级

### 备用验证逻辑

当Google MCP不可用时，系统会自动切换到基于关键词的备用验证逻辑：

- **有效关键词**: "有效", "真实", "确认", "存在"
- **置信度计算**: 基于关键词匹配程度
- **风险等级**: 根据置信度自动评估

## 集成示例

### 前端集成

在前端代码中调用Google MCP验证：

```javascript
// 调用验证接口
const response = await fetch('http://localhost:8788/verify/order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    exchange: 'google-mcp',
    pair: 'BTCUSDT',
    orderRef: 'order_123',
    wallet: '0x742d35Cc6634C0532925a3b8D6C0C5C68b7486eD'
  })
});

const result = await response.json();
if (result.status === 'ok') {
  console.log(`验证通过，置信度: ${result.confidence}%`);
} else {
  console.log(`验证失败: ${result.reason}`);
}
```

### 后端集成

在后端系统中集成Google MCP验证：

```javascript
// 调用验证服务
const verificationResult = await verifyOrder('google-mcp', 'BTCUSDT', 'order_123');

if (verificationResult.valid) {
  // 处理验证成功的订单
  console.log(`订单验证成功，风险等级: ${verificationResult.riskLevel}`);
} else {
  // 处理验证失败的订单
  console.log(`订单验证失败: ${verificationResult.details}`);
}
```

## 故障排除

### 常见问题

1. **API密钥错误**: 检查`GOOGLE_MCP_API_KEY`环境变量是否正确设置
2. **网络连接问题**: 确保服务器可以访问Google MCP API
3. **响应解析错误**: 检查Google MCP响应格式是否符合预期

### 调试方法

1. 检查服务器日志中的错误信息
2. 验证环境变量配置
3. 测试健康检查端点：`GET /healthz`

## 安全考虑

- API密钥应妥善保管，避免泄露
- 验证请求应包含适当的超时设置
- 建议在生产环境中使用HTTPS加密通信
- 定期轮换API密钥以提高安全性

## 性能优化

- 设置合理的请求超时时间（默认30秒）
- 使用连接池管理HTTP连接
- 考虑实现结果缓存机制
- 监控API调用频率和响应时间

## 版本历史

- **v1.0.0** (2025-10-24): 初始版本，支持Google MCP验证功能
- **v1.1.0** (2025-10-24): 增加置信度评分和风险等级评估

## 相关文档

- [API接口文档](../02-api/jp-verify.md)
- [系统架构文档](../00-arch/overview.md)
- [验证流程文档](../01-flow/order-claim-state.md)