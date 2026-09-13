import { randomUUID } from 'crypto';
import { DatabaseManager } from '../database/db.js';
import { VerificationResult, VerificationStatus } from '../types/index.js';

/**
 * 修复：原代码把验证记录写在 `dbManager.verifications` 上，而 DatabaseManager
 * 根本没有这个属性 —— 之所以没报错，是因为构造函数写成
 * `constructor(dbManager: typeof dbManager)`，参数在自己的类型标注里自引用
 * （TS2502），整个类型退化成 any，把后面所有错误一起吞掉了。
 *
 * 这里把类型修正为 DatabaseManager，并把这份内存态明确放到模块级 Map。
 * 注意：进程重启即丢失，仅适用于当前的演示用途；要持久化需落到 SQLite 表。
 */
const verifications = new Map<string, VerificationResult>();

export class VerificationService {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /**
   * 处理验证请求
   * @param request 验证请求数据
   * @returns 验证结果
   */
  async processVerification(request: any): Promise<{ id: string; status: VerificationStatus }> {
    // 生成唯一的验证ID
    const verificationId = randomUUID();
    
    // 创建初始验证记录
    const verificationRecord = {
      id: verificationId,
      walletAddress: request.walletAddress,
      chainId: request.chainId,
      signature: request.signature,
      message: request.message,
      status: 'verifying' as VerificationStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // 存储到数据库
    verifications.set(verificationId, verificationRecord);
    
    // 模拟异步验证过程
    setTimeout(() => {
      this.completeVerification(verificationId);
    }, 5000);
    
    return {
      id: verificationId,
      status: 'verifying'
    };
  }

  /**
   * 完成验证过程
   * @param verificationId 验证ID
   */
  private async completeVerification(verificationId: string): Promise<void> {
    const verification = verifications.get(verificationId);
    
    if (!verification) {
      return;
    }
    
    // 模拟验证逻辑 - 这里应该集成实际的验证逻辑
    const isValid = Math.random() > 0.3; // 70% 的概率验证通过
    
    // 更新验证记录
    // 修复：'approved' / 'rejected' 不是 VerificationStatus 的成员，
    // 合法值见 types/index.ts（verified / failed）
    const updatedVerification: VerificationResult = {
      ...verification,
      status: isValid ? 'verified' : 'failed',
      result: isValid,
      reason: isValid ? 'Verification successful' : 'Insufficient trading volume',
      updatedAt: new Date().toISOString()
    };
    
    // 存储更新后的记录
    verifications.set(verificationId, updatedVerification);
  }

  /**
   * 获取验证结果
   * @param verificationId 验证ID
   * @returns 验证结果
   */
  async getVerificationResult(verificationId: string): Promise<VerificationResult | null> {
    const verification = verifications.get(verificationId);
    
    if (!verification) {
      return null;
    }
    
    return {
      id: verification.id,
      walletAddress: verification.walletAddress,
      status: verification.status,
      result: verification.result,
      reason: verification.reason,
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt
    };
  }

  /**
   * 获取验证历史记录
   * @param walletAddress 钱包地址
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns 验证历史记录数组
   */
  async getVerificationHistory(walletAddress: string, limit: number = 10, offset: number = 0): Promise<any[]> {
    // 获取所有验证记录
    const allVerifications = Array.from(verifications.values());
    
    // 过滤指定钱包地址的记录
    const filteredVerifications = allVerifications.filter(v => v.walletAddress === walletAddress);
    
    // 排序并分页
    const sortedVerifications = filteredVerifications
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(offset, offset + limit);
    
    // 映射到结果格式
    return sortedVerifications.map(v => ({
      id: v.id,
      walletAddress: v.walletAddress,
      status: v.status,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt
    }));
  }
}

export default VerificationService;
