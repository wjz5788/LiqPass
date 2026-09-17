#!/usr/bin/env node
/**
 * 生成本地开发用的 .env.local。
 *
 * 每次生成的密钥都是随机的，只存在于你本机、且已被 .gitignore 排除。
 * 这里刻意不内置任何固定私钥 —— 仓库里原先硬编码的
 * 0xac0974be…（Hardhat 0 号账户）是全网公开的，用它签名等于没签。
 *
 * 用法: node scripts/setup-dev-env.mjs [--force]
 */
import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 以脚本自身位置为准，这样从仓库根目录用 pnpm setup:env 调用也能写对地方
const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(pkgRoot, '.env.local');
const force = process.argv.includes('--force');

if (existsSync(target) && !force) {
  console.error(`✋ ${target} 已存在。要重新生成请加 --force（会覆盖现有密钥）。`);
  process.exit(1);
}

const hex32 = () => '0x' + randomBytes(32).toString('hex');
const addr = () => '0x' + randomBytes(20).toString('hex');
const secret = (n = 48) => randomBytes(n).toString('base64url');

const body = `# 本地开发环境变量 —— 由 scripts/setup-dev-env.mjs 生成
# 生成时间: ${new Date().toISOString()}
#
# ⚠️ 本文件已被 .gitignore 排除，请勿提交、勿复制到生产环境。
# ⚠️ 下面的私钥是随机生成的本地测试用密钥，不要往对应地址转入任何资产。

NODE_ENV=development
API_PORT=3002
HOST=127.0.0.1
LOG_LEVEL=debug

# ── 密钥 ────────────────────────────────────────────────────────────
JWT_SECRET=${secret()}
ADMIN_API_KEY=${randomBytes(32).toString('hex')}
PRICER_PRIVATE_KEY=${hex32()}
ISSUER_PRIVATE_KEY=${hex32()}

# ── 链上配置 ────────────────────────────────────────────────────────
# 默认指向本地 anvil/hardhat 节点。要连 Base 主网请自行改为
# PAYMENT_CHAIN_ID=8453 且 BASE_RPC=https://mainnet.base.org
PAYMENT_CHAIN_ID=31337
BASE_RPC=http://127.0.0.1:8545
CONFIRMATIONS=1

# 下面三个地址是随机占位值，只为让 EnvValidator 通过、服务能起来。
# 在本地链上部署完 CheckoutUSDC 和 MockUSDC 之后，务必替换成真实地址。
CHECKOUT_CONTRACT_ADDRESS=${addr()}
PAYMENT_VAULT_ADDRESS=${addr()}
USDC_ADDRESS=${addr()}

# ── 数据库 ──────────────────────────────────────────────────────────
DB_ADAPTER=sqlite
DB_FILE=./data/dev-us-backend.db

# ── CORS ───────────────────────────────────────────────────────────
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# ── 依赖服务 ────────────────────────────────────────────────────────
JP_VERIFY_BASE_URL=http://127.0.0.1:8082
`;

writeFileSync(target, body, { mode: 0o600 });
console.log(`✅ 已生成 ${target}（权限 600）`);
console.log('   密钥均为随机值，仅供本地开发。');
console.log('   合约地址留空，部署后请补上 CHECKOUT_CONTRACT_ADDRESS / PAYMENT_VAULT_ADDRESS / USDC_ADDRESS。');
