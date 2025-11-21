import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../contexts/WalletContext';
import { useToast } from '../contexts/ToastContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { buildLink } from '../utils';

// 支付链接预览组件
function PaymentLinkPreview({ url, onCopy }: { url: string; onCopy: () => void }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-stone-600">{new URL(url).pathname}</div>
        <Badge>Link</Badge>
      </div>
      
      <div className="mt-4 grid gap-6">
        <Card className="p-4">
          <div className="text-sm text-stone-500">SKU</div>
          <div className="mt-1 text-base font-semibold">24h</div>
          <div className="mt-1 text-sm text-stone-600">BTCUSDT</div>
          <div className="mt-3 text-2xl font-extrabold">20 USDC</div>
        </Card>
        
        <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto]">
          <div className="break-all rounded-lg border border-stone-200 bg-stone-50 p-2 font-mono text-xs text-stone-700">
            {url}
          </div>
          <Button onClick={onCopy}>复制 / Copy</Button>
        </div>
      </div>
    </Card>
  );
}

export const Landing: React.FC = () => {
  const { message, setMessage, address, onBase } = useWallet();
  const { push } = useToast();
  const [linkUrl, setLinkUrl] = useState("");

  const createPaymentLink = () => {
    const url = buildLink("24h", "BTCUSDT", 20, 24);
    setLinkUrl(url);
    setMessage("已创建支付链接 / Payment link created");
    push({ title: "已创建支付链接 / Payment link created" });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(linkUrl);
      push({ title: t.copied });
    } catch {
      setMessage(linkUrl);
    }
  };

  return (
    <section className="relative mx-auto max-w-7xl px-4 py-16 sm:py-24">
      <div className="grid items-center gap-14 md:grid-cols-2">
        {/* 左侧内容 */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600 shadow-sm">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-600" />
            订单保障 / Order Protection
          </div>
          
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
            快速创建支付链接 / Create Payment Links Fast
          </h1>
          
          <p className="mt-4 max-w-xl text-stone-600">
            面向交易者的 24h 爆仓保 · 一键生成支付链接，便于分享与下单。
          </p>
          
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={createPaymentLink}>
              创建支付链接 / Create Link
            </Button>
            <Link 
              to="/links/create" 
              className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-50 transition-colors"
            >
              高级创建 / Advanced
            </Link>
          </div>
          
          {message && (
            <Card className="mt-4">
              <div className="text-sm text-stone-800">{message}</div>
            </Card>
          )}
          
          <div className="mt-4 text-xs text-stone-500">
            {address ? (
              <span>钱包已连接 / Wallet connected · Base: {onBase ? "是 / Yes" : "否 / No"}</span>
            ) : (
              <span>钱包未连接 / Wallet not connected</span>
            )}
          </div>
        </div>

        {/* 右侧预览 */}
        {linkUrl ? (
          <PaymentLinkPreview url={linkUrl} onCopy={copyToClipboard} />
        ) : (
          <Card>
            <div className="text-center text-stone-500 py-12">
              <div className="text-lg font-medium mb-2">预览区 / Preview</div>
              <div className="text-sm">点击“创建支付链接 / Create Link”生成预览</div>
            </div>
          </Card>
        )}
      </div>
    </section>
  );
};