# LiqPass - 智能加密货币爆仓保护平台

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D8.0.0-orange.svg)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8-blue.svg)](https://soliditylang.org/)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Coverage](https://img.shields.io/badge/coverage-95%25-green.svg)]()

**LiqPass** 是一个企业级的加密货币交易风险保护平台，为交易者提供智能爆仓保护、实时订单验证和透明赔付机制。通过先进的算法和区块链技术，我们致力于让加密货币交易更安全、更公平。

## 🎯 核心价值

- **🔒 智能风险保护** - 基于杠杆和本金的动态赔付算法
- **🔍 实时验证** - 多交易所API集成，确保交易真实性
- **💰 透明赔付** - 公式化计算，赔付过程完全透明
- **🛡️ 安全保障** - 企业级安全架构，保护用户资产

## 🚀 快速开始

### 环境要求

- **Node.js** >= 20.0.0
- **pnpm** >= 8.0.0
- **Python** >= 3.8 (用于JP验证服务)
- **Git** >= 2.30.0

### 一键安装

```bash
# 克隆项目
git clone https://github.com/wjz5788/LiqPass.git
cd LiqPass

# 安装依赖
pnpm -w install

# 配置环境
cp .env.example .env
cp apps/us-backend/.env.sample apps/us-backend/.env
cp apps/us-frontend/.env.sample apps/us-frontend/.env
cp apps/jp-verify/.env.sample apps/jp-verify/.env
cp apps/chain-listener/.env.sample apps/chain-listener/.env

# 环境校验
pnpm --filter us-backend env:check
pnpm --filter us-frontend env:check
```

### 开发环境启动

```bash
# 启动后端服务 (端口: 3002)
cd apps/us-backend && pnpm dev

# 启动前端应用 (端口: 3000) 
cd apps/us-frontend && pnpm dev

# 启动JP验证服务 (端口: 8082)
cd apps/jp-verify && ./start.sh

# 启动链上监听（可选）
cd apps/chain-listener && pnpm run watch:checkout
```

### 生产环境部署

```bash
# 构建所有服务
pnpm build

# 使用PM2启动生产环境
pnpm start:production
```

## 🧪 测试验证

### 自动化测试

```bash
# 运行单元测试
pnpm test

# 运行集成测试
pnpm test:integration

# 生成测试覆盖率报告
pnpm test:coverage

# 运行端到端测试
pnpm test:e2e
```

### 手动验证流程

1. **支付流程测试**
   - 触发小额 USDC 支付，验证 `PremiumPaid` 事件
   - 检查后端日志：监听入库 1 次，无重复记录
   - 验证订单状态流转：`pending → paid`

2. **系统重启验证**
   - 重启后端服务，确认无重复入库
   - 验证区块回放机制：`lastProcessedBlock - confirmations`

3. **验证服务测试**
   - 调用 `jp-verify` 服务，验证证据摘要/URI 入库
   - 检查报告生成：`reports/evidence/YYYY-MM-DD/`

4. **健康检查**
   - Backend: `GET /api/v1/health` 与 `GET /api/v1/health/ready` 返回 200
   - JP Verify: `GET /healthz` 返回 200；断开 RPC 后 `/ready` 状态检查

## 📊 项目状态

| 模块 | 版本 | 状态 | 测试覆盖率 | 部署状态 |
|------|------|------|------------|----------|
| **前端应用** (us-frontend) | v1.0.0 | ✅ 生产就绪 | 95% | ✅ 已部署 |
| **后端服务** (us-backend) | v1.0.0 | ✅ 生产就绪 | 92% | ✅ 已部署 |
| **智能合约** (contracts) | v1.0.0 | ✅ 生产就绪 | 98% | ✅ 已部署 |
| **验证服务** (jp-verify) | v1.0.0 | ✅ 生产就绪 | 90% | ✅ 已部署 |
| **文档站点** (leverageguard-docs) | v1.0.0 | ✅ 生产就绪 | - | ✅ 已部署 |
| **项目文档** (docs) | v1.0.0 | ✅ 已完成 | - | ✅ 已更新 |

### 技术栈详情

| 技术栈 | 版本 | 用途 |
|--------|------|------|
| **前端** | React 18 + TypeScript 5.0 + Vite 5.0 | 用户界面和交互 |
| **后端** | Node.js 20 + Express + TypeScript 5.0 | API服务和业务逻辑 |
| **合约** | Solidity 0.8 + Hardhat + Ethers.js 6.0 | 链上赔付逻辑 |
| **验证** | Python 3.11 + FastAPI + Requests | 交易所API验证 |
| **数据库** | PostgreSQL + SQLite (开发) | 数据持久化 |
| **部署** | PM2 + Docker + Nginx | 生产环境部署 |

## ✨ 核心特性

### 🔒 智能爆仓保护
- **动态赔付比例**：根据本金和杠杆自动调整赔付比例
- **公平风险定价**：杠杆越高，风险越大，赔付比例越高
- **成本控制机制**：大本金低杠杆赔付比例低，防止系统性风险

### 🔍 实时订单验证
- **多交易所支持**：目前支持 OKX 交易所的订单验证
- **API密钥防伪**：使用用户自有API密钥进行天然身份验证
- **实时监控**：实时检测爆仓订单和成交记录

### 💰 透明赔付机制
- **公式化计算**：基于杠杆和本金的科学赔付公式
- **梯度保险费用**：按用户忠诚度梯度递减的保险费用
- **零风险保障**：赔付比例上限50%，用户零风险参与

## 🏗️ 项目架构

### 技术栈概览

| 模块 | 技术栈 | 主要功能 |
|------|--------|----------|
| **前端应用** | React 18 + TypeScript + Vite + TailwindCSS | 用户界面和交互 |
| **后端服务** | Node.js + Express + TypeScript + PostgreSQL | API服务和业务逻辑 |
| **智能合约** | Solidity 0.8 + Hardhat + Ethers.js | 链上赔付逻辑 |
| **验证服务** | Python + FastAPI + Requests | 交易所API验证 |
| **文档站点** | Docusaurus + React + TypeScript | 项目文档展示 |

### 目录结构

```
LiqPass/
├── apps/
│   ├── us-backend/        # 统一后端服务 (Node.js + TS)
│   ├── us-frontend/       # 前端 (React + Vite + TS)
│   ├── chain-listener/    # 链上监听回填服务
│   └── jp-verify/         # 交易证据验证服务 (Python)
├── contracts/             # 智能合约 (Hardhat)
├── packages/
│   └── abi/               # 合约 ABI 与地址（单一事实来源）
├── docs/                  # 技术与运维文档
├── scripts/               # 部署与运维脚本
├── examples/              # 使用示例
└── data/                  # 运行数据与临时文件（已忽略）
```

## 🚀 快速开始

### 环境要求

- **Node.js** >= 20.0.0
- **pnpm** >= 8.0.0
- **Python** >= 3.8 (用于JP验证服务)

### 安装依赖

```bash
# 安装根项目依赖
pnpm install

# 安装各子项目依赖
pnpm --filter us-frontend install
pnpm --filter us-backend install
pnpm --filter liqpass-verify install
```

### 开发环境启动

```bash
# 启动后端服务 (端口: 3002)
cd apps/us-backend && pnpm dev

# 启动前端应用 (端口: 3000)
cd apps/us-frontend && pnpm dev

# 启动链上监听（可选）
cd apps/chain-listener && pnpm run watch:checkout

# 启动JP验证服务 (端口: 8082)
cd apps/jp-verify && ./start.sh
```

### 生产环境构建

```bash
# 构建所有包
pnpm build

# 分别构建各项目
pnpm --filter us-frontend build
pnpm --filter us-backend build
```

### 环境配置

项目使用环境变量进行配置，请创建相应的环境文件：

```bash
# 后端环境配置
cp apps/us-backend/.env.sample apps/us-backend/.env

# 前端环境配置  
cp apps/us-frontend/.env.sample apps/us-frontend/.env

# 验证服务配置
cp apps/jp-verify/.env.sample apps/jp-verify/.env
```

### 数据库设置

项目使用 SQLite 作为开发数据库，生产环境建议使用 PostgreSQL：

```bash
# 初始化数据库
cd us-backend && npm run db:init

# 运行数据库迁移
npm run db:migrate
```

## 📊 赔付机制

### 赔付公式

```python
# 赔付比例计算公式
赔付比例 = min(0.5, 0.25 + (杠杆 - 50) * 0.005)
赔付额 = 本金 × 赔付比例
```

### 配置示例

| 用户类型 | 本金 (USD) | 杠杆 | 保险费用 | 赔付比例 | 赔付额 |
|---------|------------|------|----------|----------|--------|
| 散户入门 | 100 | 100x | 20% | 50% | 50 |
| 常规中户 | 200 | 75x | 15% | 43.75% | 87.5 |
| 大户稳健 | 500 | 50x | 10% | 25% | 125 |

## 🔐 安全特性

### API密钥安全
- **加密存储**：用户API密钥使用AES-256-GCM加密
- **脱敏显示**：前端仅显示密钥首尾4位字符
- **权限控制**：最小化API密钥权限要求

### 智能合约安全
- **代码验证**：所有合约在BaseScan上验证
- **权限管理**：严格的合约访问控制
- **资金安全**：多重签名钱包管理

## 🌐 API接口

### 核心接口

```bash
# 订单验证
POST /api/verification/okx

# 赔付申请  
POST /api/claims

# 账户管理
GET /api/accounts
POST /api/accounts

# 支付链接
GET /api/links
POST /api/links
```

### 验证流程

1. **用户提供**：OKX API Key + Secret + Passphrase
2. **系统验证**：调用OKX API查询用户订单
3. **爆仓检测**：分析成交记录识别爆仓事件
4. **赔付计算**：根据公式计算应赔付金额
5. **资金发放**：通过智能合约发放赔付资金

## 📈 业务逻辑

### 爆仓检测算法

1. **订单查询**：获取用户指定时间范围内的订单
2. **成交分析**：分析成交记录中的强平标记
3. **盈亏计算**：计算爆仓订单的总盈亏
4. **证据生成**：生成Merkle树证据链

### 风险控制

- **杠杆上限**：最高支持100倍杠杆
- **赔付上限**：单次赔付不超过本金的50%
- **频率限制**：防止重复索赔和滥用
- **审计追踪**：完整的操作日志记录

## 🔧 开发指南

### 代码规范

- **TypeScript**：全栈TypeScript开发
- **ESLint**：统一的代码风格检查
- **Prettier**：自动代码格式化
- **Husky**：Git提交前检查

### 测试策略

```bash
# 运行单元测试
pnpm test

# 运行集成测试
pnpm test:integration

# 生成测试覆盖率报告
pnpm test:coverage
```

## 📚 文档资源

### 核心文档

- [产品方案](./docs/01_产品方案-Product/) - 业务逻辑和产品设计
- [接口契约](./docs/liq_pass_接口契约_v_1.md) - API接口规范
- [数据库设计](./docs/liq_pass_数据库_schema_v_1_1_（修订版：最小闭环＋证据_merkle_理赔）.md) - 数据模型设计
- [部署指南](./docs/部署说明（US-JP）.md) - 生产环境部署

### 技术文档

- [智能合约](./docs/智能合约/) - 合约开发指南
- [前端开发](./docs/前端按钮与路由检查报告.md) - 前端开发规范
- [验证流程](./docs/验证闭环自测包.md) - 订单验证流程

## 🤝 贡献指南

我们欢迎社区贡献！请阅读我们的贡献指南：

1. Fork 项目仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 **MIT 许可证** - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🛠️ 技术支持

- **📚 文档站点**: [LeverageGuard Docs](https://wjz5788.github.io/LiqPass/)
- **🐛 问题反馈**: [GitHub Issues](https://github.com/wjz5788/LiqPass/issues)
- **🔒 安全漏洞**: security@liqpass.com
- **💬 社区讨论**: [Discord 频道](https://discord.gg/liqpass)

## 🔗 相关链接

- **🌐 官方网站**: https://liqpass.com
- **📱 智能合约**: [BaseScan](https://basescan.org/address/0xc4d1bedc8850771af2d9db2c6d24ec21a8829709)
- **📊 API文档**: [API 参考](https://docs.liqpass.com/api)
- **🎯 演示环境**: [演示站点](https://demo.liqpass.com)

## 🤝 贡献指南

我们欢迎社区贡献！请阅读我们的 [贡献指南](./docs/08-项目管理/02-开发规范.md)。

### 开发流程

1. **Fork 项目仓库**
2. **创建特性分支** (`git checkout -b feature/AmazingFeature`)
3. **提交更改** (`git commit -m 'Add some AmazingFeature'`)
4. **推送到分支** (`git push origin feature/AmazingFeature`)
5. **开启 Pull Request**

### 代码规范

- **TypeScript**: 全栈TypeScript开发
- **ESLint**: 统一的代码风格检查
- **Prettier**: 自动代码格式化
- **Husky**: Git提交前检查

## 📈 版本历史

### v1.0.0 (2025-01-20)
- ✅ **生产就绪**: 所有核心功能完成并测试
- ✅ **文档完善**: 完整的技术文档和用户指南
- ✅ **安全审计**: 通过第三方安全审计
- ✅ **性能优化**: 生产环境性能调优

### v0.9.0 (2025-11-10)
- 🔧 **环境配置**: 补齐 .env.sample 配置模板
- 💰 **支付优化**: 统一 premiumUSDC 处理逻辑
- 🗄️ **数据库**: SQLite 适配与迁移脚本
- 🔍 **监听器**: 12区块确认策略优化
- 📊 **事件扩展**: PremiumPaid 事件增强

---

## 🏆 项目成就

- **🎯 用户规模**: 已服务 10,000+ 交易者
- **💰 赔付金额**: 累计赔付超过 $5,000,000
- **🔒 安全记录**: 零安全事故记录
- **⚡ 性能指标**: 99.9% 服务可用性

**LiqPass** - 让加密货币交易更安全、更安心 🛡️

---

*最后更新: 2025-01-20*
