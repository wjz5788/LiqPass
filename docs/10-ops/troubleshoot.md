# 错误处理与故障排查手册

## 文档概述

**文档目的**：提供LiqPass系统常见错误的诊断和修复指南，帮助运维团队快速定位和解决系统故障。
**适用对象**：运维团队、开发团队、技术支持团队
**文档版本**：v1.0
**最后更新**：2024-12-19

## 1. 错误分类与严重程度

### 1.1 错误严重程度定义
- **P0 - 紧急**：系统完全不可用，需要立即修复
- **P1 - 严重**：核心功能不可用，影响大量用户
- **P2 - 重要**：部分功能异常，影响部分用户
- **P3 - 一般**：非核心功能问题，影响有限
- **P4 - 轻微**：界面显示问题，不影响功能

### 1.2 错误类型分类
- **网络错误**：连接超时、DNS解析失败等
- **数据库错误**：连接失败、查询超时、死锁等
- **API错误**：接口调用失败、参数验证错误等
- **区块链错误**：交易失败、Gas不足、合约调用错误等
- **业务逻辑错误**：计算错误、状态不一致等

## 2. 常见错误诊断与修复

### 2.1 网络连接错误

#### 错误1：前端无法连接后端服务
**错误现象**：前端页面显示"无法连接到服务器"或"网络错误"
**错误代码**：`NETWORK_ERROR`, `ECONNREFUSED`

**诊断步骤**：
1. 检查后端服务是否正常运行
```bash
# 检查US后端服务状态
curl -f http://localhost:3001/healthz

# 检查JP验证服务状态  
curl -f http://localhost:3002/healthz
```

2. 检查防火墙和端口配置
```bash
# 检查端口监听状态
netstat -tulpn | grep :3001
netstat -tulpn | grep :3002

# 检查防火墙规则
sudo ufw status
```

3. 检查DNS解析
```bash
# 检查域名解析
nslookup api.liqpass.com

# 检查本地hosts文件
cat /etc/hosts | grep liqpass
```

**修复命令**：
```bash
# 重启后端服务
cd /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend
npm start

# 重启验证服务
cd /Users/zhaomosheng/Desktop/100u/LiqPass/jp-verify  
npm start

# 临时关闭防火墙（仅开发环境）
sudo ufw disable
```

#### 错误2：交易所API连接超时
**错误现象**：价格验证失败，显示"交易所API不可用"
**错误代码**：`EXCHANGE_API_TIMEOUT`, `ETIMEDOUT`

**诊断步骤**：
1. 检查网络连通性
```bash
# 测试连接到交易所API
curl -I https://api.binance.com/api/v3/ping
curl -I https://www.okx.com/api/v5/market/ticker
```

2. 检查API密钥配置
```bash
# 检查环境变量配置
cat /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/.env.us | grep API_KEY
```

3. 检查API调用频率限制
```bash
# 查看API调用日志
tail -f /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/logs/api-calls.log
```

**修复命令**：
```bash
# 重置API密钥（如果需要）
export BINANCE_API_KEY="new_api_key"
export BINANCE_SECRET_KEY="new_secret_key"

# 增加请求超时时间
export API_TIMEOUT=10000

# 重启服务应用新配置
cd /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend
npm restart
```

### 2.2 数据库错误

#### 错误3：SQLite数据库锁死
**错误现象**：数据库操作超时，显示"database is locked"
**错误代码**：`SQLITE_BUSY`, `SQLITE_LOCKED`

**诊断步骤**：
1. 检查数据库连接状态
```bash
# 检查数据库文件状态
ls -la /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/

# 检查是否有僵尸进程占用数据库
fuser /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/us.sqlite
```

2. 检查数据库日志
```bash
# 查看数据库操作日志
tail -f /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/logs/db.log
```

3. 检查并发连接数
```bash
# 查看当前数据库连接
sqlite3 /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/us.sqlite "PRAGMA database_list;"
```

**修复命令**：
```bash
# 强制关闭所有数据库连接
fuser -k /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/us.sqlite

# 备份并重建数据库（严重情况下）
cp /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/us.sqlite /tmp/us.sqlite.backup
rm /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/us.sqlite*

# 重新初始化数据库
cd /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend
node src/scripts/init-db.js
```

#### 错误4：数据库查询性能问题
**错误现象**：API响应缓慢，数据库查询超时
**错误代码**：`QUERY_TIMEOUT`, `DATABASE_SLOW`

**诊断步骤**：
1. 检查数据库索引
```bash
# 检查表索引状态
sqlite3 /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/us.sqlite ".indexes"
```

2. 分析慢查询
```bash
# 启用SQLite性能分析
sqlite3 /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/us.sqlite "PRAGMA temp_store = MEMORY;"
sqlite3 /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/us.sqlite "PRAGMA journal_mode = WAL;"
```

3. 检查数据库大小和碎片
```bash
# 检查数据库大小
sqlite3 /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/us.sqlite "SELECT name, page_count * page_size as size FROM pragma_page_count(), pragma_page_size();"
```

**修复命令**：
```bash
# 优化数据库性能
sqlite3 /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/us.sqlite "VACUUM;"
sqlite3 /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/us.sqlite "ANALYZE;"

# 重建索引
sqlite3 /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/us.sqlite "REINDEX;"

# 调整数据库配置
sqlite3 /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/us.sqlite "PRAGMA cache_size = -64000;"
```

### 2.3 API接口错误

#### 错误5：API参数验证失败
**错误现象**：API调用返回400错误，参数验证不通过
**错误代码**：`VALIDATION_ERROR`, `INVALID_PARAMETERS`

**诊断步骤**：
1. 检查请求参数格式
```bash
# 查看API请求日志
tail -f /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/logs/access.log | grep "400"
```

2. 验证请求体格式
```bash
# 测试API接口
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Content-Type: application/json" \
  -d '{"sku_id":"DAY_24H_FIXED","payout_amount":100000}' \
  -v
```

3. 检查API文档和参数要求
```bash
# 查看API规范
cat /Users/zhaomosheng/Desktop/100u/LiqPass/docs/02-api/us-backend.md | grep -A 10 "创建订单"
```

**修复命令**：
```bash
# 修正请求参数格式
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "sku_id": "DAY_24H_FIXED",
    "payout_amount": 100000,
    "leverage_multiplier": 3,
    "user_address": "0x1234..."
  }'

# 更新客户端SDK版本
cd /Users/zhaomosheng/Desktop/100u/LiqPass/us-frontend
npm update liqpass-sdk
```

#### 错误6：身份认证失败
**错误现象**：API调用返回401错误，身份验证失败
**错误代码**：`AUTHENTICATION_FAILED`, `INVALID_TOKEN`

**诊断步骤**：
1. 检查JWT令牌有效性
```bash
# 验证令牌格式
jwt-decode <token>
```

2. 检查API密钥配置
```bash
# 检查环境变量
cat /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/.env.us | grep -E "(JWT|SECRET|KEY)"
```

3. 检查令牌过期时间
```bash
# 查看令牌签发和过期时间
node -e "console.log(JSON.parse(Buffer.from('<token>'.split('.')[1], 'base64').toString()))"
```

**修复命令**：
```bash
# 重新生成JWT密钥
export JWT_SECRET="$(openssl rand -base64 32)"

# 更新环境配置文件
echo "JWT_SECRET=$JWT_SECRET" >> /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/.env.us

# 重启服务
cd /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend
npm restart

# 清除客户端缓存（前端）
localStorage.removeItem('auth_token')
sessionStorage.clear()
```

### 2.4 区块链相关错误

#### 错误7：智能合约调用失败
**错误现象**：合约交易失败，Gas费用不足或合约执行错误
**错误代码**：`CONTRACT_CALL_FAILED`, `OUT_OF_GAS`, `REVERTED`

**诊断步骤**：
1. 检查Gas价格和限制
```bash
# 检查当前Gas价格
curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}'
```

2. 检查合约状态
```bash
# 检查合约代码
node -e "
const { ethers } = require('ethers');
const provider = new ethers.providers.JsonRpcProvider(process.env.BASE_RPC_URL);
const contract = new ethers.Contract(process.env.CONTRACT_ADDRESS, ['function getPolicyCount() view returns (uint256)'], provider);
contract.getPolicyCount().then(console.log);
"
```

3. 检查交易状态
```bash
# 查看交易详情
curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getTransactionReceipt","params":["0x..."],"id":1}'
```

**修复命令**：
```bash
# 增加Gas限制
export GAS_LIMIT=300000

# 调整Gas价格
export GAS_PRICE_MULTIPLIER=1.2

# 重新提交交易
node src/scripts/resubmit-transaction.js <failed_tx_hash>

# 检查私钥余额
node -e "
const { ethers } = require('ethers');
const wallet = new ethers.Wallet(process.env.PAYOUT_PRIVATE_KEY);
const provider = new ethers.providers.JsonRpcProvider(process.env.BASE_RPC_URL);
const balance = await provider.getBalance(wallet.address);
console.log('Balance:', ethers.utils.formatEther(balance), 'ETH');
"
```

#### 错误8：区块链网络连接问题
**错误现象**：无法连接到区块链网络，交易无法提交
**错误代码**：`BLOCKCHAIN_NETWORK_ERROR`, `RPC_CONNECTION_FAILED`

**诊断步骤**：
1. 检查RPC端点连通性
```bash
# 测试Base网络连接
curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}'

# 测试备用RPC端点
curl -X POST https://base-mainnet.g.alchemy.com/v2/<key> \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}'
```

2. 检查网络同步状态
```bash
# 检查最新区块高度
curl -X POST https://mainnet.base.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

3. 检查防火墙和代理设置
```bash
# 检查网络连接
telnet mainnet.base.org 443

# 检查代理设置
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

**修复命令**：
```bash
# 切换到备用RPC端点
export BASE_RPC_URL="https://base-mainnet.g.alchemy.com/v2/your-api-key"

# 配置重试机制
export RPC_RETRY_ATTEMPTS=3
export RPC_RETRY_DELAY=1000

# 重启服务应用新配置
cd /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend
npm restart
```

### 2.5 前端错误

#### 错误9：前端资源加载失败
**错误现象**：页面显示空白或资源加载错误
**错误代码**：`CHUNK_LOAD_ERROR`, `RESOURCE_LOAD_FAILED`

**诊断步骤**：
1. 检查构建产物
```bash
# 检查dist目录文件
ls -la /Users/zhaomosheng/Desktop/100u/LiqPass/us-frontend/dist/

# 检查文件完整性
find /Users/zhaomosheng/Desktop/100u/LiqPass/us-frontend/dist -name "*.js" -exec shasum {} \;
```

2. 检查服务器配置
```bash
# 检查Nginx配置（如果使用）
cat /etc/nginx/sites-available/liqpass | grep -A 5 location
```

3. 检查浏览器控制台错误
```javascript
// 在浏览器控制台检查错误
console.error('Frontend errors:');
window.addEventListener('error', (e) => console.error('Global error:', e));
```

**修复命令**：
```bash
# 重新构建前端
cd /Users/zhaomosheng/Desktop/100u/LiqPass/us-frontend
npm run build

# 清理缓存
rm -rf /Users/zhaomosheng/Desktop/100u/LiqPass/us-frontend/dist
rm -rf /Users/zhaomosheng/Desktop/100u/LiqPass/us-frontend/node_modules/.cache

# 重启开发服务器
npm run dev
```

#### 错误10：钱包连接失败
**错误现象**：无法连接MetaMask或其他钱包
**错误代码**：`WALLET_CONNECTION_FAILED`, `CHAIN_NOT_SUPPORTED`

**诊断步骤**：
1. 检查钱包扩展状态
```javascript
// 检查MetaMask可用性
if (typeof window.ethereum !== 'undefined') {
  console.log('MetaMask is available');
} else {
  console.log('Please install MetaMask');
}
```

2. 检查网络配置
```javascript
// 检查当前网络
const chainId = await window.ethereum.request({ method: 'eth_chainId' });
console.log('Current chainId:', chainId);

// 检查支持的链
const supportedChains = ['0x2105']; // Base主网
console.log('Supported chains:', supportedChains);
```

3. 检查权限请求
```javascript
// 检查账户权限
const accounts = await window.ethereum.request({ method: 'eth_accounts' });
console.log('Connected accounts:', accounts);
```

**修复命令**：
```bash
# 更新网络配置
cat > /Users/zhaomosheng/Desktop/100u/LiqPass/us-frontend/src/config/networks.ts << 'EOF'
export const SUPPORTED_CHAINS = {
  BASE_MAINNET: {
    chainId: '0x2105',
    chainName: 'Base Mainnet',
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org']
  }
};
EOF

# 重新构建前端
cd /Users/zhaomosheng/Desktop/100u/LiqPass/us-frontend
npm run build
```

### 2.6 业务逻辑错误

#### 错误11：保费计算错误
**错误现象**：保费计算结果与预期不符
**错误代码**：`PREMIUM_CALCULATION_ERROR`, `INVALID_LEVERAGE`

**诊断步骤**：
1. 检查计算参数
```bash
# 查看保费计算日志
tail -f /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/logs/calculation.log | grep premium
```

2. 验证计算公式
```javascript
// 手动验证保费计算
const calculatePremium = (payout, leverage, riskFactor) => {
  return payout / leverage * (1 + riskFactor);
};

console.log('Test calculation:', calculatePremium(100000, 3, 0.1));
```

3. 检查SKU配置
```bash
# 检查产品配置
cat /Users/zhaomosheng/Desktop/100u/LiqPass/docs/04-product/skus.md | grep -A 5 "DAY_24H_FIXED"
```

**修复命令**：
```bash
# 更新SKU配置
node src/scripts/update-skus.js

# 清除缓存并重新计算
redis-cli flushall

# 重启服务
cd /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend
npm restart
```

#### 错误12：订单状态不一致
**错误现象**：订单状态显示异常，与预期状态不符
**错误代码**：`ORDER_STATE_INCONSISTENT`, `STATE_TRANSITION_ERROR`

**诊断步骤**：
1. 检查订单状态历史
```bash
# 查询订单状态变更记录
sqlite3 /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/data/us.sqlite "SELECT * FROM order_state_history WHERE order_id = 'ORD_123';"
```

2. 验证状态机逻辑
```javascript
// 检查状态转换规则
const validTransitions = {
  'CREATED': ['VERIFYING', 'CANCELLED'],
  'VERIFYING': ['ACTIVE', 'FAILED'],
  'ACTIVE': ['CLAIM_TRIGGERED', 'EXPIRED']
};

console.log('Valid transitions:', validTransitions);
```

3. 检查并发操作
```bash
# 查看并发操作日志
tail -f /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/logs/concurrency.log
```

**修复命令**：
```bash
# 修复订单状态
node src/scripts/fix-order-state.js ORD_123

# 重新同步区块链状态
node src/scripts/sync-blockchain-state.js

# 更新状态机配置
cp src/state-machine/order-state.js src/state-machine/order-state.js.backup
# 编辑状态机配置...
```

## 3. 系统监控与日志分析

### 3.1 关键监控指标

#### 3.1.1 服务健康检查
```bash
# 自动化健康检查脚本
#!/bin/bash

# 检查后端服务
if curl -f http://localhost:3001/healthz > /dev/null 2>&1; then
    echo "US Backend: OK"
else
    echo "US Backend: FAILED"
    # 触发告警
fi

# 检查验证服务
if curl -f http://localhost:3002/healthz > /dev/null 2>&1; then
    echo "JP Verify: OK"
else
    echo "JP Verify: FAILED"
fi

# 检查数据库连接
if sqlite3 /path/to/database.db "SELECT 1;" > /dev/null 2>&1; then
    echo "Database: OK"
else
    echo "Database: FAILED"
fi
```

#### 3.1.2 性能监控
```bash
# 监控系统资源使用
#!/bin/bash

# CPU使用率
cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)

# 内存使用率
mem_usage=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')

# 磁盘使用率
disk_usage=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')

echo "CPU: ${cpu_usage}%"
echo "Memory: ${mem_usage}%"
echo "Disk: ${disk_usage}%"

# 如果资源使用率过高，触发告警
if (( $(echo "$cpu_usage > 80" | bc -l) )); then
    echo "High CPU usage detected"
fi
```

### 3.2 日志分析工具

#### 3.2.1 实时日志监控
```bash
# 实时监控错误日志
tail -f /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/logs/error.log | grep -E "(ERROR|FATAL)"

# 监控API访问日志
tail -f /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/logs/access.log | awk '$9 >= 400 {print}'

# 监控数据库查询日志
tail -f /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/logs/db.log | grep -E "(SLOW|TIMEOUT)"
```

#### 3.2.2 日志分析脚本
```bash
#!/bin/bash
# 错误日志分析脚本

LOG_FILE="/Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/logs/error.log"

# 统计错误类型
echo "=== Error Type Statistics ==="
grep -oE "ERROR_TYPE_[A-Z_]+" "$LOG_FILE" | sort | uniq -c | sort -nr

# 统计最近错误
echo "=== Recent Errors (Last 1 hour) ==="
grep "$(date -d '1 hour ago' '+%Y-%m-%d %H:')" "$LOG_FILE" | tail -10

# 统计错误频率
echo "=== Error Frequency ==="
awk '{print $1" "$2}' "$LOG_FILE" | cut -d: -f1-2 | uniq -c | tail -5
```

## 4. 故障恢复流程

### 4.1 紧急恢复步骤

#### 4.1.1 服务不可用恢复
```bash
# 紧急重启所有服务
cd /Users/zhaomosheng/Desktop/100u/LiqPass

# 停止所有服务
pkill -f "node.*us-backend"
pkill -f "node.*jp-verify"
pkill -f "vite"

# 启动服务
cd us-backend && npm start &
cd ../jp-verify && npm start &
cd ../us-frontend && npm run dev &

# 验证服务状态
sleep 10
curl -f http://localhost:3001/healthz
curl -f http://localhost:3002/healthz
curl -f http://localhost:5173
```

#### 4.1.2 数据库故障恢复
```bash
# 数据库备份恢复
cd /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend

# 停止服务
pkill -f "node.*server.js"

# 备份当前数据库
cp data/us.sqlite data/us.sqlite.emergency.backup.$(date +%Y%m%d_%H%M%S)

# 从备份恢复
if [ -f "data/us.sqlite.backup" ]; then
    cp data/us.sqlite.backup data/us.sqlite
else
    # 重新初始化
    node src/scripts/init-db.js
fi

# 重启服务
npm start
```

### 4.2 数据一致性检查

#### 4.2.1 订单状态一致性验证
```bash
# 检查订单状态一致性
node src/scripts/verify-order-consistency.js

# 输出示例
# Checking 150 orders...
# ✅ 148 orders are consistent
# ❌ 2 orders have state inconsistencies
# Repairing inconsistent orders...
# ✅ All orders repaired successfully
```

#### 4.2.2 区块链状态同步
```bash
# 同步区块链状态
node src/scripts/sync-blockchain-state.js

# 输出示例
# Syncing blockchain state...
# Processing block 12345678...
# Found 5 policy creation events
# Found 2 payout events
# Updated 7 order states
# Sync completed successfully
```

## 5. 预防性维护

### 5.1 定期维护任务

#### 5.1.1 数据库维护
```bash
# 每日数据库优化
#!/bin/bash
cd /Users/zhaomosheng/Desktop/100u/LiqPass/us-backend

# 备份数据库
cp data/us.sqlite data/us.sqlite.backup.$(date +%Y%m%d)

# 优化数据库
sqlite3 data/us.sqlite "VACUUM;"
sqlite3 data/us.sqlite "ANALYZE;"

# 清理旧备份（保留最近7天）
find data/ -name "us.sqlite.backup.*" -mtime +7 -delete

echo "Database maintenance completed"
```

#### 5.1.2 日志文件管理
```bash
# 日志轮转和清理
#!/bin/bash
LOG_DIR="/Users/zhaomosheng/Desktop/100u/LiqPass/us-backend/logs"

# 压缩旧日志
find "$LOG_DIR" -name "*.log" -mtime +1 -exec gzip {} \;

# 删除过旧日志（保留30天）
find "$LOG_DIR" -name "*.log.gz" -mtime +30 -delete

# 清理临时文件
find "$LOG_DIR" -name "*.tmp" -mtime +1 -delete

echo "Log maintenance completed"
```

### 5.2 监控告警设置

#### 5.2.1 关键指标告警
```bash
# 监控脚本示例
#!/bin/bash

# 检查服务响应时间
response_time=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3001/healthz)

if (( $(echo "$response_time > 2.0" | bc -l) )); then
    echo "High response time: ${response_time}s" | mail -s "Service Performance Alert" admin@liqpass.com
fi

# 检查错误率
error_count=$(grep -c "ERROR" /path/to/error.log)
request_count=$(grep -c "GET\|POST" /path/to/access.log)
error_rate=$(echo "scale=2; $error_count / $request_count * 100" | bc)

if (( $(echo "$error_rate > 1.0" | bc -l) )); then
    echo "High error rate: ${error_rate}%" | mail -s "Error Rate Alert" admin@liqpass.com
fi
```

---

**文档维护**：本手册应定期更新，基于实际运维经验添加新的错误场景和解决方案。