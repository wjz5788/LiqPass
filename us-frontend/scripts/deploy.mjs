// us-frontend/scripts/deploy.mjs
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import 'dotenv/config';

// =================================================================================
// 部署脚本 - LeverageGuardV3
// =================================================================================
//
// 使用方法:
// 1. 安装依赖: npm install dotenv
// 2. 编译合约:
//    - 打开 Remix IDE (https://remix.ethereum.org/)
//    - 将 `contracts/LeverageGuardV3.sol` 的内容粘贴到 Remix
//    - 在 "Solidity Compiler" 标签页, 选择 "0.8.21" 或兼容版本进行编译
//    - 编译成功后, 复制 ABI 和 Bytecode (在 "Compilation Details" 中)
// 3. 粘贴 ABI 和 Bytecode:
//    - 将复制的 ABI 粘贴到下面的 `contractABI` 变量中
//    - 将复制的 Bytecode (object) 粘贴到下面的 `contractBytecode` 变量中 (需要带 '0x' 前缀)
// 4. 创建 .env 文件:
//    - 在 `us-frontend` 目录下创建一个名为 `.env` 的文件
//    - 在文件中添加一行: `PRIVATE_KEY=你的私钥` (请务必保证私钥的安全)
// 5. 运行脚本:
//    - node scripts/deploy.mjs
//
// =================================================================================

// 1. 粘贴从 Remix 复制的 ABI
const contractABI = [
  // 在这里粘贴 ABI
  // 例如: { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" }, ...
];

// 2. 粘贴从 Remix 复制的 Bytecode (带 '0x' 前缀)
const contractBytecode = '0x...'; // 在这里粘贴 Bytecode

async function main() {
  // 从 .env 文件加载私钥
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('错误: 请在 .env 文件中设置 PRIVATE_KEY');
    process.exit(1);
  }

  // 创建部署账户
  const account = privateKeyToAccount(`0x${privateKey}`);

  // 创建 Viem 客户端
  const publicClient = createPublicClient({
    chain: base,
    transport: http(), // 使用 Base 主网的 RPC
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  });

  console.log(`正在使用地址 ${account.address} 部署合约...`);

  try {
    // 部署合约
    const hash = await walletClient.deployContract({
      abi: contractABI,
      bytecode: contractBytecode,
      args: [], // 构造函数没有参数
    });

    console.log('合约部署交易已发送, 交易哈希:', hash);
    console.log('正在等待交易确认...');

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log('✅ 合约部署成功!');
      console.log('📄 合约地址:', receipt.contractAddress);
    } else {
      console.error('❌ 合约部署失败。');
    }

  } catch (error) {
    console.error('部署过程中发生错误:', error);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
