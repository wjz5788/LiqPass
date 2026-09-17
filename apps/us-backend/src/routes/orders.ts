import express from 'express';
import { z } from 'zod';
import OrderService, { OrderError } from '../services/orderService.js';
import AuthService from '../services/authService.js';
import { EnhancedAuthMiddleware } from '../middleware/enhancedAuth.js';
import { createApiKeyAuthInstance } from '../middleware/apiKeyAuth.js';
import { appendOrder } from '../database/fileLedger.js';
import dbManager, { db } from '../database/db.js';
import { verifyPremiumPaid, PaymentVerifyError } from '../services/paymentVerification.js';
import { getAuthWallet, assertWalletMatches } from '../middleware/walletOwnership.js';
import type { RequireAuthMiddleware } from '../middleware/authMiddleware.js';
import { v4 as uuid } from 'uuid';
// 注：移除对数据库的幂等性快照依赖，改由服务层与文件账本保证一致性

const previewSchema = z.object({
  skuId: z.string().min(1),
  principal: z.number().positive(),
  leverage: z.number().positive(),
  wallet: z.string().min(1)
});

const createSchema = z.object({
  skuId: z.string().min(1),
  principal: z.coerce.number().positive(),
  leverage: z.coerce.number().positive(),
  wallet: z.string().min(1),
  premiumUSDC6d: z.coerce.number().positive(),
  idempotencyKey: z.string().min(1),
  paymentMethod: z.enum(['permit2', 'approve_transfer']),
  paymentProofId: z.string().min(1).optional(),
  orderRef: z.string().min(1).optional(),
  exchange: z.string().min(1).optional(),
  pair: z.string().min(1).optional()
});

const toFixedString = (value: number, fractionDigits: number) =>
  value.toFixed(fractionDigits);

// 幂等性快照改由 OrderService 内部索引与文件账本保障，路由层不再写入独立快照

export default function ordersRoutes(orderService: OrderService, requireAuth: RequireAuthMiddleware) {
  const router = express.Router();
  const apiKeyAuth = createApiKeyAuthInstance(dbManager);
  const enhancedAuth = new EnhancedAuthMiddleware(new AuthService(), apiKeyAuth);

  // 轻量认证：使用 X-API-Key 校验，仅用于创建/查询订单接口；预览匿名
  const requireApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = (req.headers['x-api-key'] || req.headers['X-API-Key'] || '') as string;
    const admin = (process.env.ADMIN_API_KEY || '').trim();
    if (!admin || !key || key.trim() !== admin) {
      return res.status(401).json({ ok: false, code: 'UNAUTHORIZED', message: 'Missing or invalid API key' });
    }
    next();
  };

  // 订单列表 - 需要认证（API Key）
  router.get('/orders', requireApiKey, async (_req, res) => {
    const orders = await orderService.listOrdersPersisted();
    return res.json({ ok: true, orders });
  });

  // 修复：此前该接口不做任何身份校验，任意填一个钱包地址就能读到对方的全部订单。
  // 现在以登录会话中的钱包为准，忽略客户端传入的 address/wallet 参数。
  router.get('/orders/my', requireAuth, async (req, res) => {
    const address = getAuthWallet(req);
    try {
      if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(401).json({
          ok: false,
          code: 'UNAUTHORIZED',
          message: '当前会话没有绑定钱包地址'
        });
      }
      const all = await orderService.listOrdersPersisted();
      const list = all.filter(o => o.wallet.toLowerCase() === address);
      return res.json({ ok: true, orders: list });
    } catch (error) {
      return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR', message: '查询我的订单失败' });
    }
  });

  router.get('/claims/my', async (req, res) => {
    try {
      const addrRaw = (req.query.address || req.query.wallet || '') as string;
      const address = addrRaw.toString().toLowerCase();
      const baseSql = `
        SELECT
          c.id               AS claimId,
          c.status           AS status,
          c.verify_ref       AS evidenceId,
          c.reviewed_at      AS verifiedAt,
          c.payout_at        AS paidAt,
          c.payout_tx_hash   AS payoutTxHash,
          o.id               AS orderId,
          (
            SELECT substr(external_ref, instr(external_ref, ':') + 1)
            FROM order_references r
            WHERE r.order_id = c.order_id
            ORDER BY r.created_at DESC
            LIMIT 1
          )                  AS orderRef,
          o.premium_usdc     AS premium_usdc_6d,
          o.principal_usdc   AS principal_usdc_6d,
          o.leverage         AS leverage,
          o.payout_usdc      AS payout_usdc_6d,
          o.created_at       AS orderCreatedAt
        FROM claims c
        JOIN orders o ON o.id = c.order_id
      `;
      const list = /^0x[a-fA-F0-9]{40}$/.test(address)
        ? db.all(`${baseSql} WHERE o.wallet_address = ? ORDER BY c.created_at DESC`, address)
        : db.all(`${baseSql} ORDER BY c.created_at DESC`);
      return res.json({ ok: true, claims: list });
    } catch (error) {
      return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR', message: '查询理赔失败' });
    }
  });

  // 产品目录 - 公开访问
  router.get('/catalog/skus', (_req, res) => {
    const skus = orderService.listSkus();
    res.json({
      ok: true,
      skus
    });
  });

  // 订单预览 - 匿名访问
  router.post('/orders/preview', (req, res) => {
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_REQUEST',
        issues: parsed.error.issues
      });
    }

    try {
      const quote = orderService.preview(parsed.data);
      const payment = orderService.getPaymentConfig();

      return res.json({
        ok: true,
        quote: {
          idempotencyKey: quote.idempotencyKey,
          premiumUSDC6d: quote.premiumUSDC6d.toString(),
          feeRatio: toFixedString(quote.feeRatio, 6),
          payoutUSDC6d: quote.payoutUSDC6d.toString(),
          payoutRatio: toFixedString(quote.payoutRatio, 6),
          quoteTtl: Math.max(
            0,
            Math.round(
              (new Date(quote.expiresAt).getTime() - Date.now()) / 1000
            )
          ),
          expiresAt: quote.expiresAt,
          payment
        },
        sku: orderService.getSku(quote.skuId)
      });
    } catch (error) {
      if (error instanceof OrderError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }

      return res.status(500).json({
        ok: false,
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error while generating quote.'
      });
    }
  });

  // 创建订单 - 需要认证（API Key）
  router.post('/orders', requireApiKey, async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: 'INVALID_REQUEST',
        issues: parsed.error.issues
      });
    }

    try {
      const { order, created } = orderService.createOrder(parsed.data);
      const payment = orderService.getPaymentConfig();

      const response = {
        ok: true,
        order: {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
          premiumUSDC6d: order.premiumUSDC6d.toString(),
          feeRatio: toFixedString(order.feeRatio, 6),
          payoutUSDC6d: order.payoutUSDC6d.toString(),
          payoutRatio: toFixedString(order.payoutRatio, 6),
          skuId: order.skuId,
          wallet: order.wallet,
          paymentMethod: order.paymentMethod,
          paymentProofId: order.paymentProofId,
          createdAt: order.createdAt,
          payment
        }
      };

      return res.status(created ? 201 : 200).json(response);
    } catch (error) {
      if (error instanceof OrderError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }

      return res.status(500).json({
        ok: false,
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error while creating order.'
      });
    }
  });

  // 最小创建：用于链上支付前占位，避免 /submit-tx 找不到订单
  router.post('/orders/minimal-create', requireAuth, async (req, res) => {
    try {
      // ── 修复 ────────────────────────────────────────────────────────────
      // 原实现无鉴权、无链上核验，保费由客户端申报，principal/payout 一律写 0：
      // 任何人都能凭空为任意钱包造订单，金额随便填。
      // 现在要求必须带上已确认的链上交易，并由服务端核验
      // PremiumPaid(买家, 金额) 后才落库；保费以链上实际支付金额为准。
      const { orderId, wallet, txHash, principal, leverage } = req.body as any;
      const id = String(orderId || '').trim();
      const w = String(wallet || '').trim().toLowerCase();
      const tx = String(txHash || '').trim();

      if (!/^ord_[a-f0-9\-]{36}$/.test(id) && !/^0x[0-9a-fA-F]{64}$/.test(id) && id.length < 16) {
        return res.status(400).json({ ok: false, code: 'INVALID_ORDER_ID', message: '订单ID无效' });
      }
      if (!/^0x[a-fA-F0-9]{40}$/.test(w)) {
        return res.status(400).json({ ok: false, code: 'INVALID_WALLET', message: '钱包地址无效' });
      }
      // 只能为自己的钱包建单
      if (!assertWalletMatches(req, res, w)) return;
      if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) {
        return res.status(400).json({ ok: false, code: 'INVALID_TX_HASH', message: '缺少或非法的支付交易哈希' });
      }

      const exists = db.get(`SELECT id FROM orders WHERE id = ? LIMIT 1`, id) as any;
      if (exists) {
        return res.json({ ok: true, created: false });
      }

      // 同一笔交易不可用于多个订单
      const txUsed = db.get(`SELECT id FROM orders WHERE payment_tx_hash = ? LIMIT 1`, tx) as any;
      if (txUsed) {
        return res.status(409).json({ ok: false, code: 'TX_ALREADY_USED', message: '该交易已用于其它订单' });
      }

      let verified;
      try {
        verified = await verifyPremiumPaid({ txHash: tx, expectedBuyer: w });
      } catch (err: any) {
        if (err instanceof PaymentVerifyError) {
          return res.status(err.httpStatus).json({ ok: false, code: err.code, message: err.message });
        }
        throw err;
      }

      const nowIso = new Date().toISOString();
      // 以链上实际支付金额为准，不接受客户端申报
      const premium6d = Number(verified.amount6d);
      const principalNum = Math.max(0, Math.round(Number(principal) || 0));
      const leverageNum = Math.max(0, Math.round(Number(leverage) || 0));
      db.run(
        `INSERT INTO orders (
          id, user_id, wallet_address, product_id, principal_usdc, leverage,
          premium_usdc, payout_usdc, duration_hours, status, payment_proof_id,
          created_at, updated_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        'user-id-placeholder',
        w,
        'sku_24h_liq',
        principalNum,
        leverageNum,
        premium6d,
        0, // payout_usdc：本最小化路径不承诺赔付额，理赔时按产品规则另行计算
        24,
        'paid',
        null,
        nowIso,
        nowIso,
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      );
      try {
        const existingClaim = db.get(`SELECT id FROM claims WHERE order_id = ? LIMIT 1`, id) as any;
        if (!existingClaim) {
          const claimId = `clm_${uuid()}`;
          db.run(
            `INSERT INTO claims (id, order_id, user_id, user_wallet, status, currency, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'pending', 'USDC', datetime('now'), datetime('now'))`,
            claimId,
            id,
            'user-id-placeholder',
            w
          );
        }
      } catch {}
      return res.status(201).json({ ok: true, created: true });
    } catch (error) {
      return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR', message: '最小化创建订单失败' });
    }
  });

  // 获取订单详情 - 允许 JWT（钱包会话）或 API Key 认证
  router.get('/orders/:orderId', enhancedAuth.middleware({ requireAuth: true, allowedMethods: ['jwt', 'apiKey'] }), (req, res) => {
    const { orderId } = req.params;

    try {
      const order = orderService.getOrder(orderId);
      if (!order) {
        return res.status(404).json({
          ok: false,
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found.'
        });
      }

      const payment = orderService.getPaymentConfig();
      const sku = orderService.getSku(order.skuId);

      return res.json({
        ok: true,
        order: {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
          premiumUSDC6d: order.premiumUSDC6d.toString(),
          feeRatio: toFixedString(order.feeRatio, 6),
          payoutUSDC6d: order.payoutUSDC6d.toString(),
          payoutRatio: toFixedString(order.payoutRatio, 6),
          skuId: order.skuId,
          sku: sku ? {
            id: sku.id,
            code: sku.code,
            title: sku.title,
            description: sku.description,
            windowHours: sku.windowHours
          } : undefined,
          wallet: order.wallet,
          paymentMethod: order.paymentMethod,
          paymentProofId: order.paymentProofId,
          exchange: order.exchange,
          pair: order.pair,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          payment
        }
      });
    } catch (error) {
      if (error instanceof OrderError) {
        return res.status(error.httpStatus).json({
          ok: false,
          code: error.code,
          message: error.message
        });
      }

      return res.status(500).json({
        ok: false,
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error while retrieving order.'
      });
    }
  });

  const submitSchema = z.object({
    txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  });

  router.post('/orders/:orderId/submit-tx', requireAuth, async (req, res) => {
    const { orderId } = req.params;
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, code: 'INVALID_REQUEST', issues: parsed.error.issues });
    }

    const order = orderService.getOrder(orderId);
    if (!order) {
      return res.status(404).json({ ok: false, code: 'ORDER_NOT_FOUND', message: '订单不存在' });
    }
    // 只有订单归属的钱包本人可以提交支付凭证
    if (!assertWalletMatches(req, res, order.wallet)) return;

    if (order.status === 'paid') {
      return res.json({ ok: true, alreadyPaid: true, order });
    }

    try {
      const txHash = parsed.data.txHash;

      // 同一笔 txHash 不可用于多个订单
      const allOrders = await orderService.listOrdersPersisted();
      const reused = allOrders.find(
        (o: any) => o.id !== order.id && String(o.paymentTx || '').toLowerCase() === txHash.toLowerCase()
      );
      if (reused) {
        return res.status(409).json({ ok: false, code: 'TX_ALREADY_USED', message: '该交易已用于其它订单' });
      }

      const expectedAmount = BigInt(Math.round(Number((order as any).premiumUSDC6d ?? 0)));
      if (expectedAmount <= 0n) {
        return res.status(500).json({ ok: false, code: 'ORDER_AMOUNT_MISSING', message: '订单保费金额缺失，无法核验' });
      }

      // 链上核验：PremiumPaid 事件的付款人与金额必须与订单一致
      // （原实现只比对 tx.to 和 RPC 链 ID，任何人拿任意一笔打到合约的交易哈希
      //   就能把任意订单标记为已支付）
      let verified;
      try {
        verified = await verifyPremiumPaid({
          txHash,
          expectedBuyer: String(order.wallet || ''),
          expectedAmount6d: expectedAmount
        });
      } catch (err: any) {
        if (err instanceof PaymentVerifyError) {
          return res.status(err.httpStatus).json({ ok: false, code: err.code, message: err.message });
        }
        throw err;
      }

      // 链上 orderId 同样不可被两个订单复用
      const dupOnchain = allOrders.find(
        (o: any) => o.id !== order.id &&
          String(o.onchainOrderId || '').toLowerCase() === verified.onchainOrderId
      );
      if (dupOnchain) {
        return res.status(409).json({ ok: false, code: 'ONCHAIN_ORDER_ID_REUSED', message: '链上订单号已被占用' });
      }
      (order as any).onchainOrderId = verified.onchainOrderId;

      order.status = 'paid';
      order.paymentStatus = 'paid';
      order.paymentTx = txHash;
      order.updatedAt = new Date().toISOString();
      await appendOrder(order);
      // 修复：支付状态原先只写进文件账本，SQL 里的 orders 行永远停留在 pending，
      // 导致任何基于 SQL 的查询和对账都看不到已支付订单。
      try {
        db.run(
          `UPDATE orders
             SET status = 'paid', payment_tx_hash = ?, payment_block_number = ?,
                 paid_at = ?, updated_at = ?
           WHERE id = ?`,
          txHash,
          verified.blockNumber,
          order.updatedAt,
          order.updatedAt,
          order.id
        );
      } catch (e) {
        console.warn('更新订单支付状态到 SQL 失败（文件账本已记录）:', e);
      }
      try {
        const existing = db.get(`SELECT id FROM claims WHERE order_id = ? LIMIT 1`, order.id);
        if (!existing) {
          const refRow = db.get(`SELECT external_ref FROM order_references WHERE order_id = ? ORDER BY created_at DESC LIMIT 1`, order.id) as any;
          const orderRef = refRow?.external_ref ? String(refRow.external_ref).split(':').slice(1).join(':') : null;
          const claimId = `clm_${uuid()}`;
          db.run(
            `INSERT INTO claims (id, order_id, user_id, user_wallet, status, currency, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'pending', 'USDC', datetime('now'), datetime('now'))`,
            claimId,
            order.id,
            'user-id-placeholder',
            order.wallet
          );
          if (orderRef) {
            // 可选：写入审核事件或索引，当前仅保留order_references表中的外部引用
          }
        }
      } catch {}
      return res.json({ ok: true, order });
    } catch (error: any) {
      return res.status(500).json({ ok: false, code: 'INTERNAL_ERROR', message: error?.message || '提交交易处理失败' });
    }
  });

  return router;
}
