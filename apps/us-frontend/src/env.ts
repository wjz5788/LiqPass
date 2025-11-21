/**
 * 环境变量校验
 * 使用纯TypeScript实现，无需额外依赖
 */

export interface EnvConfig {
  VITE_API_BASE: string;
  VITE_API_BASE_URL: string;
  VITE_CHECKOUT_CONTRACT_ADDRESS: string;
  VITE_BASE_USDC_ADDRESS: string;
  VITE_TREASURY_ADDRESS: string;
  VITE_BASE_RPC: string;
  VITE_DEV_MODE: boolean;
}

/**
 * 验证是否为有效的以太坊地址
 */
function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * 验证是否为有效的URL
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 环境变量校验函数
 */
function validateEnv(): EnvConfig {
  const env = import.meta.env as Record<string, any>;
  const isDev = !!import.meta.env.DEV;

  const apiBaseRaw = (env.VITE_API_BASE ?? env.VITE_API_BASE_URL ?? (isDev ? '/api' : '')) as string;

  const contractAddress = (env.VITE_CHECKOUT_CONTRACT_ADDRESS || (isDev ? '0xc423c34b57730ba87fb74b99180663913a345d68' : '')) as string;
  const baseUsdcAddress = (env.VITE_BASE_USDC_ADDRESS || env.VITE_CHECKOUT_USDC_ADDRESS || (isDev ? '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' : '')) as string;
  const treasuryAddress = (env.VITE_TREASURY_ADDRESS || (isDev ? '0xaa1f4df6fc3ad033cc71d561689189d11ab54f4b' : '')) as string;
  const baseRpc = (env.VITE_BASE_RPC || (isDev ? 'https://mainnet.base.org' : '')) as string;

  if (!isDev) {
    const requiredFields = ['VITE_BASE_USDC_ADDRESS', 'VITE_TREASURY_ADDRESS', 'VITE_BASE_RPC'];
    const missingFields = requiredFields.filter(field => !env[field]);
    if (missingFields.length > 0) {
      throw new Error(`缺少必需的环境变量: ${missingFields.join(', ')}`);
    }
    if (!apiBaseRaw) {
      throw new Error('VITE_API_BASE 或 VITE_API_BASE_URL 必须配置');
    }
  }

  if (apiBaseRaw && !isValidUrl(apiBaseRaw) && !apiBaseRaw.startsWith('/')) {
    throw new Error('VITE_API_BASE / VITE_API_BASE_URL 必须是有效的URL');
  }

  if (baseRpc && !isValidUrl(baseRpc)) {
    throw new Error('VITE_BASE_RPC 必须是有效的URL');
  }

  const addresses = [
    { key: 'VITE_CHECKOUT_CONTRACT_ADDRESS', value: contractAddress },
    { key: 'VITE_BASE_USDC_ADDRESS', value: baseUsdcAddress },
    { key: 'VITE_TREASURY_ADDRESS', value: treasuryAddress }
  ];
  const invalidAddresses = addresses.filter(({ value }) => value && !isValidEthereumAddress(value));
  if (!isDev && invalidAddresses.length > 0) {
    throw new Error(`无效的以太坊地址: ${invalidAddresses.map(({ key }) => key).join(', ')}`);
  }

  return {
    VITE_API_BASE: apiBaseRaw,
    VITE_API_BASE_URL: apiBaseRaw,
    VITE_CHECKOUT_CONTRACT_ADDRESS: contractAddress,
    VITE_BASE_USDC_ADDRESS: baseUsdcAddress,
    VITE_TREASURY_ADDRESS: treasuryAddress,
    VITE_BASE_RPC: baseRpc,
    VITE_DEV_MODE: env.VITE_DEV_MODE === 'true' || isDev
  };
}

// 导出验证后的环境变量配置
export const ENV = (() => {
  try {
    return validateEnv();
  } catch (error) {
    console.error('环境变量校验失败:', error);
    
    // 开发模式下提供友好的错误提示
    if (import.meta.env.DEV) {
      console.error('请检查 .env 文件，确保所有必需的环境变量都已配置');
      console.error('参考 .env.example 文件进行配置');
    }
    
    throw error;
  }
})();

// 导出便捷访问函数
export const getEnv = () => ENV;
export const isDevMode = () => ENV.VITE_DEV_MODE;
export const getApiBase = () => ENV.VITE_API_BASE;
export const getContractAddresses = () => ({
  checkout: ENV.VITE_CHECKOUT_CONTRACT_ADDRESS,
  baseUSDC: ENV.VITE_BASE_USDC_ADDRESS,
  treasury: ENV.VITE_TREASURY_ADDRESS
});
export const getRpcUrl = () => ENV.VITE_BASE_RPC;
