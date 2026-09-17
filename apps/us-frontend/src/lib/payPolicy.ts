import { ethers } from 'ethers';
import api from '../services/api';
import {
  BASE_USDC_ADDRESS,
  CHECKOUT_CONTRACT_ADDRESS,
  BASE_MAINNET
} from '../constants';
const STATIC_QUOTE_HASH = import.meta.env.VITE_CHECKOUT_QUOTE_HASH;

const BASE_CHAIN_ID_DEC = BigInt(parseInt(BASE_MAINNET.chainId, 16));
const BASE_CHAIN_ID_HEX = BASE_MAINNET.chainId;
const USDC_DECIMALS = 6;

const ERC20_ABI = [
  'function approve(address spender,uint256 amount) external returns (bool)',
  'function allowance(address owner,address spender) view returns (uint256)'
];

const CHECKOUT_ABI = [
  'function buyPolicy(bytes32 orderId,uint256 amount,bytes32 quoteHash) external'
];


export async function connectAndEnsureBase() {
  const eth = (window as any)?.ethereum;
  if (!eth) throw new Error('未检测到钱包，请安装 MetaMask');
  await eth.request({ method: 'eth_requestAccounts' });
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID_HEX }] });
  } catch (error: any) {
    if (error?.code === 4902) {
      await eth.request({ method: 'wallet_addEthereumChain', params: [BASE_MAINNET] });
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BASE_CHAIN_ID_HEX }] });
    } else {
      throw error;
    }
  }
  const provider = new ethers.BrowserProvider(eth);
  const { chainId } = await provider.getNetwork();
  if (chainId !== BASE_CHAIN_ID_DEC) throw new Error('请先切换到 Base 主网');
  const signer = await provider.getSigner();
  const address = await signer.getAddress();
  return { provider, signer, address };
}

export async function payPolicy(amountUSDC: string) {
  if (!CHECKOUT_CONTRACT_ADDRESS) {
    throw new Error('缺少 CHECKOUT_CONTRACT_ADDRESS 配置');
  }

  const { signer, address } = await connectAndEnsureBase();
  const amount = ethers.parseUnits(amountUSDC, USDC_DECIMALS);

  if (amount <= 0n) {
    throw new Error('请输入有效的 USDC 金额');
  }

  const orderId = ethers.id(`${address}:${Date.now()}:${Math.random()}`);

  // 修复：原实现在后端 /quote-hash 调用失败时，会**本地伪造**一个随机 quoteHash。
  // 该哈希从未在合约里注册过，buyPolicy 必定 revert（"invalid or expired quote hash"），
  // 用户却先付掉了一笔 approve 的 gas，且拿不到任何有效报错。
  // 报价必须来自后端，拿不到就明确失败。
  let quoteHash: string;
  if (typeof STATIC_QUOTE_HASH === 'string' && /^0x[a-fA-F0-9]{64}$/.test(STATIC_QUOTE_HASH)) {
    quoteHash = STATIC_QUOTE_HASH;
  } else {
    const quoteResp = await api.post<{ ok: boolean; data?: { quoteHash: string } }>(
      '/api/v1/pricing/quote-hash',
      { wallet: address, orderId, amountUSDC },
      { requireAuth: true }
    );
    const got = (quoteResp as any)?.data?.quoteHash;
    if (!got || !/^0x[a-fA-F0-9]{64}$/.test(got)) {
      throw new Error('未能从服务端获取有效报价（quoteHash），请稍后重试');
    }
    quoteHash = got;
  }
  const usdc = new ethers.Contract(BASE_USDC_ADDRESS, ERC20_ABI, signer);
  const allowance: bigint = await usdc.allowance(address, CHECKOUT_CONTRACT_ADDRESS);

  if (allowance < amount) {
    const approveTx = await usdc.approve(CHECKOUT_CONTRACT_ADDRESS, amount);
    await approveTx.wait();
  }

  const checkout = new ethers.Contract(CHECKOUT_CONTRACT_ADDRESS, CHECKOUT_ABI, signer);
  const buyTx = await checkout.buyPolicy(orderId, amount, quoteHash);
  const receipt = await buyTx.wait();

  return { orderId, txHash: receipt?.hash ?? buyTx.hash };
}

export async function payAndSubmit(
  amountUSDC: string,
  meta?: { principal?: number; leverage?: number }
) {
  const { orderId, txHash } = await payPolicy(amountUSDC);
  try {
    const { address } = await connectAndEnsureBase();
    // 后端现在要求：① 钱包登录态（只能为自己建单）②带上 txHash 并由服务端
    // 核验链上 PremiumPaid 事件，保费以链上实际金额为准。
    // 原先用裸 fetch 不带任何凭证，改走 api 客户端以附上 Authorization。
    await api.post('/api/v1/orders/minimal-create', {
      orderId,
      wallet: address,
      txHash,
      principal: meta?.principal,
      leverage: meta?.leverage
    }, { requireAuth: true });
  } catch {}
  try {
    await fetch(`/api/v1/orders/${orderId}/submit-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txHash })
    });
  } catch {}
  return { orderId, txHash };
}

export async function payPolicyWithWallet(
  params: { amountUsdc: number },
  wallet: { address: string; ethereum: any }
) {
  if (!CHECKOUT_CONTRACT_ADDRESS) throw new Error('缺少 CHECKOUT_CONTRACT_ADDRESS 配置');
  const provider = new ethers.BrowserProvider(wallet.ethereum);
  const signer = await provider.getSigner();
  const amount = ethers.parseUnits(String(params.amountUsdc), USDC_DECIMALS);
  if (amount <= 0n) throw new Error('请输入有效的 USDC 金额');
  const orderId = ethers.id(`${wallet.address}:${Date.now()}:${Math.random()}`);
  // 与 payPolicy() 同样的修复：拿不到后端报价时，原实现会本地伪造一个
  // 从未在合约注册过的 quoteHash，buyPolicy 必定 revert，用户却已先付掉
  // approve 的 gas。报价必须来自后端。
  let quoteHash: string;
  if (typeof STATIC_QUOTE_HASH === 'string' && /^0x[a-fA-F0-9]{64}$/.test(STATIC_QUOTE_HASH)) {
    quoteHash = STATIC_QUOTE_HASH;
  } else {
    const quoteResp = await api.post<{ ok: boolean; data?: { quoteHash: string } }>(
      '/api/v1/pricing/quote-hash',
      { wallet: wallet.address, orderId, amountUSDC: String(params.amountUsdc) },
      { requireAuth: true }
    );
    const got = (quoteResp as any)?.data?.quoteHash;
    if (!got || !/^0x[a-fA-F0-9]{64}$/.test(got)) {
      throw new Error('未能从服务端获取有效报价（quoteHash），请稍后重试');
    }
    quoteHash = got;
  }
  const usdc = new ethers.Contract(BASE_USDC_ADDRESS, ERC20_ABI, signer);
  const allowance: bigint = await usdc.allowance(wallet.address, CHECKOUT_CONTRACT_ADDRESS);
  if (allowance < amount) {
    const approveTx = await usdc.approve(CHECKOUT_CONTRACT_ADDRESS, amount);
    await approveTx.wait();
  }
  const checkout = new ethers.Contract(CHECKOUT_CONTRACT_ADDRESS, CHECKOUT_ABI, signer);
  const buyTx = await checkout.buyPolicy(orderId, amount, quoteHash);
  const receipt = await buyTx.wait();
  return { orderId, txHash: receipt?.hash ?? buyTx.hash };
}
