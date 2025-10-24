# 本地运行与部署手册

本文档提供LiqPass系统在本地开发环境和生产环境中的完整运行与部署指南。

## 系统要求

### 基础环境
- **Node.js**: 20.18.1 或更高版本（使用 `.nvmrc` 指定版本）
- **npm**: 9.x 或更高版本
- **操作系统**: macOS, Linux, Windows (WSL2推荐)
- **内存**: 至少 4GB RAM
- **磁盘空间**: 至少 2GB 可用空间

### 可选依赖
- **MetaMask**: 浏览器钱包扩展（用于前端测试）
- **Base网络**: 需要配置Base主网或测试网

## 本地开发环境搭建

### 1. 环境准备

```bash
# 克隆项目（如果尚未克隆）
git clone <repository-url>
cd LiqPass

# 使用正确的Node.js版本
nvm use  # 如果已安装nvm
# 或手动安装Node.js 20.18.1
```

### 2. 依赖安装

由于项目采用多项目结构，需要分别安装各项目依赖：

```bash
# 安装US后端依赖
cd us-backend
npm install

# 安装JP验证服务器依赖
cd ../jp-verify
npm install

# 安装US前端依赖
cd ../us-frontend
npm install

# 返回项目根目录
cd ..
```

### 3. 环境配置

为每个服务创建环境配置文件：

**US后端配置** (`us-backend/.env`):
```bash
# 复制示例配置
cp us-backend/.env.example us-backend/.env

# 编辑配置文件
# US_PORT=3001
# DB_PATH=./data/us.sqlite
# LOG_PATH=./logs/us-backend.log
# ALLOW_ORIGIN=http://localhost:5173
# PAYOUT_MODE=simulate
```

**JP验证服务器配置** (`jp-verify/.env`):
```bash
# 复制示例配置
cp jp-verify/.env.example jp-verify/.env

# 编辑配置文件
# JP_PORT=8787
# VERIFY_MODE=stub  # 开发环境使用stub模式
```

**US前端配置** (`us-frontend/.env`):
```bash
# 复制示例配置
cp us-frontend/.env.example us-frontend/.env

# 编辑配置文件
# VITE_US_BACKEND_BASE=/api/verify
# VITE_JP_VERIFY_BASE=http://127.0.0.1:8787
```

### 4. 数据库初始化

```bash
# 创建数据目录
mkdir -p us-backend/data us-backend/logs
mkdir -p jp-verify/data jp-verify/logs

# 初始化US后端数据库（首次运行时会自动创建）
cd us-backend
npm run dev  # 首次运行会自动创建数据库表结构
```

### 5. 启动服务

#### 方式一：分别启动（推荐用于开发）

**终端1 - 启动US后端**:
```bash
cd us-backend
npm run dev
# 服务运行在 http://localhost:3001
```

**终端2 - 启动JP验证服务器**:
```bash
cd jp-verify
npm run dev
# 服务运行在 http://localhost:8787
```

**终端3 - 启动US前端**:
```bash
cd us-frontend
npm run dev
# 服务运行在 http://localhost:5173
```

#### 方式二：使用启动脚本（如果存在）

```bash
# 如果项目提供了启动脚本
./start-dev.sh
```

### 6. 验证服务状态

检查各服务是否正常运行：

```bash
# 检查US后端
curl http://localhost:3001/healthz

# 检查JP验证服务器
curl http://localhost:8787/healthz

# 检查前端（在浏览器中打开）
open http://localhost:5173
```

## 生产环境部署

### 1. 服务器准备

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

### 2. 项目部署

```bash
# 克隆项目
git clone <repository-url> /opt/liqpass
cd /opt/liqpass

# 安装依赖
cd us-backend && npm install --production && cd ..
cd jp-verify && npm install --production && cd ..
cd us-frontend && npm install --production && cd ..

# 构建前端
cd us-frontend
npm run build
cd ..
```

### 3. 生产环境配置

**US后端生产配置** (`us-backend/.env.production`):
```bash
NODE_ENV=production
US_PORT=3001
DB_PATH=/opt/liqpass/data/us.sqlite
LOG_PATH=/opt/liqpass/logs/us-backend.log
ALLOW_ORIGIN=https://your-domain.com
PAYOUT_MODE=real  # 生产环境使用真实赔付
PAYOUT_PRIVATE_KEY=your_production_private_key
BASE_RPC_URL=https://mainnet.base.org
CONTRACT_ADDRESS=0x9552b58d323993f84d01e3744f175f47a9462f94
```

**JP验证服务器生产配置** (`jp-verify/.env.production`):
```bash
NODE_ENV=production
JP_PORT=8787
VERIFY_MODE=real
OKX_API_KEY=your_production_okx_key
BINANCE_API_KEY=your_production_binance_key
# ... 其他生产环境配置
```

### 4. 使用PM2进程管理

```bash
# 全局安装PM2
npm install -g pm2

# 创建PM2配置文件 (ecosystem.config.js)
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'liqpass-us-backend',
      script: './us-backend/src/server.js',
      cwd: '/opt/liqpass',
      env: {
        NODE_ENV: 'production',
        NODE_PATH: '/opt/liqpass/us-backend/node_modules'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env_file: '/opt/liqpass/us-backend/.env.production'
    },
    {
      name: 'liqpass-jp-verify',
      script: './jp-verify/src/server.js',
      cwd: '/opt/liqpass',
      env: {
        NODE_ENV: 'production',
        NODE_PATH: '/opt/liqpass/jp-verify/node_modules'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env_file: '/opt/liqpass/jp-verify/.env.production'
    }
  ]
};
EOF

# 启动服务
pm2 start ecosystem.config.js

# 设置开机自启
pm2 startup
pm2 save
```

### 5. Nginx反向代理配置

```nginx
# /etc/nginx/sites-available/liqpass
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /opt/liqpass/us-frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # US后端API代理
    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # JP验证服务器代理（如果需要外部访问）
    location /jp-api/ {
        proxy_pass http://localhost:8787/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 启用站点
sudo ln -s /etc/nginx/sites-available/liqpass /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL证书配置（生产环境必需）

```bash
# 使用Certbot获取免费SSL证书
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# 自动续期设置
sudo crontab -e
# 添加：0 12 * * * /usr/bin/certbot renew --quiet
```

## 端口映射与网络配置

### 默认端口分配

| 服务 | 端口 | 协议 | 访问方式 |
|------|------|------|----------|
| US前端 | 5173 | HTTP | http://localhost:5173 |
| US后端 | 3001 | HTTP | http://localhost:3001 |
| JP验证服务器 | 8787 | HTTP | http://localhost:8787 |

### 防火墙配置

```bash
# Ubuntu/Debian
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --reload
```

## 日志管理

### 日志文件位置

```bash
# US后端日志
/opt/liqpass/logs/us-backend.log

# JP验证服务器日志
/opt/liqpass/logs/jp-verify.log

# PM2日志
pm2 logs liqpass-us-backend
pm2 logs liqpass-jp-verify

# Nginx日志
/var/log/nginx/access.log
/var/log/nginx/error.log
```

### 日志轮转配置

```bash
# 创建日志轮转配置
sudo cat > /etc/logrotate.d/liqpass << 'EOF'
/opt/liqpass/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF
```

## 备份与恢复

### 数据库备份

```bash
# 创建备份脚本
cat > /opt/liqpass/scripts/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/liqpass/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份US数据库
cp /opt/liqpass/data/us.sqlite $BACKUP_DIR/us_db_$DATE.sqlite

# 备份JP数据库
cp /opt/liqpass/jp-verify/data/jp.sqlite $BACKUP_DIR/jp_db_$DATE.sqlite

# 保留最近7天备份
find $BACKUP_DIR -name "*.sqlite" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR"
EOF

chmod +x /opt/liqpass/scripts/backup.sh

# 设置定时备份
crontab -e
# 添加：0 2 * * * /opt/liqpass/scripts/backup.sh
```

### 系统恢复

```bash
# 停止服务
pm2 stop all

# 恢复数据库
cp /opt/liqpass/backups/us_db_20240101_120000.sqlite /opt/liqpass/data/us.sqlite
cp /opt/liqpass/backups/jp_db_20240101_120000.sqlite /opt/liqpass/jp-verify/data/jp.sqlite

# 重启服务
pm2 start all
```

## 健康检查脚本

### 基础健康检查

```bash
cat > /opt/liqpass/scripts/healthcheck.sh << 'EOF'
#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查服务状态函数
check_service() {
    local name=$1
    local url=$2
    
    if curl -s --max-time 10 "$url" > /dev/null; then
        echo -e "${GREEN}✓${NC} $name is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $name is unhealthy"
        return 1
    fi
}

# 检查磁盘空间
check_disk() {
    local usage=$(df /opt/liqpass | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$usage" -lt 80 ]; then
        echo -e "${GREEN}✓${NC} Disk usage: $usage%"
    else
        echo -e "${YELLOW}⚠${NC} Disk usage: $usage% (high)"
    fi
}

# 检查内存使用
check_memory() {
    local usage=$(free | awk 'NR==2 {printf "%.0f", $3/$2 * 100}')
    if [ "$usage" -lt 80 ]; then
        echo -e "${GREEN}✓${NC} Memory usage: $usage%"
    else
        echo -e "${YELLOW}⚠${NC} Memory usage: $usage% (high)"
    fi
}

echo "=== LiqPass Health Check ==="

# 检查服务
check_service "US Backend" "http://localhost:3001/healthz"
check_service "JP Verify" "http://localhost:8787/healthz"

# 检查系统资源
check_disk
check_memory

# 检查PM2进程
if pm2 status | grep -q online; then
    echo -e "${GREEN}✓${NC} PM2 processes are running"
else
    echo -e "${RED}✗${NC} PM2 processes are not running"
fi

echo "=== Health Check Complete ==="
EOF

chmod +x /opt/liqpass/scripts/healthcheck.sh
```

### 自动化监控

```bash
# 创建监控脚本
cat > /opt/liqpass/scripts/monitor.sh << 'EOF'
#!/bin/bash

LOG_FILE="/opt/liqpass/logs/monitor.log"

# 记录时间
echo "[$(date)] Starting health check" >> "$LOG_FILE"

# 运行健康检查
/opt/liqpass/scripts/healthcheck.sh >> "$LOG_FILE" 2>&1

# 检查退出状态
if [ $? -ne 0 ]; then
    # 发送警报（示例：记录到日志）
    echo "[$(date)] ALERT: Health check failed" >> "$LOG_FILE"
    
    # 这里可以添加邮件、Slack等通知机制
    # send_alert "LiqPass health check failed"
fi

echo "[$(date)] Monitoring complete" >> "$LOG_FILE"
EOF

chmod +x /opt/liqpass/scripts/monitor.sh

# 设置定时监控
crontab -e
# 添加：*/5 * * * * /opt/liqpass/scripts/monitor.sh
```

## 故障排查

### 常见问题及解决方案

1. **端口冲突**
   ```bash
   # 检查端口占用
   lsof -i :3001
   lsof -i :8787
   lsof -i :5173
   
   # 杀死占用进程
   kill -9 <PID>
   ```

2. **依赖安装失败**
   ```bash
   # 清理缓存
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **数据库连接问题**
   ```bash
   # 检查数据库文件权限
   ls -la /opt/liqpass/data/
   
   # 修复权限
   chmod 644 /opt/liqpass/data/*.sqlite
   chown www-data:www-data /opt/liqpass/data/
   ```

4. **PM2服务异常**
   ```bash
   # 重启PM2服务
   pm2 restart all
   pm2 reset all
   pm2 logs
   ```

### 调试模式

```bash
# 启用详细日志
export DEBUG=liqpass:*

# 或直接修改环境变量
NODE_ENV=development npm run dev
```

## 更新与维护

### 代码更新流程

```bash
# 拉取最新代码
cd /opt/liqpass
git pull origin main

# 更新依赖
cd us-backend && npm install && cd ..
cd jp-verify && npm install && cd ..
cd us-frontend && npm install && npm run build && cd ..

# 重启服务
pm2 restart all

# 验证更新
/opt/liqpass/scripts/healthcheck.sh
```

### 版本回滚

```bash
# 回滚到指定版本
git checkout <commit-hash>

# 重启服务
pm2 restart all
```

此手册确保LiqPass系统在不同环境中的稳定运行，涵盖了从开发到生产的完整部署流程。