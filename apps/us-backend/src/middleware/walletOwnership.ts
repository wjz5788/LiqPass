import type express from 'express';
import type { AuthenticatedRequest } from './authMiddleware.js';

/**
 * 从已认证会话中取出钱包地址。
 *
 * 本项目只允许钱包登录（authService.validateSession 会强制 loginType === 'wallet'），
 * 所以 req.auth.profile.walletAddress 就是调用者的身份。
 */
export function getAuthWallet(req: express.Request): string | null {
  const auth = (req as AuthenticatedRequest).auth as any;
  const wallet = auth?.profile?.walletAddress ?? auth?.walletAddress ?? null;
  return wallet ? String(wallet).toLowerCase() : null;
}

/**
 * 校验「调用者的钱包」与「资源归属的钱包」一致。
 *
 * 修复：orders 相关接口此前完全不做归属校验 ——
 *   - GET  /orders/my            填别人的地址就能看别人的订单
 *   - POST /orders/:id/submit-tx 任何人都能对任意订单提交交易哈希
 *   - POST /orders/minimal-create 任何人都能替任意钱包建单
 */
export function assertWalletMatches(
  req: express.Request,
  res: express.Response,
  ownerWallet: string | null | undefined
): boolean {
  const caller = getAuthWallet(req);
  if (!caller) {
    res.status(401).json({ ok: false, code: 'UNAUTHORIZED', message: '需要钱包登录' });
    return false;
  }
  const owner = String(ownerWallet || '').toLowerCase();
  if (!owner || owner !== caller) {
    // 不透露该订单是否存在
    res.status(403).json({ ok: false, code: 'FORBIDDEN', message: '无权操作该订单' });
    return false;
  }
  return true;
}

export default assertWalletMatches;
