import React, { useState, useEffect } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { getSkus, type Sku } from '../services/catalog';
import { createOrder } from '../services/order';
import { fetchOrderHistory, type OrderHistoryItem } from '../services/order';

type VerificationStatus = 'not_started' | 'verifying' | 'verified' | 'failed';
type OrderStatus = 'not_created' | 'creating' | 'created' | 'failed';

export function NewVerificationFlowPage() {
  const { account, isConnected } = useWallet();
  const [skus, setSkus] = useState<Sku[]>([]);
  const [selectedSku, setSelectedSku] = useState<Sku | null>(null);
  const [orderId, setOrderId] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('not_started');
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('not_created');
  const [orders, setOrders] = useState<OrderHistoryItem[]>([]);
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

  // 加载订单历史
  useEffect(() => {
    if (isConnected && account) {
      loadOrderHistory();
    }
  }, [isConnected, account]);

  const loadOrderHistory = async () => {
    if (!account) return;
    
    try {
      const result = await fetchOrderHistory(account);
      setOrders(result);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  };

  // 模拟验证过程
  const handleVerification = async () => {
    if (!orderId.trim()) {
      setError('请输入订单号');
      return;
    }

    setVerificationStatus('verifying');
    setError('');

    // 模拟验证过程
    setTimeout(() => {
      // 随机决定验证结果（80%成功率）
      const isSuccess = Math.random() > 0.2;
      
      if (isSuccess) {
        setVerificationStatus('verified');
        setSuccess('订单验证成功！');
        
        // 保存验证状态到本地存储
        if (account) {
          const verificationKey = `verification_${account}_${orderId}`;
          localStorage.setItem(verificationKey, JSON.stringify({
            verified: true,
            timestamp: Date.now(),
            orderId: orderId
          }));
        }
      } else {
        setVerificationStatus('failed');
        setError('订单验证失败，请检查订单号是否正确');
      }
    }, 2000);
  };

  // 检查验证状态
  const checkVerificationStatus = (): boolean => {
    if (!account || !orderId.trim()) return false;
    
    const verificationKey = `verification_${account}_${orderId}`;
    const verificationData = localStorage.getItem(verificationKey);
    
    if (!verificationData) return false;
    
    try {
      const data = JSON.parse(verificationData);
      // 检查验证是否在24小时内有效
      const isRecent = Date.now() - data.timestamp < 24 * 60 * 60 * 1000;
      return data.verified && isRecent;
    } catch {
      return false;
    }
  };

  // 创建订单
  const handleCreateOrder = async () => {
    if (!account) {
      setError('请先连接钱包');
      return;
    }

    if (!checkVerificationStatus()) {
      setError('请先完成订单验证');
      return;
    }

    if (!selectedSku) {
      setError('请选择保险产品');
      return;
    }

    setOrderStatus('creating');
    setError('');

    try {
      const payload = {
        skuId: selectedSku.id,
        exchange: selectedSku.exchange,
        pair: 'BTCUSDT',
        orderRef: orderId,
        wallet: account,
        premium: selectedSku.premium,
        payout: selectedSku.payout,
        paymentMethod: 'wallet' as 'wallet' | 'card',
      };

      const result = await createOrder(payload);
      setOrderStatus('created');
      setSuccess(`订单创建成功！订单ID: ${result.orderId}`);
      
      // 清除验证状态
      localStorage.removeItem(`verification_${account}_${orderId}`);
      
      // 重新加载订单历史
      await loadOrderHistory();
    } catch (err: any) {
      setOrderStatus('failed');
      setError(err.message || '订单创建失败');
    }
  };

  // 重置流程
  const resetFlow = () => {
    setVerificationStatus('not_started');
    setOrderStatus('not_created');
    setError('');
    setSuccess('');
    setOrderId('');
    setSelectedSku(null);
  };

  const formatCurrency = (amount: number) => {
    return (amount / 100).toFixed(2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-12">
        {/* 页面标题 */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            新验证流程
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            完整的保险购买流程：验证订单 → 选择产品 → 下单购买 → 管理订单
          </p>
        </div>

        {/* 流程步骤指示器 */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="flex justify-between items-center">
            {[
              { step: 1, label: '连接钱包', status: isConnected ? 'completed' : 'pending' },
              { step: 2, label: '订单验证', status: verificationStatus === 'verified' ? 'completed' : verificationStatus === 'verifying' ? 'active' : 'pending' },
              { step: 3, label: '选择产品', status: selectedSku ? 'completed' : 'pending' },
              { step: 4, label: '下单购买', status: orderStatus === 'created' ? 'completed' : orderStatus === 'creating' ? 'active' : 'pending' }
            ].map(({ step, label, status }) => (
              <div key={step} className="flex flex-col items-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                  status === 'completed' ? 'bg-green-500' :
                  status === 'active' ? 'bg-blue-500 animate-pulse' :
                  'bg-slate-600'
                }`}>
                  {status === 'completed' ? '✓' : step}
                </div>
                <span className="mt-2 text-sm text-slate-300">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 钱包连接状态 */}
        {!isConnected && (
          <div className="max-w-4xl mx-auto bg-slate-800/50 rounded-2xl border border-slate-700 p-8 mb-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-white mb-4">请先连接钱包</h2>
              <p className="text-slate-300 mb-6">连接钱包后即可开始验证流程</p>
              <a 
                href="/" 
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-3 px-8 rounded-xl transition-all duration-300"
              >
                连接钱包
              </a>
            </div>
          </div>
        )}

        {/* 主流程内容 */}
        {isConnected && (
          <div className="max-w-4xl mx-auto">
            {/* 验证步骤 */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8 mb-8">
              <h2 className="text-2xl font-semibold text-white mb-6">1. 订单验证</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    订单号
                  </label>
                  <input
                    type="text"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    placeholder="请输入您的交易订单号"
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    disabled={verificationStatus === 'verifying'}
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleVerification}
                    disabled={!orderId.trim() || verificationStatus === 'verifying'}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300"
                  >
                    {verificationStatus === 'verifying' ? '验证中...' : '开始验证'}
                  </button>
                  
                  {verificationStatus !== 'not_started' && (
                    <button
                      onClick={resetFlow}
                      className="px-6 py-3 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
                    >
                      重置
                    </button>
                  )}
                </div>

                {/* 验证状态显示 */}
                {verificationStatus === 'verified' && (
                  <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
                    <div className="flex items-center text-green-400">
                      <span className="text-lg mr-2">✓</span>
                      <span>订单验证成功！可以继续下一步</span>
                    </div>
                  </div>
                )}

                {verificationStatus === 'failed' && (
                  <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
                    <div className="flex items-center text-red-400">
                      <span className="text-lg mr-2">✗</span>
                      <span>订单验证失败，请检查订单号是否正确</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 产品选择步骤 */}
            {verificationStatus === 'verified' && (
              <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8 mb-8">
                <h2 className="text-2xl font-semibold text-white mb-6">2. 选择保险产品</h2>
                
                <div className="grid gap-6 md:grid-cols-2">
                  {skus.map((sku) => (
                    <div 
                      key={sku.id}
                      className={`p-6 rounded-xl border-2 cursor-pointer transition-all duration-300 ${
                        selectedSku?.id === sku.id 
                          ? 'border-indigo-500 bg-indigo-500/10' 
                          : 'border-slate-600 bg-slate-700/50 hover:border-slate-500'
                      }`}
                      onClick={() => setSelectedSku(sku)}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">{sku.title}</h3>
                        <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-sm rounded-full">
                          {sku.exchange}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-slate-400">保费:</span>
                          <span className="text-white font-semibold">${formatCurrency(sku.premium)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">赔付金额:</span>
                          <span className="text-emerald-400 font-semibold">${formatCurrency(sku.payout)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">保障期限:</span>
                          <span className="text-white">24小时</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {skus.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-slate-400">暂无可用产品</p>
                  </div>
                )}
              </div>
            )}

            {/* 下单步骤 */}
            {selectedSku && verificationStatus === 'verified' && (
              <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8 mb-8">
                <h2 className="text-2xl font-semibold text-white mb-6">3. 确认下单</h2>
                
                <div className="space-y-6">
                  {/* 订单摘要 */}
                  <div className="bg-slate-700/30 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">订单摘要</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <span className="text-slate-400">产品:</span>
                        <span className="text-white ml-2">{selectedSku.title}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">交易所:</span>
                        <span className="text-white ml-2">{selectedSku.exchange}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">保费:</span>
                        <span className="text-white ml-2">${formatCurrency(selectedSku.premium)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">赔付金额:</span>
                        <span className="text-emerald-400 ml-2">${formatCurrency(selectedSku.payout)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 下单按钮 */}
                  <button
                    onClick={handleCreateOrder}
                    disabled={orderStatus === 'creating'}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-slate-600 disabled:to-slate-600 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-300"
                  >
                    {orderStatus === 'creating' ? '创建订单中...' : '确认下单'}
                  </button>
                </div>
              </div>
            )}

            {/* 成功/错误消息 */}
            {error && (
              <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg mb-8">
                <div className="flex items-center text-red-400">
                  <span className="text-lg mr-2">✗</span>
                  <span>{error}</span>
                </div>
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg mb-8">
                <div className="flex items-center text-green-400">
                  <span className="text-lg mr-2">✓</span>
                  <span>{success}</span>
                </div>
              </div>
            )}

            {/* 订单历史 */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-8">
              <h2 className="text-2xl font-semibold text-white mb-6">订单历史</h2>
              
              {orders.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-700">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300 uppercase tracking-wider">订单ID</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300 uppercase tracking-wider">交易所</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300 uppercase tracking-wider">交易对</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300 uppercase tracking-wider">保费</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300 uppercase tracking-wider">赔付金额</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300 uppercase tracking-wider">状态</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-300 uppercase tracking-wider">创建时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-4 py-3 text-sm text-slate-300 font-mono">{order.id.substring(0, 8)}...</td>
                          <td className="px-4 py-3 text-sm text-slate-300">{order.exchange}</td>
                          <td className="px-4 py-3 text-sm text-slate-300">{order.pair}</td>
                          <td className="px-4 py-3 text-sm text-slate-300">${formatCurrency(order.premium)}</td>
                          <td className="px-4 py-3 text-sm text-slate-300">${formatCurrency(order.payout)}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              order.status === 'created' ? 'bg-green-900 text-green-200' :
                              order.status === 'pending' ? 'bg-yellow-900 text-yellow-200' :
                              'bg-slate-700 text-slate-300'
                            }`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-300">{formatDate(order.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-400">暂无订单记录</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}