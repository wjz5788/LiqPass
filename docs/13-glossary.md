# 术语表与约定

## 文档概述

**文档目的**：统一LiqPass项目中的术语定义、命名规范、错误码约定等技术标准，确保团队内部沟通一致性和代码规范性。
**适用对象**：开发团队、测试团队、产品团队、文档编写人员
**文档版本**：v1.0
**最后更新**：2024-12-19

## 1. 核心业务术语

### 1.1 产品相关术语

#### 1.1.1 保险产品术语
| 术语 | 英文 | 定义 | 示例 |
|------|------|------|------|
| **保险单** | Policy | 用户购买的杠杆保险合约 | `POL_20241219_001` |
| **保费** | Premium | 用户为保险单支付的费用 | `100 USDC` |
| **赔付金额** | Payout Amount | 保险触发时的赔偿金额 | `10,000 USDC` |
| **杠杆倍数** | Leverage Multiplier | 保费与赔付金额的比例 | `3x`, `5x`, `10x` |
| **等待期** | Waiting Period | 保险生效前的等待时间 | `24小时` |
| **保险期限** | Policy Term | 保险单的有效期 | `24小时`, `7天` |

#### 1.1.2 风险相关术语
| 术语 | 英文 | 定义 | 相关字段 |
|------|------|------|----------|
| **风险因子** | Risk Factor | 基于市场波动性的定价参数 | `risk_factor` |
| **触发条件** | Trigger Condition | 赔付触发的价格条件 | `price_drop_10%` |
| **精算模型** | Actuarial Model | 保费计算的风险评估模型 | `black_scholes` |
| **赔付率** | Payout Ratio | 实际赔付与保费的比率 | `payout_ratio` |

### 1.2 技术架构术语

#### 1.2.1 区块链相关
| 术语 | 英文 | 定义 | 技术实现 |
|------|------|------|----------|
| **智能合约** | Smart Contract | 自动执行的链上代码 | `LeverageGuard.sol` |
| **Gas费用** | Gas Fee | 执行交易的计算成本 | `0.001 ETH` |
| **事件日志** | Event Log | 合约状态变化的记录 | `PolicyCreated`事件 |
| **预言机** | Oracle | 链下数据上链的服务 | `Chainlink Oracle` |

#### 1.2.2 系统组件
| 术语 | 英文 | 定义 | 对应服务 |
|------|------|------|----------|
| **US后端** | US Backend | 用户服务后端系统 | `us-backend`服务 |
| **JP验证** | JP Verify | 价格验证服务 | `jp-verify`服务 |
| **前端应用** | Frontend App | 用户界面应用 | `us-frontend`应用 |
| **数据库** | Database | 业务数据存储 | `SQLite`数据库 |

## 2. 变量命名约定

### 2.1 通用命名规则

#### 2.1.1 命名风格
```javascript
// ✅ 正确的命名示例
const policyId = 'POL_20241219_001';        // camelCase（变量）
const PAYOUT_AMOUNT = 10000;               // UPPER_CASE（常量）
class PolicyManager { }                     // PascalCase（类）
function calculatePremium() { }            // camelCase（函数）

// ❌ 错误的命名示例
const policy_id = 'POL_001';                // 蛇形命名（不推荐）
const PayoutAmount = 10000;                 // 混合大小写（常量）
function CalculatePremium() { }            // 帕斯卡命名（函数）
```

#### 2.1.2 数据类型前缀（可选）
```javascript
// 匈牙利命名法变体（可选使用）
const strPolicyId = 'POL_001';              // 字符串
const numPayoutAmount = 10000;             // 数字
const arrPolicyList = [];                   // 数组
const objPolicyData = {};                   // 对象
const bIsActive = true;                    // 布尔值

// 现代JavaScript推荐使用语义化命名
const policyId = 'POL_001';                // 直接语义化
const payoutAmount = 10000;
const policyList = [];
const policyData = {};
const isActive = true;
```

### 2.2 业务对象命名

#### 2.2.1 数据库表字段
```sql
-- 订单表字段命名
CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    order_id TEXT UNIQUE NOT NULL,          -- ORD_YYYYMMDD_XXX
    user_address TEXT NOT NULL,             -- 用户钱包地址
    sku_id TEXT NOT NULL,                   -- 产品SKU
    payout_amount INTEGER NOT NULL,         -- 赔付金额（单位：USDC最小单位）
    premium_amount INTEGER NOT NULL,        -- 保费金额
    leverage_multiplier INTEGER NOT NULL,   -- 杠杆倍数
    policy_status TEXT NOT NULL,            -- 保单状态
    created_at INTEGER NOT NULL,            -- 创建时间戳
    updated_at INTEGER NOT NULL             -- 更新时间戳
);

-- 保单表字段命名
CREATE TABLE policies (
    policy_id TEXT PRIMARY KEY,             -- POL_YYYYMMDD_XXX
    order_id TEXT NOT NULL,                 -- 关联订单
    trigger_price INTEGER,                  -- 触发价格
    actual_payout INTEGER,                  -- 实际赔付金额
    claim_timestamp INTEGER,                -- 索赔时间
    claim_status TEXT                       -- 索赔状态
);
```

#### 2.2.2 API请求/响应字段
```javascript
// API请求体字段命名
const createOrderRequest = {
  skuId: 'DAY_24H_FIXED',                   // 产品SKU ID
  payoutAmount: 100000,                      // 赔付金额（单位：USDC最小单位）
  leverageMultiplier: 3,                     // 杠杆倍数
  userAddress: '0x742d35Cc6634C0532925a3b8D...' // 用户钱包地址
};

// API响应体字段命名
const orderResponse = {
  orderId: 'ORD_20241219_001',               // 订单ID
  policyId: 'POL_20241219_001',             // 保单ID
  premiumAmount: 33333,                      // 保费金额
  estimatedPayout: 100000,                   // 预计赔付
  expirationTime: 1734624000,                // 过期时间戳
  status: 'CREATED'                         // 订单状态
};
```

### 2.3 代码文件命名

#### 2.3.1 文件命名规范
```bash
# 后端文件命名
src/
├── controllers/           # 控制器
│   ├── orderController.js
│   └── policyController.js
├── services/              # 业务服务
│   ├── orderService.js
│   └── premiumService.js
├── models/                # 数据模型
│   ├── Order.js
│   └── Policy.js
├── utils/                 # 工具函数
│   ├── dateUtils.js
│   └── validationUtils.js
└── config/                # 配置文件
    ├── database.js
    └── blockchain.js

# 前端文件命名
src/
├── components/            # React组件
│   ├── OrderForm.tsx
│   └── PolicyCard.tsx
├── pages/                 # 页面组件
│   ├── HomePage.tsx
│   └── OrderHistoryPage.tsx
├── services/              # API服务
│   ├── orderApi.ts
│   └── policyApi.ts
└── types/                 # TypeScript类型
    ├── order.types.ts
    └── policy.types.ts
```

#### 2.3.2 测试文件命名
```bash
# 测试文件命名约定
__tests__/
├── unit/                  # 单元测试
│   ├── orderService.test.js
│   └── premiumService.test.js
├── integration/           # 集成测试
│   ├── orderApi.test.js
│   └── policyApi.test.js
└── e2e/                  # 端到端测试
    ├── orderFlow.test.js
    └── payoutFlow.test.js

# 测试工具文件
testUtils/
├── setup.js              # 测试环境配置
├── fixtures/             # 测试数据
│   ├── orderFixtures.js
│   └── policyFixtures.js
└── mocks/                # 模拟对象
    ├── blockchainMock.js
    └── exchangeMock.js
```

## 3. 错误码规范

### 3.1 错误码分类体系

#### 3.1.1 错误码结构
```javascript
// 错误码格式：TYPE_MODULE_SPECIFIC
// TYPE: 错误类型（4位）
// MODULE: 模块标识（3位）
// SPECIFIC: 具体错误（3位）

const ERROR_CODE_PATTERN = /^[A-Z]{4}_[A-Z]{3}_[A-Z]{3}$/;

// 示例错误码
const VALIDATION_ERROR = 'VAL_ORD_INV';     // 订单验证失败
const BLOCKCHAIN_ERROR = 'BLC_TX_FAIL';     // 交易失败
const EXCHANGE_ERROR = 'EXC_API_DOWN';     // 交易所API宕机
```

#### 3.1.2 错误类型定义
| 错误类型 | 代码前缀 | 描述 | HTTP状态码 |
|----------|----------|------|------------|
| **验证错误** | `VAL_` | 输入参数验证失败 | 400 |
| **认证错误** | `AUTH_` | 身份认证失败 | 401 |
| **权限错误** | `PERM_` | 权限不足 | 403 |
| **资源错误** | `RES_` | 资源未找到 | 404 |
| **业务错误** | `BIZ_` | 业务逻辑错误 | 422 |
| **系统错误** | `SYS_` | 系统内部错误 | 500 |
| **区块链错误** | `BLC_` | 区块链相关错误 | 502 |
| **外部服务错误** | `EXT_` | 第三方服务错误 | 503 |

### 3.2 具体错误码定义

#### 3.2.1 订单相关错误
```javascript
// 订单模块错误码
const ORDER_ERRORS = {
  // 验证错误
  VAL_ORD_INV: {
    code: 'VAL_ORD_INV',
    message: '订单参数无效',
    description: '订单创建参数不符合要求',
    httpStatus: 400
  },
  
  VAL_ORD_AMT: {
    code: 'VAL_ORD_AMT', 
    message: '赔付金额超出范围',
    description: '赔付金额不在允许范围内（1000-1000000 USDC）',
    httpStatus: 400
  },
  
  // 业务错误
  BIZ_ORD_LIM: {
    code: 'BIZ_ORD_LIM',
    message: '用户订单限制',
    description: '用户已达到最大订单数量限制',
    httpStatus: 422
  },
  
  BIZ_ORD_FUND: {
    code: 'BIZ_ORD_FUND',
    message: '资金不足',
    description: '用户钱包余额不足以支付保费',
    httpStatus: 422
  }
};
```

#### 3.2.2 保单相关错误
```javascript
// 保单模块错误码
const POLICY_ERRORS = {
  // 验证错误
  VAL_POL_INV: {
    code: 'VAL_POL_INV',
    message: '保单ID无效',
    description: '提供的保单ID格式不正确或不存在',
    httpStatus: 400
  },
  
  // 业务错误
  BIZ_POL_EXP: {
    code: 'BIZ_POL_EXP',
    message: '保单已过期',
    description: '保单已超过有效期，无法进行索赔',
    httpStatus: 422
  },
  
  BIZ_POL_CLAIM: {
    code: 'BIZ_POL_CLAIM',
    message: '索赔条件未满足',
    description: '价格未达到触发条件，无法索赔',
    httpStatus: 422
  },
  
  // 系统错误
  SYS_POL_DB: {
    code: 'SYS_POL_DB',
    message: '保单数据异常',
    description: '保单数据存储出现异常',
    httpStatus: 500
  }
};
```

#### 3.2.3 区块链相关错误
```javascript
// 区块链模块错误码
const BLOCKCHAIN_ERRORS = {
  // 交易错误
  BLC_TX_FAIL: {
    code: 'BLC_TX_FAIL',
    message: '交易执行失败',
    description: '区块链交易执行失败，可能由于Gas不足或合约错误',
    httpStatus: 502
  },
  
  BLC_TX_PEND: {
    code: 'BLC_TX_PEND',
    message: '交易待确认',
    description: '交易已提交但尚未被区块链确认',
    httpStatus: 202
  },
  
  // 网络错误
  BLC_NET_DOWN: {
    code: 'BLC_NET_DOWN',
    message: '区块链网络不可用',
    description: '无法连接到区块链网络',
    httpStatus: 503
  },
  
  // 合约错误
  BLC_CTR_REV: {
    code: 'BLC_CTR_REV',
    message: '合约执行回滚',
    description: '智能合约执行过程中发生回滚',
    httpStatus: 422
  }
};
```

### 3.3 错误处理最佳实践

#### 3.3.1 统一错误响应格式
```javascript
// 错误响应对象
class AppError extends Error {
  constructor(errorCode, message, details = null) {
    super(message);
    this.name = 'AppError';
    this.code = errorCode;
    this.details = details;
    this.timestamp = Date.now();
    this.stack = new Error().stack;
  }
  
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp
      }
    };
  }
}

// 使用示例
try {
  // 业务逻辑
} catch (error) {
  if (error instanceof AppError) {
    throw error;
  } else {
    // 未知错误转换为系统错误
    throw new AppError('SYS_UNK_ERR', '未知系统错误', error.message);
  }
}
```

#### 3.3.2 错误日志记录
```javascript
// 结构化错误日志
const logger = {
  error: (error, context = {}) => {
    const logEntry = {
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      errorCode: error.code || 'UNKNOWN',
      message: error.message,
      stack: error.stack,
      context: context,
      userId: context.userId,
      requestId: context.requestId
    };
    
    console.error(JSON.stringify(logEntry));
    
    // 发送到错误监控系统
    this.sendToMonitoring(logEntry);
  }
};

// 使用示例
app.use((error, req, res, next) => {
  logger.error(error, {
    userId: req.user?.id,
    requestId: req.id,
    path: req.path,
    method: req.method
  });
  
  if (error instanceof AppError) {
    res.status(error.httpStatus || 500).json(error.toJSON());
  } else {
    res.status(500).json({
      error: {
        code: 'SYS_UNK_ERR',
        message: 'Internal Server Error',
        timestamp: Date.now()
      }
    });
  }
});
```

## 4. 时间与金额单位

### 4.1 时间单位约定

#### 4.1.1 时间格式标准
```javascript
// 时间格式约定
const TIME_FORMATS = {
  // 数据库存储：Unix时间戳（秒）
  DATABASE: 'timestamp_seconds',    // 1734624000
  
  // API传输：ISO 8601格式
  API: 'iso8601',                   // '2024-12-19T00:00:00Z'
  
  // 前端显示：本地化格式
  DISPLAY: 'localized',             // '2024年12月19日 08:00'
  
  // 日志记录：UTC格式
  LOG: 'utc_string'                 // '2024-12-19 00:00:00 UTC'
};

// 时间转换工具
class TimeUtils {
  static toDatabaseTime(date) {
    return Math.floor(date.getTime() / 1000);  // 转换为秒
  }
  
  static fromDatabaseTime(timestamp) {
    return new Date(timestamp * 1000);         // 转换为Date对象
  }
  
  static toApiTime(date) {
    return date.toISOString();                 // ISO 8601格式
  }
  
  static fromApiTime(isoString) {
    return new Date(isoString);
  }
}
```

#### 4.1.2 时间精度要求
| 场景 | 精度要求 | 存储格式 | 示例 |
|------|----------|----------|------|
| **订单创建时间** | 秒级精度 | Unix时间戳 | `1734624000` |
| **保险生效时间** | 分钟级精度 | ISO 8601 | `2024-12-19T08:00:00Z` |
| **价格快照时间** | 毫秒级精度 | 时间戳+毫秒 | `1734624000123` |
| **日志时间戳** | 毫秒级精度 | ISO 8601扩展 | `2024-12-19T08:00:00.123Z` |

### 4.2 金额单位约定

#### 4.2.1 货币单位标准
```javascript
// 金额单位约定
const CURRENCY_UNITS = {
  // 内部计算：最小单位（避免浮点数精度问题）
  INTERNAL: 'smallest_unit',        // 1 USDC = 1,000,000 最小单位
  
  // 用户界面：标准单位
  UI: 'standard_unit',              // 1.00 USDC
  
  // 数据库存储：最小单位
  DATABASE: 'smallest_unit',        // 存储整数
  
  // API传输：标准单位（字符串）
  API: 'standard_string'            // "1.00"
};

// 金额转换工具
class AmountUtils {
  static toInternalAmount(amount, decimals = 6) {
    // 将标准单位转换为最小单位
    return Math.round(amount * Math.pow(10, decimals));
  }
  
  static fromInternalAmount(internalAmount, decimals = 6) {
    // 将最小单位转换为标准单位
    return internalAmount / Math.pow(10, decimals);
  }
  
  static formatForDisplay(amount, decimals = 2) {
    // 格式化显示金额
    return amount.toFixed(decimals);
  }
}

// 使用示例
const premium = 100.50; // 100.50 USDC
const internalPremium = AmountUtils.toInternalAmount(premium); // 100500000
const displayPremium = AmountUtils.formatForDisplay(premium); // "100.50"
```

#### 4.2.2 金额精度处理
```javascript
// 精度处理策略
class PrecisionHandler {
  static validateAmount(amount, min, max, decimals = 6) {
    const internalMin = this.toInternalAmount(min, decimals);
    const internalMax = this.toInternalAmount(max, decimals);
    const internalAmount = this.toInternalAmount(amount, decimals);
    
    if (internalAmount < internalMin || internalAmount > internalMax) {
      throw new AppError('VAL_AMT_RNG', '金额超出允许范围');
    }
    
    // 检查精度
    const expectedInternal = amount * Math.pow(10, decimals);
    if (Math.abs(internalAmount - expectedInternal) > 0.0001) {
      throw new AppError('VAL_AMT_PRC', '金额精度不符合要求');
    }
    
    return true;
  }
  
  static roundToPrecision(amount, decimals = 6) {
    // 四舍五入到指定精度
    const factor = Math.pow(10, decimals);
    return Math.round(amount * factor) / factor;
  }
}
```

## 5. 时区与精度约定

### 5.1 时区处理策略

#### 5.1.1 时区统一标准
```javascript
// 时区处理约定
const TIMEZONE_POLICY = {
  // 服务器时区：UTC
  SERVER: 'UTC',
  
  // 数据库存储：UTC时间戳
  DATABASE: 'UTC',
  
  // 业务逻辑：基于用户时区
  BUSINESS: 'USER_TIMEZONE',
  
  // 前端显示：本地时区
  DISPLAY: 'LOCAL_TIMEZONE'
};

// 时区转换工具
class TimezoneUtils {
  static getServerTime() {
    return new Date(); // 服务器UTC时间
  }
  
  static toUserTimezone(utcDate, userTimezone) {
    // 转换为用户时区
    return new Date(utcDate.toLocaleString('en-US', { timeZone: userTimezone }));
  }
  
  static fromUserTimezone(userDate, userTimezone) {
    // 从用户时区转换为UTC
    return new Date(userDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  }
  
  static formatForUser(date, userTimezone, format = 'long') {
    const options = {
      timeZone: userTimezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return date.toLocaleString('en-US', options);
  }
}
```

#### 5.1.2 时间边界处理
```javascript
// 保险期限计算
class PolicyTermCalculator {
  static calculateExpiration(startTime, termHours, userTimezone) {
    const startUTC = this.fromUserTimezone(startTime, userTimezone);
    const expirationUTC = new Date(startUTC.getTime() + termHours * 60 * 60 * 1000);
    
    return this.toUserTimezone(expirationUTC, userTimezone);
  }
  
  static isWithinTerm(policy, currentTime) {
    const startUTC = this.fromUserTimezone(policy.startTime, policy.userTimezone);
    const expirationUTC = this.fromUserTimezone(policy.expirationTime, policy.userTimezone);
    const currentUTC = this.fromUserTimezone(currentTime, policy.userTimezone);
    
    return currentUTC >= startUTC && currentUTC <= expirationUTC;
  }
  
  static getRemainingTime(policy, currentTime) {
    const expirationUTC = this.fromUserTimezone(policy.expirationTime, policy.userTimezone);
    const currentUTC = this.fromUserTimezone(currentTime, policy.userTimezone);
    
    return expirationUTC - currentUTC; // 毫秒数
  }
}
```

### 5.2 数值精度约定

#### 5.2.1 浮点数精度处理
```javascript
// 浮点数精度问题处理
class FloatPrecision {
  static safeAdd(a, b) {
    // 安全加法，避免浮点数精度问题
    const multiplier = Math.pow(10, Math.max(
      this.getDecimalPlaces(a),
      this.getDecimalPlaces(b)
    ));
    
    return (a * multiplier + b * multiplier) / multiplier;
  }
  
  static safeMultiply(a, b) {
    // 安全乘法
    const aDecimals = this.getDecimalPlaces(a);
    const bDecimals = this.getDecimalPlaces(b);
    const multiplier = Math.pow(10, aDecimals + bDecimals);
    
    return (a * Math.pow(10, aDecimals)) * (b * Math.pow(10, bDecimals)) / multiplier;
  }
  
  static getDecimalPlaces(num) {
    // 获取小数位数
    if (Math.floor(num) === num) return 0;
    return num.toString().split('.')[1].length || 0;
  }
}

// 保费计算示例
class PremiumCalculator {
  static calculatePremium(payoutAmount, leverage, riskFactor) {
    // 使用安全数学运算
    const basePremium = FloatPrecision.safeDivide(payoutAmount, leverage);
    const riskAdjustment = FloatPrecision.safeMultiply(basePremium, riskFactor);
    
    return FloatPrecision.safeAdd(basePremium, riskAdjustment);
  }
}
```

#### 5.2.2 价格精度要求
| 价格类型 | 精度要求 | 存储格式 | 计算精度 |
|----------|----------|----------|----------|
| **加密货币价格** | 8位小数 | 字符串或BigNumber | 高精度计算 |
| **保费金额** | 6位小数 | 整数（最小单位） | 整数运算 |
| **赔付金额** | 6位小数 | 整数（最小单位） | 整数运算 |
| **汇率计算** | 8位小数 | 高精度浮点数 | 高精度计算 |

## 6. 文档与注释规范

### 6.1 代码注释标准

#### 6.1.1 JSDoc注释规范
```javascript
/**
 * 计算保险保费
 * @param {number} payoutAmount - 赔付金额（USDC最小单位）
 * @param {number} leverage - 杠杆倍数（2, 3, 5, 10）
 * @param {number} riskFactor - 风险因子（0.1-0.5）
 * @param {string} skuId - 产品SKU标识
 * @returns {number} 保费金额（USDC最小单位）
 * @throws {AppError} 当参数无效时抛出VALIDATION_ERROR
 * @example
 * const premium = calculatePremium(1000000, 3, 0.15, 'DAY_24H_FIXED');
 * // returns 500000 (0.5 USDC)
 */
function calculatePremium(payoutAmount, leverage, riskFactor, skuId) {
  // 参数验证
  if (!payoutAmount || payoutAmount <= 0) {
    throw new AppError('VAL_PRM_PAY', '赔付金额必须大于0');
  }
  
  // 业务逻辑
  const basePremium = payoutAmount / leverage;
  const riskPremium = basePremium * riskFactor;
  
  return Math.round(basePremium + riskPremium);
}
```

#### 6.1.2 类型定义注释
```typescript
/**
 * 保险订单接口定义
 */
interface IOrder {
  /** 订单唯一标识 */
  orderId: string;
  
  /** 用户钱包地址 */
  userAddress: string;
  
  /** 产品SKU标识 */
  skuId: SKUType;
  
  /** 赔付金额（USDC最小单位） */
  payoutAmount: number;
  
  /** 保费金额（USDC最小单位） */
  premiumAmount: number;
  
  /** 订单状态 */
  status: OrderStatus;
  
  /** 创建时间（Unix时间戳） */
  createdAt: number;
}

/**
 * 订单状态枚举
 */
enum OrderStatus {
  /** 已创建 */
  CREATED = 'CREATED',
  
  /** 支付中 */
  PAYING = 'PAYING',
  
  /** 已生效 */
  ACTIVE = 'ACTIVE',
  
  /** 已过期 */
  EXPIRED = 'EXPIRED',
  
  /** 已赔付 */
  PAID_OUT = 'PAID_OUT',
  
  /** 已取消 */
  CANCELLED = 'CANCELLED'
}
```

### 6.2 文档编写规范

#### 6.2.1 API文档标准
```markdown
## 创建订单 API

### 端点
`POST /api/v1/orders`

### 描述
创建新的杠杆保险订单

### 请求头
```http
Content-Type: application/json
Authorization: Bearer {token}
```

### 请求体
```json
{
  "skuId": "DAY_24H_FIXED",
  "payoutAmount": 100000,
  "leverageMultiplier": 3,
  "userAddress": "0x742d35Cc6634C0532925a3b8D..."
}
```

### 参数说明
| 参数 | 类型 | 必填 | 描述 | 示例 |
|------|------|------|------|------|
| skuId | string | 是 | 产品SKU标识 | "DAY_24H_FIXED" |
| payoutAmount | number | 是 | 赔付金额（USDC最小单位） | 100000 |
| leverageMultiplier | number | 是 | 杠杆倍数 | 3 |
| userAddress | string | 是 | 用户钱包地址 | "0x..." |

### 响应
#### 成功响应（200）
```json
{
  "orderId": "ORD_20241219_001",
  "policyId": "POL_20241219_001",
  "premiumAmount": 33333,
  "status": "CREATED",
  "expirationTime": 1734624000
}
```

#### 错误响应
| 状态码 | 错误码 | 描述 |
|--------|--------|------|
| 400 | VAL_ORD_INV | 订单参数无效 |
| 401 | AUTH_TOKEN_INV | 认证令牌无效 |
| 422 | BIZ_ORD_LIM | 用户订单限制 |
```

#### 6.2.2 变更日志格式
```markdown
# 变更日志

## [1.2.0] - 2024-12-19

### 新增
- 新增周度保险产品（WEEK_7D_FIXED）
- 添加价格预警通知功能
- 支持多链钱包连接

### 变更
- 优化保费计算算法
- 提高API响应速度
- 更新用户界面设计

### 修复
- 修复订单状态同步问题
- 解决移动端显示异常
- 修复数据库连接池泄漏

### 安全
- 增强身份验证机制
- 添加API速率限制
- 更新依赖库安全补丁
```

---

**文档维护**：本术语表应定期更新，反映业务发展和技术演进。所有团队成员有责任遵循本规范，确保项目的一致性和可维护性。