import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { createOrder } from '../services/order';
import { getSkus } from '../services/catalog';
import type { Sku } from '../services/catalog';

export function CreateOrderPage() {
  const { account } = useWallet();
  const [skus, setSkus] = useState<Sku[]>([]);
  const [selectedSku, setSelectedSku] = useState<Sku | null>(null);
  const [orderId, setOrderId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 加载产品列表
  useEffect(() => {
    const loadSkus = async () => {
      try {
        const skuList = await getSkus();
        setSkus(skuList);
      } catch (err) {
        console.error('Failed to load SKUs:', err);
      }
    };
    loadSkus();
  }, []);

  // 检查验证状态
  const checkVerificationStatus = (wallet: string, orderId: string): boolean => {
    const verificationKey = `verification_${wallet}_${orderId}`;
    const verificationData = localStorage.getItem(verificationKey);
    
    if (!verificationData) {
      return false;
    }
    
    try {
      const data = JSON.parse(verificationData);
      // 检查验证是否在24小时内有效
      const isRecent = Date.now() - data.timestamp < 24 * 60 * 60 * 1000;
      return data.verified && isRecent;
    } catch {
      return false;
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 前置条件检查：必须1 - 链接钱包
    if (!account) {
      setError('请先链接钱包');
      return;
    }
    
    // 前置条件检查：必须2 - 验证通过
    if (!orderId.trim()) {
      setError('请输入订单号');
      return;
    }
    
    if (!checkVerificationStatus(account, orderId)) {
      setError('订单验证未通过或已过期，请先完成订单验证');
      return;
    }
    
    if (!selectedSku) {
      setError('请选择保险产品');
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        skuId: selectedSku.id,
        exchange: selectedSku.exchange,
        pair: 'BTCUSDT', // 默认交易对
        orderRef: orderId,
        wallet: account,
        premium: selectedSku.premium,
        payout: selectedSku.payout,
        paymentMethod: 'wallet' as 'wallet' | 'card',
      };

      const result = await createOrder(payload);
      setSuccess(`订单创建成功！订单ID: ${result.orderId}`);
      
      // 清除验证状态，避免重复使用
      localStorage.removeItem(`verification_${wallet}_${orderId}`);
      
      // 重置表单
      setOrderId('');
      setSelectedSku(null);
    } catch (err: any) {
      setError(err.message || '订单创建失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-white mb-8">创建保险订单</h1>
      
      {/* 流程说明 */}
      <div className="bg-slate-800 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-white mb-4">下单流程</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-blue-600 rounded-lg p-4">
            <div className="text-white font-bold text-lg mb-2">步骤1</div>
            <div className="text-slate-200">链接钱包</div>
          </div>
          <div className="bg-blue-600 rounded-lg p-4">
            <div className="text-white font-bold text-lg mb-2">步骤2</div>
            <div className="text-slate-200">订单验证</div>
          </div>
          <div className="bg-green-600 rounded-lg p-4">
            <div className="text-white font-bold text-lg mb-2">步骤3</div>
            <div className="text-slate-200">下单购买</div>
          </div>
        </div>
        <p className="text-slate-300 mt-4 text-sm">
          注意：下单购买前必须完成钱包链接和订单验证两个步骤
        </p>
      </div>
      
      {/* 钱包状态 */}
      <div className="bg-slate-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">钱包状态</h3>
            <p className="text-slate-300">
              {account ? '✅ 钱包已连接' : '❌ 钱包未连接'}
            </p>
            {account && (
              <p className="text-slate-400 text-sm font-mono break-all mt-1">
                {account}
              </p>
            )}
          </div>
          {!account && (
            <a 
              href="/" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
            >
              连接钱包
            </a>
          )}
        </div>
      </div>
      
      {/* 验证状态 */}
      <div className="bg-slate-800 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">验证状态</h3>
            <p className="text-slate-300">
              {account && orderId && checkVerificationStatus(account, orderId) 
                ? '✅ 订单验证已通过' 
                : '❌ 订单验证未通过'}
            </p>
            {account && orderId && !checkVerificationStatus(account, orderId) && (
              <p className="text-slate-400 text-sm mt-1">
                请先完成订单验证
              </p>
            )}
          </div>
          <a 
            href="/verify" 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors"
          >
            去验证
          </a>
        </div>
      </div>
      
      {/* 订单创建表单 */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">创建订单</h2>
        
        <form onSubmit={handleCreateOrder} className="space-y-4">
          {/* 产品选择 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              选择保险产品
            </label>
            <select 
              value={selectedSku?.id || ''}
              onChange={(e) => {
                const sku = skus.find(s => s.id === e.target.value);
                setSelectedSku(sku || null);
              }}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
              required
            >
              <option value="">请选择产品</option>
              {skus.map(sku => (
                <option key={sku.id} value={sku.id}>
                  {sku.title}
                </option>
              ))}
            </select>
          </div>
          
          {/* 订单号输入 */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              已验证的订单号
            </label>
            <input 
              type="text" 
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="请输入已验证的订单号"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white"
              required
            />
          </div>
          
          {/* 产品信息显示 */}
          {selectedSku && (
            <div className="bg-slate-700 rounded-lg p-4">
              <h4 className="text-white font-semibold mb-2">产品信息</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-slate-300">产品名称:</div>
                <div className="text-white">{selectedSku.title}</div>
                <div className="text-slate-300">保费:</div>
                <div className="text-white">{selectedSku.premium} USDC</div>
                <div className="text-slate-300">赔付金额:</div>
                <div className="text-white">{selectedSku.payout} USDC</div>
                <div className="text-slate-300">交易所:</div>
                <div className="text-white">{selectedSku.exchange}</div>
              </div>
            </div>
          )}
          
          <button 
            type="submit"
            disabled={isLoading || !account || !orderId || !selectedSku || !checkVerificationStatus(account, orderId)}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-medium py-2 px-4 rounded-md transition-colors"
          >
            {isLoading ? '创建中...' : '创建订单'}
          </button>
        </form>
      </div>
      
      {error && (
        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg mt-6">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-900 border border-green-700 text-green-200 px-4 py-3 rounded-lg mt-6">
          {success}
        </div>
      )}
    </div>
  );
}