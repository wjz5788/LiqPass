import { createPublicClient, createWalletClient, custom, http, stringToHex, Hex } from 'viem';
import { base } from 'viem/chains';

// 合约地址配置
export const CONTRACT_ADDRESSES = {
  // LeverageGuardV3 合约地址（部署后需要更新）
  LEVERAGE_GUARD: '0x...', // TODO: 部署后更新
  
  // USDC 代币地址 (Base 主网)
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  
  // Permit2 合约地址 (多链统一)
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3'
} as const;

// ABI for the relevant parts of the LeverageGuardV3 contract
const LeverageGuardV3ABI = [
  {
    "type": "function",
    "name": "buyWithPermit2",
    "inputs": [
      { "name": "orderId", "type": "bytes32" },
      {
        "name": "permitData", "type": "tuple", "components": [
          { "name": "permitted", "type": "tuple", "components": [
              { "name": "token", "type": "address" },
              { "name": "amount", "type": "uint256" }
            ]
          },
          { "name": "spender", "type": "address" },
          { "name": "nonce", "type": "uint256" },
          { "name": "deadline", "type": "uint256" }
        ]
      },
      { "name": "sig", "type": "bytes" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "buyWithUSDC",
    "inputs": [
      { "name": "orderId", "type": "bytes32" },
      { "name": "amount", "type": "uint256" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  }
] as const;

const USDC_ABI = [
  {
    "constant": false,
    "inputs": [
      { "name": "_spender", "type": "address" },
      { "name": "_value", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [ { "name": "", "type": "bool" } ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      { "name": "_owner", "type": "address" },
      { "name": "_spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [ { "name": "", "type": "uint256" } ],
    "payable": false,
    "stateMutability": "view",
    "type": "function"
  }
] as const;


// USDC 代币信息
export const USDC_TOKEN = {
  address: CONTRACT_ADDRESSES.USDC,
  decimals: 6,
  symbol: 'USDC',
  name: 'USD Coin'
} as const;

// Permit2 相关类型
export interface PermitData {
  permitted: {
    token: string;
    amount: string;
  };
  spender: string;
  nonce: number;
  deadline: number;
}

// 支付结果类型
export interface PaymentResult {
  success: boolean;
  transactionHash?: string;
  orderId?: string;
  error?: string;
  method: 'permit2' | 'usdc' | 'none';
}

/**
 * USDC支付服务类
 * 实现Permit2优先策略，失败时回退到传统approve+transferFrom
 */
export class USDCPaymentService {
  private walletClient: any;
  private publicClient: any;

  constructor(ethereumProvider: any) {
    // 初始化Viem客户端
    this.publicClient = createPublicClient({
      chain: base,
      transport: http()
    });

    this.walletClient = createWalletClient({
      chain: base,
      transport: custom(ethereumProvider)
    });
  }

  /**
   * 使用Permit2进行USDC支付
   * @param amount 支付金额（6位小数）
   * @param orderId 订单ID
   * @returns 支付结果
   */
  async payWithPermit2(amount: number, orderId: string): Promise<PaymentResult> {
    try {
      const [account] = await this.walletClient.getAddresses();
      
      // 1. 准备Permit2数据
      const permitData = await this.preparePermitData(amount, account);
      
      // 2. 获取EIP-712签名
      const signature = await this.signPermitData(permitData, account);
      
      // 3. 调用合约的buyWithPermit2方法
      const transactionHash = await this.executePermit2Payment(
        orderId,
        permitData,
        signature,
        account
      );

      return {
        success: true,
        transactionHash,
        orderId,
        method: 'permit2'
      };
    } catch (error) {
      console.error('Permit2 payment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Permit2 payment failed',
        method: 'permit2'
      };
    }
  }

  /**
   * 使用传统approve+transferFrom进行USDC支付
   * @param amount 支付金额（6位小数）
   * @param orderId 订单ID
   * @returns 支付结果
   */
  async payWithUSDC(amount: number, orderId: string): Promise<PaymentResult> {
    try {
      const [account] = await this.walletClient.getAddresses();
      
      // 1. 批准USDC转账
      await this.approveUSDC(amount, account);
      
      // 2. 调用合约的buyWithUSDC方法
      const transactionHash = await this.executeUSDCPayment(orderId, amount, account);

      return {
        success: true,
        transactionHash,
        orderId,
        method: 'usdc'
      };
    } catch (error) {
      console.error('USDC payment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'USDC payment failed',
        method: 'usdc'
      };
    }
  }

  /**
   * 智能支付方法：优先使用Permit2，失败时回退到传统方式
   * @param amount 支付金额（6位小数）
   * @param orderId 订单ID
   * @returns 支付结果
   */
  async smartPayment(amount: number, orderId: string): Promise<PaymentResult> {
    try {
      // 金额校验
      if (amount <= 0) {
        return {
          success: false,
          error: '支付金额必须大于0',
          method: 'none'
        };
      }
      
      // 订单去重检查（前端层面）
      const orderKey = `order_${orderId}`;
      const existingOrder = localStorage.getItem(orderKey);
      if (existingOrder) {
        return {
          success: false,
          error: '订单已处理，请勿重复提交',
          method: 'none'
        };
      }
      
      // 检查钱包是否支持Permit2
      const supportsPermit2 = await this.supportsPermit2();
      
      if (supportsPermit2) {
        // 尝试Permit2支付
        const permit2Result = await this.payWithPermit2(amount, orderId);
        if (permit2Result.success) {
          // 标记订单为已处理
          localStorage.setItem(orderKey, JSON.stringify({
            timestamp: Date.now(),
            amount: amount,
            method: 'permit2'
          }));
          
          return {
            ...permit2Result,
            method: 'permit2'
          };
        }
        console.warn('Permit2支付失败，尝试传统USDC支付:', permit2Result.error);
      }
      
      // 回退到传统USDC支付
      const usdcResult = await this.payWithUSDC(amount, orderId);
      
      if (usdcResult.success) {
        // 标记订单为已处理
        localStorage.setItem(orderKey, JSON.stringify({
          timestamp: Date.now(),
          amount: amount,
          method: 'usdc'
        }));
      }
      
      return {
        ...usdcResult,
        method: 'usdc'
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '智能支付失败',
        method: 'none'
      };
    }
  }

  /**
   * 准备Permit2数据
   */
  private async preparePermitData(amount: number, account: string): Promise<PermitData> {
    const amountInWei = this.toUSDCWei(amount);
    
    // 获取nonce（这里简化处理，实际应该从合约获取）
    const nonce = Date.now();
    
    // 设置24小时有效期
    const deadline = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

    return {
      permitted: {
        token: CONTRACT_ADDRESSES.USDC,
        amount: amountInWei.toString()
      },
      spender: CONTRACT_ADDRESSES.LEVERAGE_GUARD,
      nonce,
      deadline
    };
  }

  /**
   * 对Permit数据进行EIP-712签名
   */
  private async signPermitData(permitData: PermitData, account: string): Promise<Hex> {
    try {
      // 使用Permit2 SDK准备EIP-712数据
      const domain = {
        name: 'Permit2',
        chainId: base.id,
        verifyingContract: CONTRACT_ADDRESSES.PERMIT2
      };

      const types = {
        PermitTransferFrom: [
          { name: 'permitted', type: 'TokenPermissions' },
          { name: 'spender', type: 'address' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ],
        TokenPermissions: [
          { name: 'token', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ]
      };

      // 使用钱包进行签名
      const signature = await this.walletClient.signTypedData({
        account,
        domain,
        types,
        primaryType: 'PermitTransferFrom',
        message: {
          permitted: {
            token: permitData.permitted.token,
            amount: BigInt(permitData.permitted.amount)
          },
          spender: permitData.spender,
          nonce: BigInt(permitData.nonce),
          deadline: BigInt(permitData.deadline)
        }
      });

      return signature;
    } catch (error) {
      throw new Error(`Failed to sign permit data: ${error}`);
    }
  }

  /**
   * 执行Permit2支付
   */
  private async executePermit2Payment(
    orderId: string,
    permitData: PermitData,
    signature: Hex,
    account: string
  ): Promise<string> {
    if (CONTRACT_ADDRESSES.LEVERAGE_GUARD === '0x...') {
      throw new Error("LEVERAGE_GUARD contract address not set.");
    }

    const permitDataForContract = {
        permitted: {
            token: permitData.permitted.token,
            amount: BigInt(permitData.permitted.amount)
        },
        spender: permitData.spender,
        nonce: BigInt(permitData.nonce),
        deadline: BigInt(permitData.deadline)
    };

    const { request } = await this.publicClient.simulateContract({
      account,
      address: CONTRACT_ADDRESSES.LEVERAGE_GUARD,
      abi: LeverageGuardV3ABI,
      functionName: 'buyWithPermit2',
      args: [
        stringToHex(orderId, { size: 32 }),
        permitDataForContract,
        signature
      ],
    });

    const hash = await this.walletClient.writeContract(request);
    return hash;
  }

  /**
   * 批准USDC转账
   */
  private async approveUSDC(amount: number, account: string): Promise<void> {
    const amountInWei = this.toUSDCWei(amount);
    const spender = CONTRACT_ADDRESSES.LEVERAGE_GUARD;

    if (spender === '0x...') {
      throw new Error("LEVERAGE_GUARD contract address not set.");
    }

    // Check allowance
    const allowance = await this.publicClient.readContract({
      address: CONTRACT_ADDRESSES.USDC,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [account, spender]
    });

    if (allowance >= amountInWei) {
      console.log("Allowance is sufficient, skipping approval.");
      return;
    }

    const { request } = await this.publicClient.simulateContract({
      account,
      address: CONTRACT_ADDRESSES.USDC,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [spender, amountInWei],
    });

    const hash = await this.walletClient.writeContract(request);
    await this.publicClient.waitForTransactionReceipt({ hash });
    console.log(`Approved ${amount} USDC for contract ${spender}. Tx: ${hash}`);
  }

  /**
   * 执行传统USDC支付
   */
  private async executeUSDCPayment(orderId: string, amount: number, account: string): Promise<string> {
    if (CONTRACT_ADDRESSES.LEVERAGE_GUARD === '0x...') {
      throw new Error("LEVERAGE_GUARD contract address not set.");
    }
    
    const { request } = await this.publicClient.simulateContract({
      account,
      address: CONTRACT_ADDRESSES.LEVERAGE_GUARD,
      abi: LeverageGuardV3ABI,
      functionName: 'buyWithUSDC',
      args: [stringToHex(orderId, { size: 32 }), this.toUSDCWei(amount)],
    });

    const hash = await this.walletClient.writeContract(request);
    return hash;
  }

  /**
   * 将金额转换为USDC的wei单位（6位小数）
   */
  private toUSDCWei(amount: number): bigint {
    return BigInt(Math.floor(amount * 10 ** USDC_TOKEN.decimals));
  }

  /**
   * 检查钱包是否支持Permit2
   */
  async supportsPermit2(): Promise<boolean> {
    try {
      // 检查钱包是否支持EIP-712签名
      const [account] = await this.walletClient.getAddresses();
      const testData = await this.preparePermitData(1, account);
      await this.signPermitData(testData, account);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取USDC余额
   */
  async getUSDCBalance(account: string): Promise<number> {
    try {
      const balance = await this.publicClient.readContract({
        address: CONTRACT_ADDRESSES.USDC,
        abi: [
          {
            "constant": true,
            "inputs": [{ "name": "_owner", "type": "address" }],
            "name": "balanceOf",
            "outputs": [{ "name": "balance", "type": "uint256" }],
            "payable": false,
            "stateMutability": "view",
            "type": "function"
          }
        ],
        functionName: 'balanceOf',
        args: [account]
      });
      return Number(balance) / (10 ** USDC_TOKEN.decimals);
    } catch (error) {
      console.error('Failed to get USDC balance:', error);
      return 0;
    }
  }
}

/**
 * 创建USDC支付服务实例
 */
export function createUSDCPaymentService(ethereumProvider: any): USDCPaymentService {
  return new USDCPaymentService(ethereumProvider);
}

export default USDCPaymentService;