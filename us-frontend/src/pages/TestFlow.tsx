import React, { useState, useEffect } from 'react';
import { submitVerification } from '../services/verify';
import type { ExchangeId, TradingPairId } from '../config/verification';
import { TRADING_PAIR_OPTIONS } from '../config/verification';

/**
 * 测试流程页面 - 专门用于测试完整流程的独立页面
 * 提供逐步测试功能，便于开发和调试
 */
export function TestFlowPage() {
  // 测试流程状态
  const [currentStep, setCurrentStep] = useState(1); // 1: 基本信息, 2: API配置, 3: 订单验证, 4: 结果分析
  
  // 测试数据状态
  const [testData, setTestData] = useState({
    wallet: '0x' + Math.random().toString(16).substr(2, 40), // 随机生成测试钱包
    exchange: 'Binance' as ExchangeId,
    pair: '',
    orderId: '',
    apiKeys: {
      binanceApiKey: '',
      binanceSecretKey: '',
      okxApiKey: '',
      okxSecretKey: '',
      okxPassphrase: ''
    }
  });

  // 测试结果状态
  const [testResults, setTestResults] = useState<Array<{
    step: string;
    status: 'success' | 'error' | 'warning';
    message: string;
    timestamp: number;
    details?: any;
  }>>([]);

  const [isTesting, setIsTesting] = useState(false);
  const [currentTest, setCurrentTest] = useState('');

  // 支持的交易所列表
  const exchanges: ExchangeId[] = ['Binance', 'OKX'];

  /**
   * 添加测试结果
   */
  const addTestResult = (step: string, status: 'success' | 'error' | 'warning', message: string, details?: any) => {
    setTestResults(prev => [...prev, {
      step,
      status,
      message,
      timestamp: Date.now(),
      details
    }]);
  };

  /**
   * 步骤1: 基本信息配置
   */
  const handleStep1Complete = () => {
    addTestResult('基本信息配置', 'success', '测试数据配置完成');
    setCurrentStep(2);
  };

  /**
   * 步骤2: API配置测试
   */
  const handleStep2Complete = async () => {
    setIsTesting(true);
    setCurrentTest('API配置验证');
    
    try {
      // 模拟API配置验证
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (testData.exchange === 'Binance' && !testData.apiKeys.binanceApiKey) {
        addTestResult('API配置验证', 'error', 'Binance API密钥未配置');
        return;
      }
      
      if (testData.exchange === 'OKX' && !testData.apiKeys.okxApiKey) {
        addTestResult('API配置验证', 'error', 'OKX API密钥未配置');
        return;
      }
      
      addTestResult('API配置验证', 'success', 'API配置验证通过');
      setCurrentStep(3);
    } catch (error) {
      addTestResult('API配置验证', 'error', 'API配置验证失败', error);
    } finally {
      setIsTesting(false);
      setCurrentTest('');
    }
  };

  /**
   * 步骤3: 订单验证测试
   */
  const handleStep3Complete = async () => {
    if (!testData.pair || !testData.orderId) {
      addTestResult('订单验证', 'error', '请填写完整的订单信息');
      return;
    }

    setIsTesting(true);
    setCurrentTest('订单验证');

    try {
      // 模拟订单验证过程
      addTestResult('订单验证', 'success', '订单信息格式验证通过');
      
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 模拟验证结果
      const mockResult = {
        status: 'ok',
        exchange: testData.exchange.toLowerCase(),
        pair: testData.pair,
        orderRef: testData.orderId,
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
        }
      };

      addTestResult('订单验证', 'success', '订单验证成功', mockResult);
      setCurrentStep(4);
    } catch (error) {
      addTestResult('订单验证', 'error', '订单验证失败', error);
    } finally {
      setIsTesting(false);
      setCurrentTest('');
    }
  };

  /**
   * 重置测试流程
   */
  const handleReset = () => {
    setCurrentStep(1);
    setTestResults([]);
    setTestData({
      wallet: '0x' + Math.random().toString(16).substr(2, 40),
      exchange: 'Binance',
      pair: '',
      orderId: '',
      apiKeys: {
        binanceApiKey: '',
        binanceSecretKey: '',
        okxApiKey: '',
        okxSecretKey: '',
        okxPassphrase: ''
      }
    });
  };

  /**
   * 根据选择的交易所过滤可用的交易对
   */
  const getAvailablePairs = () => {
    return TRADING_PAIR_OPTIONS.filter(pair => pair.exchangeId === testData.exchange);
  };

  /**
   * 更新测试数据
   */
  const updateTestData = (field: string, value: any) => {
    setTestData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  /**
   * 更新API密钥数据
   */
  const updateApiKeys = (field: string, value: string) => {
    setTestData(prev => ({
      ...prev,
      apiKeys: {
        ...prev.apiKeys,
        [field]: value
      }
    }));
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-6 text-center">
        测试流程页面
      </h1>
      <p className="text-slate-400 text-center mb-8">
        这是一个专门用于测试完整流程的独立页面，便于开发和调试
      </p>

      {/* 进度指示器 */}
      <div className="flex justify-center mb-8">
        <div className="flex space-x-4">
          {[1, 2, 3, 4].map(step => (
            <div key={step} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold ${
                step === currentStep 
                  ? 'bg-blue-600 text-white' 
                  : step < currentStep 
                    ? 'bg-green-600 text-white' 
                    : 'bg-slate-600 text-slate-300'
              }`}>
                {step}
              </div>
              {step < 4 && (
                <div className={`w-20 h-1 mx-2 ${
                  step < currentStep ? 'bg-green-600' : 'bg-slate-600'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 步骤标签 */}
      <div className="flex justify-between mb-8 text-sm text-slate-400">
        <span className={currentStep >= 1 ? 'text-blue-400 font-semibold' : ''}>基本信息</span>
        <span className={currentStep >= 2 ? 'text-blue-400 font-semibold' : ''}>API配置</span>
        <span className={currentStep >= 3 ? 'text-blue-400 font-semibold' : ''}>订单验证</span>
        <span className={currentStep >= 4 ? 'text-blue-400 font-semibold' : ''}>结果分析</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：测试步骤面板 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 步骤1: 基本信息配置 */}
          {currentStep === 1 && (
            <div className="bg-slate-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">步骤1: 基本信息配置</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    测试钱包地址
                  </label>
                  <input
                    type="text"
                    value={testData.wallet}
                    onChange={(e) => updateTestData('wallet', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                    placeholder="请输入测试钱包地址"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    交易所
                  </label>
                  <select 
                    value={testData.exchange} 
                    onChange={(e) => updateTestData('exchange', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
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
                  <input
                    type="text"
                    value={testData.pair}
                    onChange={(e) => updateTestData('pair', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                    placeholder="请输入交易对，如：BTC-USDT-SWAP"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    支持的交易对：BTC-USDT-SWAP, BTC-USDC-SWAP, BTCUSDT, BTCUSDC
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    订单号
                  </label>
                  <input
                    type="text"
                    value={testData.orderId}
                    onChange={(e) => updateTestData('orderId', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                    placeholder="请输入测试订单号"
                  />
                </div>

                <button
                  onClick={handleStep1Complete}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-md font-medium"
                >
                  下一步：API配置
                </button>
              </div>
            </div>
          )}

          {/* 步骤2: API配置测试 */}
          {currentStep === 2 && (
            <div className="bg-slate-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">步骤2: API配置测试</h2>
              
              <div className="space-y-4">
                {testData.exchange === 'Binance' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Binance API Key
                      </label>
                      <input
                        type="text"
                        value={testData.apiKeys.binanceApiKey}
                        onChange={(e) => updateApiKeys('binanceApiKey', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                        placeholder="请输入Binance API Key"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Binance Secret Key
                      </label>
                      <input
                        type="password"
                        value={testData.apiKeys.binanceSecretKey}
                        onChange={(e) => updateApiKeys('binanceSecretKey', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                        placeholder="请输入Binance Secret Key"
                      />
                    </div>
                  </>
                )}

                {testData.exchange === 'OKX' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        OKX API Key
                      </label>
                      <input
                        type="text"
                        value={testData.apiKeys.okxApiKey}
                        onChange={(e) => updateApiKeys('okxApiKey', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                        placeholder="请输入OKX API Key"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        OKX Secret Key
                      </label>
                      <input
                        type="password"
                        value={testData.apiKeys.okxSecretKey}
                        onChange={(e) => updateApiKeys('okxSecretKey', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                        placeholder="请输入OKX Secret Key"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        OKX Passphrase
                      </label>
                      <input
                        type="password"
                        value={testData.apiKeys.okxPassphrase}
                        onChange={(e) => updateApiKeys('okxPassphrase', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
                        placeholder="请输入OKX Passphrase"
                      />
                    </div>
                  </>
                )}

                <div className="flex space-x-4">
                  <button
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 bg-slate-600 hover:bg-slate-700 text-white px-4 py-3 rounded-md"
                  >
                    上一步
                  </button>
                  <button
                    onClick={handleStep2Complete}
                    disabled={isTesting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-md disabled:opacity-50"
                  >
                    {isTesting ? '测试中...' : '测试API配置'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 步骤3: 订单验证测试 */}
          {currentStep === 3 && (
            <div className="bg-slate-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">步骤3: 订单验证测试</h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-slate-700 rounded-md">
                  <h3 className="text-slate-300 font-medium mb-2">测试信息摘要</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-400">钱包:</span> {testData.wallet}</div>
                    <div><span className="text-slate-400">交易所:</span> {testData.exchange}</div>
                    <div><span className="text-slate-400">交易对:</span> {testData.pair}</div>
                    <div><span className="text-slate-400">订单号:</span> {testData.orderId}</div>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="flex-1 bg-slate-600 hover:bg-slate-700 text-white px-4 py-3 rounded-md"
                  >
                    上一步
                  </button>
                  <button
                    onClick={handleStep3Complete}
                    disabled={isTesting}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-md disabled:opacity-50"
                  >
                    {isTesting ? '验证中...' : '开始订单验证'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 步骤4: 结果分析 */}
          {currentStep === 4 && (
            <div className="bg-slate-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">步骤4: 测试结果分析</h2>
              
              <div className="space-y-4">
                <div className="p-4 bg-green-900/20 border border-green-600 rounded-md">
                  <h3 className="text-green-400 font-semibold mb-2">测试完成</h3>
                  <p className="text-green-300">所有测试步骤已成功完成</p>
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={handleReset}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-md"
                  >
                    重新开始测试
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 右侧：测试结果面板 */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800 rounded-lg p-6 h-full">
            <h3 className="text-lg font-semibold text-white mb-4">测试结果</h3>
            
            {isTesting && (
              <div className="mb-4 p-3 bg-blue-900/20 border border-blue-600 rounded-md">
                <p className="text-blue-400">🔄 正在执行: {currentTest}</p>
              </div>
            )}

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {testResults.length === 0 ? (
                <p className="text-slate-400 text-center py-8">暂无测试结果</p>
              ) : (
                testResults.map((result, index) => (
                  <div key={index} className={`p-3 rounded-md ${
                    result.status === 'success' ? 'bg-green-900/20 border border-green-600' :
                    result.status === 'error' ? 'bg-red-900/20 border border-red-600' :
                    'bg-yellow-900/20 border border-yellow-600'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-white">{result.step}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        result.status === 'success' ? 'bg-green-600 text-white' :
                        result.status === 'error' ? 'bg-red-600 text-white' :
                        'bg-yellow-600 text-black'
                      }`}>
                        {result.status === 'success' ? '成功' : result.status === 'error' ? '错误' : '警告'}
                      </span>
                    </div>
                    <p className={`text-sm ${
                      result.status === 'success' ? 'text-green-300' :
                      result.status === 'error' ? 'text-red-300' :
                      'text-yellow-300'
                    }`}>
                      {result.message}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 调试信息 */}
      <div className="mt-8 p-4 bg-slate-900 rounded text-xs text-slate-400">
        <h3 className="font-mono mb-2">调试信息:</h3>
        <pre className="whitespace-pre-wrap">
          当前步骤: {currentStep}\n
          测试状态: {isTesting ? '进行中' : '空闲'}\n
          测试结果数量: {testResults.length}\n
          测试数据: {JSON.stringify(testData, null, 2)}
        </pre>
      </div>
    </div>
  );
}