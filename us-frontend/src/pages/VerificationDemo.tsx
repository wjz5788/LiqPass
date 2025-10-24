import React, { useState, useEffect } from 'react';
import { submitVerification } from '../services/verify';
import type { ExchangeId, TradingPairId } from '../config/verification';
import { TRADING_PAIR_OPTIONS } from '../config/verification';

/**
 * 验证流程演示页面 - 展示新用户第一次验证的完整流程
 * 这是一个独立的演示页面，展示从钱包连接到订单验证的完整流程
 */
export function VerificationDemoPage() {
  // 模拟钱包状态
  const [wallet, setWallet] = useState<string>('');
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  
  // 验证流程状态
  const [currentStep, setCurrentStep] = useState(1); // 1: 钱包连接, 2: API密钥设置, 3: 订单验证, 4: 验证结果
  
  // 订单验证状态
  const [orderId, setOrderId] = useState('');
  const [exchange, setExchange] = useState<ExchangeId>('Binance');
  const [pair, setPair] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [error, setError] = useState('');
  
  // API密钥状态
  const [apiKeys, setApiKeys] = useState({
    binanceApiKey: '',
    binanceSecretKey: '',
    okxApiKey: '',
    okxSecretKey: '',
    okxPassphrase: ''
  });

  // 支持的交易所列表
  const exchanges: ExchangeId[] = ['Binance', 'OKX'];

  /**
   * 模拟钱包连接
   */
  const handleConnectWallet = () => {
    // 模拟连接钱包，生成一个随机钱包地址
    const mockWallet = '0x' + Math.random().toString(16).substr(2, 40);
    setWallet(mockWallet);
    setIsWalletConnected(true);
    setCurrentStep(2); // 进入下一步：API密钥设置
    
    // 模拟从localStorage加载保存的API密钥
    const savedKeys = localStorage.getItem(`apiKeys_${mockWallet}`);
    if (savedKeys) {
      try {
        setApiKeys(JSON.parse(savedKeys));
      } catch (e) {
        console.error('Failed to parse saved API keys', e);
      }
    }
  };

  /**
   * 保存API密钥
   */
  const handleSaveApiKeys = () => {
    if (!wallet) return;
    
    // 保存到localStorage
    localStorage.setItem(`apiKeys_${wallet}`, JSON.stringify(apiKeys));
    setCurrentStep(3); // 进入下一步：订单验证
  };

  /**
   * 根据选择的交易所过滤可用的交易对
   */
  const getAvailablePairs = () => {
    return TRADING_PAIR_OPTIONS.filter(pair => pair.exchangeId === exchange);
  };

  /**
   * 处理订单验证
   */
  const handleVerifyOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!wallet) {
      setError('请先连接钱包');
      return;
    }
    
    if (exchange === 'Binance' && !apiKeys.binanceApiKey) {
      setError('请先设置Binance API密钥');
      return;
    }
    if (exchange === 'OKX' && !apiKeys.okxApiKey) {
      setError('请先设置OKX API密钥');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setVerificationResult(null);

    try {
      // 模拟验证请求
      const request = {
        exchange,
        pairId: pair as TradingPairId,
        orderId,
        wallet,
        skuCode: 'DAY_24H_FIXED',
        env: 'production',
        principal: 1000,
        leverage: 10,
      };

      const apiKeyParams = {
        binanceApiKey: apiKeys.binanceApiKey,
        binanceSecretKey: apiKeys.binanceSecretKey,
        okxApiKey: apiKeys.okxApiKey,
        okxSecretKey: apiKeys.okxSecretKey,
        okxPassphrase: apiKeys.okxPassphrase
      };

      // 在实际应用中，这里会调用真实的验证服务
      // const result = await submitVerification(request, apiKeyParams);
      
      // 模拟验证结果
      const mockResult = {
        status: 'ok',
        exchange: exchange.toLowerCase(),
        pair: pair,
        orderRef: orderId,
        eligible: true,
        parsed: {
          side: 'BUY',
          avgPx: '45000.00',
          qty: '0.1',
          liqPx: '42000.00'
        },
        quote: {
          premium: 50,
          payoutCap: 1000,
          currency: 'USDT'
        },
        evidenceHint: '验证通过，可以购买保险'
      };
      
      setVerificationResult(mockResult);
      setCurrentStep(4); // 进入结果页面
      
      // 保存验证状态
      localStorage.setItem(`verification_${wallet}_${orderId}`, JSON.stringify({
        verified: true,
        timestamp: Date.now(),
        exchange,
        pair,
        orderId
      }));
      
    } catch (err: any) {
      console.error('验证失败:', err);
      setError(err.message || '验证失败，请检查订单信息');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 重置流程，重新开始
   */
  const handleReset = () => {
    setWallet('');
    setIsWalletConnected(false);
    setCurrentStep(1);
    setOrderId('');
    setExchange('Binance');
    setPair('');
    setVerificationResult(null);
    setError('');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-8 text-center">
        新用户验证流程演示
      </h1>
      
      {/* 进度指示器 */}
      <div className="flex justify-center mb-8">
        <div className="flex space-x-4">
          {[1, 2, 3, 4].map(step => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step === currentStep 
                  ? 'bg-blue-600 text-white' 
                  : step < currentStep 
                    ? 'bg-green-600 text-white' 
                    : 'bg-slate-600 text-slate-300'
              }`}>
                {step}
              </div>
              {step < 4 && (
                <div className={`w-16 h-1 mx-2 ${
                  step < currentStep ? 'bg-green-600' : 'bg-slate-600'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* 步骤标签 */}
      <div className="flex justify-between mb-8 text-sm text-slate-400">
        <span className={currentStep >= 1 ? 'text-blue-400' : ''}>钱包连接</span>
        <span className={currentStep >= 2 ? 'text-blue-400' : ''}>API密钥设置</span>
        <span className={currentStep >= 3 ? 'text-blue-400' : ''}>订单验证</span>
        <span className={currentStep >= 4 ? 'text-blue-400' : ''}>验证结果</span>
      </div>

      {/* 步骤1: 钱包连接 */}
      {currentStep === 1 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">步骤1: 连接钱包</h2>
          <p className="text-slate-300 mb-6">
            首先需要连接您的加密货币钱包，以便进行后续的验证操作。
          </p>
          
          <div className="flex justify-center">
            <button
              onClick={handleConnectWallet}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium transition-colors"
            >
              模拟连接钱包
            </button>
          </div>
          
          {isWalletConnected && (
            <div className="mt-4 p-3 bg-green-900/20 border border-green-600 rounded-md">
              <p className="text-green-400">✅ 钱包已连接: {wallet}</p>
            </div>
          )}
        </div>
      )}

      {/* 步骤2: API密钥设置 */}
      {currentStep === 2 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">步骤2: 设置API密钥</h2>
          <p className="text-slate-300 mb-6">
            为了验证您的交易所订单，需要设置相应的API密钥。请确保API密钥具有读取订单的权限。
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                选择交易所
              </label>
              <select 
                value={exchange} 
                onChange={(e) => setExchange(e.target.value as ExchangeId)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
              >
                {exchanges.map(ex => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
            </div>
            
            {exchange === 'Binance' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Binance API Key
                  </label>
                  <input
                    type="text"
                    value={apiKeys.binanceApiKey}
                    onChange={(e) => setApiKeys({...apiKeys, binanceApiKey: e.target.value})}
                    placeholder="请输入您的Binance API Key"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Binance Secret Key
                  </label>
                  <input
                    type="password"
                    value={apiKeys.binanceSecretKey}
                    onChange={(e) => setApiKeys({...apiKeys, binanceSecretKey: e.target.value})}
                    placeholder="请输入您的Binance Secret Key"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                  />
                </div>
              </>
            )}
            
            {exchange === 'OKX' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    OKX API Key
                  </label>
                  <input
                    type="text"
                    value={apiKeys.okxApiKey}
                    onChange={(e) => setApiKeys({...apiKeys, okxApiKey: e.target.value})}
                    placeholder="请输入您的OKX API Key"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    OKX Secret Key
                  </label>
                  <input
                    type="password"
                    value={apiKeys.okxSecretKey}
                    onChange={(e) => setApiKeys({...apiKeys, okxSecretKey: e.target.value})}
                    placeholder="请输入您的OKX Secret Key"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    OKX Passphrase
                  </label>
                  <input
                    type="password"
                    value={apiKeys.okxPassphrase}
                    onChange={(e) => setApiKeys({...apiKeys, okxPassphrase: e.target.value})}
                    placeholder="请输入您的OKX Passphrase"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                  />
                </div>
              </>
            )}
            
            <div className="flex justify-between pt-4">
              <button
                onClick={() => setCurrentStep(1)}
                className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md"
              >
                上一步
              </button>
              <button
                onClick={handleSaveApiKeys}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                保存并继续
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 步骤3: 订单验证 */}
      {currentStep === 3 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">步骤3: 验证订单</h2>
          <p className="text-slate-300 mb-6">
            请输入您的交易所订单信息进行验证。系统将验证订单的有效性和保险资格。
          </p>
          
          <form onSubmit={handleVerifyOrder} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                交易所
              </label>
              <select 
                value={exchange} 
                onChange={(e) => setExchange(e.target.value as ExchangeId)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                required
              >
                {exchanges.map(ex => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                交易对
              </label>
              <select 
                value={pair} 
                onChange={(e) => setPair(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                required
              >
                <option value="">请选择交易对</option>
                {getAvailablePairs().map(pair => (
                  <option key={pair.id} value={pair.id}>{pair.label}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                订单号
              </label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="请输入您的订单号"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                required
              />
            </div>
            
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-600 rounded-md">
                <p className="text-red-400">❌ {error}</p>
              </div>
            )}
            
            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md"
              >
                上一步
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md disabled:opacity-50"
              >
                {isLoading ? '验证中...' : '开始验证'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 步骤4: 验证结果 */}
      {currentStep === 4 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">步骤4: 验证结果</h2>
          
          {verificationResult ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-900/20 border border-green-600 rounded-md">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center mr-3">
                    ✓
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-400">验证成功</h3>
                    <p className="text-green-300">订单验证通过，可以购买保险</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700 p-3 rounded">
                  <p className="text-slate-400 text-sm">交易所</p>
                  <p className="text-white">{verificationResult.exchange}</p>
                </div>
                <div className="bg-slate-700 p-3 rounded">
                  <p className="text-slate-400 text-sm">交易对</p>
                  <p className="text-white">{verificationResult.pair}</p>
                </div>
                <div className="bg-slate-700 p-3 rounded">
                  <p className="text-slate-400 text-sm">订单号</p>
                  <p className="text-white">{verificationResult.orderRef}</p>
                </div>
                <div className="bg-slate-700 p-3 rounded">
                  <p className="text-slate-400 text-sm">交易方向</p>
                  <p className="text-white">{verificationResult.parsed?.side}</p>
                </div>
              </div>
              
              {verificationResult.quote && (
                <div className="bg-blue-900/20 border border-blue-600 rounded-md p-4">
                  <h4 className="text-blue-400 font-semibold mb-2">保险报价</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-blue-300 text-sm">保费</p>
                      <p className="text-white">{verificationResult.quote.premium} USDT</p>
                    </div>
                    <div>
                      <p className="text-blue-300 text-sm">赔付上限</p>
                      <p className="text-white">{verificationResult.quote.payoutCap} USDT</p>
                    </div>
                    <div>
                      <p className="text-blue-300 text-sm">状态</p>
                      <p className="text-green-400">可购买</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleReset}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md"
                >
                  重新开始验证
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-slate-400">验证结果加载中...</p>
            </div>
          )}
        </div>
      )}
      
      {/* 调试信息（开发时可见） */}
      <div className="mt-8 p-4 bg-slate-900 rounded text-xs text-slate-400">
        <h3 className="font-mono mb-2">调试信息:</h3>
        <pre className="whitespace-pre-wrap">
          当前步骤: {currentStep}\n
          钱包状态: {isWalletConnected ? '已连接' : '未连接'}\n
          钱包地址: {wallet || '无'}\n
          API密钥状态: {apiKeys.binanceApiKey || apiKeys.okxApiKey ? '已设置' : '未设置'}\n
          验证结果: {verificationResult ? JSON.stringify(verificationResult, null, 2) : '无'}
        </pre>
      </div>
    </div>
  );
}