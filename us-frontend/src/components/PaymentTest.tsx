import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { createUSDCPaymentService } from '../services/usdcPayment';

/**
 * 支付测试组件 - 用于验证Permit2签名流程和USDC支付回退
 */
export function PaymentTest() {
  const { account, isConnected, ethereumProvider } = useWallet();
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testAmount, setTestAmount] = useState('1'); // 1 USDC

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${result}`]);
  };

  const runPaymentTest = async () => {
    if (!isConnected || !account || !ethereumProvider) {
      addTestResult('❌ 请先连接钱包');
      return;
    }

    setIsTesting(true);
    setTestResults([]);

    try {
      addTestResult('🚀 开始支付测试...');
      
      const paymentService = createUSDCPaymentService(ethereumProvider);
      const amount = parseFloat(testAmount) * 1000000; // 转换为6位小数
      const orderId = `test_${Date.now()}`;

      // 测试1: 检查钱包是否支持Permit2
      addTestResult('🔍 检查钱包Permit2支持...');
      const supportsPermit2 = await paymentService.supportsPermit2();
      addTestResult(supportsPermit2 ? '✅ 钱包支持Permit2' : '⚠️ 钱包不支持Permit2，将使用回退方案');

      // 测试2: 检查USDC余额
      addTestResult('💰 检查USDC余额...');
      const balance = await paymentService.getUSDCBalance(account);
      addTestResult(`📊 USDC余额: ${(balance / 1000000).toFixed(6)} USDC`);

      if (balance < amount) {
        addTestResult('❌ USDC余额不足，无法继续测试');
        return;
      }

      // 测试3: 执行智能支付
      addTestResult('💳 执行智能支付...');
      const result = await paymentService.smartPayment(amount, orderId);

      if (result.success) {
        addTestResult(`✅ 支付成功！方法: ${result.methodUsed}`);
        if (result.transactionHash) {
          addTestResult(`🔗 交易哈希: ${result.transactionHash}`);
        }
      } else {
        addTestResult(`❌ 支付失败: ${result.error}`);
      }

      // 测试4: 订单去重检查
      addTestResult('🔄 测试订单去重机制...');
      const duplicateResult = await paymentService.smartPayment(amount, orderId);
      if (!duplicateResult.success && duplicateResult.error?.includes('订单已处理')) {
        addTestResult('✅ 订单去重机制工作正常');
      } else {
        addTestResult('❌ 订单去重机制异常');
      }

      // 测试5: 金额校验
      addTestResult('⚖️ 测试金额校验...');
      const zeroAmountResult = await paymentService.smartPayment(0, `zero_${Date.now()}`);
      if (!zeroAmountResult.success && zeroAmountResult.error?.includes('金额必须大于0')) {
        addTestResult('✅ 金额校验工作正常');
      } else {
        addTestResult('❌ 金额校验异常');
      }

      addTestResult('🎉 测试完成！');

    } catch (error: any) {
      addTestResult(`💥 测试过程中发生错误: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-slate-800 rounded-xl">
      <h2 className="text-2xl font-bold text-white mb-6">USDC支付测试</h2>
      
      <div className="space-y-4">
        {/* 测试配置 */}
        <div className="bg-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">测试配置</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                测试金额 (USDC)
              </label>
              <input
                type="number"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                min="0.000001"
                step="0.000001"
                className="w-full px-3 py-2 bg-slate-600 border border-slate-500 rounded-md text-white"
                placeholder="输入测试金额"
              />
            </div>
            
            <div className="flex items-end">
              <button
                onClick={runPaymentTest}
                disabled={!isConnected || isTesting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                {isTesting ? '测试中...' : '开始测试'}
              </button>
            </div>
          </div>
          
          <div className="mt-3 text-sm text-slate-400">
            💡 建议使用小额USDC进行测试（如0.001 USDC）
          </div>
        </div>

        {/* 钱包状态 */}
        <div className="bg-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">钱包状态</h3>
          <div className="text-slate-300 space-y-2">
            <div>连接状态: {isConnected ? '✅ 已连接' : '❌ 未连接'}</div>
            {account && (
              <div className="font-mono text-sm break-all">
                地址: {account}
              </div>
            )}
          </div>
        </div>

        {/* 测试结果 */}
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-white">测试结果</h3>
            {testResults.length > 0 && (
              <button
                onClick={clearResults}
                className="text-slate-400 hover:text-white text-sm"
              >
                清除结果
              </button>
            )}
          </div>
          
          {testResults.length > 0 ? (
            <div className="bg-slate-800 rounded-md p-3 max-h-64 overflow-y-auto">
              {testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono mb-2 last:mb-0">
                  {result}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-center py-8">
              暂无测试结果，点击"开始测试"按钮开始验证
            </div>
          )}
        </div>

        {/* 功能说明 */}
        <div className="bg-slate-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3">测试功能说明</h3>
          <div className="text-slate-300 space-y-2 text-sm">
            <div>✅ <strong>Permit2支持检测</strong> - 检查钱包是否支持Permit2签名</div>
            <div>✅ <strong>USDC余额检查</strong> - 验证用户USDC余额是否充足</div>
            <div>✅ <strong>智能支付流程</strong> - 优先Permit2，失败时回退传统USDC</div>
            <div>✅ <strong>订单去重机制</strong> - 防止重复支付</div>
            <div>✅ <strong>金额校验</strong> - 确保支付金额有效性</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaymentTest;