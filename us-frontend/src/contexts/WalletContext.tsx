import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

/**
 * 检查是否安装了MetaMask钱包
 */
const isMetaMaskInstalled = (): boolean => {
  return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
};

/**
 * 钱包上下文接口 - 定义钱包连接状态和操作方法
 */
interface WalletContextType {
  isConnected: boolean; // 钱包是否已连接
  account: string | null; // 当前连接的钱包地址
  isConnecting: boolean; // 是否正在连接中
  error: string | null; // 错误信息
  connectWallet: () => Promise<void>; // 连接钱包方法
  disconnectWallet: () => void; // 断开钱包连接方法
}

/**
 * 创建钱包上下文
 */
const WalletContext = createContext<WalletContextType | undefined>(undefined);

/**
 * 使用钱包的Hook
 */
export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

/**
 * 钱包提供者组件 - 管理钱包连接状态
 */
export const WalletProvider: React.FC<WalletProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false); // 连接状态
  const [account, setAccount] = useState<string | null>(null); // 钱包地址状态
  const [isConnecting, setIsConnecting] = useState(false); // 连接中状态
  const [error, setError] = useState<string | null>(null); // 错误状态

  /**
   * 检查是否已安装MetaMask并初始化连接状态
   */
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      // 检查是否已连接
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            setIsConnected(true);
          }
        })
        .catch((err: Error) => {
          console.error('Failed to get accounts:', err);
        });
      
      // 监听账户变化
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // 用户断开连接
          setAccount(null);
          setIsConnected(false);
        } else {
          setAccount(accounts[0]);
          setIsConnected(true);
        }
      };
      
      // 监听网络变化
      const handleChainChanged = () => {
        // 重新加载页面以应用新的网络
        window.location.reload();
      };
      
      // 注册事件监听器
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      // 清理函数：移除事件监听器
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  // 连接钱包
  const connectWallet = async () => {
    if (!isMetaMaskInstalled()) {
      setError('请安装MetaMask钱包');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setIsConnected(true);
        
        // 检查网络是否为Base主网
        const chainId = await window.ethereum.request({
          method: 'eth_chainId'
        });

        // Base主网chainId: 0x2105 (8453)
        if (chainId !== '0x2105') {
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x2105' }],
            });
          } catch (switchError: any) {
            // 如果网络不存在，添加Base网络
            if (switchError.code === 4902) {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x2105',
                  chainName: 'Base Mainnet',
                  nativeCurrency: {
                    name: 'Ether',
                    symbol: 'ETH',
                    decimals: 18,
                  },
                  rpcUrls: ['https://mainnet.base.org'],
                  blockExplorerUrls: ['https://basescan.org'],
                }],
              });
            } else {
              throw switchError;
            }
          }
        }
      }
    } catch (err: any) {
      console.error('钱包连接失败:', err);
      if (err.code === 4001) {
        setError('用户拒绝了连接请求');
      } else {
        setError('钱包连接失败，请重试');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // 断开钱包连接
  const disconnectWallet = () => {
    setAccount(null);
    setIsConnected(false);
    setError(null);
  };

  // 监听账户变化
  useEffect(() => {
    if (!isMetaMaskInstalled()) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // 用户断开连接
        disconnectWallet();
      } else if (accounts[0] !== account) {
        // 账户切换
        setAccount(accounts[0]);
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);

    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
    };
  }, [account]);

  // 监听网络变化
  useEffect(() => {
    if (!isMetaMaskInstalled()) return;

    const handleChainChanged = (chainId: string) => {
      console.log('网络已切换:', chainId);
      // 可以在这里处理网络切换逻辑
    };

    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    };
  }, []);

  const value: WalletContextType = {
    isConnected,
    account,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};