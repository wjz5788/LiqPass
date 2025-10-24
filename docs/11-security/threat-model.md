# 安全与信任边界说明

## 文档概述

**文档目的**：定义LiqPass系统的安全边界、威胁模型和信任假设，确保系统在设计和实现层面的安全性。
**适用对象**：安全团队、开发团队、运维团队
**文档版本**：v1.0
**最后更新**：2024-12-19

## 1. 系统安全架构

### 1.1 信任边界定义

#### 1.1.1 外部信任边界
- **用户端**：浏览器/移动应用 - 部分信任（需验证用户身份）
- **区块链网络**：Base主网 - 完全信任（去中心化共识）
- **交易所API**：Binance/OKX - 部分信任（依赖API可靠性）
- **第三方服务**：Alchemy RPC - 部分信任（基础设施依赖）

#### 1.1.2 内部信任边界
- **前端应用层**：React/Vite应用 - 高信任（可控代码）
- **后端服务层**：Node.js API服务 - 高信任（内部部署）
- **数据库层**：SQLite数据库 - 高信任（本地存储）
- **智能合约层**：Solidity合约 - 完全信任（代码透明）

### 1.2 安全假设

#### 1.2.1 核心安全假设
1. **区块链安全性**：Base网络51%攻击概率极低
2. **私钥安全**：用户私钥在本地安全存储
3. **API可靠性**：交易所API提供准确的价格数据
4. **网络传输**：HTTPS/TLS保护数据传输安全

#### 1.2.2 运营安全假设
1. **服务器安全**：部署环境符合安全标准
2. **代码完整性**：部署代码与源码一致
3. **人员可信**：运维团队遵循安全规范
4. **时间同步**：系统时间与标准时间同步

## 2. 密钥管理与存储策略

### 2.1 密钥分类与用途

#### 2.1.1 系统密钥
```javascript
// 系统密钥配置示例
const SYSTEM_KEYS = {
  // JWT签名密钥（后端服务）
  JWT_SECRET: process.env.JWT_SECRET || 'default-secret-change-in-production',
  
  // 数据库加密密钥
  DB_ENCRYPTION_KEY: process.env.DB_ENCRYPTION_KEY,
  
  // API密钥（交易所访问）
  BINANCE_API_KEY: process.env.BINANCE_API_KEY,
  BINANCE_SECRET_KEY: process.env.BINANCE_SECRET_KEY,
  
  // RPC服务密钥
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY,
  
  // 智能合约操作密钥
  PAYOUT_PRIVATE_KEY: process.env.PAYOUT_PRIVATE_KEY,
  CONTRACT_OWNER_KEY: process.env.CONTRACT_OWNER_KEY
};
```

#### 2.1.2 用户密钥
- **钱包私钥**：用户本地存储，永不传输到服务器
- **会话令牌**：JWT令牌，短期有效，HTTPS传输
- **API访问密钥**：用户级API密钥，权限受限

### 2.2 密钥存储策略

#### 2.2.1 环境变量存储
```bash
# 生产环境密钥配置示例
# .env.production
JWT_SECRET="$(openssl rand -base64 32)"
DB_ENCRYPTION_KEY="$(openssl rand -base64 32)"
BINANCE_API_KEY="your-binance-api-key"
BINANCE_SECRET_KEY="your-binance-secret-key"
PAYOUT_PRIVATE_KEY="0x..."  # 仅用于赔付操作的私钥
```

#### 2.2.2 硬件安全模块（HSM）集成
```javascript
// HSM集成示例（未来扩展）
const { CloudHSM } = require('aws-cloudhsm');

class SecureKeyManager {
  constructor() {
    this.hsmClient = new CloudHSM({
      region: 'us-east-1',
      clusterId: process.env.HSM_CLUSTER_ID
    });
  }
  
  async signTransaction(txData) {
    // 使用HSM签名交易
    const signature = await this.hsmClient.sign({
      keyLabel: 'payout-key',
      message: txData
    });
    return signature;
  }
}
```

### 2.3 密钥轮换策略

#### 2.3.1 定期轮换计划
```bash
# 密钥轮换脚本示例
#!/bin/bash
# rotate-keys.sh

# JWT密钥轮换（每月）
NEW_JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$NEW_JWT_SECRET" >> /tmp/new-env

# API密钥轮换（每季度）
# 需要手动更新交易所API密钥

# 数据库加密密钥轮换（每年）
# 需要重新加密数据库

# 智能合约密钥轮换（按需）
# 需要部署新合约并迁移数据
```

#### 2.3.2 紧急密钥撤销
```javascript
// 紧急密钥撤销机制
class EmergencyKeyRevocation {
  static revokeCompromisedKeys() {
    // 立即撤销所有JWT令牌
    JWT_BLACKLIST.clearAll();
    
    // 禁用API访问
    API_RATE_LIMITER.disableAllKeys();
    
    // 暂停智能合约操作
    CONTRACT_MANAGER.pauseAllOperations();
    
    // 通知管理员
    this.notifyAdmins('EMERGENCY: All keys have been revoked');
  }
}
```

## 3. 最小权限原则实施

### 3.1 服务权限矩阵

#### 3.1.1 后端服务权限
| 服务组件 | 数据库访问 | 文件系统 | 网络访问 | 系统调用 |
|---------|-----------|----------|----------|----------|
| API服务器 | 读写订单表 | 日志目录 | 区块链RPC | 无特权 |
| 定时任务 | 读写订单表 | 备份目录 | 交易所API | 无特权 |
| 赔付服务 | 读写订单表 | 无访问 | 区块链RPC | 无特权 |

#### 3.1.2 智能合约权限
```solidity
// 合约权限控制示例
contract LeverageGuard {
    address public owner;
    mapping(address => bool) public payoutOperators;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier onlyPayoutOperator() {
        require(payoutOperators[msg.sender], "Not payout operator");
        _;
    }
    
    // 只有赔付操作员可以执行赔付
    function executePayout(uint256 policyId) public onlyPayoutOperator {
        // 赔付逻辑
    }
}
```

### 3.2 用户权限分级

#### 3.2.1 用户角色定义
```javascript
// 用户角色权限配置
const USER_ROLES = {
  CUSTOMER: {
    permissions: [
      'order:create',
      'order:view_own',
      'policy:view_own',
      'payout:request'
    ]
  },
  
  OPERATOR: {
    permissions: [
      'order:view_all',
      'policy:view_all',
      'payout:approve',
      'risk:monitor'
    ]
  },
  
  ADMIN: {
    permissions: [
      'system:configure',
      'user:manage',
      'audit:view',
      'key:rotate'
    ]
  }
};
```

#### 3.2.2 API权限控制
```javascript
// API权限中间件
const authorize = (requiredPermission) => {
  return (req, res, next) => {
    const userRole = req.user.role;
    const userPermissions = USER_ROLES[userRole]?.permissions || [];
    
    if (!userPermissions.includes(requiredPermission)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Insufficient permissions'
      });
    }
    
    next();
  };
};

// 使用示例
app.get('/api/admin/users', authorize('user:manage'), getUserList);
```

## 4. 入站数据校验

### 4.1 输入验证框架

#### 4.1.1 请求参数验证
```javascript
// 使用Joi进行参数验证
const Joi = require('joi');

const orderSchema = Joi.object({
  sku_id: Joi.string().valid('DAY_24H_FIXED', 'WEEK_7D_FIXED').required(),
  payout_amount: Joi.number().min(1000).max(1000000).required(),
  leverage_multiplier: Joi.number().valid(2, 3, 5).required(),
  user_address: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
});

const validateOrder = (req, res, next) => {
  const { error } = orderSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      details: error.details.map(d => d.message)
    });
  }
  
  next();
};
```

#### 4.1.2 SQL注入防护
```javascript
// 使用参数化查询
const db = require('./database');

class OrderRepository {
  async createOrder(orderData) {
    // 安全的参数化查询
    const result = await db.run(`
      INSERT INTO orders (sku_id, payout_amount, leverage_multiplier, user_address)
      VALUES (?, ?, ?, ?)
    `, [
      orderData.sku_id,
      orderData.payout_amount,
      orderData.leverage_multiplier,
      orderData.user_address
    ]);
    
    return result;
  }
  
  // 禁止直接拼接SQL
  async unsafeQuery(userInput) {
    // ❌ 危险：SQL注入漏洞
    return await db.run(`SELECT * FROM orders WHERE user_address = '${userInput}'`);
  }
}
```

### 4.2 业务逻辑验证

#### 4.2.1 金额边界检查
```javascript
// 金额验证逻辑
class AmountValidator {
  static validatePayoutAmount(amount, leverage) {
    const minPayout = 1000; // 1 USDC
    const maxPayout = 1000000; // 1000 USDC
    
    if (amount < minPayout || amount > maxPayout) {
      throw new Error(`Payout amount must be between ${minPayout} and ${maxPayout}`);
    }
    
    // 检查杠杆倍数限制
    const maxLeveragedAmount = amount * leverage;
    if (maxLeveragedAmount > 5000000) { // 5000 USDC
      throw new Error('Leveraged amount exceeds maximum limit');
    }
    
    return true;
  }
}
```

#### 4.2.2 时间窗口验证
```javascript
// 时间相关验证
class TimeValidator {
  static validateOrderTime(orderTime) {
    const now = Date.now();
    const orderTimestamp = new Date(orderTime).getTime();
    
    // 防止时间穿越攻击
    if (orderTimestamp > now + 300000) { // 5分钟未来时间
      throw new Error('Order time cannot be in the future');
    }
    
    // 防止重放攻击（时间窗口）
    if (now - orderTimestamp > 300000) { // 5分钟有效期
      throw new Error('Order timestamp expired');
    }
    
    return true;
  }
}
```

## 5. 重放攻击与签名验证

### 5.1 防重放攻击机制

#### 5.1.1 Nonce机制
```javascript
// Nonce防重放攻击
class ReplayProtection {
  constructor() {
    this.usedNonces = new Set();
    this.nonceExpiry = 5 * 60 * 1000; // 5分钟
  }
  
  generateNonce() {
    const nonce = crypto.randomBytes(16).toString('hex');
    const expiry = Date.now() + this.nonceExpiry;
    
    // 存储nonce和过期时间
    this.usedNonces.add(nonce);
    
    // 定时清理过期nonce
    setTimeout(() => {
      this.usedNonces.delete(nonce);
    }, this.nonceExpiry);
    
    return { nonce, expiry };
  }
  
  validateNonce(nonce) {
    if (this.usedNonces.has(nonce)) {
      throw new Error('Nonce already used');
    }
    
    this.usedNonces.add(nonce);
    return true;
  }
}
```

#### 5.1.2 时间戳验证
```javascript
// 时间戳防重放
class TimestampProtection {
  static validateTimestamp(timestamp, maxAge = 300000) {
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    
    if (isNaN(requestTime)) {
      throw new Error('Invalid timestamp');
    }
    
    // 防止未来时间攻击
    if (requestTime > now + 60000) { // 1分钟容差
      throw new Error('Timestamp too far in the future');
    }
    
    // 防止过期请求重放
    if (now - requestTime > maxAge) {
      throw new Error('Request timestamp expired');
    }
    
    return true;
  }
}
```

### 5.2 数字签名验证

#### 5.2.1 请求签名机制
```javascript
// 请求签名验证
class RequestSigner {
  static signRequest(payload, privateKey) {
    const message = JSON.stringify(payload, Object.keys(payload).sort());
    const signature = crypto.createSign('SHA256')
      .update(message)
      .sign(privateKey, 'base64');
    
    return signature;
  }
  
  static verifySignature(payload, signature, publicKey) {
    const message = JSON.stringify(payload, Object.keys(payload).sort());
    const verifier = crypto.createVerify('SHA256')
      .update(message);
    
    return verifier.verify(publicKey, signature, 'base64');
  }
}

// 使用示例
const signedRequest = (req, res, next) => {
  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];
  const nonce = req.headers['x-nonce'];
  
  try {
    TimestampProtection.validateTimestamp(timestamp);
    ReplayProtection.validateNonce(nonce);
    
    const payload = {
      ...req.body,
      timestamp,
      nonce
    };
    
    if (!RequestSigner.verifySignature(payload, signature, PUBLIC_KEY)) {
      return res.status(401).json({ error: 'INVALID_SIGNATURE' });
    }
    
    next();
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};
```

#### 5.2.2 智能合约签名验证
```solidity
// 合约中的签名验证
library SignatureVerification {
    function verify(
        bytes32 message,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address expectedSigner
    ) internal pure returns (bool) {
        address recovered = ecrecover(message, v, r, s);
        return recovered == expectedSigner;
    }
    
    function getMessageHash(
        uint256 policyId,
        uint256 payoutAmount,
        uint256 nonce
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(policyId, payoutAmount, nonce));
    }
}
```

## 6. 日志脱敏与隐私保护

### 6.1 敏感信息识别

#### 6.1.1 敏感字段定义
```javascript
// 敏感字段配置
const SENSITIVE_FIELDS = {
  PRIVATE_KEYS: /(private[_-]?key|secret[_-]?key|pkey)/i,
  API_KEYS: /(api[_-]?key|access[_-]?token)/i,
  PERSONAL_INFO: /(email|phone|address|ssn|id[_-]?card)/i,
  FINANCIAL_DATA: /(credit[_-]?card|bank[_-]?account|balance)/i,
  WALLET_ADDRESSES: /(0x[a-fA-F0-9]{40})/g
};
```

#### 6.1.2 日志级别分类
```javascript
// 日志敏感度分级
const LOG_LEVELS = {
  DEBUG: {
    // 包含完整信息，仅开发环境使用
    maskSensitive: false
  },
  INFO: {
    // 部分脱敏，生产环境使用
    maskSensitive: true,
    maskPattern: '***'
  },
  ERROR: {
    // 错误日志可包含更多信息用于调试
    maskSensitive: false
  }
};
```

### 6.2 脱敏处理策略

#### 6.2.1 实时脱敏处理
```javascript
// 日志脱敏中间件
class LogSanitizer {
  static sanitize(logData, level = 'INFO') {
    const config = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    
    if (!config.maskSensitive) {
      return logData;
    }
    
    return this.maskSensitiveData(logData, config.maskPattern);
  }
  
  static maskSensitiveData(data, mask = '***') {
    if (typeof data === 'string') {
      // 脱敏钱包地址
      data = data.replace(SENSITIVE_FIELDS.WALLET_ADDRESSES, '0x***');
      
      // 脱敏私钥和API密钥
      Object.values(SENSITIVE_FIELDS).forEach(pattern => {
        data = data.replace(pattern, mask);
      });
    }
    
    return data;
  }
}

// 使用示例
const logger = {
  info: (message, data) => {
    const sanitizedData = LogSanitizer.sanitize(data, 'INFO');
    console.log(`[INFO] ${message}`, sanitizedData);
  },
  
  error: (message, error) => {
    // 错误日志不脱敏，便于调试
    console.error(`[ERROR] ${message}`, error);
  }
};
```

#### 6.2.2 数据库字段加密
```javascript
// 敏感字段加密存储
const crypto = require('crypto');

class FieldEncryption {
  constructor(encryptionKey) {
    this.algorithm = 'aes-256-gcm';
    this.key = crypto.createHash('sha256').update(encryptionKey).digest();
  }
  
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.key);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('hex'),
      data: encrypted,
      authTag: authTag.toString('hex')
    };
  }
  
  decrypt(encryptedData) {
    const decipher = crypto.createDecipher(this.algorithm, this.key);
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// 使用示例
const encryptor = new FieldEncryption(process.env.DB_ENCRYPTION_KEY);

// 存储前加密
const encryptedEmail = encryptor.encrypt(user.email);
// 读取时解密
const originalEmail = encryptor.decrypt(encryptedEmail);
```

## 7. 威胁建模与风险评估

### 7.1 STRIDE威胁分析

#### 7.1.1 威胁分类
| 威胁类型 | 描述 | 影响组件 | 缓解措施 |
|---------|------|----------|----------|
| **Spoofing** | 身份伪造 | 用户认证 | 多因素认证、数字签名 |
| **Tampering** | 数据篡改 | 数据库、API | 数据签名、区块链存储 |
| **Repudiation** | 抵赖行为 | 交易日志 | 不可变审计日志 |
| **Information Disclosure** | 信息泄露 | 敏感数据 | 加密存储、访问控制 |
| **Denial of Service** | 拒绝服务 | 所有服务 | 速率限制、负载均衡 |
| **Elevation of Privilege** | 权限提升 | 权限系统 | 最小权限原则 |

#### 7.1.2 风险等级评估
```javascript
// 风险评分模型
class RiskAssessment {
  static calculateRiskScore(threat, impact, likelihood) {
    // 风险分数 = 影响 × 可能性
    const impactScore = this.getImpactScore(impact);
    const likelihoodScore = this.getLikelihoodScore(likelihood);
    
    return impactScore * likelihoodScore;
  }
  
  static getImpactScore(impact) {
    const impactLevels = {
      'LOW': 1,
      'MEDIUM': 3,
      'HIGH': 5,
      'CRITICAL': 10
    };
    
    return impactLevels[impact] || 1;
  }
  
  static getLikelihoodScore(likelihood) {
    const likelihoodLevels = {
      'RARE': 1,
      'UNLIKELY': 2,
      'POSSIBLE': 3,
      'LIKELY': 5,
      'ALMOST_CERTAIN': 8
    };
    
    return likelihoodLevels[likelihood] || 1;
  }
}

// 示例风险评估
const threats = [
  {
    name: '私钥泄露',
    impact: 'CRITICAL',
    likelihood: 'UNLIKELY',
    riskScore: RiskAssessment.calculateRiskScore('私钥泄露', 'CRITICAL', 'UNLIKELY') // 20
  },
  {
    name: 'API限流攻击',
    impact: 'MEDIUM', 
    likelihood: 'LIKELY',
    riskScore: RiskAssessment.calculateRiskScore('API限流攻击', 'MEDIUM', 'LIKELY') // 15
  }
];
```

### 7.2 安全控制措施

#### 7.2.1 防御深度策略
```javascript
// 多层防御机制
class DefenseInDepth {
  static getSecurityLayers() {
    return [
      {
        layer: '网络层',
        controls: ['防火墙', 'DDoS防护', 'VPN'],
        responsibility: '基础设施团队'
      },
      {
        layer: '应用层', 
        controls: ['输入验证', '身份认证', '权限控制'],
        responsibility: '开发团队'
      },
      {
        layer: '数据层',
        controls: ['加密存储', '备份恢复', '访问审计'],
        responsibility: '数据库团队'
      },
      {
        layer: '监控层',
        controls: ['日志分析', '异常检测', '安全告警'],
        responsibility: '安全团队'
      }
    ];
  }
}
```

#### 7.2.2 安全事件响应
```javascript
// 安全事件响应流程
class SecurityIncidentResponse {
  static async handleIncident(incident) {
    const responsePlan = {
      'DATA_BREACH': this.handleDataBreach,
      'UNAUTHORIZED_ACCESS': this.handleUnauthorizedAccess,
      'DOS_ATTACK': this.handleDosAttack,
      'CONTRACT_EXPLOIT': this.handleContractExploit
    };
    
    const handler = responsePlan[incident.type];
    if (handler) {
      await handler.call(this, incident);
    } else {
      await this.handleGenericIncident(incident);
    }
  }
  
  static async handleDataBreach(incident) {
    // 1. 立即隔离受影响系统
    await this.isolateAffectedSystems(incident);
    
    // 2. 通知相关方
    await this.notifyStakeholders(incident);
    
    // 3. 启动取证调查
    await this.startForensicInvestigation(incident);
    
    // 4. 修复漏洞
    await this.remediateVulnerabilities(incident);
  }
}
```

## 8. 合规性与审计要求

### 8.1 安全合规标准

#### 8.1.1 行业标准遵循
- **ISO 27001**：信息安全管理体系
- **SOC 2**：服务组织控制
- **GDPR**：通用数据保护条例
- **PCI DSS**：支付卡行业数据安全标准

#### 8.1.2 区块链特定要求
- **智能合约安全审计**：第三方代码审查
- **密钥管理合规**：符合行业最佳实践
- **交易监控**：反洗钱(AML)合规
- **数据隐私**：用户数据保护

### 8.2 安全审计流程

#### 8.2.1 定期安全审计
```javascript
// 安全审计计划
const SECURITY_AUDIT_SCHEDULE = {
  DAILY: [
    '检查安全日志',
    '验证备份完整性',
    '监控异常活动'
  ],
  
  WEEKLY: [
    '审查访问日志',
    '检查系统补丁',
    '验证安全配置'
  ],
  
  MONTHLY: [
    '全面漏洞扫描',
    '审查权限分配',
    '测试灾难恢复'
  ],
  
  QUARTERLY: [
    '第三方安全审计',
    '渗透测试',
    '安全策略更新'
  ]
};
```

#### 8.2.2 审计报告模板
```markdown
# 安全审计报告

## 审计概述
- 审计时间: {date}
- 审计范围: {scope}
- 审计方法: {methodology}

## 发现的问题
### 高风险问题
- [ ] 问题1描述
- [ ] 问题2描述

### 中风险问题  
- [ ] 问题3描述

### 低风险问题
- [ ] 问题4描述

## 改进建议
1. 建议1
2. 建议2

## 合规状态
- [ ] 符合ISO 27001要求
- [ ] 符合GDPR要求
- [ ] 符合行业标准
```

---

**文档维护**：本威胁模型应定期更新，反映系统架构变化和新出现的安全威胁。安全团队负责维护此文档的准确性和时效性。