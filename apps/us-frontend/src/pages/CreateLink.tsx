import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { useToast } from '../contexts/ToastContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { Dictionary } from '../types';
import { buildLink } from '../utils';

interface CreateLinkProps {
  t: Dictionary;
}

export const CreateLink: React.FC = () => {
  const navigate = useNavigate();
  const { push } = useToast();
  const { address } = useWallet();
  
  const [formData, setFormData] = useState({
    product: '',
    symbol: '',
    amount: '',
    duration: ''
  });

  const normalizeSymbol = (input: string): string => {
    const raw = String(input || '').trim();
    if (!raw) return raw;
    const low = raw.toLowerCase().replace(/\s+/g, '');
    if (low === 'btuusdc') return 'BTCUSDC';
    if (raw.includes('-')) {
      const parts = raw.split('-').map(p => p.trim().toUpperCase()).filter(Boolean);
      if (parts.length >= 2) return `${parts[0]}${parts[1]}`;
    }
    return raw.toUpperCase();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateLink = async () => {
    if (!address) {
      push({ title: t.walletRequired, type: 'error' });
      return;
    }

    if (!formData.product || !formData.symbol || !formData.amount || !formData.duration) {
      push({ title: t.fillAllFields, type: 'error' });
      return;
    }

    try {
      const response = await fetch('/api/v1/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Assuming you have a way to get the auth token
          // 'Authorization': `Bearer ${your_auth_token}`
        },
        body: JSON.stringify({
          product: formData.product,
          symbol: normalizeSymbol(formData.symbol),
          amount: parseFloat(formData.amount),
          duration: parseInt(formData.duration)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create link');
      }

      const { link } = await response.json();

      // 复制到剪贴板
      navigator.clipboard.writeText(link.url).then(() => {
        push({ title: t.linkCreated });
        navigate('/links');
      }).catch(() => {
        push({ title: t.copyFailed, type: 'error' });
      });

    } catch (error) {
      console.error('Error creating link:', error);
      push({ title: t.creationFailed, type: 'error' });
    }
  };

  const breadcrumbItems = [
    { label: '首页 / Home', to: '/' },
    { label: '创建链接 / Create Link' }
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Breadcrumb items={breadcrumbItems} />
      
      <div className="mt-6">
        <h1 className="text-3xl font-bold">创建支付链接 / Create Link</h1>
        <p className="mt-2 text-stone-600">填写产品参数生成支付链接 / Fill the form to generate a payment link</p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        {/* 表单区域 */}
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">产品 / Product</label>
              <Select
                value={formData.product}
                onChange={(e) => handleInputChange('product', e.target.value)}
              >
                <option value="">请选择产品 / Select product</option>
                <option value="24h">{t.productOption24h}</option>
                <option value="7d">{t.productOption7d}</option>
                <option value="30d">{t.productOption30d}</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">交易对 / Symbol</label>
              <Select
                value={formData.symbol}
                onChange={(e) => handleInputChange('symbol', e.target.value)}
              >
                <option value="">请选择交易对 / Select symbol</option>
                <option value="BTCUSDT">BTC/USDT</option>
                <option value="ETHUSDT">ETH/USDT</option>
                <option value="SOLUSDT">SOL/USDT</option>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">金额 / Amount</label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder={'请输入金额 / Enter amount'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">时长 / Duration</label>
              <Input
                type="number"
                value={formData.duration}
                onChange={(e) => handleInputChange('duration', e.target.value)}
                placeholder={'请输入时长（小时） / Enter duration (hours)'}
              />
            </div>

            <Button 
              onClick={handleCreateLink}
              disabled={!address}
              className="w-full"
            >
              {address ? '创建链接 / Create Link' : '请先连接钱包 / Connect wallet first'}
            </Button>
          </div>
        </Card>

        {/* 预览区域 */}
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">预览 / Preview</h3>
            
            {formData.product && formData.symbol && formData.amount && formData.duration ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">{t.product}:</span>
                  <span className="font-medium">{formData.product}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">{t.symbol}:</span>
                  <span className="font-medium">{formData.symbol}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">金额 / Amount:</span>
                  <span className="font-medium">{formData.amount} USDC</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-600">时长 / Duration:</span>
                  <span className="font-medium">{formData.duration} 小时 / hours</span>
                </div>
                
                <div className="mt-4 p-3 bg-stone-50 rounded text-xs font-mono break-all">
                  {buildLink(
                    formData.product,
                    normalizeSymbol(formData.symbol),
                    parseFloat(formData.amount),
                    parseInt(formData.duration)
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center text-stone-500 py-8">
                <div className="text-sm">填写表单以生成预览 / Fill the form to preview</div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
