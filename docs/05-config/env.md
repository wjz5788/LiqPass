# 配置与密钥清单

本文档提供LiqPass系统三端（US后端、US前端、JP验证服务器）的配置与密钥清单，确保系统可运行而不泄露敏感信息。

## 概述

LiqPass系统由三个独立服务组成，每个服务有特定的配置需求：
- **US后端**：处理订单、理赔、区块链交互
- **US前端**：用户界面，连接钱包和API
- **JP验证服务器**：验证交易所订单和理赔信息

## US后端配置 (.env.example)

```bash
# ===========================================
# US后端服务配置 - LiqPass US Backend
# ===========================================

# 服务器配置
US_PORT=3001
NODE_ENV=development

# 数据库配置
DB_PATH=./data/us.sqlite

# 日志配置
LOG_PATH=./logs/us-backend.log

# CORS配置
ALLOW_ORIGIN=http://localhost:5173
ALLOWED_HEADERS=Content-Type,Authorization,Idempotency-Key,X-Wallet-Address

# 赔付模式配置
PAYOUT_MODE=simulate  # simulate|real
DEFAULT_PAYOUT_ADDRESS=0x00195EcF4FF21aB985b13FC741Cdf276C71D88A1

# 区块链配置（仅当PAYOUT_MODE=real时必需）
PAYOUT_PRIVATE_KEY=your_payout_private_key_here
BASE_RPC_URL=https://mainnet.base.org
CONTRACT_ADDRESS=0x9552b58d323993f84d01e3744f175f47a9462f94

# 交易所API密钥（仅用于验证脚本，生产环境应使用JP验证服务器）
BINANCE_API_KEY=your_binance_api_key_here
BINANCE_SECRET_KEY=your_binance_secret_key_here
OKX_API_KEY=your_okx_api_key_here
OKX_SECRET_KEY=your_okx_secret_key_here
OKX_PASSPHRASE=your_okx_passphrase_here
```

### US后端配置说明

| 变量名 | 作用 | 默认值 | 是否必填 | 安全级别 |
|--------|------|--------|----------|----------|
| US_PORT | 服务器端口 | 3001 | 否 | 低 |
| DB_PATH | SQLite数据库文件路径 | ./data/us.sqlite | 否 | 中 |
| LOG_PATH | 日志文件路径 | ./logs/us-backend.log | 否 | 低 |
| ALLOW_ORIGIN | CORS允许的来源 | http://localhost:5173 | 否 | 低 |
| PAYOUT_MODE | 赔付模式 | simulate | 否 | 中 |
| PAYOUT_PRIVATE_KEY | 区块链赔付私钥 | - | 条件必填 | 高 |
| BASE_RPC_URL | Base链RPC端点 | https://mainnet.base.org | 否 | 中 |
| CONTRACT_ADDRESS | 智能合约地址 | 0x9552b58d323993f84d01e3744f175f47a9462f94 | 否 | 中 |

## US前端配置 (.env.example)

```bash
# ===========================================
# US前端配置 - LiqPass US Frontend
# ===========================================

# 开发服务器配置
VITE_PORT=5173
NODE_ENV=development

# API端点配置
VITE_US_BACKEND_BASE=/api/verify
VITE_JP_VERIFY_BASE=http://127.0.0.1:8787

# 钱包配置
VITE_SUPPORTED_NETWORKS=base
VITE_DEFAULT_NETWORK=base

# 功能开关
VITE_ENABLE_MOCK=true
VITE_ENABLE_ANALYTICS=false
```

### US前端配置说明

| 变量名 | 作用 | 默认值 | 是否必填 | 安全级别 |
|--------|------|--------|----------|----------|
| VITE_PORT | 开发服务器端口 | 5173 | 否 | 低 |
| VITE_US_BACKEND_BASE | US后端API基础URL | /api/verify | 否 | 低 |
| VITE_JP_VERIFY_BASE | JP验证服务器URL | http://127.0.0.1:8787 | 否 | 低 |
| VITE_ENABLE_MOCK | 启用模拟数据 | true | 否 | 低 |

## JP验证服务器配置 (.env.example)

```bash
# ===========================================
# JP验证服务器配置 - LiqPass JP Verify
# ===========================================

# 服务器配置
JP_PORT=8787
NODE_ENV=development

# 验证模式配置
VERIFY_MODE=real  # real|stub

# 交易所API端点配置
OKX_BASE_URL=https://www.okx.com
BINANCE_BASE_URL=https://api.binance.com

# 交易所API密钥（仅当VERIFY_MODE=real时必需）
OKX_API_KEY=your_okx_api_key_here
OKX_SECRET_KEY=your_okx_secret_key_here
OKX_PASSPHRASE=your_okx_passphrase_here
BINANCE_API_KEY=your_binance_api_key_here
BINANCE_SECRET_KEY=your_binance_secret_key_here

# 安全配置
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
MAX_REQUEST_SIZE=1048576
```

### JP验证服务器配置说明

| 变量名 | 作用 | 默认值 | 是否必填 | 安全级别 |
|--------|------|--------|----------|----------|
| JP_PORT | 服务器端口 | 8787 | 否 | 低 |
| VERIFY_MODE | 验证模式 | real | 否 | 中 |
| OKX_API_KEY | OKX交易所API密钥 | - | 条件必填 | 高 |
| BINANCE_API_KEY | Binance交易所API密钥 | - | 条件必填 | 高 |
| RATE_LIMIT_REQUESTS | 速率限制请求数 | 100 | 否 | 低 |

## 安全配置指南

### 密钥管理原则

1. **最小权限原则**：所有API密钥应仅具有读取权限
2. **环境隔离**：开发、测试、生产环境使用不同的密钥
3. **定期轮换**：API密钥应定期更换
4. **IP白名单**：交易所API密钥应配置IP白名单

### 敏感信息处理

| 信息类型 | 存储位置 | 访问控制 | 备份策略 |
|----------|----------|----------|----------|
| 区块链私钥 | 环境变量 | 仅限赔付服务 | 加密备份 |
| 交易所API密钥 | JP服务器环境变量 | 仅限验证服务 | 不备份 |
| 数据库文件 | 本地文件系统 | 文件权限控制 | 定期备份 |

### 部署安全检查清单

- [ ] 所有敏感密钥已从代码中移除
- [ ] 环境变量文件已添加到.gitignore
- [ ] 生产环境使用强密码和密钥
- [ ] API密钥已配置IP白名单
- [ ] 数据库文件权限已正确设置
- [ ] 日志文件不包含敏感信息

## 配置验证脚本

每个服务启动时应验证关键配置：

```javascript
// US后端配置验证
function validateUSBackendConfig() {
  const required = ['US_PORT', 'DB_PATH'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (process.env.PAYOUT_MODE === 'real' && !process.env.PAYOUT_PRIVATE_KEY) {
    throw new Error('PAYOUT_PRIVATE_KEY is required when PAYOUT_MODE=real');
  }
}

// JP验证服务器配置验证
function validateJPVerifyConfig() {
  if (process.env.VERIFY_MODE === 'real') {
    const required = ['OKX_API_KEY', 'BINANCE_API_KEY'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required API keys for real verification mode: ${missing.join(', ')}`);
    }
  }
}
```

## 故障排查

### 常见配置问题

1. **端口冲突**：检查US_PORT(3001)和JP_PORT(8787)是否被占用
2. **CORS错误**：确认ALLOW_ORIGIN配置正确
3. **数据库权限**：确保DB_PATH目录有写权限
4. **API密钥失效**：检查交易所API密钥是否有效

### 日志检查点

- 服务启动时记录关键配置（隐藏敏感信息）
- API调用失败时记录错误详情
- 数据库操作异常时记录SQL错误

## 版本控制

- 所有.env文件应添加到.gitignore
- 仅提供.env.example作为模板
- 敏感配置通过CI/CD管道注入
- 配置变更应有相应文档更新

此配置清单确保LiqPass系统在不同环境中的安全、可靠运行。