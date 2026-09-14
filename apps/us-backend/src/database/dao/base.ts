// DAO层基础接口定义
// 修复：运行时注入的是 better-sqlite3 实例（同步 API），
// 原先却按 node-sqlite3 声明类型（`import type { Database } from 'sqlite3'`），
// 导致这些文件被写成了回调风格 —— 回调永远不会被调用。
import type { Database } from 'better-sqlite3';

export interface BaseDAO<T> {
  findById(id: string): T | undefined;
  findAll(limit?: number, offset?: number): T[];
  create(entity: T): T;
  update(id: string, updates: Partial<T>): T | undefined;
  delete(id: string): boolean;
  count(filter?: Record<string, any>): number;
}

export interface PageRequest {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PageResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export abstract class BaseDAOImpl<T extends { id: string }> implements BaseDAO<T> {
  protected db: Database;
  protected tableName: string;

  constructor(db: Database, tableName: string) {
    this.db = db;
    this.tableName = tableName;
  }

  findById(id: string): T | undefined {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`);
    let result: T | undefined;
    stmt.get(id, (err, row) => {
      if (!err) {
        result = row as T;
      }
    });
    return result;
  }

  findAll(limit = 100, offset = 0): T[] {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName} LIMIT ? OFFSET ?`);
    let results: T[] = [];
    stmt.all(limit, offset, (err: any, rows: any) => {
      if (!err) {
        results = rows as T[];
      }
    });
    return results;
  }

  abstract create(entity: T): T;
  abstract update(id: string, updates: Partial<T>): T | undefined;

  delete(id: string): boolean {
    // 修复：db 是 better-sqlite3（同步 API，run 直接返回 { changes }），
    // 原代码按 node-sqlite3 的回调风格写，回调永远不会被调用，
    // 且回调里的 this.changes 在 TS 下是隐式 any（TS2683）。
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`);
    const info = stmt.run(id);
    return info.changes > 0;
  }

  count(filter?: Record<string, any>): number {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const params: any[] = [];

    if (filter && Object.keys(filter).length > 0) {
      const conditions = Object.keys(filter).map(key => {
        params.push(filter[key]);
        return `${key} = ?`;
      }).join(' AND ');
      sql += ` WHERE ${conditions}`;
    }

    const stmt = this.db.prepare(sql);
    let count = 0;
    stmt.get(...params, (err: any, row: any) => {
      if (!err && row) {
        count = (row as { count: number }).count;
      }
    });
    return count;
  }

  protected paginate(pageRequest: PageRequest): { limit: number; offset: number } {
    const limit = Math.min(Math.max(pageRequest.pageSize, 1), 1000);
    const offset = Math.max((pageRequest.page - 1) * limit, 0);
    return { limit, offset };
  }

  protected buildWhereClause(filters: Record<string, any>): { sql: string; params: any[] } {
    const params: any[] = [];
    const conditions: string[] = [];

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          conditions.push(`${key} IN (${value.map(() => '?').join(',')})`);
          params.push(...value);
        } else {
          conditions.push(`${key} = ?`);
          params.push(value);
        }
      }
    });

    return {
      sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params
    };
  }
}