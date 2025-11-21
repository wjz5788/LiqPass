import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Dictionary } from '../types';

interface SuccessProps {
  t: Dictionary;
}

export const Success: React.FC = () => {
  // 模拟支付成功数据
  const paymentData = {
    id: 'PAY-2024-001',
    product: '24h',
    symbol: 'BTCUSDT',
    amount: 20,
    duration: 24,
    startTime: new Date().getTime(),
    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000).getTime()
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        {/* 成功图标 */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold">支付成功！/ Payment Successful</h1>
        <p className="mt-2 text-stone-600">您的保险已生效，感谢您的购买 / Your insurance is active. Thank you for purchasing.</p>
        
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* 支付详情 */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">支付详情 / Payment Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-stone-600">订单号 / Order ID</span>
                <span className="font-mono text-sm">{paymentData.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">产品 / Product</span>
                <span>{paymentData.product}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">交易对 / Symbol</span>
                <Badge>{paymentData.symbol}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">支付金额 / Amount</span>
                <span className="font-semibold text-amber-600">{paymentData.amount} USDC</span>
              </div>
            </div>
          </Card>
          
          {/* 保险信息 */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">保险信息 / Policy Info</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-stone-600">保险时长 / Duration</span>
                <span>{paymentData.duration} 小时</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">生效时间 / Start</span>
                <span>{new Date(paymentData.startTime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">到期时间 / End</span>
                <span>{new Date(paymentData.endTime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600">状态 / Status</span>
                <Badge variant="success">生效中</Badge>
              </div>
            </div>
          </Card>
        </div>
        
        {/* 操作按钮 */}
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link to="/">
            <Button variant="outline">返回首页 / Back to Home</Button>
          </Link>
          <Link to="/links">
            <Button>管理支付链接 / Manage Links</Button>
          </Link>
          <Button variant="outline">下载收据 / Download Receipt</Button>
        </div>
        
        {/* 后续步骤 */}
        <Card className="mt-8 p-6">
          <h3 className="font-semibold mb-3">后续步骤 / Next Steps</h3>
          <ul className="space-y-2 text-sm text-stone-600">
            <li>• 保险将在到期后自动失效 / Policy expires automatically at end</li>
            <li>• 如发生爆仓，理赔将自动处理 / Claims are processed automatically upon liquidation</li>
            <li>• 您可以在“订单管理 / Orders”页面查看详情 / View details on Orders</li>
            <li>• 如需帮助，请联系客服 / Contact support if needed</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};