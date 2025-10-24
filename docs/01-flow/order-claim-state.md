# LiqPass 业务流程与状态机

## 业务流程时序图

```mermaid
sequenceDiagram
    participant U as 用户
    participant FE as 前端
    participant US as US后端
    participant JP as JP验证
    participant BC as Base链
    
    %% 浏览产品阶段
    U->>FE: 浏览产品目录
    FE->>US: GET /catalog/skus
    US-->>FE: 返回SKU列表
    FE-->>U: 显示产品信息
    
    %% 连接钱包阶段
    U->>FE: 连接MetaMask钱包
    FE->>U: 请求钱包签名
    U-->>FE: 确认签名
    
    %% 下单阶段
    U->>FE: 选择产品并下单
    FE->>US: POST /orders (含钱包地址)
    US->>JP: POST /verify/order
    JP-->>US: 返回验证结果
    US->>BC: 创建订单记录
    BC-->>US: 订单创建成功
    US-->>FE: 返回订单ID
    FE-->>U: 显示订单确认
    
    %% 开仓阶段
    Note over U,BC: 用户在实际交易所开仓
    U->>BC: 执行杠杆交易
    
    %% 理赔阶段
    U->>FE: 提交理赔申请
    FE->>US: POST /claim (含爆仓证明)
    US->>JP: 验证理赔条件
    JP-->>US: 理赔验证结果
    US->>BC: 执行赔付智能合约
    BC-->>US: 赔付执行成功
    US-->>FE: 返回理赔状态
    FE-->>U: 显示理赔结果
```

## 订单状态机

```mermaid
stateDiagram-v2
    [*] --> draft : 用户浏览产品
    draft --> paid : 支付保费成功
    paid --> active : JP验证通过
    active --> expired : 保险期限结束
    active --> claim_filed : 用户申请理赔
    
    claim_filed --> claim_verifying : 提交理赔申请
    claim_verifying --> claim_approved : JP验证通过
    claim_verifying --> claim_rejected : JP验证失败
    claim_approved --> claim_paid : 链上赔付完成
    claim_rejected --> active : 返回活跃状态
    
    claim_paid --> [*] : 理赔流程结束
    expired --> [*] : 订单自然结束
    
    %% 可逆转条件
    paid --> draft : 支付失败/超时
    claim_verifying --> claim_filed : 补充材料要求
```

## 状态定义与触发条件

### 订单状态

| 状态 | 触发条件 | 可逆转条件 | 描述 |
|------|----------|------------|------|
| draft | 用户浏览产品 | - | 初始状态，用户正在选择产品 |
| paid | 用户支付保费成功 | 支付失败/超时可回退 | 保费支付完成，等待验证 |
| active | JP验证通过订单真实性 | - | 保险生效，进入保障期 |
| expired | 保险期限自然结束 | - | 保险期限结束，无理赔发生 |

### 理赔状态

| 状态 | 触发条件 | 可逆转条件 | 描述 |
|------|----------|------------|------|
| claim_filed | 用户提交理赔申请 | - | 理赔申请已提交 |
| claim_verifying | 系统接收理赔申请 | 可要求补充材料 | JP验证理赔条件 |
| claim_approved | JP验证通过理赔条件 | - | 理赔审核通过 |
| claim_rejected | JP验证拒绝理赔 | 可重新申请 | 理赔审核拒绝 |
| claim_paid | 链上赔付执行成功 | - | 赔付完成，流程结束 |

## 关键业务流程说明

### 1. 浏览→连接钱包→验证→下单
**触发条件**：用户选择产品并确认购买
**关键检查点**：
- 钱包连接状态验证
- 产品库存和价格验证
- JP验证订单真实性
- 链上订单记录创建

### 2. 开仓→理赔申请
**触发条件**：用户在交易所发生爆仓
**关键检查点**：
- 爆仓证明文件验证
- 保险期限有效性检查
- JP验证理赔条件
- 赔付金额计算

### 3. 赔付执行
**触发条件**：理赔审核通过
**关键检查点**：
- 智能合约调用权限
- 资金充足性检查
- 交易确认状态监控
- 赔付记录更新

## 状态流转规则

### 正向流转
1. **draft → paid**：用户完成支付
2. **paid → active**：JP验证通过
3. **active → claim_filed**：用户提交理赔
4. **claim_filed → claim_verifying**：系统接收申请
5. **claim_verifying → claim_approved**：验证通过
6. **claim_approved → claim_paid**：链上赔付完成

### 逆向流转（异常处理）
1. **paid → draft**：支付失败或超时
2. **claim_verifying → claim_filed**：需要补充材料
3. **claim_verifying → claim_rejected**：验证失败
4. **claim_rejected → active**：返回保障状态

## 业务规则约束

- **时间约束**：保险期限结束后不可申请理赔
- **金额约束**：赔付金额不超过保单限额
- **身份约束**：只有保单持有人可申请理赔
- **证据约束**：理赔申请需提供有效爆仓证明
- **链上约束**：所有状态变更需在链上记录