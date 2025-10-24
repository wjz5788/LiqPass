import React, { useState, useEffect } from 'react';
import { submitVerification } from '../services/verify';
import type { ExchangeId, TradingPairId } from '../config/verification';
import { TRADING_PAIR_OPTIONS } from '../config/verification';
import { useWallet } from '../contexts/WalletContext';

/**
 * 新用户验证流程页面 - 完整的5步验证流程
 * 1. 用户链接钱包
 * 2. 选择交易所
 * 3. 输入对应的API
 * 4. 订单号+手动输入交易对
 * 5. 点击验证
 */
export function NewUserVerificationPage() {
  // 使用钱包上下文获取当前连接的钱包地址
  const { isConnected, account, connectWallet, isConnecting } = useWallet();
  
  // 验证流程状态
  const [currentStep, setCurrentStep] = useState(1); // 1: 钱包连接, 2: 交易所选择, 3: API输入, 4: 订单信息, 5: 验证结果
  
  // 交易所和API密钥状态
  const [exchange, setExchange] = useState<ExchangeId>('Binance'); // 选择的交易所
  const [apiKeys, setApiKeys] = useState({
    binanceApiKey: '',
    binanceSecretKey: '',
    okxApiKey: '',
    okxSecretKey: '',
    okxPassphrase: ''
  });
  
  // 订单信息状态
  const [orderId, setOrderId] = useState(''); // 订单号
  const [pair, setPair] = useState(''); // 交易对
  const [manualPair, setManualPair] = useState(''); // 手动输入的交易对
  const [useManualPair, setUseManualPair] = useState(false); // 是否使用手动输入
  
  // 验证状态
  const [isLoading, setIsLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [error, setError] = useState('');

  // 支持的交易所列表
  const exchanges: ExchangeId[] = ['Binance', 'OKX'];

  // 当钱包连接状态变化时，自动进入下一步
  useEffect(() => {
    if (isConnected && currentStep === 1) {
      setCurrentStep(2);
      
      // 加载保存的API密钥
      const savedKeys = localStorage.getItem(`apiKeys_${account}`);
      if (savedKeys) {
        try {
          setApiKeys(JSON.parse(savedKeys));
        } catch (e) {
          console.error('Failed to parse saved API keys', e);
        }
      }
    }
  }, [isConnected, currentStep, account]);

  // 根据选择的交易所过滤可用的交易对
  const getAvailablePairs = () => {
    return TRADING_PAIR_OPTIONS.filter(pair => pair.exchangeId === exchange);
  };

  // 步骤1: 连接钱包
  const handleConnectWallet = async () => {
    try {
      await connectWallet();
    } catch (err) {
      console.error('钱包连接失败:', err);
    }
  };

  // 步骤2: 选择交易所
  const handleSelectExchange = () => {
    if (!exchange) {
      setError('请选择交易所');
      return;
    }
    setCurrentStep(3);
  };

  // 步骤3: 输入API密钥
  const handleSaveApiKeys = () => {
    if (!account) return;
    
    // 验证API密钥格式
    if (exchange === 'Binance' && (!apiKeys.binanceApiKey || !apiKeys.binanceSecretKey)) {
      setError('请填写完整的Binance API密钥和Secret密钥');
      return;
    }
    
    if (exchange === 'OKX' && (!apiKeys.okxApiKey || !apiKeys.okxSecretKey || !apiKeys.okxPassphrase)) {
      setError('请填写完整的OKX API密钥、Secret密钥和Passphrase');
      return;
    }
    
    // 保存API密钥到localStorage
    localStorage.setItem(`apiKeys_${account}`, JSON.stringify(apiKeys));
    setCurrentStep(4);
    setError('');
  };

  // 步骤4: 输入订单信息
  const handleInputOrderInfo = () => {
    if (!orderId.trim()) {
      setError('请输入订单号');
      return;
    }
    
    if (!useManualPair && !pair) {
      setError('请选择交易对或启用手动输入');
      return;
    }
    
    if (useManualPair && !manualPair.trim()) {
      setError('请输入交易对');
      return;
    }
    
    setCurrentStep(5);
    setError('');
  };

  // 步骤5: 执行验证
  const handleVerifyOrder = async () => {
    if (!account) {
      setError('钱包未连接');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      const selectedPair = useManualPair ? manualPair : pair;
      
      const request = {
        exchange,
        pairId: selectedPair as TradingPairId,
        orderId,
        wallet: account,
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

      const result = await submitVerification(request, apiKeyParams);
      setVerificationResult(result);
      
      // 保存验证状态
      if (result.status === 'ok') {
        localStorage.setItem(`verification_${account}_${orderId}`, JSON.stringify({
          verified: true,
          timestamp: Date.now(),
          exchange,
          pair: selectedPair,
          orderId
        }));
      }
    } catch (err: any) {
      console.error('验证失败:', err);
      setError(err.message || '验证失败，请检查订单信息');
    } finally {
      setIsLoading(false);
    }
  };

  // 重置流程
  const handleReset = () => {
    setCurrentStep(1);
    setVerificationResult(null);
    setError('');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-8 text-center">
        新用户验证流程
      </h1>
      
      {/* 进度指示器 */}
      <div className="flex justify-center mb-8">
        <div className="flex space-x-4">
          {[1, 2, 3, 4, 5].map(step => (
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
              {step < 5 && (
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
        <span className={currentStep >= 2 ? 'text-blue-400' : ''}>选择交易所</span>
        <span className={currentStep >= 3 ? 'text-blue-400' : ''}>输入API</span>
        <span className={currentStep >= 4 ? 'text-blue-400' : ''}>订单信息</span>
        <span className={currentStep >= 5 ? 'text-blue-400' : ''}>验证结果</span>
      </div>
      
      {/* 错误提示 */}
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}
      
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
              disabled={isConnecting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-3 rounded-md font-medium transition-colors"
            >
              {isConnecting ? '连接中...' : '连接钱包'}
            </button>
          </div>
          
          {isConnected && (
            <div className="mt-4 p-3 bg-green-900/20 border border-green-600 rounded-md">
              <p className="text-green-400">✅ 钱包已连接: {account}</p>
            </div>
          )}
        </div>
      )}
      
      {/* 步骤2: 选择交易所 */}
      {currentStep === 2 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">步骤2: 选择交易所</h2>
          <p className="text-slate-300 mb-6">
            请选择您要验证订单的交易所。
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
            
            <div className="flex justify-between mt-6">
              <button
                onClick={() => setCurrentStep(1)}
                className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md"
              >
                上一步
              </button>
              <button
                onClick={handleSelectExchange}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                下一步
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 步骤3: 输入API密钥 */}
      {currentStep === 3 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">步骤3: 输入API密钥</h2>
          <p className="text-slate-300 mb-6">
            请输入您在{exchange}交易所的API密钥信息。请确保API密钥具有读取订单的权限。
          </p>
          
          <div className="space-y-4">
            {exchange === 'Binance' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Binance API Key
                  </label>
                  <input 
                    type="text" 
                    value={apiKeys.binanceApiKey}
                    onChange={(e) => setApiKeys({...apiKeys, binanceApiKey: e.target.value})}
                    placeholder="请输入Binance API Key"
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
                    placeholder="请输入Binance Secret Key"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    OKX API Key
                  </label>
                  <input 
                    type="text" 
                    value={apiKeys.okxApiKey}
                    onChange={(e) => setApiKeys({...apiKeys, okxApiKey: e.target.value})}
                    placeholder="请输入OKX API Key"
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
                    placeholder="请输入OKX Secret Key"
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
                    placeholder="请输入OKX Passphrase"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                  />
                </div>
              </>
            )}
            
            <div className="flex justify-between mt-6">
              <button
                onClick={() => setCurrentStep(2)}
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
      
      {/* 步骤4: 输入订单信息 */}
      {currentStep === 4 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">步骤4: 输入订单信息</h2>
          <p className="text-slate-300 mb-6">
            请输入您的交易所订单信息进行验证。
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                订单号
              </label>
              <input 
                type="text" 
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="请输入订单号"
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                交易对选择方式
              </label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input 
                    type="radio" 
                    checked={!useManualPair}
                    onChange={() => setUseManualPair(false)}
                    className="mr-2"
                  />
                  <span className="text-slate-300">从列表选择</span>
                </label>
                <label className="flex items-center">
                  <input 
                    type="radio" 
                    checked={useManualPair}
                    onChange={() => setUseManualPair(true)}
                    className="mr-2"
                  />
                  <span className="text-slate-300">手动输入</span>
                </label>
              </div>
            </div>
            
            {!useManualPair ? (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  选择交易对
                </label>
                <select 
                  value={pair} 
                  onChange={(e) => setPair(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                >
                  <option value="">选择交易对</option>
                  {getAvailablePairs().map(p => (
                    <option key={p.id} value={p.id}>{p.label.en}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  手动输入交易对
                </label>
                <input 
                  type="text" 
                  value={manualPair}
                  onChange={(e) => setManualPair(e.target.value)}
                  placeholder="例如: BTCUSDT"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                />
              </div>
            )}
            
            <div className="flex justify-between mt-6">
              <button
                onClick={() => setCurrentStep(3)}
                className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md"
              >
                上一步
              </button>
              <button
                onClick={handleInputOrderInfo}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                下一步
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 步骤5: 验证结果 */}
      {currentStep === 5 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">步骤5: 验证结果</h2>
          
          {!verificationResult ? (
            <div className="text-center">
              <p className="text-slate-300 mb-6">
                准备验证您的订单信息...
              </p>
              <button
                onClick={handleVerifyOrder}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-6 py-3 rounded-md font-medium transition-colors"
              >
                {isLoading ? '验证中...' : '开始验证'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 验证结果状态显示 */}
              <div className={`p-4 rounded-lg border ${
                verificationResult.status === 'success' ? 'bg-green-900/20 border-green-600' :
                verificationResult.status === 'failed' ? 'bg-red-900/20 border-red-600' :
                verificationResult.status === 'error' ? 'bg-red-900/20 border-red-600' :
                verificationResult.status === 'warning' ? 'bg-yellow-900/20 border-yellow-600' :
                verificationResult.status === 'invalid' ? 'bg-orange-900/20 border-orange-600' :
                'bg-slate-700 border-slate-600'
              }`}>
                <div className="flex items-center mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                    verificationResult.status === 'success' ? 'bg-green-600' :
                    verificationResult.status === 'failed' ? 'bg-red-600' :
                    verificationResult.status === 'error' ? 'bg-red-600' :
                    verificationResult.status === 'warning' ? 'bg-yellow-600' :
                    verificationResult.status === 'invalid' ? 'bg-orange-600' :
                    'bg-slate-600'
                  }`}>
                    {verificationResult.status === 'success' ? '✓' :
                     verificationResult.status === 'failed' ? '✗' :
                     verificationResult.status === 'error' ? '⚠' :
                     verificationResult.status === 'warning' ? '⚠' :
                     verificationResult.status === 'invalid' ? '!' : '?'}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold ${
                      verificationResult.status === 'success' ? 'text-green-400' :
                      verificationResult.status === 'failed' ? 'text-red-400' :
                      verificationResult.status === 'error' ? 'text-red-400' :
                      verificationResult.status === 'warning' ? 'text-yellow-400' :
                      verificationResult.status === 'invalid' ? 'text-orange-400' :
                      'text-white'
                    }">
                      {verificationResult.status === 'success' ? '验证成功' :
                       verificationResult.status === 'failed' ? '验证失败' :
                       verificationResult.status === 'error' ? '验证错误' :
                       verificationResult.status === 'warning' ? '验证警告' :
                       verificationResult.status === 'invalid' ? '验证无效' :
                       '验证中'}
                    </h3>
                    {verificationResult.errorMessage && (
                      <p className="text-slate-300 text-sm">{verificationResult.errorMessage}</p>
                    )}
                  </div>
                </div>
                
                {/* 详细结果信息 */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-300">交易所:</span>
                    <span className="text-white">{exchange}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-300">交易对:</span>
                    <span className="text-white">{useManualPair ? manualPair : pair}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-slate-300">订单号:</span>
                    <span className="text-white">{orderId}</span>
                  </div>
                  
                  {verificationResult.eligible !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-300">是否符合条件:</span>
                      <span className={`font-medium ${
                        verificationResult.eligible ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {verificationResult.eligible ? '是' : '否'}
                      </span>
                    </div>
                  )}
                  
                  {verificationResult.timestamp && (
                    <div className="flex justify-between">
                      <span className="text-slate-300">验证时间:</span>
                      <span className="text-white">{new Date(verificationResult.timestamp).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 详细结果列表 */}
              {verificationResult.details && verificationResult.details.length > 0 && (
                <div className="p-4 bg-slate-700 rounded-lg">
                  <h4 className="text-md font-semibold text-white mb-3">详细结果</h4>
                  <div className="space-y-2">
                    {verificationResult.details.map((detail, index) => (
                      <div key={index} className={`p-2 rounded ${
                        detail.severity === 'success' ? 'bg-green-900/20' :
                        detail.severity === 'warning' ? 'bg-yellow-900/20' :
                        detail.severity === 'error' ? 'bg-red-900/20' :
                        'bg-slate-600'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className={`text-sm font-medium ${
                            detail.severity === 'success' ? 'text-green-400' :
                            detail.severity === 'warning' ? 'text-yellow-400' :
                            detail.severity === 'error' ? 'text-red-400' :
                            'text-slate-300'
                          }`}>
                            {detail.code}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            detail.severity === 'success' ? 'bg-green-600 text-white' :
                            detail.severity === 'warning' ? 'bg-yellow-600 text-white' :
                            detail.severity === 'error' ? 'bg-red-600 text-white' :
                            'bg-slate-600 text-slate-300'
                          }`}>
                            {detail.severity === 'success' ? '成功' :
                             detail.severity === 'warning' ? '警告' :
                             detail.severity === 'error' ? '错误' : '信息'}
                          </span>
                        </div>
                        <p className="text-slate-300 text-sm mt-1">{detail.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* 操作按钮 */}
              <div className="flex justify-between">
                <button
                  onClick={() => setCurrentStep(4)}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-md"
                >
                  上一步
                </button>
                <div className="space-x-2">
                  {verificationResult.retryable && (
                    <button
                      onClick={handleVerifyOrder}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
                    >
                      重新验证
                    </button>
                  )}
                  <button
                    onClick={handleReset}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
                  >
                    重新开始验证
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}