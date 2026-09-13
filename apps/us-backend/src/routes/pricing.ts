import express from 'express';
import { ethers } from 'ethers';
import { z } from 'zod';
import { lazyEnv } from '../utils/requireEnv.js';
import requireAdminApiKey from '../middleware/requireAdminApiKey.js';

const router = express.Router();

// 签名私钥：必须来自环境变量，缺失即报错（原先硬编码的是公开的 Hardhat 测试私钥）
const getPricerPrivateKey = lazyEnv('PRICER_PRIVATE_KEY');

// 合约地址与链 ID：必须来自环境变量，避免测试网 / 主网串签
const getPolicyAddr = lazyEnv('CHECKOUT_CONTRACT_ADDRESS', 'CHECKOUT_ADDR', 'POLICY_ADDR');
const getChainId = () => Number(lazyEnv('PAYMENT_CHAIN_ID')());

/**
 * POST /api/v1/pricing/quote
 * 定价报价接口 - 返回EIP-712签名报价
 */
const quoteSchema = z.object({
  principal: z.number().positive(),
  leverage: z.number().positive(),
  durationHours: z.number().int().positive().optional(),
  skuId: z.number().int().positive().optional(),
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
});

router.post('/quote', async (req, res) => {
  try {
    const parsed = quoteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'INVALID_REQUEST', issues: parsed.error.issues });
    }
    const { principal, leverage, durationHours, skuId, wallet } = parsed.data;

    // 计算保费（简化版，实际应该根据产品逻辑计算）
    const baseFee = Math.min(0.15, 0.05 + (leverage - 20) * 0.001 + (principal / 500) * 0.02);
    const feeRatio = Math.min(0.15, baseFee);
    const price = Math.round(principal * feeRatio * 1_000_000); // 转换为6位小数
    
    const maxPayout = Math.round(principal * Math.min(0.5, Math.max(0.1, 0.25 + (leverage - 50) * 0.005 - (principal / 500) * 0.1)) * 1_000_000);

    // 生成唯一ID
    const quoteId = ethers.hexlify(ethers.randomBytes(32));
    const POLICY_ADDR = getPolicyAddr();
    const CHAIN_ID = getChainId();
    const inputHash = ethers.keccak256(ethers.toUtf8Bytes(`${wallet}-${principal}-${leverage}-${Date.now()}`));
    
    // 设置过期时间（5分钟）
    const deadline = Math.floor(Date.now() / 1000) + 300;
    
    // 构建报价数据
    const quote = {
      wallet: wallet.toLowerCase(),
      inputHash,
      price: price.toString(),
      maxPayout: maxPayout.toString(),
      durationHours: durationHours || 24,
      quoteId,
      deadline: deadline.toString(),
      chainId: String(CHAIN_ID),
      contractAddr: POLICY_ADDR,
      skuId: skuId || 101
    };

    // EIP-712域数据
    const domain = {
      name: 'LiqPass',
      version: '1',
      chainId: CHAIN_ID,
      verifyingContract: POLICY_ADDR
    };

    // 报价类型定义
    const types = {
      Quote: [
        { name: 'wallet', type: 'address' },
        { name: 'inputHash', type: 'bytes32' },
        { name: 'price', type: 'uint96' },
        { name: 'maxPayout', type: 'uint96' },
        { name: 'durationHours', type: 'uint32' },
        { name: 'quoteId', type: 'bytes32' },
        { name: 'deadline', type: 'uint256' },
        { name: 'chainId', type: 'uint256' },
        { name: 'contractAddr', type: 'address' }
      ]
    };

    // 创建签名者
    const signer = new ethers.Wallet(getPricerPrivateKey());
    
    // 生成EIP-712签名
    const quoteSig = await signer.signTypedData(domain, types, quote);

    // 生成幂等键
    const idempotencyKey = ethers.hexlify(ethers.randomBytes(16));

    // 与前端约定：直接返回顶层 quote/quoteSig，便于消费
    res.json({ success: true, idempotencyKey, quote, quoteSig });

  } catch (error: any) {
    console.error('定价报价失败:', error);
    res.status(500).json({ ok: false, error: error.message || '定价报价失败' });
  }
});

export default router;
/**
 * 追加：临时quoteHash注册接口
 * 用于在支付前由合约owner注册一个短期有效的quoteHash，满足合约校验
 */
const quoteHashSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  // 必填：报价必须绑定到具体订单与金额，否则等于签一张空白支票
  orderId: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  amountUSDC: z.string().regex(/^\d+(\.\d+)?$/),
  ttlSec: z.number().int().positive().max(3600).optional()
});

// 该接口会用服务端 owner 私钥发起链上交易（消耗 gas），必须鉴权，
// 否则任何人都能循环调用耗空 owner 钱包。
router.post('/quote-hash', requireAdminApiKey, async (req, res) => {
  try {
    const parsed = quoteHashSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'INVALID_REQUEST', issues: parsed.error.issues });
    }
    const { wallet, orderId, amountUSDC, ttlSec } = parsed.data;

    const rpc = process.env.BASE_RPC;
    const ownerPk = process.env.CHECKOUT_OWNER_PRIVATE_KEY || process.env.ISSUER_PRIVATE_KEY;
    const checkoutAddr = (process.env.CHECKOUT_CONTRACT_ADDRESS || process.env.CHECKOUT_ADDR || process.env.POLICY_ADDR || '').trim();
    if (!checkoutAddr) {
      return res.status(500).json({ ok: false, error: 'SERVER_CONFIG_MISSING', hint: '需要配置 CHECKOUT_CONTRACT_ADDRESS' });
    }

    if (!rpc || !ownerPk) {
      return res.status(500).json({ ok: false, error: 'SERVER_CONFIG_MISSING', hint: '需要配置 BASE_RPC 与 ISSUER_PRIVATE_KEY' });
    }

    const provider = new ethers.JsonRpcProvider(rpc);
    const signer = new ethers.Wallet(ownerPk, provider);

    const checkoutAbi = [
      'function quoteCommitment(address buyer,bytes32 orderId,uint256 amount) pure returns (bytes32)',
      'function registerQuoteHash(bytes32 quoteHash,uint256 expiryTime) external',
      'function isValidQuoteHash(bytes32 quoteHash) view returns (bool)'
    ];
    const checkout = new ethers.Contract(checkoutAddr, checkoutAbi, signer);

    const nowSec = Math.floor(Date.now() / 1000);
    const expiry = nowSec + (ttlSec ?? 600);

    // 修复：原实现用随机 salt 生成一个与订单、买家、金额都无关的裸哈希。
    // 合约只校验「是否注册过且未过期」，任何人都能从公开事件里抄走它，
    // 换成自己的 orderId、改成任意金额去支付。现在改为链上同款承诺哈希。
    const amount = ethers.parseUnits(amountUSDC, 6);
    const quoteHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'bytes32', 'uint256'],
        [ethers.getAddress(wallet), orderId, amount]
      )
    );

    const tx = await checkout.registerQuoteHash(quoteHash, expiry);
    const receipt = await tx.wait();

    const valid = await checkout.isValidQuoteHash(quoteHash);
    if (!valid) {
      return res.status(500).json({ ok: false, error: 'REGISTER_FAILED' });
    }

    return res.json({ ok: true, data: { quoteHash, expiry, txHash: receipt?.hash ?? tx.hash } });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || 'quote-hash 注册失败' });
  }
});
