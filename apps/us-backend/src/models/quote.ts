import { db } from '../database/db.js';

export interface Quote {
  id: string;
  user_id: string;
  product_id: string;
  principal: number;
  leverage: number;
  premium: number;
  payout: number;
  params_json: string;
  expires_at: string;
  created_at: string;
}

export interface CreateQuoteData {
  user_id: string;
  product_id: string;
  principal: number;
  leverage: number;
  premium: number;
  payout: number;
  params: any;
  expires_at: Date;
}

export class QuoteModel {
  static async create(data: CreateQuoteData): Promise<Quote> {
    const id = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 修复：db 是 better-sqlite3（同步 API），原先整个文件按 node-sqlite3
    // 回调风格编写，回调永远不会被调用 —— 这些 Promise 一个都不会 resolve。
    db.run(
      `INSERT INTO quotes (
        id, user_id, product_id, principal, leverage,
        premium, payout, params_json, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      data.user_id,
      data.product_id,
      data.principal,
      data.leverage,
      data.premium,
      data.payout,
      JSON.stringify(data.params),
      data.expires_at.toISOString(),
      new Date().toISOString()
    );
    return db.get('SELECT * FROM quotes WHERE id = ?', id) as Quote;
  }

  static async findById(id: string): Promise<Quote | null> {
    return (db.get('SELECT * FROM quotes WHERE id = ?', id) as Quote) || null;
  }

  static async findByUserId(userId: string): Promise<Quote[]> {
    return db.all('SELECT * FROM quotes WHERE user_id = ? ORDER BY created_at DESC', userId) as Quote[];
  }

  static async findValidById(id: string): Promise<Quote | null> {
    return (db.get(
      'SELECT * FROM quotes WHERE id = ? AND expires_at > ?',
      id,
      new Date().toISOString()
    ) as Quote) || null;
  }

  static async cleanupExpiredQuotes(): Promise<number> {
    // 修复：db 来自 better-sqlite3（同步 API），原代码按 node-sqlite3 的
    // 回调风格调用，回调永远不会执行，Promise 永远 pending。
    const info = db.run('DELETE FROM quotes WHERE expires_at <= ?', new Date().toISOString());
    return info.changes;
  }

  static async getQuoteStats(productId: string): Promise<{
    total_quotes: number;
    total_principal: number;
    total_premium: number;
    avg_leverage: number;
  }> {
    const row = db.get(
      `SELECT
        COUNT(*) as total_quotes,
        SUM(principal) as total_principal,
        SUM(premium) as total_premium,
        AVG(leverage) as avg_leverage
      FROM quotes
      WHERE product_id = ? AND expires_at > ?`,
      productId,
      new Date().toISOString()
    ) as any;
    return {
      total_quotes: row?.total_quotes || 0,
      total_principal: row?.total_principal || 0,
      total_premium: row?.total_premium || 0,
      avg_leverage: row?.avg_leverage || 0
    };
  }
}

export default QuoteModel;