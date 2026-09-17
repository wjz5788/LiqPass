import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { useToast } from '../contexts/ToastContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { Breadcrumb } from '../components/ui/Breadcrumb';
import { PaymentLink } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

// t 改由 LanguageContext 提供，不再作为 prop（App.tsx 从未传过这个 prop）

// 模拟数据
const mockLinks: PaymentLink[] = [
  {
    id: '1',
    product: '24h',
    symbol: 'BTCUSDT',
    amount: 20,
    duration: 24,
    url: 'https://liqpass.com/pay/1',
    createdAt: new Date('2024-01-15').getTime(),
    status: 'active',
    usageCount: 5
  },
  {
    id: '2',
    product: '7d',
    symbol: 'ETHUSDT',
    amount: 15,
    duration: 168,
    url: 'https://liqpass.com/pay/2',
    createdAt: new Date('2024-01-10').getTime(),
    status: 'active',
    usageCount: 2
  },
  {
    id: '3',
    product: '30d',
    symbol: 'SOLUSDT',
    amount: 10,
    duration: 720,
    url: 'https://liqpass.com/pay/3',
    createdAt: new Date('2024-01-05').getTime(),
    status: 'inactive',
    usageCount: 0
  }
];

export const Links: React.FC = () => {
  const { address } = useWallet();
  const { push } = useToast();
  const [links] = useState<PaymentLink[]>(mockLinks);

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      push({ title: '已复制链接 / Copied' });
    }).catch(() => {
      push({ title: '复制失败 / Copy failed', type: 'error' });
    });
  };

  const handleToggleStatus = (linkId: string, currentStatus: 'active' | 'inactive') => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    push({ 
      title: `链接 ${newStatus === 'active' ? '已激活' : '已停用'}`,
      type: 'success'
    });
  };

  const breadcrumbItems = [
    { label: '首页 / Home', to: '/' },
    { label: '支付链接 / Links' }
  ];

  const columns = [
    {
      key: 'product',
      label: '产品 / Product',
      render: (link: PaymentLink) => (
        <div>
          <div className="font-medium">{link.product}</div>
          <div className="text-sm text-stone-500">{link.symbol}</div>
        </div>
      )
    },
    {
      key: 'amount',
      label: '金额 / Amount',
      render: (link: PaymentLink) => (
        <div className="font-semibold">{link.amount} USDC</div>
      )
    },
    {
      key: 'duration',
      label: '时长 / Duration',
      render: (link: PaymentLink) => (
        <div>{link.duration} 小时</div>
      )
    },
    {
      key: 'status',
      label: '状态 / Status',
      render: (link: PaymentLink) => (
        <Badge 
          variant={link.status === 'active' ? 'success' : 'default'}
        >
          {link.status === 'active' ? '活跃 / Active' : '停用 / Inactive'}
        </Badge>
      )
    },
    {
      key: 'usage',
      label: '使用次数 / Usage',
      render: (link: PaymentLink) => (
        <div>{link.usageCount} 次</div>
      )
    },
    {
      key: 'actions',
      label: '操作 / Actions',
      render: (link: PaymentLink) => (
        <div className="flex gap-2">
          <Button 
            size="sm" 
            onClick={() => handleCopyLink(link.url)}
          >
            复制 / Copy
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => handleToggleStatus(link.id, link.status)}
          >
            {link.status === 'active' ? '停用 / Disable' : '激活 / Activate'}
          </Button>
        </div>
      )
    }
  ];

  if (!address) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Breadcrumb items={breadcrumbItems} />
        
        <Card className="mt-8 p-8 text-center">
          <div className="text-lg font-semibold mb-2">请连接钱包 / Connect Wallet</div>
          <div className="text-stone-600 mb-4">连接钱包后查看您的支付链接 / Connect wallet to view your payment links</div>
          <Link 
            to="/" 
            className="inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
          >
            返回首页 / Back to Home
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Breadcrumb items={breadcrumbItems} />
      
      <div className="mt-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">支付链接 / Links</h1>
          <p className="mt-2 text-stone-600">管理您的支付链接 / Manage your payment links</p>
        </div>
        
        <Link 
          to="/links/create"
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
        >
          创建新链接 / Create Link
        </Link>
      </div>

      <div className="mt-8">
        {/* 修复：DataTable 的 props 是 rows/columns（没有 data/keyField），
            列字段是 label（不是 header）—— 这个调用一直对不上组件签名 */}
        {links.length > 0 ? (
          <DataTable
            rows={links}
            columns={columns}
          />
        ) : (
          <Card className="p-8 text-center">
            <div className="text-lg font-semibold mb-2">暂无支付链接 / No links yet</div>
            <div className="text-stone-600 mb-4">创建您的第一个支付链接 / Create your first payment link</div>
            <Link 
              to="/links/create"
              className="inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
            >
              创建链接 / Create Link
            </Link>
          </Card>
        )}
      </div>
    </div>
  );
};