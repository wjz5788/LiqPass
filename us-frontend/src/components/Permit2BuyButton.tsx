import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { createUSDCPaymentService, type PaymentResult } from '../services/usdcPayment';
import type { Sku } from '../services/catalog';

interface Permit2BuyButtonProps {
  sku: Sku;
  onPaymentComplete?: (result: PaymentResult) => void;
  onPaymentError?: (error: string) => void;
}

/**
 * 支持Permit2的购买按钮组件
 * 实现Permit2优先策略，失败时回退到传统USDC支付
 */
export function Permit2BuyButton({ sku, onPaymentComplete, onPaymentError }: Permit2BuyButtonProps) {
  const { account, isConnected, ethereumProvider } = useWallet();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');

  const handleBuyClick = async () => {
    if (!isConnected || !account || !ethereumProvider) {
      onPaymentError?.('请先连接钱包');
      return;
    }

    setIsProcessing(true);
    setPaymentStatus('准备支付...');

    try {
      // 创建USDC支付服务实例
      const paymentService = createUSDCPaymentService(ethereumProvider);
      
      // 生成唯一订单ID
      const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // 保费金额（USDC，6位小数）
      const premiumAmount = sku.premium; // 假设保费已经是USDC金额
      
      setPaymentStatus('检查钱包支持...');
      
      // 检查钱包是否支持Permit2
      const supportsPermit2 = await paymentService.supportsPermit2();
      
      if (supportsPermit2) {
        setPaymentStatus('使用Permit2支付...');
      } else {
        setPaymentStatus('使用传统USDC支付...');
      }
      
      // 执行智能支付
      const result = await paymentService.smartPayment(premiumAmount, orderId);
      
      if (result.success) {
        setPaymentStatus(`支付成功！交易哈希: ${result.transactionHash?.slice(0, 10)}...`);
        onPaymentComplete?.(result);
        
        // 3秒后清除状态
        setTimeout(() => setPaymentStatus(''), 3000);
      } else {
        setPaymentStatus(`支付失败: ${result.error}`);
        onPaymentError?.(result.error || '支付失败');
        
        // 5秒后清除错误状态
        setTimeout(() => setPaymentStatus(''), 5000);
      }
      
    } catch (error: any) {
      console.error('Payment process failed:', error);
      const errorMessage = error.message || '支付过程发生错误';
      setPaymentStatus(`错误: ${errorMessage}`);
      onPaymentError?.(errorMessage);
      
      // 5秒后清除错误状态
      setTimeout(() => setPaymentStatus(''), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  // 获取支付状态样式
  const getStatusStyle = () => {
    if (paymentStatus.includes('成功')) {
      return 'bg-green-100 text-green-800 border-green-300';
    } else if (paymentStatus.includes('失败') || paymentStatus.includes('错误')) {
      return 'bg-red-100 text-red-800 border-red-300';
    } else {
      return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleBuyClick}
        disabled={!isConnected || isProcessing}
        className={`
          rounded-full px-5 py-2 text-sm font-medium text-white shadow-lg transition-all
          ${isProcessing 
            ? 'bg-indigo-400 cursor-not-allowed' 
            : 'bg-indigo-500 hover:bg-indigo-400 hover:shadow-indigo-700/30 transform hover:-translate-y-0.5'
          }
          disabled:opacity-50
        `}
      >
        {isProcessing ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            支付中...
          </div>
        ) : (
          '使用USDC购买'
        )}
      </button>
      
      {paymentStatus && (
        <div className={`
          text-xs px-3 py-2 rounded-lg border ${getStatusStyle()}
          transition-all duration-300
        `}>
          {paymentStatus}
        </div>
      )}
      
      {/* 支付方式说明 */}
      <div className="text-xs text-slate-400 mt-1">
        💡 优先使用Permit2一次签名支付，失败时自动回退到传统USDC支付
      </div>
    </div>
  );
}

/**
 * 增强的购买按钮组件，包含产品信息和支付状态
 */
export function EnhancedBuyButton({ sku }: { sku: Sku }) {
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);

  const handlePaymentComplete = (result: PaymentResult) => {
    setPaymentResult(result);
    console.log('Payment completed:', result);
    
    // 这里可以添加订单创建逻辑
    // 例如：调用后端API创建订单记录
  };

  const handlePaymentError = (error: string) => {
    console.error('Payment failed:', error);
    // 可以添加错误处理逻辑
  };

  return (
    <div className="p-4 bg-slate-800 rounded-xl flex items-center justify-between">
      <div className="flex-1">
        <strong className="text-white block mb-1">{sku.title}</strong>
        <div className="text-sm text-slate-400 space-y-1">
          <div>交易所: {sku.exchange}</div>
          <div>保费: ${(sku.premium / 100).toFixed(2)} USDC</div>
          <div>赔付金额: ${(sku.payout / 100).toFixed(2)} USDC</div>
        </div>
        
        {paymentResult && paymentResult.success && (
          <div className="mt-2 p-2 bg-green-900/20 border border-green-700 rounded text-green-400 text-xs">
            ✅ 支付成功！订单已创建
            {paymentResult.transactionHash && (
              <div className="mt-1 font-mono">
                交易: {paymentResult.transactionHash.slice(0, 16)}...
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="ml-4">
        <Permit2BuyButton 
          sku={sku}
          onPaymentComplete={handlePaymentComplete}
          onPaymentError={handlePaymentError}
        />
      </div>
    </div>
  );
}

export default Permit2BuyButton;