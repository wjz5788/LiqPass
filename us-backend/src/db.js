/**
 * @file db.js
 * @description 数据库连接配置和初始化模块
 * @author LiqPass Team
 * @notice 负责SQLite数据库的连接、配置和迁移管理
 */

import path from 'node:path';        // 路径处理模块
import fs from 'node:fs';           // 文件系统模块
import { fileURLToPath } from 'node:url';  // URL转文件路径
import Database from 'better-sqlite3';     // SQLite数据库驱动

// Resolve paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVICE_ROOT = path.resolve(__dirname, '..');
const WORKSPACE_ROOT = path.resolve(SERVICE_ROOT, '..', '..');

// Database path from environment variables or default
const DB_PATH = path.resolve(SERVICE_ROOT, process.env.DB_PATH ?? './data/us.sqlite');

// Ensure the database directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Initialize the database connection
const db = new Database(DB_PATH);

// Enable WAL (Write-Ahead Logging) mode for better concurrency
db.pragma('journal_mode = WAL');

// Run migrations
const migratePath = path.resolve(WORKSPACE_ROOT, 'scripts', 'migrate.sql');
if (fs.existsSync(migratePath)) {
  const migrationScript = fs.readFileSync(migratePath, 'utf8');
  db.exec(migrationScript);
  console.log('[db] Migrations executed successfully.');
}

console.log(`[db] Connected to SQLite database at ${DB_PATH}`);

export default db;
