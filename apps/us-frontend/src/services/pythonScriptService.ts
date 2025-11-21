/**
 * Python脚本调用服务
 * 用于在前端直接调用Python脚本进行OKX订单验证
 */

// 验证结果接口定义
export interface ScriptVerifyResult {
  success: boolean;
  data?: {
    proof: string;
    orderEcho?: string;
    orderRaw?: any;
    fills?: any[];
    consistencyCheck?: boolean;
    liquidationStatus?: string;
    verifiedAt?: string;
  };
  error?: string;
  message?: string;
}

// API密钥存储接口
export interface ApiKeys {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  uid?: string;
}

// 验证载荷接口
export interface VerifyPayload {
  userId: string;
  ordId: string;
  instId: string;
  keys?: ApiKeys;
}

// 脚本调用服务类
class PythonScriptService {
  private currentUserId: string | null = null;
  private keysKey(userId: string) { return `okx:keys:${userId}`; }
  private instKey(userId: string) { return `okx:instId:${userId}`; }
  setCurrentUser(userId: string) { this.currentUserId = userId; }
  getCurrentUser(): string { return this.currentUserId || 'default'; }
  saveApiKeys(userId: string, apiKeys: ApiKeys): void {
    localStorage.setItem(this.keysKey(userId), JSON.stringify(apiKeys));
    this.setCurrentUser(userId);
  }
  getApiKeys(userId?: string): ApiKeys | null {
    const uid = userId || this.getCurrentUser();
    const stored = localStorage.getItem(this.keysKey(uid));
    if (!stored) return null;
    try { return JSON.parse(stored) as ApiKeys; } catch { return null; }
  }
  clearApiKeys(userId?: string): void {
    const uid = userId || this.getCurrentUser();
    localStorage.removeItem(this.keysKey(uid));
  }
  hasApiKeys(userId?: string): boolean {
    return this.getApiKeys(userId) !== null;
  }
  saveInstId(userId: string, instId: string): void {
    localStorage.setItem(this.instKey(userId), instId);
  }
  getInstId(userId?: string): string | null {
    const uid = userId || this.getCurrentUser();
    return localStorage.getItem(this.instKey(uid));
  }
  clearInstId(userId?: string): void {
    const uid = userId || this.getCurrentUser();
    localStorage.removeItem(this.instKey(uid));
  }
  async verify(params: VerifyPayload): Promise<ScriptVerifyResult> {
    const uid = params.userId || this.getCurrentUser();
    const instId = params.instId || this.getInstId(uid) || '';
    const keys = params.keys || this.getApiKeys(uid);
    if (!uid || !instId || !keys) {
      return { success: false, error: '缺少凭据或交易对', message: '请先在设置页保存密钥与交易对' };
    }
    const resp = await fetch('/_scripts/okx/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, ordId: params.ordId, instId, keys })
    });
    const json = await resp.json().catch(() => ({ success: false, error: '脚本执行失败' }));
    if (!resp.ok) return { success: false, error: json?.error || '脚本执行失败', message: json?.message || '验证失败' };
    return json as ScriptVerifyResult;
  }
  
  // 辅助函数：格式化订单信息
  private formatOrderEcho(orderData: any): string {
    if (!orderData) return '订单信息不可用';
    return `订单详情: ID=${orderData.orderId || '未知'}, 交易对=${orderData.pair || '未知'}, 方向=${orderData.side || '未知'}, 状态=${orderData.status || '未知'}, 数量=${orderData.executedQty || 0}, 均价=${orderData.avgPrice || 0}`;
  }
  
  // 辅助函数：获取清算状态
  private getLiquidationStatus(liquidationData: any): string {
    if (!liquidationData) return '未知';
    const status = liquidationData.status;
    if (status === 'full') return '已清算';
    if (status === 'partial') return '部分清算';
    if (status === 'none') return '正常';
    return '未知';
  }
  
  // 辅助函数：字符串哈希
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  // 生成Python脚本内容
  private generateScriptContent(): string {
    return '';
  }
  
  // 创建临时脚本文件
  private async createTempScript(content: string): Promise<string> { return ''; }
  
  // 执行Python脚本
  private async executeScript(scriptPath: string): Promise<ScriptVerifyResult> { return { success: false, error: '未实现' }; }
  
  // 清理临时文件
  private async cleanupTempScript(scriptPath: string): Promise<void> {}
  
  // 简化验证方法（用于第二次调用，只需订单号）
  async simpleVerify(ordId: string, userId?: string): Promise<ScriptVerifyResult> {
    const uid = userId || this.getCurrentUser();
    const instId = this.getInstId(uid) || 'BTC-USDT-SWAP';
    return this.verify({ userId: uid, ordId, instId });
  }
}

// 创建服务实例
export const pythonScriptService = new PythonScriptService();

export default pythonScriptService;