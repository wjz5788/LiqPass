# 风控与反滥用策略文档

## 文档概述

**文档目的**：定义LiqPass系统的风险控制和反滥用机制，确保系统安全稳定运行，防止恶意行为和系统滥用。
**适用对象**：开发团队、运维团队、风险控制团队
**文档版本**：v1.0
**最后更新**：2024-12-19

## 1. 等待期策略

### 1.1 等待期定义
- **标准等待期**：订单创建后24小时内不触发赔付
- **延长等待期**：高风险用户或特殊产品可延长至48小时
- **豁免等待期**：VIP用户或特定场景可豁免等待期

### 1.2 等待期实现

```javascript
// 等待期检查函数
const checkWaitingPeriod = (order) => {
  const orderTime = new Date(order.created_at);
  const currentTime = new Date();
  const waitingPeriod = order.waiting_period || 24 * 60 * 60 * 1000; // 默认24小时
  
  const timeElapsed = currentTime - orderTime;
  const isInWaitingPeriod = timeElapsed < waitingPeriod;
  
  return {
    isInWaitingPeriod,
    timeElapsed,
    waitingPeriod,
    remainingTime: Math.max(0, waitingPeriod - timeElapsed)
  };
};

// 赔付申请前的等待期验证
const validateClaimEligibility = (order, claimRequest) => {
  const waitingPeriodCheck = checkWaitingPeriod(order);
  
  if (waitingPeriodCheck.isInWaitingPeriod) {
    throw new Error(`订单仍在等待期内，剩余时间：${formatTime(waitingPeriodCheck.remainingTime)}`);
  }
  
  return true;
};
```

### 1.3 等待期例外规则

```javascript
// 等待期例外处理
const handleWaitingPeriodException = (order, user) => {
  const exceptions = [
    // VIP用户豁免
    { condition: user.tier === 'VIP', waitingPeriod: 0 },
    // 高价值订单延长等待期
    { condition: order.payout_amount > 1000000, waitingPeriod: 48 * 60 * 60 * 1000 },
    // 新用户延长等待期
    { condition: user.account_age < 30 * 24 * 60 * 60 * 1000, waitingPeriod: 48 * 60 * 60 * 1000 }
  ];
  
  const applicableException = exceptions.find(exp => exp.condition);
  return applicableException ? applicableException.waitingPeriod : null;
};
```

## 2. 限赔策略

### 2.1 赔付限额规则

#### 2.1.1 用户级别限额
```javascript
// 用户赔付限额配置
const userPayoutLimits = {
  TIER_BASIC: {
    daily_limit: 100000,      // 每日赔付限额
    weekly_limit: 500000,     // 每周赔付限额
    monthly_limit: 2000000,   // 每月赔付限额
    single_order_limit: 50000 // 单笔订单赔付限额
  },
  TIER_STANDARD: {
    daily_limit: 500000,
    weekly_limit: 2000000,
    monthly_limit: 5000000,
    single_order_limit: 200000
  },
  TIER_PREMIUM: {
    daily_limit: 1000000,
    weekly_limit: 5000000,
    monthly_limit: 10000000,
    single_order_limit: 500000
  }
};
```

#### 2.1.2 系统级别限额
```javascript
// 系统全局限额
const systemPayoutLimits = {
  total_daily_limit: 10000000,     // 系统每日总赔付限额
  total_weekly_limit: 50000000,    // 系统每周总赔付限额
  concurrent_claims_limit: 100,    // 并发赔付申请限制
  max_payout_per_transaction: 1000000 // 单笔交易最大赔付额
};
```

### 2.2 限额检查实现

```javascript
// 赔付限额检查
const checkPayoutLimits = async (user, payoutAmount) => {
  const userTier = user.tier || 'TIER_BASIC';
  const userLimits = userPayoutLimits[userTier];
  
  // 检查单笔订单限额
  if (payoutAmount > userLimits.single_order_limit) {
    throw new Error(`单笔赔付金额超过用户限额：${userLimits.single_order_limit}`);
  }
  
  // 检查当日赔付总额
  const todayPayouts = await getTodayPayouts(user.id);
  const todayTotal = todayPayouts.reduce((sum, payout) => sum + payout.amount, 0);
  
  if (todayTotal + payoutAmount > userLimits.daily_limit) {
    throw new Error(`当日赔付总额超过限额：${userLimits.daily_limit}`);
  }
  
  // 检查系统全局限额
  const systemTodayPayouts = await getSystemTodayPayouts();
  const systemTodayTotal = systemTodayPayouts.reduce((sum, payout) => sum + payout.amount, 0);
  
  if (systemTodayTotal + payoutAmount > systemPayoutLimits.total_daily_limit) {
    throw new Error(`系统当日赔付总额超过限额：${systemPayoutLimits.total_daily_limit}`);
  }
  
  return true;
};
```

## 3. 黑名单管理

### 3.1 黑名单分类

#### 3.1.1 用户黑名单
```javascript
// 黑名单原因分类
const blacklistReasons = {
  FRAUDULENT_CLAIM: '欺诈性赔付申请',
  MULTI_ACCOUNT_ABUSE: '多账户滥用',
  API_ABUSE: 'API接口滥用',
  SUSPICIOUS_BEHAVIOR: '可疑行为',
  REGULATORY_COMPLIANCE: '监管合规要求'
};

// 黑名单级别
const blacklistLevels = {
  LEVEL_1: { // 轻度限制
    restrictions: ['NEW_ORDER_CREATION'],
    duration: 7 * 24 * 60 * 60 * 1000 // 7天
  },
  LEVEL_2: { // 中度限制
    restrictions: ['NEW_ORDER_CREATION', 'CLAIM_SUBMISSION'],
    duration: 30 * 24 * 60 * 60 * 1000 // 30天
  },
  LEVEL_3: { // 重度限制
    restrictions: ['ALL_OPERATIONS'],
    duration: null // 永久
  }
};
```

#### 3.1.2 IP地址黑名单
```javascript
// IP黑名单管理
const ipBlacklist = {
  // 已知恶意IP段
  ranges: [
    '192.168.100.0/24',
    '10.0.1.0/24'
  ],
  // 单个恶意IP
  individual: [
    '203.0.113.5',
    '198.51.100.23'
  ],
  // 高风险地区IP
  high_risk_regions: [
    'country:XX', // 高风险国家代码
    'region:YY'   // 高风险地区
  ]
};
```

### 3.2 黑名单检查机制

```javascript
// 黑名单检查函数
const checkBlacklist = async (user, ipAddress) => {
  // 检查用户黑名单
  const userBlacklistRecord = await getUserBlacklistRecord(user.id);
  if (userBlacklistRecord && userBlacklistRecord.is_active) {
    const restrictions = blacklistLevels[userBlacklistRecord.level].restrictions;
    throw new Error(`用户已被列入黑名单，限制操作：${restrictions.join(', ')}`);
  }
  
  // 检查IP黑名单
  if (await isIPBlacklisted(ipAddress)) {
    throw new Error('访问IP已被列入黑名单');
  }
  
  // 检查设备指纹
  const deviceFingerprint = generateDeviceFingerprint(user, ipAddress);
  if (await isDeviceBlacklisted(deviceFingerprint)) {
    throw new Error('设备已被列入黑名单');
  }
  
  return true;
};

// 设备指纹生成
const generateDeviceFingerprint = (user, ipAddress) => {
  const components = [
    user.user_agent,
    ipAddress,
    user.accept_language,
    user.screen_resolution
  ].filter(Boolean).join('|');
  
  return crypto.createHash('sha256').update(components).digest('hex');
};
```

## 4. 风控开关

### 4.1 系统风控开关

#### 4.1.1 全局开关配置
```javascript
// 风控开关配置
const riskControlSwitches = {
  // 订单创建相关
  ORDER_CREATION: {
    enabled: true,
    description: '订单创建风控',
    risk_threshold: 0.8
  },
  
  // 赔付申请相关
  CLAIM_PROCESSING: {
    enabled: true,
    description: '赔付处理风控',
    risk_threshold: 0.9
  },
  
  // API访问相关
  API_RATE_LIMITING: {
    enabled: true,
    description: 'API速率限制',
    requests_per_minute: 100
  },
  
  // 价格验证相关
  PRICE_VERIFICATION: {
    enabled: true,
    description: '价格验证风控',
    data_source_verification: true
  }
};
```

#### 4.1.2 动态开关控制
```javascript
// 风控开关管理类
class RiskControlManager {
  constructor() {
    this.switches = riskControlSwitches;
    this.overrideRules = new Map();
  }
  
  // 检查开关状态
  isEnabled(switchName, context = {}) {
    const switchConfig = this.switches[switchName];
    if (!switchConfig) return false;
    
    // 检查覆盖规则
    const override = this.overrideRules.get(switchName);
    if (override) {
      return override.enabled;
    }
    
    // 基于上下文的动态开关
    if (context.emergency_mode) {
      return switchConfig.emergency_override || switchConfig.enabled;
    }
    
    return switchConfig.enabled;
  }
  
  // 动态启用/禁用开关
  setSwitch(switchName, enabled, reason = '') {
    if (!this.switches[switchName]) {
      throw new Error(`未知的风控开关：${switchName}`);
    }
    
    this.overrideRules.set(switchName, { enabled, reason, timestamp: Date.now() });
    
    // 记录操作日志
    this.logSwitchChange(switchName, enabled, reason);
  }
  
  // 获取开关状态报告
  getStatusReport() {
    return Object.keys(this.switches).map(switchName => ({
      name: switchName,
      default_enabled: this.switches[switchName].enabled,
      current_enabled: this.isEnabled(switchName),
      override: this.overrideRules.get(switchName)
    }));
  }
}
```

## 5. 速率限制

### 5.1 API速率限制

#### 5.1.1 基于令牌桶的限流
```javascript
// 令牌桶限流实现
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;        // 桶容量
    this.tokens = capacity;          // 当前令牌数
    this.refillRate = refillRate;    // 每秒补充令牌数
    this.lastRefill = Date.now();
  }
  
  // 尝试获取令牌
  tryConsume(tokens = 1) {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }
  
  // 补充令牌
  refill() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
  
  // 获取等待时间
  getWaitTime(tokens = 1) {
    this.refill();
    
    if (this.tokens >= tokens) {
      return 0;
    }
    
    const tokensNeeded = tokens - this.tokens;
    return (tokensNeeded / this.refillRate) * 1000; // 返回毫秒
  }
}

// 用户级别的速率限制
class UserRateLimiter {
  constructor() {
    this.userBuckets = new Map();
    this.limits = {
      BASIC: { capacity: 100, refillRate: 10 },    // 基础用户：100请求/10秒
      STANDARD: { capacity: 500, refillRate: 50 },  // 标准用户：500请求/50秒
      PREMIUM: { capacity: 1000, refillRate: 100 }  // 高级用户：1000请求/100秒
    };
  }
  
  // 检查用户请求限制
  checkLimit(userId, userTier = 'BASIC') {
    if (!this.userBuckets.has(userId)) {
      const limit = this.limits[userTier] || this.limits.BASIC;
      this.userBuckets.set(userId, new TokenBucket(limit.capacity, limit.refillRate));
    }
    
    const bucket = this.userBuckets.get(userId);
    return bucket.tryConsume();
  }
  
  // 获取用户限制信息
  getUserLimitInfo(userId) {
    const bucket = this.userBuckets.get(userId);
    if (!bucket) return null;
    
    return {
      remaining: Math.floor(bucket.tokens),
      capacity: bucket.capacity,
      refillRate: bucket.refillRate
    };
  }
}
```

#### 5.1.2 端点级别限流
```javascript
// 端点级别速率限制配置
const endpointRateLimits = {
  // 订单相关端点
  '/api/v1/orders': {
    create: { window: 60000, max: 10 },  // 创建订单：10次/分钟
    list: { window: 60000, max: 30 },   // 查询订单：30次/分钟
    get: { window: 60000, max: 60 }     // 获取订单详情：60次/分钟
  },
  
  // 赔付相关端点
  '/api/v1/claims': {
    submit: { window: 300000, max: 5 },  // 提交赔付：5次/5分钟
    status: { window: 60000, max: 20 }   // 查询赔付状态：20次/分钟
  },
  
  // 价格相关端点
  '/api/v1/prices': {
    current: { window: 10000, max: 100 }, // 当前价格：100次/10秒
    history: { window: 60000, max: 30 }   // 历史价格：30次/分钟
  }
};

// 滑动窗口限流实现
class SlidingWindowRateLimiter {
  constructor(windowSize, maxRequests) {
    this.windowSize = windowSize;    // 窗口大小（毫秒）
    this.maxRequests = maxRequests;   // 最大请求数
    this.requests = new Map();        // 存储用户请求时间戳
  }
  
  // 检查请求是否允许
  isAllowed(userId, endpoint) {
    const now = Date.now();
    const userKey = `${userId}:${endpoint}`;
    
    if (!this.requests.has(userKey)) {
      this.requests.set(userKey, []);
    }
    
    const userRequests = this.requests.get(userKey);
    
    // 移除过期请求
    const windowStart = now - this.windowSize;
    const validRequests = userRequests.filter(time => time > windowStart);
    this.requests.set(userKey, validRequests);
    
    // 检查是否超过限制
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    // 记录当前请求
    validRequests.push(now);
    return true;
  }
  
  // 获取剩余请求数
  getRemainingRequests(userId, endpoint) {
    const userKey = `${userId}:${endpoint}`;
    const userRequests = this.requests.get(userKey) || [];
    
    const now = Date.now();
    const windowStart = now - this.windowSize;
    const validRequests = userRequests.filter(time => time > windowStart);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }
}
```

## 6. 重试与熔断阈值

### 6.1 重试策略

#### 6.1.1 指数退避重试
```javascript
// 指数退避重试策略
class ExponentialBackoffRetry {
  constructor(maxRetries = 5, baseDelay = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
  }
  
  async execute(operation, context = {}) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // 记录成功日志
        this.logSuccess(attempt, context);
        return result;
        
      } catch (error) {
        lastError = error;
        
        // 检查是否应该重试
        if (!this.shouldRetry(error, attempt)) {
          this.logFailure(attempt, error, context);
          throw error;
        }
        
        // 计算等待时间
        const delay = this.calculateDelay(attempt);
        
        // 记录重试日志
        this.logRetry(attempt, error, delay, context);
        
        // 等待后重试
        if (attempt < this.maxRetries) {
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }
  
  // 计算延迟时间
  calculateDelay(attempt) {
    return Math.min(this.baseDelay * Math.pow(2, attempt), 30000); // 最大30秒
  }
  
  // 检查是否应该重试
  shouldRetry(error, attempt) {
    // 不可重试的错误
    const nonRetryableErrors = [
      'VALIDATION_ERROR',
      'AUTHENTICATION_ERROR',
      'PERMISSION_DENIED'
    ];
    
    if (nonRetryableErrors.includes(error.code)) {
      return false;
    }
    
    // 网络错误、超时错误等可以重试
    const retryableErrors = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'SERVER_ERROR'
    ];
    
    return retryableErrors.includes(error.code) && attempt < this.maxRetries;
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 6.2 熔断器模式

#### 6.2.1 熔断器状态机
```javascript
// 熔断器实现
class CircuitBreaker {
  constructor(failureThreshold = 5, timeout = 60000) {
    this.failureThreshold = failureThreshold; // 失败阈值
    this.timeout = timeout;                   // 超时时间
    this.failureCount = 0;                    // 当前失败次数
    this.state = 'CLOSED';                    // 状态：CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = 0;                     // 下次尝试时间
  }
  
  // 执行操作
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
      
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  // 成功处理
  onSuccess() {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }
  
  // 失败处理
  onFailure() {
    this.failureCount++;
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
  
  // 获取状态
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      nextAttempt: this.nextAttempt,
      isAvailable: this.state !== 'OPEN' || Date.now() >= this.nextAttempt
    };
  }
}

// 服务熔断器管理器
class ServiceCircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }
  
  // 获取服务的熔断器
  getBreaker(serviceName) {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker());
    }
    return this.breakers.get(serviceName);
  }
  
  // 执行服务调用
  async callService(serviceName, operation) {
    const breaker = this.getBreaker(serviceName);
    return await breaker.execute(operation);
  }
  
  // 获取所有熔断器状态
  getAllStatus() {
    const status = {};
    for (const [serviceName, breaker] of this.breakers) {
      status[serviceName] = breaker.getStatus();
    }
    return status;
  }
}
```

## 7. 异常检测与告警

### 7.1 异常模式检测

#### 7.1.1 行为异常检测
```javascript
// 用户行为异常检测
class UserBehaviorAnalyzer {
  constructor() {
    this.normalPatterns = this.initializeNormalPatterns();
  }
  
  // 检测异常行为
  detectAnomalies(userActions, timeWindow = 3600000) { // 1小时窗口
    const anomalies = [];
    
    // 检测高频操作
    const highFrequency = this.detectHighFrequency(userActions, timeWindow);
    if (highFrequency) {
      anomalies.push({
        type: 'HIGH_FREQUENCY_OPERATION',
        severity: 'MEDIUM',
        details: highFrequency
      });
    }
    
    // 检测时间模式异常
    const timePattern = this.detectTimePatternAnomaly(userActions);
    if (timePattern) {
      anomalies.push({
        type: 'UNUSUAL_TIME_PATTERN',
        severity: 'LOW',
        details: timePattern
      });
    }
    
    // 检测金额模式异常
    const amountPattern = this.detectAmountAnomaly(userActions);
    if (amountPattern) {
      anomalies.push({
        type: 'UNUSUAL_AMOUNT_PATTERN',
        severity: 'HIGH',
        details: amountPattern
      });
    }
    
    return anomalies;
  }
  
  // 检测高频操作
  detectHighFrequency(actions, timeWindow) {
    const windowStart = Date.now() - timeWindow;
    const recentActions = actions.filter(action => action.timestamp > windowStart);
    
    if (recentActions.length > 100) { // 1小时内超过100次操作
      return {
        actionCount: recentActions.length,
        timeWindow: timeWindow,
        averageInterval: timeWindow / recentActions.length
      };
    }
    
    return null;
  }
}
```

### 7.2 实时告警系统

#### 7.2.1 告警规则配置
```javascript
// 告警规则配置
const alertRules = {
  RISK_CONTROL: {
    high_frequency_operation: {
      threshold: 100,        // 1小时内操作次数
      severity: 'MEDIUM',
      channels: ['EMAIL', 'SLACK']
    },
    unusual_payout_pattern: {
      threshold: 5,         // 连续赔付申请次数
      severity: 'HIGH',
      channels: ['SMS', 'EMAIL', 'SLACK']
    },
    system_limits_exceeded: {
      threshold: 0.8,       // 系统限额使用率
      severity: 'HIGH',
      channels: ['SMS', 'EMAIL']
    }
  }
};

// 告警管理器
class AlertManager {
  constructor() {
    this.alertHistory = [];
    this.notificationChannels = {
      EMAIL: new EmailNotifier(),
      SLACK: new SlackNotifier(),
      SMS: new SMSNotifier()
    };
  }
  
  // 触发告警
  async triggerAlert(rule, context, severity) {
    const alert = {
      id: this.generateAlertId(),
      rule: rule,
      context: context,
      severity: severity,
      timestamp: new Date(),
      status: 'TRIGGERED'
    };
    
    this.alertHistory.push(alert);
    
    // 发送通知
    await this.sendNotifications(rule, alert);
    
    return alert;
  }
  
  // 发送通知
  async sendNotifications(rule, alert) {
    const channels = rule.channels || [];
    
    for (const channel of channels) {
      const notifier = this.notificationChannels[channel];
      if (notifier) {
        await notifier.send(alert);
      }
    }
  }
}
```

## 8. 实施与监控

### 8.1 风控指标监控

#### 8.1.1 关键监控指标
```javascript
// 风控监控指标
const riskMetrics = {
  // 用户行为指标
  user_behavior: {
    daily_active_users: 0,
    average_orders_per_user: 0,
    claim_approval_rate: 0,
    fraud_detection_rate: 0
  },
  
  // 系统性能指标
  system_performance: {
    api_success_rate: 0,
    average_response_time: 0,
    concurrent_users: 0,
    system_utilization: 0
  },
  
  // 风险指标
  risk_indicators: {
    suspicious_activity_count: 0,
    blacklisted_users: 0,
    rate_limited_requests: 0,
    circuit_breaker_triggers: 0
  }
};

// 监控数据收集
class RiskMetricsCollector {
  constructor() {
    this.metrics = riskMetrics;
    this.collectionInterval = 60000; // 每分钟收集一次
  }
  
  // 收集指标数据
  async collectMetrics() {
    const metrics = {
      timestamp: new Date(),
      user_behavior: await this.collectUserBehaviorMetrics(),
      system_performance: await this.collectSystemPerformanceMetrics(),
      risk_indicators: await this.collectRiskIndicatorMetrics()
    };
    
    // 存储到监控数据库
    await this.storeMetrics(metrics);
    
    return metrics;
  }
  
  // 生成监控报告
  generateReport(timeRange = '24h') {
    return {
      time_range: timeRange,
      summary: this.generateSummary(),
      trends: this.analyzeTrends(),
      alerts: this.getRecentAlerts(),
      recommendations: this.generateRecommendations()
    };
  }
}
```

### 8.2 风控策略优化

#### 8.2.1 A/B测试框架
```javascript
// 风控策略A/B测试
class RiskControlABTest {
  constructor() {
    this.experiments = new Map();
  }
  
  // 创建实验
  createExperiment(name, variants) {
    this.experiments.set(name, {
      variants: variants,
      startTime: new Date(),
      participants: new Map(),
      results: {}
    });
  }
  
  // 分配用户到实验组
  assignVariant(userId, experimentName) {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) return null;
    
    // 简单的随机分配
    const variantNames = Object.keys(experiment.variants);
    const randomIndex = Math.floor(Math.random() * variantNames.length);
    const variant = variantNames[randomIndex];
    
    experiment.participants.set(userId, {
      variant: variant,
      assignedAt: new Date()
    });
    
    return variant;
  }
  
  // 收集实验结果
  recordResult(experimentName, userId, outcome) {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) return;
    
    const participant = experiment.participants.get(userId);
    if (!participant) return;
    
    if (!experiment.results[participant.variant]) {
      experiment.results[participant.variant] = [];
    }
    
    experiment.results[participant.variant].push(outcome);
  }
  
  // 分析实验结果
  analyzeResults(experimentName) {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) return null;
    
    const analysis = {};
    
    for (const [variant, outcomes] of Object.entries(experiment.results)) {
      analysis[variant] = {
        participantCount: outcomes.length,
        successRate: outcomes.filter(o => o.success).length / outcomes.length,
        averageResponseTime: outcomes.reduce((sum, o) => sum + o.responseTime, 0) / outcomes.length,
        fraudDetectionRate: outcomes.filter(o => o.fraudDetected).length / outcomes.length
      };
    }
    
    return analysis;
  }
}
```

---

**文档维护**：风控策略应定期评审和优化，基于实际运行数据和新的威胁情报进行调整。