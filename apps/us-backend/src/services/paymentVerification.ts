import { ethers } from 'ethers';

/**
 * 链上支付核验（PremiumPaid 事件）。
 *
 * 抽成独立模块的原因：原先创建订单有两条路径 ——
 *   1) POST /orders/:orderId/submit-tx  只比对 tx.to 和 RPC 链 ID
 *   2) POST /orders/minimal-create      完全不校验，无鉴权，金额由客户端申报
 * 两条都无法证明「这笔钱确实是这个人为这个订单付的」。现在统一走这里。
 */

export type PaymentVerifyFailure =
  | 'SERVER_CONFIG_MISSING'
  | 'RPC_CHAIN_MISMATCH'
  | 'TX_NOT_FOUND'
  | 'TX_FAILED'
  | 'TX_PENDING_CONFIRMATIONS'
  | 'TX_TO_MISMATCH'
  | 'PAYMENT_EVENT_MISMATCH';

export interface VerifiedPayment {
  onchainOrderId: string;
  buyer: string;
  amount6d: bigint;
  quoteHash: string;
  txHash: string;
  blockNumber: number;
}

export class PaymentVerifyError extends Error {
  constructor(
    public readonly code: PaymentVerifyFailure,
    message: string,
    public readonly httpStatus: number = 400
  ) {
    super(message);
    this.name = 'PaymentVerifyError';
  }
}

const PREMIUM_PAID_ABI = [
  'event PremiumPaid(bytes32 indexed orderId, address indexed buyer, uint256 amount, bytes32 indexed quoteHash, address token, address treasury, uint256 chainId, uint256 timestamp)'
];

export function checkoutContractAddress(): string {
  return (
    process.env.CHECKOUT_CONTRACT_ADDRESS ||
    process.env.CHECKOUT_ADDR ||
    process.env.POLICY_ADDR ||
    ''
  ).trim().toLowerCase();
}

/**
 * 校验一笔交易确实包含「指定买家支付了指定金额」的 PremiumPaid 事件。
 *
 * @param txHash          待核验的交易哈希
 * @param expectedBuyer   订单归属的钱包地址
 * @param expectedAmount6d 期望金额（micro-USDC）。传 null 表示不校验金额，
 *                        由调用方自行比对（例如需要先按事件金额反查订单）。
 */
export async function verifyPremiumPaid(params: {
  txHash: string;
  expectedBuyer?: string | null;
  expectedAmount6d?: bigint | null;
}): Promise<VerifiedPayment> {
  const { txHash, expectedBuyer = null, expectedAmount6d = null } = params;

  const target = checkoutContractAddress();
  if (!target) {
    throw new PaymentVerifyError('SERVER_CONFIG_MISSING', '未配置 CHECKOUT_CONTRACT_ADDRESS', 500);
  }

  const rpc = (process.env.BASE_RPC || '').trim();
  if (!rpc) {
    throw new PaymentVerifyError('SERVER_CONFIG_MISSING', '未配置 BASE_RPC', 500);
  }
  const expectedChainId = String(process.env.PAYMENT_CHAIN_ID || '').trim();
  if (!expectedChainId) {
    throw new PaymentVerifyError('SERVER_CONFIG_MISSING', '未配置 PAYMENT_CHAIN_ID', 500);
  }

  const provider = new ethers.JsonRpcProvider(rpc);

  const network = await provider.getNetwork();
  if (String(network.chainId) !== expectedChainId) {
    throw new PaymentVerifyError(
      'RPC_CHAIN_MISMATCH',
      'BASE_RPC 指向的链与 PAYMENT_CHAIN_ID 不一致',
      500
    );
  }

  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    throw new PaymentVerifyError('TX_NOT_FOUND', '交易未找到');
  }

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) {
    throw new PaymentVerifyError('TX_FAILED', '交易未上链或执行失败');
  }

  const minConfirmations = Number(process.env.CONFIRMATIONS || 3);
  const confirmations = await receipt.confirmations();
  if (confirmations < minConfirmations) {
    throw new PaymentVerifyError(
      'TX_PENDING_CONFIRMATIONS',
      `确认数不足（${confirmations}/${minConfirmations}），请稍后重试`,
      202
    );
  }

  if ((tx.to || '').toLowerCase() !== target) {
    throw new PaymentVerifyError('TX_TO_MISMATCH', '交易目标地址不是结算合约');
  }

  const iface = new ethers.Interface(PREMIUM_PAID_ABI);
  for (const log of receipt.logs) {
    if ((log.address || '').toLowerCase() !== target) continue;
    let parsed: ethers.LogDescription | null = null;
    try {
      parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
    } catch {
      continue;
    }
    if (!parsed || parsed.name !== 'PremiumPaid') continue;

    const buyer = String(parsed.args.buyer);
    const amount = BigInt(parsed.args.amount);

    if (expectedBuyer && buyer.toLowerCase() !== expectedBuyer.toLowerCase()) continue;
    if (expectedAmount6d !== null && amount !== expectedAmount6d) continue;

    return {
      onchainOrderId: String(parsed.args.orderId).toLowerCase(),
      buyer,
      amount6d: amount,
      quoteHash: String(parsed.args.quoteHash).toLowerCase(),
      txHash,
      blockNumber: receipt.blockNumber
    };
  }

  throw new PaymentVerifyError(
    'PAYMENT_EVENT_MISMATCH',
    '交易中未找到与本订单匹配的 PremiumPaid 事件（付款地址或金额不符）'
  );
}

export default verifyPremiumPaid;
