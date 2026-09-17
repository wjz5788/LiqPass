-- 创建合约事件表
CREATE TABLE IF NOT EXISTS contract_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tx_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL,
    order_id TEXT NOT NULL,
    buyer_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    quote_hash TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    event_timestamp INTEGER NOT NULL,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending',
    error_message TEXT,
    
    -- 唯一约束，确保幂等性
    UNIQUE(tx_hash, log_index)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_contract_events_tx_hash ON contract_events(tx_hash);
CREATE INDEX IF NOT EXISTS idx_contract_events_order_id ON contract_events(order_id);
CREATE INDEX IF NOT EXISTS idx_contract_events_buyer_address ON contract_events(buyer_address);
CREATE INDEX IF NOT EXISTS idx_contract_events_block_number ON contract_events(block_number);
CREATE INDEX IF NOT EXISTS idx_contract_events_status ON contract_events(status);

-- 【重命名说明】本表原名 orders。
-- 它属于链上事件监听子系统（id 自增、order_id 为链上订单号、buyer_address/amount），
-- 与应用层的订单表（010_persist_memory_tables.sql 里 id 为 TEXT 主键、
-- 含 wallet_address / premium_usdc 等列）是两回事。
-- 由于本文件在 migrationManager 的执行顺序中排在最前，它抢先建出了名为 orders 的表，
-- 后面 002 和 010 里的 CREATE TABLE IF NOT EXISTS orders 全部静默跳过，
-- 导致 orderServiceDb / orderDAO / minimal-create 对 orders 的每一次读写
-- 都会因为「no such column」而失败。改名以消除冲突。
CREATE TABLE IF NOT EXISTS contract_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT UNIQUE NOT NULL,
    buyer_address TEXT NOT NULL,
    amount TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_tx_hash TEXT,
    payment_block_number INTEGER,
    payment_log_index INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建订单索引
CREATE INDEX IF NOT EXISTS idx_contract_orders_order_id ON contract_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_contract_orders_buyer ON contract_orders(buyer_address);
CREATE INDEX IF NOT EXISTS idx_contract_orders_status ON contract_orders(status);