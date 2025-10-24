# LiqPass SKU与定价参数表

## 概述

本文档定义了LiqPass的保险产品SKU（Stock Keeping Unit）和定价参数。所有SKU采用统一的定价公式，确保前后端计算一致性。

## 定价公式

### 核心定价公式
```
price = p(loss) * payout * (1 + load) + ops_fee
```

**参数说明**:
- `p(loss)`: 损失概率（基于历史数据和风险模型）
- `payout`: 赔付倍数（固定值，基于杠杆倍数）
- `load`: 附加费率（运营成本和利润）
- `ops_fee`: 固定运营费用

### 简化公式（上线初期）
```
price = 固定保费（基于杠杆档位）
```

## SKU产品列表

| SKU ID | 产品名称 | 杠杆倍数 | 赔付倍数 | 保险期限 | 最大保额 | 固定保费 |
|--------|----------|----------|----------|----------|----------|----------|
| sku_3x_leverage | 3倍杠杆保险 | 3x | 5x | 24小时 | $500 | $0.02 |
| sku_5x_leverage | 5倍杠杆保险 | 5x | 10x | 24小时 | $1,000 | $0.05 |
| sku_10x_leverage | 10倍杠杆保险 | 10x | 20x | 24小时 | $2,000 | $0.15 |
| sku_20x_leverage | 20倍杠杆保险 | 20x | 40x | 24小时 | $5,000 | $0.50 |

## 参数详细说明

### 1. sku_3x_leverage
```json
{
  "id": "sku_3x_leverage",
  "name": "3倍杠杆保险",
  "description": "针对3倍杠杆交易的保险产品，适合保守型投资者",
  "leverage": 3,
  "payout_multiplier": 5,
  "duration_hours": 24,
  "max_coverage": 500,
  "premium": 0.02,
  "risk_parameters": {
    "p_loss": 0.01,
    "load_rate": 0.2,
    "ops_fee": 0.005
  },
  "supported_exchanges": ["binance", "okx", "bybit"],
  "supported_symbols": ["BTCUSDT", "ETHUSDT", "ADAUSDT"],
  "activation_delay_minutes": 5
}
```

### 2. sku_5x_leverage
```json
{
  "id": "sku_5x_leverage",
  "name": "5倍杠杆保险",
  "description": "针对5倍杠杆交易的保险产品，平衡风险与收益",
  "leverage": 5,
  "payout_multiplier": 10,
  "duration_hours": 24,
  "max_coverage": 1000,
  "premium": 0.05,
  "risk_parameters": {
    "p_loss": 0.02,
    "load_rate": 0.25,
    "ops_fee": 0.008
  },
  "supported_exchanges": ["binance", "okx", "bybit"],
  "supported_symbols": ["BTCUSDT", "ETHUSDT", "ADAUSDT", "DOTUSDT"],
  "activation_delay_minutes": 10
}
```

### 3. sku_10x_leverage
```json
{
  "id": "sku_10x_leverage",
  "name": "10倍杠杆保险",
  "description": "针对10倍杠杆交易的高风险保险产品",
  "leverage": 10,
  "payout_multiplier": 20,
  "duration_hours": 24,
  "max_coverage": 2000,
  "premium": 0.15,
  "risk_parameters": {
    "p_loss": 0.05,
    "load_rate": 0.3,
    "ops_fee": 0.01
  },
  "supported_exchanges": ["binance", "okx"],
  "supported_symbols": ["BTCUSDT", "ETHUSDT"],
  "activation_delay_minutes": 15
}
```

### 4. sku_20x_leverage
```json
{
  "id": "sku_20x_leverage",
  "name": "20倍杠杆保险",
  "description": "针对20倍杠杆交易的极高风险保险产品",
  "leverage": 20,
  "payout_multiplier": 40,
  "duration_hours": 24,
  "max_coverage": 5000,
  "premium": 0.50,
  "risk_parameters": {
    "p_loss": 0.08,
    "load_rate": 0.35,
    "ops_fee": 0.015
  },
  "supported_exchanges": ["binance"],
  "supported_symbols": ["BTCUSDT"],
  "activation_delay_minutes": 30
}
```

## 定价计算示例

### 示例1：5倍杠杆保险
```javascript
// 输入参数
const p_loss = 0.02;      // 2%损失概率
const payout = 10;         // 10倍赔付
const load = 0.25;         // 25%附加费率
const ops_fee = 0.008;     // 固定运营费用

// 计算保费
const theoretical_premium = p_loss * payout * (1 + load) + ops_fee;
// = 0.02 * 10 * 1.25 + 0.008
// = 0.25 + 0.008 = 0.258

// 实际采用固定保费：0.05（简化模型）
const actual_premium = 0.05;
```

### 示例2：赔付计算
```javascript
// 用户投保金额
const coverage_amount = 800;  // 用户选择的保额

// 实际赔付金额 = 保额 × 赔付倍数
const payout_amount = coverage_amount * payout_multiplier;
// 对于5倍杠杆：800 × 10 = 8000
```

## 种子数据JSON

### 完整的SKU配置数据
```json
{
  "skus": [
    {
      "id": "sku_3x_leverage",
      "name": "3倍杠杆保险",
      "description": "针对3倍杠杆交易的保险产品，适合保守型投资者",
      "leverage": 3,
      "payout_multiplier": 5,
      "duration_hours": 24,
      "max_coverage": 500,
      "premium": 0.02,
      "risk_parameters": {
        "p_loss": 0.01,
        "load_rate": 0.2,
        "ops_fee": 0.005
      },
      "supported_exchanges": ["binance", "okx", "bybit"],
      "supported_symbols": ["BTCUSDT", "ETHUSDT", "ADAUSDT"],
      "activation_delay_minutes": 5
    },
    {
      "id": "sku_5x_leverage",
      "name": "5倍杠杆保险",
      "description": "针对5倍杠杆交易的保险产品，平衡风险与收益",
      "leverage": 5,
      "payout_multiplier": 10,
      "duration_hours": 24,
      "max_coverage": 1000,
      "premium": 0.05,
      "risk_parameters": {
        "p_loss": 0.02,
        "load_rate": 0.25,
        "ops_fee": 0.008
      },
      "supported_exchanges": ["binance", "okx", "bybit"],
      "supported_symbols": ["BTCUSDT", "ETHUSDT", "ADAUSDT", "DOTUSDT"],
      "activation_delay_minutes": 10
    },
    {
      "id": "sku_10x_leverage",
      "name": "10倍杠杆保险",
      "description": "针对10倍杠杆交易的高风险保险产品",
      "leverage": 10,
      "payout_multiplier": 20,
      "duration_hours": 24,
      "max_coverage": 2000,
      "premium": 0.15,
      "risk_parameters": {
        "p_loss": 0.05,
        "load_rate": 0.3,
        "ops_fee": 0.01
      },
      "supported_exchanges": ["binance", "okx"],
      "supported_symbols": ["BTCUSDT", "ETHUSDT"],
      "activation_delay_minutes": 15
    },
    {
      "id": "sku_20x_leverage",
      "name": "20倍杠杆保险",
      "description": "针对20倍杠杆交易的极高风险保险产品",
      "leverage": 20,
      "payout_multiplier": 40,
      "duration_hours": 24,
      "max_coverage": 5000,
      "premium": 0.50,
      "risk_parameters": {
        "p_loss": 0.08,
        "load_rate": 0.35,
        "ops_fee": 0.015
      },
      "supported_exchanges": ["binance"],
      "supported_symbols": ["BTCUSDT"],
      "activation_delay_minutes": 30
    }
  ],
  "version": "1.0.0",
  "last_updated": "2024-01-01T00:00:00Z",
  "pricing_model": "fixed_premium",
  "currency": "USDT"
}
```

## 业务规则

### 1. 保额限制
- 最小保额：$10
- 最大保额：见各SKU定义
- 保额必须为整数

### 2. 时间规则
- 保险生效延迟：见各SKU的activation_delay_minutes
- 保险期限：固定24小时
- 过期后不可续保，需重新购买

### 3. 交易所限制
- 不同SKU支持不同的交易所
- 新交易所需要风险评估后添加
- 不支持跨交易所保险

### 4. 交易对限制
- 高风险SKU限制交易对种类
- 新交易对需要流动性评估
- 不支持非主流交易对

## 风险控制参数

### 损失概率 (p_loss)
基于历史爆仓数据计算：
- 3倍杠杆：1% (保守估计)
- 5倍杠杆：2% (市场平均)
- 10倍杠杆：5% (高风险)
- 20倍杠杆：8% (极高风险)

### 附加费率 (load)
包含：
- 运营成本：10%
- 风险准备金：5%
- 利润：5-20% (随风险增加)

### 固定运营费用 (ops_fee)
覆盖：
- 链上交易费用
- 验证服务成本
- 系统维护费用

## 数据更新策略

### 定期更新
- **风险参数**：每月根据市场数据调整
- **支持列表**：每季度评估交易所和交易对
- **定价模型**：每半年重新校准

### 紧急调整
- 市场波动超过阈值时立即调整
- 重大安全事件后重新评估风险
- 监管政策变化时相应调整

## 使用说明

### 前端使用
```javascript
// 获取SKU列表
const response = await fetch('/catalog/skus');
const { skus } = await response.json();

// 显示产品信息
skus.forEach(sku => {
  console.log(`产品: ${sku.name}, 保费: ${sku.premium} USDT`);
});
```

### 后端使用
```javascript
// 保费计算函数
function calculatePremium(skuId, coverageAmount) {
  const sku = skus.find(s => s.id === skuId);
  if (!sku) throw new Error('Invalid SKU ID');
  
  // 简化模型：固定保费
  return sku.premium;
}

// 赔付计算函数
function calculatePayout(skuId, coverageAmount) {
  const sku = skus.find(s => s.id === skuId);
  return coverageAmount * sku.payout_multiplier;
}
```

此文档为前后端提供统一的SKU定义和定价参数，确保系统一致性。