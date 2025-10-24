# 审计与证据留存文档

## 文档概述

**文档目的**：定义LiqPass系统的审计日志标准和证据留存策略，确保交易和理赔过程的可追溯性和可验证性。
**适用对象**：开发团队、运维团队、审计人员
**文档版本**：v1.0
**最后更新**：2024-12-19

## 1. 审计日志标准

### 1.1 日志级别定义
- **DEBUG**：开发调试信息
- **INFO**：业务操作记录
- **WARN**：警告信息
- **ERROR**：错误信息
- **AUDIT**：审计关键事件

### 1.2 核心审计事件

#### 1.2.1 用户操作审计
```json
{
  "event_type": "USER_ACTION",
  "user_id": "0x1234...",
  "action": "WALLET_CONNECT",
  "timestamp": "2024-12-19T10:00:00Z",
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "session_id": "session_abc123"
}
```

#### 1.2.2 订单创建审计
```json
{
  "event_type": "ORDER_CREATED",
  "order_id": "ORD_20241219100000",
  "user_id": "0x1234...",
  "sku_id": "DAY_24H_FIXED",
  "premium_amount": 5000,
  "payout_amount": 100000,
  "leverage_multiplier": 3,
  "timestamp": "2024-12-19T10:00:00Z",
  "transaction_hash": "0xabc123...",
  "block_number": 12345678
}
```

#### 1.2.3 价格验证审计
```json
{
  "event_type": "PRICE_VERIFICATION",
  "order_id": "ORD_20241219100000",
  "exchange": "binance",
  "symbol": "BTCUSDT",
  "price_at_order": 45000.50,
  "price_at_verification": 42000.25,
  "price_drop_percentage": 6.67,
  "threshold_percentage": 5.00,
  "verification_result": "TRIGGERED",
  "verification_timestamp": "2024-12-20T10:00:00Z",
  "data_source": "BINANCE_API",
  "api_response_hash": "hash_abc123"
}
```

#### 1.2.4 理赔触发审计
```json
{
  "event_type": "CLAIM_TRIGGERED",
  "claim_id": "CLM_20241220100000",
  "order_id": "ORD_20241219100000",
  "user_id": "0x1234...",
  "payout_amount": 100000,
  "payout_address": "0x5678...",
  "trigger_reason": "PRICE_DROP_EXCEEDED",
  "price_data": {
    "initial_price": 45000.50,
    "trigger_price": 42000.25,
    "drop_percentage": 6.67
  },
  "transaction_hash": "0xdef456...",
  "block_number": 12346789,
  "timestamp": "2024-12-20T10:00:00Z"
}
```

## 2. 不可变对象存储策略

### 2.1 证据存储架构

#### 2.1.1 链上存储
- **智能合约事件**：关键业务事件上链
- **IPFS存储**：大文件和数据证据存储
- **时间戳服务**：外部时间戳验证

#### 2.1.2 链下存储
- **审计数据库**：结构化审计日志
- **文件存储**：API响应、截图等原始证据
- **备份策略**：多地多副本存储

### 2.2 证据哈希链

```javascript
// 证据哈希计算示例
const calculateEvidenceHash = (evidenceData) => {
  const dataString = JSON.stringify(evidenceData, Object.keys(evidenceData).sort());
  return crypto.createHash('sha256').update(dataString).digest('hex');
};

// 证据链构建
const evidenceChain = {
  order_creation: {
    hash: 'hash_order_123',
    timestamp: '2024-12-19T10:00:00Z',
    previous_hash: null
  },
  price_verification: {
    hash: 'hash_verify_456',
    timestamp: '2024-12-20T10:00:00Z',
    previous_hash: 'hash_order_123'
  },
  claim_triggered: {
    hash: 'hash_claim_789',
    timestamp: '2024-12-20T10:01:00Z',
    previous_hash: 'hash_verify_456'
  }
};
```

## 3. 链上事件映射

### 3.1 智能合约事件

#### 3.1.1 PolicyCreated事件
```solidity
event PolicyCreated(
    uint256 indexed policyId,
    address indexed user,
    uint256 premium,
    uint256 payoutAmount,
    uint256 leverage,
    uint256 startTime,
    uint256 duration
);
```

#### 3.1.2 PayoutTriggered事件
```solidity
event PayoutTriggered(
    uint256 indexed policyId,
    address indexed user,
    uint256 payoutAmount,
    uint256 triggerPrice,
    uint256 initialPrice,
    uint256 dropPercentage
);
```

### 3.2 事件索引策略

#### 3.2.1 事件索引表
| 字段 | 类型 | 描述 |
|------|------|------|
| event_id | string | 事件唯一标识 |
| contract_address | address | 合约地址 |
| event_name | string | 事件名称 |
| block_number | uint | 区块号 |
| transaction_hash | string | 交易哈希 |
| log_index | uint | 日志索引 |
| timestamp | datetime | 时间戳 |
| event_data | json | 事件数据 |

#### 3.2.2 事件同步机制
```javascript
// 事件监听器示例
const eventListener = async (event) => {
  const eventRecord = {
    event_id: `${event.transactionHash}_${event.logIndex}`,
    contract_address: event.address,
    event_name: event.event,
    block_number: event.blockNumber,
    transaction_hash: event.transactionHash,
    log_index: event.logIndex,
    timestamp: new Date(),
    event_data: event.args
  };
  
  // 存储到审计数据库
  await auditDB.insert('contract_events', eventRecord);
  
  // 计算证据哈希
  const evidenceHash = calculateEvidenceHash(eventRecord);
  
  // 存储到IPFS
  const ipfsHash = await ipfs.add(Buffer.from(JSON.stringify(eventRecord)));
  
  console.log(`事件已记录: ${event.event}, 证据哈希: ${evidenceHash}, IPFS: ${ipfsHash}`);
};
```

## 4. 可复算性保障

### 4.1 数据源可验证

#### 4.1.1 价格数据验证
```javascript
// 价格数据验证函数
const verifyPriceData = async (timestamp, symbol, exchange) => {
  // 从多个数据源获取历史价格
  const sources = [
    { name: 'BINANCE_API', url: 'https://api.binance.com/api/v3/klines' },
    { name: 'COINGECKO_API', url: 'https://api.coingecko.com/api/v3' },
    { name: 'OKX_API', url: 'https://www.okx.com/api/v5/market/history-candles' }
  ];
  
  const prices = await Promise.all(
    sources.map(async (source) => {
      const price = await fetchHistoricalPrice(source, timestamp, symbol);
      return { source: source.name, price, timestamp };
    })
  );
  
  return prices;
};
```

#### 4.1.2 数据一致性检查
```javascript
// 数据一致性验证
const verifyDataConsistency = (prices) => {
  const validPrices = prices.filter(p => p.price !== null);
  if (validPrices.length < 2) {
    throw new Error('数据源不足，无法验证一致性');
  }
  
  const avgPrice = validPrices.reduce((sum, p) => sum + p.price, 0) / validPrices.length;
  const deviations = validPrices.map(p => Math.abs(p.price - avgPrice) / avgPrice);
  
  // 检查偏差是否在允许范围内
  const maxDeviation = 0.02; // 2%
  const isConsistent = deviations.every(d => d <= maxDeviation);
  
  return {
    isConsistent,
    averagePrice: avgPrice,
    deviations,
    sources: validPrices.map(p => p.source)
  };
};
```

### 4.2 计算过程可重现

#### 4.2.1 保费计算重现
```javascript
// 保费计算函数（确定性）
const calculatePremium = (payoutAmount, leverage, duration, riskFactor) => {
  const basePremium = payoutAmount / leverage;
  const timeFactor = duration / (24 * 60 * 60); // 转换为天数
  const riskMultiplier = 1 + (riskFactor * timeFactor);
  
  return Math.round(basePremium * riskMultiplier);
};

// 计算验证
const verifyPremiumCalculation = (orderData) => {
  const { payoutAmount, leverage, duration, riskFactor, actualPremium } = orderData;
  const calculatedPremium = calculatePremium(payoutAmount, leverage, duration, riskFactor);
  
  return {
    isCorrect: calculatedPremium === actualPremium,
    calculatedPremium,
    actualPremium,
    parameters: { payoutAmount, leverage, duration, riskFactor }
  };
};
```

#### 4.2.2 赔付触发条件验证
```javascript
// 赔付触发验证
const verifyClaimTrigger = (orderData, priceData) => {
  const { initialPrice, triggerThreshold } = orderData;
  const { currentPrice, verificationTime } = priceData;
  
  const priceDrop = (initialPrice - currentPrice) / initialPrice;
  const shouldTrigger = priceDrop >= triggerThreshold;
  
  return {
    shouldTrigger,
    priceDrop: priceDrop * 100, // 转换为百分比
    triggerThreshold: triggerThreshold * 100,
    initialPrice,
    currentPrice,
    verificationTime
  };
};
```

## 5. 证据留存策略

### 5.1 短期存储（30天）
- **原始API响应**：交易所API原始响应数据
- **用户操作日志**：完整的用户交互记录
- **系统状态快照**：关键时间点的系统状态

### 5.2 中期存储（1年）
- **审计日志**：结构化审计事件记录
- **业务数据**：订单、理赔等业务数据
- **计算证据**：保费计算、赔付触发等计算过程

### 5.3 长期存储（7年）
- **链上事件**：智能合约事件记录
- **证据哈希**：关键证据的哈希值
- **时间戳证明**：外部时间戳服务记录

### 5.4 存储加密与完整性

#### 5.4.1 数据加密
```javascript
// 敏感数据加密
const encryptSensitiveData = (data, key) => {
  const cipher = crypto.createCipher('aes-256-gcm', key);
  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return { encrypted, authTag, iv: cipher.iv.toString('hex') };
};

// 数据解密
const decryptSensitiveData = (encryptedData, key) => {
  const decipher = crypto.createDecipher('aes-256-gcm', key);
  decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
  decipher.setAAD(Buffer.from(encryptedData.iv, 'hex'));
  
  let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
};
```

#### 5.4.2 完整性验证
```javascript
// 数据完整性检查
const verifyDataIntegrity = (data, storedHash) => {
  const currentHash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return currentHash === storedHash;
};

// 定期完整性扫描
const performIntegrityScan = async () => {
  const auditRecords = await auditDB.select('audit_logs');
  
  for (const record of auditRecords) {
    const isIntact = verifyDataIntegrity(record.data, record.data_hash);
    if (!isIntact) {
      console.warn(`数据完整性异常: ${record.id}`);
      // 触发告警和修复流程
    }
  }
};
```

## 6. 审计查询接口

### 6.1 RESTful API设计

#### 6.1.1 查询审计日志
```http
GET /api/v1/audit/events
Query Parameters:
- event_type: 事件类型
- user_id: 用户ID
- start_time: 开始时间
- end_time: 结束时间
- limit: 返回数量
- offset: 偏移量
```

#### 6.1.2 获取证据链
```http
GET /api/v1/audit/evidence-chain/{order_id}
Response:
{
  "order_id": "ORD_20241219100000",
  "evidence_chain": [
    {
      "event_type": "ORDER_CREATED",
      "timestamp": "2024-12-19T10:00:00Z",
      "evidence_hash": "hash_abc123",
      "ipfs_hash": "QmXYZ...",
      "block_number": 12345678
    },
    // ... 更多事件
  ]
}
```

### 6.2 数据导出功能

#### 6.2.1 审计报告生成
```javascript
// 生成审计报告
const generateAuditReport = async (orderId, format = 'pdf') => {
  const evidenceChain = await getEvidenceChain(orderId);
  const verificationResults = await verifyAllCalculations(orderId);
  
  const report = {
    order_id: orderId,
    generated_at: new Date().toISOString(),
    evidence_chain: evidenceChain,
    verification_results: verificationResults,
    integrity_checks: await performIntegrityChecks(orderId)
  };
  
  if (format === 'pdf') {
    return await generatePDFReport(report);
  } else if (format === 'json') {
    return report;
  }
};
```

## 7. 合规性与法律要求

### 7.1 数据保留期限
- **交易记录**：7年（金融监管要求）
- **用户身份信息**：5年（KYC要求）
- **审计日志**：7年（合规要求）

### 7.2 隐私保护
- **数据脱敏**：敏感信息加密存储
- **访问控制**：基于角色的数据访问
- **数据最小化**：只收集必要信息

### 7.3 监管报告
- **定期报告**：季度/年度审计报告
- **异常报告**：重大事件即时报告
- **数据提供**：监管机构数据查询接口

## 8. 实施指南

### 8.1 开发实施步骤
1. **数据库设计**：创建审计日志表结构
2. **日志中间件**：实现审计日志记录
3. **事件监听器**：设置智能合约事件监听
4. **证据存储**：集成IPFS和文件存储
5. **查询接口**：开发审计查询API

### 8.2 运维监控
- **日志监控**：实时监控审计日志生成
- **存储监控**：监控证据存储空间和完整性
- **性能监控**：审计系统性能指标

### 8.3 测试验证
- **单元测试**：审计功能单元测试
- **集成测试**：端到端审计流程测试
- **压力测试**：高并发场景下的审计性能测试

---

**文档维护**：审计策略应定期评审和更新，确保符合最新的合规要求和业务需求。